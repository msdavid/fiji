from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional
import firebase_admin 
from firebase_admin import firestore
import datetime
import uuid
from google.cloud.firestore_v1.base_query import FieldFilter # Import FieldFilter

# Use relative imports from the 'backend' directory as root
from dependencies.database import get_db
from dependencies.auth import get_firebase_user
from models.invitation import InvitationCreate, InvitationResponse, InvitationStatusResponse
from routers.roles import verify_sysadmin_role 

# Router for admin-protected invitation actions
admin_router = APIRouter(
    prefix="/invitations",
    tags=["invitations-admin"],
    dependencies=[Depends(verify_sysadmin_role)]
)

# Router for public invitation actions
public_router = APIRouter(
    prefix="/invitations",
    tags=["invitations-public"]
)

INVITATIONS_COLLECTION = "registrationInvitations"
USERS_COLLECTION = "users"
ROLES_COLLECTION = "roles"

@public_router.get("/validate", response_model=InvitationStatusResponse)
async def validate_invitation_token(
    token: str = Query(..., description="The invitation token to validate."),
    db: firestore.Client = Depends(get_db)
):
    try:
        # Updated query
        invitations_ref = db.collection(INVITATIONS_COLLECTION)
        query = invitations_ref.where(filter=FieldFilter("token", "==", token)).limit(1)
        
        invitation_doc_snapshot = None
        for doc_snapshot in query.stream():
            invitation_doc_snapshot = doc_snapshot
            break
        
        if not invitation_doc_snapshot:
            return InvitationStatusResponse(valid=False, reason="Token not found.", email=None)
        
        invitation = invitation_doc_snapshot.to_dict()
        
        if invitation.get("status") != "pending":
            return InvitationStatusResponse(
                valid=False, 
                reason=f"Token has already been {invitation.get('status', 'processed')}.",
                email=invitation.get("email")
            )
        
        expires_at = invitation.get("expiresAt")
        if expires_at and isinstance(expires_at, datetime.datetime):
            if expires_at.tzinfo is None:
                 expires_at = expires_at.replace(tzinfo=datetime.timezone.utc)
            if datetime.datetime.now(datetime.timezone.utc) > expires_at:
                return InvitationStatusResponse(valid=False, reason="Token has expired.", email=invitation.get("email"))
        elif expires_at:
            print(f"Warning: expiresAt for token {token} is not a datetime object: {type(expires_at)}")

        return InvitationStatusResponse(valid=True, reason="Token is valid and pending.", email=invitation.get("email"))

    except Exception as e:
        print(f"Error validating invitation token {token}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error validating token.")


@admin_router.post("/", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_registration_invitation(
    invitation_data: InvitationCreate, 
    current_user: dict = Depends(get_firebase_user),
    db: firestore.Client = Depends(get_db)
):
    try:
        # 1. Check if a user with this email is already registered - Updated query
        users_ref = db.collection(USERS_COLLECTION)
        user_existence_query = users_ref.where(filter=FieldFilter("email", "==", invitation_data.email)).limit(1)
        if list(user_existence_query.stream()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with email '{invitation_data.email}' is already registered."
            )
        
        # 2. Check if an active (pending) invitation for this email already exists - Updated query
        invitations_ref = db.collection(INVITATIONS_COLLECTION)
        active_invitations_query = invitations_ref.where(filter=FieldFilter("email", "==", invitation_data.email)) \
                                                  .where(filter=FieldFilter("status", "==", "pending")) \
                                                  .limit(1)
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

        invited_by_user_id = current_user.get("uid")
        if not invited_by_user_id:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not identify inviting user.")

        token = str(uuid.uuid4()) 
        created_at_client = datetime.datetime.now(datetime.timezone.utc) 
        expires_at = created_at_client + datetime.timedelta(days=invitation_data.expiresInDays)

        new_invitation_dict = {
            "email": invitation_data.email,
            "rolesToAssignOnRegistration": invitation_data.rolesToAssignOnRegistration,
            "token": token,
            "status": "pending", 
            "invitedByUserId": invited_by_user_id,
            "createdAt": firestore.SERVER_TIMESTAMP, 
            "expiresAt": expires_at 
        }

        doc_ref = db.collection(INVITATIONS_COLLECTION).document() 
        doc_ref.set(new_invitation_dict)
        
        response_data = new_invitation_dict.copy()
        response_data["invitationId"] = doc_ref.id
        response_data["createdAt"] = created_at_client 
        
        return InvitationResponse(**response_data)

    except HTTPException: 
        raise 
    except Exception as e:
        print(f"Error creating invitation: {e}") 
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")