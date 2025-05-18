from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from firebase_admin import auth, firestore
from datetime import datetime, timezone # Ensure timezone is imported

# Assuming models for UserResponse and Role might be needed or can be simplified for this response
from models.user import UserResponse # For the final response structure
from models.invitation import InvitationValidateResponse # For internal validation structure
from dependencies.database import get_db
# We might not need RBAC for public registration, but db access is essential
# from dependencies.rbac import RBACUser, get_current_user_with_rbac 

# Collections
USERS_COLLECTION = "users"
ROLES_COLLECTION = "roles" # Needed if we resolve role names for UserResponse
INVITATIONS_COLLECTION = "registrationInvitations"


router = APIRouter(
    prefix="/auth",
    tags=["authentication"]
)

class RegistrationPayload(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    firstName: str = Field(..., min_length=1)
    lastName: str = Field(..., min_length=1)
    invitationToken: str


# --- Helper function to validate token (similar to GET /invitations/validate) ---
# This could be refactored into a shared utility if used in multiple places.
async def _validate_invitation_for_registration(token: str, db: firestore.AsyncClient) -> Optional[dict]:
    """
    Validates an invitation token specifically for the registration process.
    Returns the invitation data if valid and pending, otherwise None or raises HTTPException.
    """
    if not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation token is required.")

    invitations_query = db.collection(INVITATIONS_COLLECTION).where("token", "==", token).limit(1)
    invitation_docs_snap = await invitations_query.get()

    if not invitation_docs_snap:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired invitation token.")

    invitation_doc = invitation_docs_snap[0]
    invitation_data = invitation_doc.to_dict()
    invitation_data["id"] = invitation_doc.id # Add document ID to data

    if invitation_data.get("status") != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation has already been used or revoked.")

    expires_at = invitation_data.get("expiresAt")
    if not isinstance(expires_at, datetime):
        print(f"Warning: Invitation {invitation_doc.id} has invalid expiresAt field: {expires_at}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invitation has an invalid expiration date format.")
    
    if expires_at.tzinfo is None: # Ensure timezone aware for comparison
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        # Optionally update status to 'expired' in DB here
        await db.collection(INVITATIONS_COLLECTION).document(invitation_doc.id).update({"status": "expired", "updatedAt": firestore.SERVER_TIMESTAMP})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation token has expired.")

    return invitation_data


@router.post("/register-with-invitation", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user_with_invitation(
    payload: RegistrationPayload,
    db: firestore.AsyncClient = Depends(get_db)
):
    """
    Registers a new user based on a valid invitation token.
    - Validates the invitation token.
    - Creates the user in Firebase Authentication.
    - Creates the user profile in Firestore with pre-assigned roles.
    - Marks the invitation as accepted.
    """
    
    # 1. Validate the invitation token
    invitation_data = await _validate_invitation_for_registration(payload.invitationToken, db)
    
    # Ensure the email from the token matches the payload email (security check)
    if not invitation_data or invitation_data.get("email", "").lower() != payload.email.lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email does not match the invitation.")

    # 2. Create user in Firebase Authentication
    try:
        firebase_user = auth.create_user(
            email=payload.email,
            password=payload.password,
            display_name=f"{payload.firstName} {payload.lastName}",
            email_verified=False # Typically, send a verification email post-registration
        )
    except auth.EmailAlreadyExistsError:
        # This should ideally be caught by admin create/invite checks, but good to have a safeguard
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists in Firebase Authentication.")
    except Exception as e:
        print(f"Error creating user in Firebase Auth: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create user authentication: {str(e)}")

    # 3. Create user profile in Firestore
    assigned_role_ids = invitation_data.get("assignedRoleIds", [])
    if not isinstance(assigned_role_ids, list): # Ensure it's a list
        assigned_role_ids = []
        
    # Ensure 'sysadmin' or other default roles are handled correctly if needed
    # For example, if no roles are pre-assigned, assign a default 'member' role.
    # if not assigned_role_ids:
    #     assigned_role_ids.append("default_member_role_id") 

    firestore_user_data = {
        "email": payload.email.lower(),
        "firstName": payload.firstName,
        "lastName": payload.lastName,
        "status": "active", # Or "pending_email_verification"
        "assignedRoleIds": assigned_role_ids,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
        "skills": [],
        "qualifications": [],
        "preferences": None,
        "emergencyContactDetails": None,
        "profilePictureUrl": None,
        "notes": None,
        "availability": { "general_rules": [], "specific_slots": [] }, # Default empty availability
        "lastLoginAt": None,
    }

    try:
        user_doc_ref = db.collection(USERS_COLLECTION).document(firebase_user.uid)
        await user_doc_ref.set(firestore_user_data)
    except Exception as e:
        # Critical failure: User created in Auth but not in Firestore. Attempt to clean up Auth user.
        print(f"Error creating user profile in Firestore for UID {firebase_user.uid}: {e}")
        try:
            auth.delete_user(firebase_user.uid)
            print(f"Successfully cleaned up Firebase Auth user {firebase_user.uid} due to Firestore save failure.")
        except Exception as cleanup_e:
            print(f"CRITICAL ERROR: Failed to cleanup Firebase Auth user {firebase_user.uid} after Firestore save failure: {cleanup_e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save user profile after authentication creation.")

    # 4. Update invitation status
    try:
        invitation_doc_id = invitation_data["id"] # Get ID from validated data
        await db.collection(INVITATIONS_COLLECTION).document(invitation_doc_id).update({
            "status": "accepted",
            "acceptedByUserId": firebase_user.uid,
            "updatedAt": firestore.SERVER_TIMESTAMP
        })
    except Exception as e:
        # Non-critical for user creation, but log it. User is created.
        print(f"Warning: Failed to update invitation status for token {payload.invitationToken} / ID {invitation_data.get('id')}: {e}")

    # 5. Prepare and return response (similar to GET /users/{user_id})
    # Fetch the newly created user document to ensure all fields (like timestamps) are resolved
    final_user_doc = await user_doc_ref.get()
    if not final_user_doc.exists:
        # Should not happen if Firestore set was successful
        raise HTTPException(status_code=500, detail="Failed to retrieve newly created user profile.")

    user_response_data = final_user_doc.to_dict()
    user_response_data["id"] = final_user_doc.id
    
    # Populate assignedRoleNames, privileges, isSysadmin for the UserResponse model
    # (This logic can be extracted to a shared utility function)
    user_response_data["assignedRoleNames"] = [] # Placeholder, implement _get_role_names if needed here
    user_response_data["privileges"] = {} # Placeholder
    user_response_data["isSysadmin"] = "sysadmin" in assigned_role_ids

    # TODO: Properly populate assignedRoleNames and privileges for the UserResponse
    # This might involve fetching role details again. For now, returning basic info.
    # For a full UserResponse, you'd need to call logic similar to get_user or get_current_user_with_rbac

    return UserResponse(**user_response_data)
