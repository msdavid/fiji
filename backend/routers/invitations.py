from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks, Query
from typing import List, Optional
from firebase_admin import firestore, auth
from datetime import datetime, timedelta, timezone # Added timezone

from models.invitation import InvitationCreate, InvitationResponse, InvitationListResponse, InvitationValidateResponse
from dependencies.database import get_db
from dependencies.rbac import RBACUser, get_current_user_with_rbac, require_permission
from utils.token_generator import generate_secure_token
# from utils.email_sender import send_invitation_email 

admin_router = APIRouter(
    prefix="/admin/invitations", 
    tags=["invitations-admin"]
)

public_router = APIRouter(
    prefix="/invitations", 
    tags=["invitations-public"]
)

INVITATIONS_COLLECTION = "registrationInvitations"
USERS_COLLECTION = "users"

async def send_invitation_email_placeholder(email_to: str, token: str, inviter_name: Optional[str]):
    registration_link = f"http://localhost:3000/register?token={token}" 
    print(f"--- SIMULATING SENDING INVITATION EMAIL ---")
    print(f"To: {email_to}")
    if inviter_name:
        print(f"From: {inviter_name} (via Fiji Platform)")
    else:
        print(f"From: Fiji Platform")
    print(f"Subject: You're invited to join Fiji Platform!")
    print(f"Body: Please register using the following link: {registration_link}")
    print(f"This link will expire in 7 days.")
    print(f"Token (for testing/manual use): {token}")
    print(f"--- END OF SIMULATED EMAIL ---")

@admin_router.post( 
    "/",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("invitations", "create"))]
)
async def create_invitation(
    invitation_data: InvitationCreate,
    background_tasks: BackgroundTasks,
    db: firestore.AsyncClient = Depends(get_db),
    current_admin_user: RBACUser = Depends(get_current_user_with_rbac)
):
    target_email_lower = invitation_data.email.lower()

    try:
        auth.get_user_by_email(target_email_lower)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A user with email '{invitation_data.email}' is already registered."
        )
    except auth.UserNotFoundError:
        pass 

    existing_invitation_query = db.collection(INVITATIONS_COLLECTION)\
        .where("email", "==", target_email_lower)\
        .where("status", "==", "pending")\
        .limit(1)
    
    existing_invitations_snap = await existing_invitation_query.get() # Renamed for clarity
    if existing_invitations_snap: # Check if the list is not empty
        for inv_doc in existing_invitations_snap:
            inv = inv_doc.to_dict()
            expires_at_dt = inv.get("expiresAt")
            # Ensure expires_at_dt is a datetime object and make it timezone-aware (UTC) for comparison
            if isinstance(expires_at_dt, datetime):
                if expires_at_dt.tzinfo is None:
                    expires_at_dt = expires_at_dt.replace(tzinfo=timezone.utc)
                if expires_at_dt > datetime.now(timezone.utc): # Compare timezone-aware datetimes
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"A pending invitation already exists for '{invitation_data.email}' and has not expired yet."
                    )

    token = generate_secure_token(32)
    # Store expires_at as UTC datetime object
    expires_at = datetime.now(timezone.utc) + timedelta(days=7) 

    invitation_doc_id = db.collection(INVITATIONS_COLLECTION).document().id
    
    new_invitation_data = {
        "id": invitation_doc_id,
        "email": target_email_lower,
        "token": token, 
        "status": "pending",
        "assignedRoleIds": invitation_data.assignedRoleIds or [],
        "createdByUserId": current_admin_user.uid, 
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
        "expiresAt": expires_at 
    }

    try:
        await db.collection(INVITATIONS_COLLECTION).document(invitation_doc_id).set(new_invitation_data)
        
        created_doc_snap = await db.collection(INVITATIONS_COLLECTION).document(invitation_doc_id).get()
        if not created_doc_snap.exists:
             raise HTTPException(status_code=500, detail="Failed to retrieve invitation after creation.")
        
        response_data = created_doc_snap.to_dict()
        response_data['id'] = created_doc_snap.id 
        
        inviter_name = f"{current_admin_user.first_name} {current_admin_user.last_name}".strip() or current_admin_user.email
        background_tasks.add_task(send_invitation_email_placeholder, target_email_lower, token, inviter_name)
        
        return InvitationResponse(**response_data)

    except Exception as e:
        print(f"Error creating invitation: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@admin_router.get(
    "/",
    response_model=List[InvitationListResponse],
    dependencies=[Depends(require_permission("invitations", "list"))]
)
async def list_invitations(
    db: firestore.AsyncClient = Depends(get_db),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter invitations by status (e.g., pending, accepted, expired, revoked)."),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0) 
):
    try:
        query = db.collection(INVITATIONS_COLLECTION).order_by("createdAt", direction=firestore.Query.DESCENDING)

        if status_filter:
            query = query.where("status", "==", status_filter)
        
        all_invitations_stream = query.stream()
        invitations_list = []
        
        current_offset = 0
        docs_processed_for_limit = 0

        async for doc in all_invitations_stream:
            if current_offset < offset:
                current_offset += 1
                continue
            
            if docs_processed_for_limit < limit:
                inv_data = doc.to_dict()
                inv_data['id'] = doc.id 
                
                if 'createdByUserId' not in inv_data or not inv_data['createdByUserId']:
                    inv_data['createdByUserId'] = "unknown_creator" 
                    print(f"Warning: Invitation document {doc.id} is missing 'createdByUserId'.")
                
                try:
                    invitations_list.append(InvitationListResponse(**inv_data))
                except Exception as pydantic_error:
                    print(f"Pydantic validation error for doc {doc.id}: {pydantic_error}. Data: {inv_data}")
                    continue 

                docs_processed_for_limit += 1
            else:
                break 
                
        return invitations_list
    except Exception as e:
        print(f"Error listing invitations: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@admin_router.delete(
    "/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("invitations", "delete"))]
)
async def revoke_invitation(
    invitation_id: str,
    db: firestore.AsyncClient = Depends(get_db)
):
    invitation_doc_ref = db.collection(INVITATIONS_COLLECTION).document(invitation_id)
    invitation_doc = await invitation_doc_ref.get()

    if not invitation_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found.")

    invitation_data = invitation_doc.to_dict()
    if invitation_data.get("status") != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Only pending invitations can be revoked. Current status: {invitation_data.get('status')}")

    try:
        await invitation_doc_ref.update({
            "status": "revoked",
            "updatedAt": firestore.SERVER_TIMESTAMP
        })
    except Exception as e:
        print(f"Error revoking invitation {invitation_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")
    
    return 

@public_router.get(
    "/validate", 
    response_model=InvitationValidateResponse
)
async def validate_invitation_token(
    token: str = Query(..., description="The invitation token to validate."),
    db: firestore.AsyncClient = Depends(get_db)
):
    """
    Validates an invitation token.
    Checks if the token exists, is pending, and has not expired.
    """
    if not token:
        return InvitationValidateResponse(isValid=False, message="Token is required.")

    invitations_query = db.collection(INVITATIONS_COLLECTION).where("token", "==", token).limit(1)
    invitation_docs_snap = await invitations_query.get()

    if not invitation_docs_snap:
        return InvitationValidateResponse(isValid=False, message="Invitation token not found.")

    invitation_doc = invitation_docs_snap[0] # Get the first document
    invitation_data = invitation_doc.to_dict()

    if invitation_data.get("status") != "pending":
        return InvitationValidateResponse(isValid=False, message=f"Invitation is no longer valid (status: {invitation_data.get('status')}).")

    expires_at = invitation_data.get("expiresAt")
    if not isinstance(expires_at, datetime):
        # This case should ideally not happen if data is saved correctly
        print(f"Warning: Invitation {invitation_doc.id} has invalid expiresAt field: {expires_at}")
        return InvitationValidateResponse(isValid=False, message="Invitation has an invalid expiration date format.")

    # Ensure expires_at is timezone-aware (UTC) for comparison
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        # Optionally, update status to 'expired' in DB here or via a scheduled job
        # For now, just return invalid
        # await db.collection(INVITATIONS_COLLECTION).document(invitation_doc.id).update({"status": "expired", "updatedAt": firestore.SERVER_TIMESTAMP})
        return InvitationValidateResponse(isValid=False, message="Invitation token has expired.")

    # Token is valid, pending, and not expired
    return InvitationValidateResponse(
        isValid=True,
        message="Invitation token is valid.",
        email=invitation_data.get("email"),
        assignedRoleIds=invitation_data.get("assignedRoleIds")
    )
