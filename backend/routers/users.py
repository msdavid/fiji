from fastapi import APIRouter, HTTPException, Depends, status
import firebase_admin
from firebase_admin import firestore, auth # Added auth for token verification
import datetime

from models.user import UserCreateData, UserResponse
from models.invitation import InvitationResponse # To potentially fetch invitation details
from dependencies.auth import get_firebase_user # To verify the ID token from frontend

router = APIRouter(
    prefix="/users", # Using /users as a prefix, though register is a specific action
    tags=["users"]
)

# Firestore client
db = firestore.client()
USERS_COLLECTION = "users"
INVITATIONS_COLLECTION = "registrationInvitations"
ROLES_COLLECTION = "roles" # Though not directly used here, good to have for context

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user_with_invitation(
    registration_data: UserCreateData,
    # The get_firebase_user dependency will verify the ID token sent by the frontend
    # after it has successfully created the user in Firebase Authentication.
    # This token contains the new user's Firebase UID and email.
    firebase_user_claims: dict = Depends(get_firebase_user) 
):
    """
    Finalize user registration in the backend after Firebase Auth user creation.
    This endpoint is called by the frontend with a valid Firebase ID token for the new user.
    It validates the invitation token, creates the user profile in Firestore,
    assigns roles, and updates the invitation status.
    """
    try:
        firebase_uid = firebase_user_claims.get("uid")
        firebase_email = firebase_user_claims.get("email")

        if not firebase_uid or not firebase_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, # Or 401 if token is malformed from our perspective
                detail="Invalid Firebase ID token: UID or email missing."
            )

        # 1. Validate the invitation token
        invitation_query = db.collection(INVITATIONS_COLLECTION).where("token", "==", registration_data.invitationToken).where("status", "==", "pending").limit(1).stream()
        
        invitation_doc = None
        for doc in invitation_query: # Get the first (and should be only) document
            invitation_doc = doc
            break
        
        if not invitation_doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired invitation token."
            )
        
        invitation = invitation_doc.to_dict()

        # Ensure the email in the token matches the email in the invitation
        if invitation.get("email") != firebase_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invitation email does not match authenticated user's email."
            )

        # 2. Check if user already exists in Firestore (should not happen if logic is correct, but good safeguard)
        user_doc_ref = db.collection(USERS_COLLECTION).document(firebase_uid)
        if user_doc_ref.get().exists:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User with UID {firebase_uid} already exists in Firestore."
            )

        # 3. Create user document in Firestore
        new_user_data = {
            "uid": firebase_uid,
            "email": firebase_email,
            "firstName": registration_data.firstName,
            "lastName": registration_data.lastName,
            "assignedRoleIds": invitation.get("rolesToAssignOnRegistration", []),
            "status": "active", # User is active upon registration
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
            # Add other default fields as necessary
        }
        user_doc_ref.set(new_user_data)

        # 4. Update invitation status to "accepted"
        db.collection(INVITATIONS_COLLECTION).document(invitation_doc.id).update({
            "status": "accepted",
            "updatedAt": firestore.SERVER_TIMESTAMP
        })

        # 5. Retrieve and return the created user profile
        created_user_doc = user_doc_ref.get()
        if created_user_doc.exists:
            # Construct response, ensuring datetime fields are handled
            response_data = created_user_doc.to_dict()
            # For createdAt/updatedAt, they are server timestamps.
            # For the response, we might need to convert them if they aren't datetime objects yet.
            # Pydantic's orm_mode/from_attributes should handle this if Firestore returns datetime.
            # If not, manual conversion or fetching again might be needed for exact server time.
            # For now, assume Pydantic handles it or use client-side time for response.
            if 'createdAt' not in response_data or not isinstance(response_data['createdAt'], datetime.datetime):
                 response_data['createdAt'] = datetime.datetime.now(datetime.timezone.utc) # Placeholder
            if 'updatedAt' not in response_data or not isinstance(response_data['updatedAt'], datetime.datetime):
                 response_data['updatedAt'] = datetime.datetime.now(datetime.timezone.utc) # Placeholder

            return UserResponse(**response_data)
        else:
            # This case should ideally not happen
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve user profile after creation.")

    except HTTPException:
        raise # Re-raise FastAPI/custom HTTPExceptions
    except Exception as e:
        print(f"Error during user registration: {e}") # Log the error
        # Potentially rollback Firestore user creation if invitation update fails, though complex.
        # For now, a general error.
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred during registration: {str(e)}")
