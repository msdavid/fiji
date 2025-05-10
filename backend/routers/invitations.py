from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
import firebase_admin
from firebase_admin import firestore
import datetime
import uuid # For generating unique tokens

from models.invitation import InvitationCreate, InvitationResponse
from dependencies.auth import get_firebase_user # For user authentication
from routers.roles import verify_sysadmin_role # Re-using the placeholder sysadmin check

router = APIRouter(
    prefix="/invitations",
    tags=["invitations"],
    dependencies=[Depends(verify_sysadmin_role)] # Protect all invitation routes
)

# Firestore client
db = firestore.client()
INVITATIONS_COLLECTION = "registrationInvitations"
USERS_COLLECTION = "users" # Needed to check if email is already registered
ROLES_COLLECTION = "roles" # Needed to validate rolesToAssign

@router.post("/", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_registration_invitation(
    invitation_data: InvitationCreate, 
    current_user: dict = Depends(get_firebase_user) # Get authenticated user to set invitedByUserId
):
    """
    Create a new registration invitation. Only accessible by users with sysadmin privileges.
    The actual email sending will be deferred to a later sprint.
    """
    try:
        # 1. Check if the email is already registered in the users collection
        users_query = db.collection(USERS_COLLECTION).where("email", "==", invitation_data.email).limit(1).stream()
        if any(users_query):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with email '{invitation_data.email}' is already registered or invited."
            )
        
        # 2. Check if an active invitation already exists for this email
        active_invitations_query = db.collection(INVITATIONS_COLLECTION).where("email", "==", invitation_data.email).where("status", "==", "pending").limit(1).stream()
        if any(active_invitations_query):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"An active invitation for email '{invitation_data.email}' already exists."
            )

        # 3. Validate that roles in rolesToAssignOnRegistration exist
        if invitation_data.rolesToAssignOnRegistration:
            for role_id in invitation_data.rolesToAssignOnRegistration:
                role_doc = db.collection(ROLES_COLLECTION).document(role_id).get()
                if not role_doc.exists:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Role with ID '{role_id}' not found."
                    )

        # 4. Prepare invitation data
        invited_by_user_id = current_user.get("uid")
        if not invited_by_user_id:
            # This should not happen if get_firebase_user is working correctly
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not identify inviting user.")

        token = str(uuid.uuid4()) # Generate a unique token
        created_at = datetime.datetime.now(datetime.timezone.utc)
        expires_at = created_at + datetime.timedelta(days=invitation_data.expiresInDays)

        new_invitation_dict = {
            "email": invitation_data.email,
            "rolesToAssignOnRegistration": invitation_data.rolesToAssignOnRegistration,
            "token": token,
            "status": "pending", # Initial status
            "invitedByUserId": invited_by_user_id,
            "createdAt": firestore.SERVER_TIMESTAMP, # Use server timestamp
            "expiresAt": expires_at # Store as datetime object, Firestore will convert to its timestamp
        }

        # 5. Create the invitation document in Firestore
        doc_ref = db.collection(INVITATIONS_COLLECTION).document()
        doc_ref.set(new_invitation_dict)
        
        # 6. Retrieve and return the created invitation
        created_invitation_doc = doc_ref.get()
        if created_invitation_doc.exists:
            # Note: Firestore SERVER_TIMESTAMP might not be immediately available on read-back
            # For response, we might use the client-generated `created_at` or re-fetch if exact server time is critical.
            # For simplicity, we'll construct the response using the data we have.
            response_data = created_invitation_doc.to_dict()
            # Ensure datetime fields are actual datetime for the response model
            response_data["createdAt"] = created_at 
            response_data["expiresAt"] = expires_at
            return InvitationResponse(invitationId=created_invitation_doc.id, **response_data)
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve invitation after creation.")

    except HTTPException:
        raise # Re-raise HTTPException to ensure FastAPI handles it
    except Exception as e:
        print(f"Error creating invitation: {e}") # Log the error
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

# Future endpoints for managing invitations (GET, DELETE) can be added here.