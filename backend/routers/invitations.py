from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
import firebase_admin 
from firebase_admin import firestore # For firestore.SERVER_TIMESTAMP and type hinting Client
import datetime
import uuid

# Use relative imports from the 'backend' directory as root
from dependencies.database import get_db
from dependencies.auth import get_firebase_user
from models.invitation import InvitationCreate, InvitationResponse
from routers.roles import verify_sysadmin_role # verify_sysadmin_role is in roles.py

router = APIRouter(
    prefix="/invitations",
    tags=["invitations"],
    dependencies=[Depends(verify_sysadmin_role)] # Apply sysadmin check to all routes in this router
)

INVITATIONS_COLLECTION = "registrationInvitations"
USERS_COLLECTION = "users" # To check if user already exists
ROLES_COLLECTION = "roles" # To validate roles being assigned

@router.post("/", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_registration_invitation(
    invitation_data: InvitationCreate, 
    current_user: dict = Depends(get_firebase_user), # Gets UID of the admin creating the invitation
    db: firestore.Client = Depends(get_db)
):
    try:
        # 1. Check if a user with this email is already registered
        users_query = db.collection(USERS_COLLECTION).where("email", "==", invitation_data.email).limit(1)
        if list(users_query.stream()): # If query returns any documents
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with email '{invitation_data.email}' is already registered."
            )
        
        # 2. Check if an active (pending) invitation for this email already exists
        active_invitations_query = db.collection(INVITATIONS_COLLECTION).where("email", "==", invitation_data.email).where("status", "==", "pending").limit(1)
        if list(active_invitations_query.stream()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"An active invitation for email '{invitation_data.email}' already exists."
            )

        # 3. Validate that roles to be assigned actually exist
        if invitation_data.rolesToAssignOnRegistration:
            for role_id in invitation_data.rolesToAssignOnRegistration:
                role_doc_ref = db.collection(ROLES_COLLECTION).document(role_id)
                role_doc = role_doc_ref.get()
                if not role_doc.exists:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Role with ID '{role_id}' not found. Cannot assign non-existent role."
                    )

        # 4. Prepare invitation data
        invited_by_user_id = current_user.get("uid")
        if not invited_by_user_id:
            # This should not happen if get_firebase_user and verify_sysadmin_role work correctly
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not identify inviting user.")

        token = str(uuid.uuid4()) # Generate a unique token
        created_at_client = datetime.datetime.now(datetime.timezone.utc) # For immediate response
        expires_at = created_at_client + datetime.timedelta(days=invitation_data.expiresInDays)

        new_invitation_dict = {
            "email": invitation_data.email,
            "rolesToAssignOnRegistration": invitation_data.rolesToAssignOnRegistration,
            "token": token,
            "status": "pending", # Initial status
            "invitedByUserId": invited_by_user_id,
            "createdAt": firestore.SERVER_TIMESTAMP, # Use server timestamp for consistency
            "expiresAt": expires_at # Store as datetime object, Firestore will convert to its Timestamp type
        }

        # 5. Save to Firestore
        doc_ref = db.collection(INVITATIONS_COLLECTION).document() # Auto-generate ID
        doc_ref.set(new_invitation_dict)
        
        # 6. Prepare response (use client-generated createdAt for immediate response consistency)
        # The actual stored createdAt will be the server timestamp.
        response_data = new_invitation_dict.copy()
        response_data["invitationId"] = doc_ref.id
        response_data["createdAt"] = created_at_client # Use client-side timestamp for response
        
        return InvitationResponse(**response_data)

    except HTTPException: # Re-raise HTTPExceptions directly
        raise 
    except Exception as e:
        print(f"Error creating invitation: {e}") # Log for debugging
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

# Future endpoints for managing invitations (GET all, GET specific, DELETE/revoke) can be added here.
# For example, GET /invitations/ to list all pending invitations.
# Or DELETE /invitations/{invitation_id} to revoke an invitation.