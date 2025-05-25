from fastapi import APIRouter, HTTPException, Depends, status, Request
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional, Dict, Set
import re
from firebase_admin import auth, firestore
# Removed datetime import as timezone is now used with firestore.SERVER_TIMESTAMP

from models.user import UserResponse
from models.invitation import InvitationValidateResponse
from dependencies.database import get_db
from services.two_factor_service import TwoFactorService
from services.session_service import SessionService # Added SessionService import

USERS_COLLECTION = "users"
ROLES_COLLECTION = "roles"
INVITATIONS_COLLECTION = "registrationInvitations"
ASSIGNMENTS_COLLECTION = "assignments"
WORKING_GROUPS_COLLECTION = "workingGroups"
GLOBAL_WG_ID = "organization-wide"  # Fixed ID for the global working group


router = APIRouter(
    prefix="/auth",
    tags=["authentication"]
)

# Helper function (can be moved to a common utils later)
def get_client_info(request: Request) -> tuple[Optional[str], Optional[str]]:
    """Extract client IP and User-Agent from request"""
    ip_address = (
        request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or
        request.headers.get("X-Real-IP") or
        request.client.host if request.client else None
    )
    user_agent = request.headers.get("User-Agent")
    return ip_address, user_agent

# Removed local _create_backend_session_token placeholder

class SessionLoginRequest(BaseModel):
    firebase_id_token: str
    device_fingerprint: Optional[str] = None

class SessionLoginResponse(BaseModel):
    requires_2fa: bool
    backend_session_token: Optional[str] = None
    message: Optional[str] = None


@router.post("/session-login", response_model=SessionLoginResponse)
async def session_login(
    login_request: SessionLoginRequest,
    request: Request,
    db: firestore.AsyncClient = Depends(get_db)
):
    try:
        decoded_token = auth.verify_id_token(login_request.firebase_id_token, check_revoked=True)
    except auth.RevokedIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Firebase ID token has been revoked.")
    except auth.UserDisabledError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account has been disabled.")
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase ID token.")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error verifying Firebase token: {str(e)}")

    user_id = decoded_token.get("uid")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="UID not found in Firebase token.")

    ip_address, user_agent = get_client_info(request)
    two_factor_service = TwoFactorService(db)
    session_service = SessionService(db) # Instantiate SessionService

    device_fingerprint = login_request.device_fingerprint
    if not device_fingerprint:
        device_fingerprint = TwoFactorService.create_device_fingerprint(user_agent, ip_address)

    trusted_device = await two_factor_service.check_device_trust(user_id, device_fingerprint)

    if trusted_device:
        # Use SessionService to create token (which also updates lastLoginAt)
        backend_token = await session_service.create_session_token(user_id)
        return SessionLoginResponse(
            requires_2fa=False,
            backend_session_token=backend_token,
            message="Login successful. Device trusted."
        )
    else:
        return SessionLoginResponse(
            requires_2fa=True,
            message="Device not trusted. Two-factor authentication required."
        )


class RegistrationPayload(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    firstName: str = Field(..., min_length=1)
    lastName: str = Field(..., min_length=1)
    invitationToken: str

    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """
        Validate password meets security requirements:
        - At least 8 characters
        - At least one uppercase letter
        - At least one lowercase letter
        - At least one digit
        - At least one special character
        """
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)')
        
        return v

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

async def _assign_user_to_global_working_group(db: firestore.AsyncClient, user_id: str) -> None:
    """
    Automatically assign a new user to the global 'Organization Wide' working group.
    This ensures all users can see and participate in global events.
    """
    try:
        # Check if the global working group exists
        global_wg_ref = db.collection(WORKING_GROUPS_COLLECTION).document(GLOBAL_WG_ID)
        global_wg_doc = await global_wg_ref.get()
        
        if not global_wg_doc.exists:
            print(f"Warning: Global working group '{GLOBAL_WG_ID}' does not exist. Skipping auto-assignment.")
            return
        
        # Check if user is already assigned to avoid duplicates
        existing_assignment_query = db.collection(ASSIGNMENTS_COLLECTION)\
            .where("userId", "==", user_id)\
            .where("assignableId", "==", GLOBAL_WG_ID)\
            .where("assignableType", "==", "workingGroup")\
            .limit(1)
        
        existing_assignments = await existing_assignment_query.get()
        
        if existing_assignments:
            print(f"User {user_id} already assigned to global working group")
            return
        
        # Create the assignment
        assignment_data = {
            "userId": user_id,
            "assignableId": GLOBAL_WG_ID,
            "assignableType": "workingGroup",
            "status": "active",  # Auto-active for global WG
            "role": "member",
            "notes": "Automatically assigned to organization-wide working group during registration",
            "assignedByUserId": "system",
            "assignmentDate": firestore.SERVER_TIMESTAMP,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP
        }
        
        assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document()
        await assignment_ref.set(assignment_data)
        
        print(f"✅ Successfully assigned user {user_id} to global working group")
        
    except Exception as e:
        print(f"Warning: Failed to assign user {user_id} to global working group: {str(e)}")
        # Don't fail registration if global WG assignment fails

async def _validate_invitation_for_registration(token: str, db: firestore.AsyncClient) -> Optional[dict]:
    from datetime import datetime, timezone # Moved import here as it's only used here now
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

    # Automatically assign new user to the global working group
    await _assign_user_to_global_working_group(db, firebase_user.uid)

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
    user_response_data["id"] = final_user_doc.id 
    
    user_response_data["assignedRoleNames"] = await _get_role_names_for_auth(db, assigned_role_ids)
    
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
    
    default_user_in_db_fields = {
        "phone": None, "emergencyContactDetails": None, "skills": [],
        "qualifications": [], "preferences": None, "profilePictureUrl": None,
        "notes": None, "availability": { "general_rules": [], "specific_slots": [] },
        "lastLoginAt": None
    }
    for field, default_value in default_user_in_db_fields.items():
        if field not in user_response_data:
            user_response_data[field] = default_value
            
    if "status" not in user_response_data:
        user_response_data["status"] = "active"

    return UserResponse(**user_response_data)
