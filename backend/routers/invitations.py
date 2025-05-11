from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
import firebase_admin 
from firebase_admin import firestore # For firestore.SERVER_TIMESTAMP and type hinting Client
import datetime
import uuid

# Use absolute imports from 'backend'
from backend.dependencies.database import get_db
from backend.dependencies.auth import get_firebase_user
from backend.models.invitation import InvitationCreate, InvitationResponse
from backend.routers.roles import verify_sysadmin_role # verify_sysadmin_role is in roles.py

router = APIRouter(
    prefix="/invitations",
    tags=["invitations"],
    dependencies=[Depends(verify_sysadmin_role)]
)

INVITATIONS_COLLECTION = "registrationInvitations"
USERS_COLLECTION = "users"
ROLES_COLLECTION = "roles"

@router.post("/", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_registration_invitation(
    invitation_data: InvitationCreate, 
    current_user: dict = Depends(get_firebase_user),
    db: firestore.Client = Depends(get_db)
):
    try:
        users_query = db.collection(USERS_COLLECTION).where("email", "==", invitation_data.email).limit(1)
        if list(users_query.stream()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with email '{invitation_data.email}' is already registered."
            )
        
        active_invitations_query = db.collection(INVITATIONS_COLLECTION).where("email", "==", invitation_data.email).where("status", "==", "pending").limit(1)
        if list(active_invitations_query.stream()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"An active invitation for email '{invitation_data.email}' already exists."
            )

        if invitation_data.rolesToAssignOnRegistration:
            for role_id in invitation_data.rolesToAssignOnRegistration:
                role_doc_ref = db.collection(ROLES_COLLECTION).document(role_id)
                role_doc = role_doc_ref.get()
                if not role_doc.exists:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Role with ID '{role_id}' not found."
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

# Future endpoints for managing invitations (GET, DELETE) can be added here.