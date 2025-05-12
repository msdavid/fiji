from fastapi import APIRouter, HTTPException, Depends, status
import firebase_admin 
from firebase_admin import firestore, auth # For firestore.SERVER_TIMESTAMP, auth, and type hinting Client
import datetime

# Use relative imports from the 'backend' directory as root
from dependencies.database import get_db
from dependencies.auth import get_firebase_user
from models.user import UserCreateData, UserResponse

router = APIRouter(
    prefix="/users", 
    tags=["users"]
)

USERS_COLLECTION = "users"
INVITATIONS_COLLECTION = "registrationInvitations"

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user_with_invitation(
    registration_data: UserCreateData,
    firebase_user_claims: dict = Depends(get_firebase_user),
    db: firestore.Client = Depends(get_db)
):
    try:
        firebase_uid = firebase_user_claims.get("uid")
        firebase_email = firebase_user_claims.get("email")

        if not firebase_uid or not firebase_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Firebase ID token: UID or email missing."
            )

        invitation_query = db.collection(INVITATIONS_COLLECTION).where("token", "==", registration_data.invitationToken).where("status", "==", "pending").limit(1).stream()
        
        invitation_doc_snapshot = None
        for doc_snapshot in invitation_query:
            invitation_doc_snapshot = doc_snapshot
            break
        
        if not invitation_doc_snapshot:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired invitation token."
            )
        
        invitation = invitation_doc_snapshot.to_dict()

        if invitation.get("email") != firebase_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invitation email does not match authenticated user's email."
            )

        user_doc_ref = db.collection(USERS_COLLECTION).document(firebase_uid)
        if user_doc_ref.get().exists:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User with UID {firebase_uid} already exists in Firestore."
            )

        new_user_data = {
            "uid": firebase_uid,
            "email": firebase_email,
            "firstName": registration_data.firstName,
            "lastName": registration_data.lastName,
            "assignedRoleIds": invitation.get("rolesToAssignOnRegistration", []),
            "status": "active",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        user_doc_ref.set(new_user_data)

        db.collection(INVITATIONS_COLLECTION).document(invitation_doc_snapshot.id).update({
            "status": "accepted",
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "acceptedByUserId": firebase_uid,
            "acceptedAt": firestore.SERVER_TIMESTAMP
        })
        
        created_user_doc_snapshot = user_doc_ref.get()
        if created_user_doc_snapshot.exists:
            response_data = created_user_doc_snapshot.to_dict()
            response_data['uid'] = created_user_doc_snapshot.id
            return UserResponse(**response_data)
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve user profile after creation.")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during user registration: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred during registration: {str(e)}")