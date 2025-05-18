import os # Added for FRONTEND_URL
from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks, Query
from typing import List, Optional
from firebase_admin import firestore, auth
from datetime import datetime, timedelta, timezone 

from models.invitation import InvitationCreate, InvitationResponse, InvitationListResponse, InvitationValidateResponse
from dependencies.database import get_db
from dependencies.rbac import RBACUser, get_current_user_with_rbac, require_permission
from utils.token_generator import generate_secure_token
from services.email_service import EmailService # Import EmailService

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
ROLES_COLLECTION = "roles" 

# Initialize EmailService instance
# For a production app, consider FastAPI dependency injection for EmailService
try:
    email_service = EmailService()
except ValueError as e:
    print(f"Failed to initialize EmailService: {e}. Email sending will be disabled.")
    email_service = None

# Get Frontend URL from environment variable, with a default
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

async def send_actual_invitation_email(
    email_to: str, 
    token: str, 
    inviter_name: Optional[str],
    service_instance: Optional[EmailService] # Make service_instance optional to handle initialization failure
    ):
    if not service_instance:
        print(f"EmailService not available. Skipping email to {email_to}.")
        # Fallback to placeholder logic or just log
        print(f"--- SIMULATING SENDING INVITATION EMAIL (EmailService disabled) ---")
        registration_link_placeholder = f"{FRONTEND_URL}/register?token={token}"
        print(f"To: {email_to}")
        if inviter_name:
            print(f"From: {inviter_name} (via Fiji Platform)")
        else:
            print(f"From: Fiji Platform")
        print(f"Subject: You're invited to join Fiji Platform!")
        print(f"Body: Please register using the following link: {registration_link_placeholder}")
        print(f"This link will expire in 7 days.")
        print(f"Token (for testing/manual use): {token}")
        print(f"--- END OF SIMULATED EMAIL ---")
        return

    registration_link = f"{FRONTEND_URL}/register?token={token}"
    
    subject = "You're invited to join Fiji Platform!"
    
    html_content = f"""
    <html>
        <body>
            <p>Hello,</p>
            <p>You have been invited to join the Fiji Platform by {inviter_name if inviter_name else 'the Fiji team'}.</p>
            <p>Please click the link below to register:</p>
            <p><a href="{registration_link}">{registration_link}</a></p>
            <p>This link will expire in 7 days.</p>
            <p>If you were not expecting this invitation, please ignore this email.</p>
            <p>Thanks,<br>The Fiji Platform Team</p>
        </body>
    </html>
    """
    
    text_content = f"""
    Hello,

    You have been invited to join the Fiji Platform by {inviter_name if inviter_name else 'the Fiji team'}.

    Please use the following link to register:
    {registration_link}

    This link will expire in 7 days.

    If you were not expecting this invitation, please ignore this email.

    Thanks,
    The Fiji Platform Team
    """

    print(f"Attempting to send actual invitation email to: {email_to} via Mailjet.")
    try:
        success = await service_instance.send_email(
            to_email=email_to,
            to_name=None, # Mailjet will use the email if name is None or empty
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            custom_id=f"invitation-{token}" # Optional: for tracking
        )
        if success:
            print(f"Invitation email successfully queued for {email_to}.")
        else:
            print(f"Failed to send invitation email to {email_to} via Mailjet.")
            # TODO: Add more robust error handling/logging here for failed email sends
            # For example, flag the invitation or notify admin
    except Exception as e:
        print(f"Exception during sending invitation email to {email_to}: {str(e)}")
        # TODO: Handle exception (e.g. retry logic, or marking invitation for manual follow-up)


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
        # Check if user already exists in Firebase Auth
        auth.get_user_by_email(target_email_lower)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A user with email '{invitation_data.email}' is already registered."
        )
    except auth.UserNotFoundError:
        # User does not exist, proceed
        pass 
    except Exception as e: # Catch other potential Firebase errors
        print(f"Error checking user in Firebase Auth: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error verifying user existence.")


    # Check for existing pending invitation in Firestore
    existing_invitation_query = db.collection(INVITATIONS_COLLECTION)\
        .where("email", "==", target_email_lower)\
        .where("status", "==", "pending")\
        .limit(1)
    
    existing_invitations_snap = await existing_invitation_query.get() 
    if existing_invitations_snap: 
        for inv_doc in existing_invitations_snap: # Should be at most one due to limit(1)
            inv = inv_doc.to_dict()
            expires_at_dt = inv.get("expiresAt")
            if isinstance(expires_at_dt, datetime):
                if expires_at_dt.tzinfo is None: # Ensure timezone aware for comparison
                    expires_at_dt = expires_at_dt.replace(tzinfo=timezone.utc)
                
                if expires_at_dt > datetime.now(timezone.utc): # Check if not expired
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"A pending invitation already exists for '{invitation_data.email}' and has not expired yet."
                    )

    token = generate_secure_token(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7) 

    invitation_doc_id = db.collection(INVITATIONS_COLLECTION).document().id
    
    new_invitation_data = {
        "id": invitation_doc_id, # Store the document ID within the document itself
        "email": target_email_lower,
        "token": token, 
        "status": "pending", # initial status
        "assignedRoleIds": invitation_data.assignedRoleIds or [],
        "createdByUserId": current_admin_user.uid, 
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
        "expiresAt": expires_at 
    }

    try:
        await db.collection(INVITATIONS_COLLECTION).document(invitation_doc_id).set(new_invitation_data)
        
        # Fetch the created document to ensure it was written and to return its data
        created_doc_snap = await db.collection(INVITATIONS_COLLECTION).document(invitation_doc_id).get()
        if not created_doc_snap.exists:
             # This case should ideally not happen if the set was successful without error
             raise HTTPException(status_code=500, detail="Failed to retrieve invitation after creation.")
        
        response_data = created_doc_snap.to_dict()
        # Ensure 'id' is part of the response, matching the Pydantic model
        response_data['id'] = created_doc_snap.id 
        
        inviter_name = f"{current_admin_user.first_name} {current_admin_user.last_name}".strip() or current_admin_user.email
        
        # Add email sending to background tasks
        background_tasks.add_task(send_actual_invitation_email, target_email_lower, token, inviter_name, email_service)
        
        return InvitationResponse(**response_data)

    except Exception as e:
        # Generic error handler for unexpected issues during Firestore operation or other logic
        print(f"Error creating invitation: {e}")
        # Potentially rollback or log for manual intervention if critical
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
        invitations_list_processed = [] 
        
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
                    inv_data['creatorName'] = "Unknown Creator"
                    print(f"Warning: Invitation document {doc.id} is missing 'createdByUserId'.")
                else:
                    creator_doc = await db.collection(USERS_COLLECTION).document(inv_data['createdByUserId']).get()
                    if creator_doc.exists:
                        creator_data = creator_doc.to_dict()
                        first = creator_data.get('firstName', '')
                        last = creator_data.get('lastName', '')
                        inv_data['creatorName'] = f"{first} {last}".strip() or "Name N/A"
                    else:
                        inv_data['creatorName'] = "Creator Not Found"
                
                assigned_role_ids = inv_data.get("assignedRoleIds", [])
                assigned_role_names = []
                if isinstance(assigned_role_ids, list):
                    for role_id in assigned_role_ids:
                        role_doc = await db.collection(ROLES_COLLECTION).document(role_id).get()
                        if role_doc.exists:
                            role_data = role_doc.to_dict()
                            assigned_role_names.append(role_data.get("roleName", role_id))
                        else:
                            assigned_role_names.append(f"{role_id} (not found)")
                inv_data['assignedRoleNames'] = assigned_role_names

                try:
                    invitations_list_processed.append(InvitationListResponse(**inv_data))
                except Exception as pydantic_error:
                    print(f"Pydantic validation error for doc {doc.id}: {pydantic_error}. Data: {inv_data}")
                    continue 

                docs_processed_for_limit += 1
            else:
                break 
                
        return invitations_list_processed
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
    if not token:
        return InvitationValidateResponse(isValid=False, message="Token is required.")

    invitations_query = db.collection(INVITATIONS_COLLECTION).where("token", "==", token).limit(1)
    invitation_docs_snap = await invitations_query.get()

    if not invitation_docs_snap:
        return InvitationValidateResponse(isValid=False, message="Invitation token not found.")

    invitation_doc = invitation_docs_snap[0] 
    invitation_data = invitation_doc.to_dict()

    if invitation_data.get("status") != "pending":
        return InvitationValidateResponse(isValid=False, message=f"Invitation is no longer valid (status: {invitation_data.get('status')}).")

    expires_at = invitation_data.get("expiresAt")
    if not isinstance(expires_at, datetime):
        print(f"Warning: Invitation {invitation_doc.id} has invalid expiresAt field: {expires_at}")
        return InvitationValidateResponse(isValid=False, message="Invitation has an invalid expiration date format.")

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        # Update status to expired in Firestore
        await db.collection(INVITATIONS_COLLECTION).document(invitation_doc.id).update({"status": "expired", "updatedAt": firestore.SERVER_TIMESTAMP})
        return InvitationValidateResponse(isValid=False, message="Invitation token has expired.")

    return InvitationValidateResponse(
        isValid=True,
        message="Invitation token is valid.",
        email=invitation_data.get("email"),
        assignedRoleIds=invitation_data.get("assignedRoleIds")
    )