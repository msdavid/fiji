from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Set 
from firebase_admin import auth, firestore
from datetime import datetime, timezone 

from models.user import UserResponse 
from models.invitation import InvitationValidateResponse 
from dependencies.database import get_db

USERS_COLLECTION = "users"
ROLES_COLLECTION = "roles" 
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

async def _get_role_names_for_auth(db: firestore.AsyncClient, role_ids: List[str]) -> List[str]:
    role_names = []
    if not isinstance(role_ids, list): 
        return role_names
    for role_id in role_ids:
        role_doc = await db.collection(ROLES_COLLECTION).document(role_id).get()
        if role_doc.exists:
            role_data = role_doc.to_dict()
            role_names.append(role_data.get("roleName", role_id)) 
        else:
            role_names.append(role_id) 
    return role_names

async def _validate_invitation_for_registration(token: str, db: firestore.AsyncClient) -> Optional[dict]:
    if not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation token is required.")

    invitations_query = db.collection(INVITATIONS_COLLECTION).where("token", "==", token).limit(1)
    invitation_docs_snap = await invitations_query.get()

    if not invitation_docs_snap:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired invitation token.")

    invitation_doc = invitation_docs_snap[0]
    invitation_data = invitation_doc.to_dict()
    invitation_data["id"] = invitation_doc.id 

    if invitation_data.get("status") != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation has already been used or revoked.")

    expires_at = invitation_data.get("expiresAt")
    if not isinstance(expires_at, datetime):
        print(f"Warning: Invitation {invitation_doc.id} has invalid expiresAt field: {expires_at}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invitation has an invalid expiration date format.")
    
    if expires_at.tzinfo is None: 
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await db.collection(INVITATIONS_COLLECTION).document(invitation_doc.id).update({"status": "expired", "updatedAt": firestore.SERVER_TIMESTAMP})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation token has expired.")

    return invitation_data


@router.post("/register-with-invitation", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user_with_invitation(
    payload: RegistrationPayload,
    db: firestore.AsyncClient = Depends(get_db)
):
    invitation_data = await _validate_invitation_for_registration(payload.invitationToken, db)
    
    if not invitation_data or invitation_data.get("email", "").lower() != payload.email.lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email does not match the invitation.")

    try:
        firebase_user = auth.create_user(
            email=payload.email,
            password=payload.password,
            display_name=f"{payload.firstName} {payload.lastName}",
            email_verified=False 
        )
    except auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists in Firebase Authentication.")
    except Exception as e:
        print(f"Error creating user in Firebase Auth: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create user authentication: {str(e)}")

    assigned_role_ids = invitation_data.get("assignedRoleIds", [])
    if not isinstance(assigned_role_ids, list):
        assigned_role_ids = []
        
    firestore_user_data = {
        "email": payload.email.lower(),
        "firstName": payload.firstName,
        "lastName": payload.lastName,
        "status": "active", 
        "assignedRoleIds": assigned_role_ids,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
        "skills": [], "qualifications": [], "preferences": None,
        "emergencyContactDetails": None, "profilePictureUrl": None, "notes": None,
        "availability": { "general_rules": [], "specific_slots": [] }, 
        "lastLoginAt": None,
    }

    user_doc_ref = db.collection(USERS_COLLECTION).document(firebase_user.uid)
    try:
        await user_doc_ref.set(firestore_user_data)
    except Exception as e:
        print(f"Error creating user profile in Firestore for UID {firebase_user.uid}: {e}")
        try:
            auth.delete_user(firebase_user.uid)
            print(f"Successfully cleaned up Firebase Auth user {firebase_user.uid} due to Firestore save failure.")
        except Exception as cleanup_e:
            print(f"CRITICAL ERROR: Failed to cleanup Firebase Auth user {firebase_user.uid} after Firestore save failure: {cleanup_e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save user profile after authentication creation.")

    try:
        invitation_doc_id = invitation_data["id"] 
        await db.collection(INVITATIONS_COLLECTION).document(invitation_doc_id).update({
            "status": "accepted",
            "acceptedByUserId": firebase_user.uid,
            "updatedAt": firestore.SERVER_TIMESTAMP
        })
    except Exception as e:
        print(f"Warning: Failed to update invitation status for token {payload.invitationToken} / ID {invitation_data.get('id')}: {e}")

    final_user_doc = await user_doc_ref.get()
    if not final_user_doc.exists:
        raise HTTPException(status_code=500, detail="Failed to retrieve newly created user profile.")

    user_response_data = final_user_doc.to_dict()
    user_response_data["id"] = final_user_doc.id # UID from Firebase Auth
    
    # Populate assignedRoleNames
    user_response_data["assignedRoleNames"] = await _get_role_names_for_auth(db, assigned_role_ids)
    
    # Calculate privileges and isSysadmin
    is_sysadmin = "sysadmin" in assigned_role_ids
    consolidated_privileges: Dict[str, Set[str]] = {}

    if not is_sysadmin and assigned_role_ids:
        for role_id in assigned_role_ids:
            role_doc_ref = db.collection(ROLES_COLLECTION).document(role_id)
            role_doc = await role_doc_ref.get()
            if role_doc.exists:
                role_data = role_doc.to_dict()
                privileges_for_role = role_data.get("privileges", {})
                for resource, actions in privileges_for_role.items():
                    if not isinstance(actions, list): continue
                    if resource not in consolidated_privileges:
                        consolidated_privileges[resource] = set()
                    consolidated_privileges[resource].update(actions)
    
    user_response_data["privileges"] = {resource: list(actions) for resource, actions in consolidated_privileges.items()}
    user_response_data["isSysadmin"] = is_sysadmin
    
    # Ensure all fields required by UserResponse are present, providing defaults if necessary
    # This loop ensures that fields defined in UserInDBBase (parent of UserResponse)
    # but not explicitly set during firestore_user_data creation are defaulted.
    default_user_in_db_fields = {
        "phone": None, "emergencyContactDetails": None, "skills": [], 
        "qualifications": [], "preferences": None, "profilePictureUrl": None, 
        "notes": None, "availability": { "general_rules": [], "specific_slots": [] },
        "lastLoginAt": None
    }
    for field, default_value in default_user_in_db_fields.items():
        if field not in user_response_data:
            user_response_data[field] = default_value
            
    # Ensure status is present (it should be from firestore_user_data)
    if "status" not in user_response_data:
        user_response_data["status"] = "active" # Fallback status

    return UserResponse(**user_response_data)
