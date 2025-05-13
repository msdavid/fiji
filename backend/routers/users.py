from fastapi import APIRouter, HTTPException, Depends, status, Query 
from firebase_admin import firestore # For type hinting AsyncClient
from google.cloud.firestore_v1.base_query import FieldFilter 
from typing import List, Optional, Any, Dict 

from dependencies.database import get_db
from dependencies.auth import get_firebase_user
from dependencies.rbac import RBACUser, get_current_user_with_rbac, require_permission
from models.user import UserCreateData, UserResponse, UserUpdate, UserRolesUpdate, UserSearchResult

router = APIRouter(
    prefix="/users", 
    tags=["users"]
)

USERS_COLLECTION = "users"
INVITATIONS_COLLECTION = "registrationInvitations"
ROLES_COLLECTION = "roles"

def _convert_user_data_for_response(user_data: Dict[str, Any]) -> Dict[str, Any]:
    if 'skills' in user_data and isinstance(user_data['skills'], list):
        user_data['skills'] = '\n'.join(user_data['skills'])
    elif 'skills' not in user_data or user_data['skills'] is None: 
        user_data['skills'] = None

    if 'qualifications' in user_data and isinstance(user_data['qualifications'], list):
        user_data['qualifications'] = '\n'.join(user_data['qualifications'])
    elif 'qualifications' not in user_data or user_data['qualifications'] is None: 
        user_data['qualifications'] = None
    
    if 'preferences' not in user_data or user_data['preferences'] is None:
        user_data['preferences'] = None
        
    return user_data

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user_with_invitation(
    registration_data: UserCreateData,
    firebase_user_claims: dict = Depends(get_firebase_user),
    db: firestore.AsyncClient = Depends(get_db) # Use AsyncClient
):
    try:
        firebase_uid = firebase_user_claims.get("uid")
        firebase_email = firebase_user_claims.get("email")

        if not firebase_uid or not firebase_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Firebase ID token: UID or email missing."
            )

        invitations_ref = db.collection(INVITATIONS_COLLECTION)
        query = invitations_ref.where(filter=FieldFilter("token", "==", registration_data.invitationToken)) \
                               .where(filter=FieldFilter("status", "==", "pending")) \
                               .limit(1)
        
        invitation_doc_snapshot = None
        async for doc_snapshot in query.stream(): # Use async for
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
        user_doc_check = await user_doc_ref.get() # await
        if user_doc_check.exists:
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
            "phoneNumber": None,
            "skills": None, 
            "qualifications": None, 
            "preferences": None, 
        }
        await user_doc_ref.set(new_user_data) # await

        await db.collection(INVITATIONS_COLLECTION).document(invitation_doc_snapshot.id).update({ # await
            "status": "accepted",
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "acceptedByUserId": firebase_uid,
            "acceptedAt": firestore.SERVER_TIMESTAMP
        })
        
        created_user_doc_snapshot = await user_doc_ref.get() # await
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred during registration.")


@router.get("/me", response_model=UserResponse)
async def read_users_me(
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac),
    db: firestore.AsyncClient = Depends(get_db) # Use AsyncClient
):
    user_doc_ref = db.collection(USERS_COLLECTION).document(current_rbac_user.uid)
    user_doc = await user_doc_ref.get() # await
    if not user_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Current user not found in Firestore.")
    
    response_data = user_doc.to_dict()
    response_data['uid'] = user_doc.id 
    response_data = _convert_user_data_for_response(response_data)
    return UserResponse(**response_data)

@router.put("/me", response_model=UserResponse)
async def update_users_me(
    user_update_data: UserUpdate,
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac),
    db: firestore.AsyncClient = Depends(get_db) # Use AsyncClient
):
    user_doc_ref = db.collection(USERS_COLLECTION).document(current_rbac_user.uid)
    
    update_payload = user_update_data.model_dump(exclude_unset=True)
    if not update_payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

    update_payload["updatedAt"] = firestore.SERVER_TIMESTAMP

    try:
        await user_doc_ref.update(update_payload) # await
        updated_doc = await user_doc_ref.get() # await
        if not updated_doc.exists: 
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found after update.")
        
        response_data = updated_doc.to_dict()
        response_data['uid'] = updated_doc.id
        response_data = _convert_user_data_for_response(response_data)
        return UserResponse(**response_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not update user profile.")

@router.get("/search", response_model=List[UserSearchResult], dependencies=[Depends(require_permission("users", "list"))])
async def search_users(
    q: str = Query(..., min_length=1, description="Search query for first name, last name, or email."),
    db: firestore.AsyncClient = Depends(get_db) # Use AsyncClient
):
    if not q:
        return []
        
    users_ref = db.collection(USERS_COLLECTION)
    docs_stream = users_ref.stream() # stream() is an async iterator with AsyncClient
    
    search_results = []
    search_term_lower = q.lower()
    
    async for doc in docs_stream: # Use async for
        user_data = doc.to_dict()
        user_data['uid'] = doc.id 

        first_name = user_data.get("firstName", "").lower()
        last_name = user_data.get("lastName", "").lower()
        email = user_data.get("email", "").lower()

        if search_term_lower in first_name or \
           search_term_lower in last_name or \
           search_term_lower in email:
            try:
                if "uid" in user_data and "firstName" in user_data and \
                   "lastName" in user_data and "email" in user_data:
                    search_results.append(UserSearchResult(**user_data))
            except Exception as e: 
                print(f"Skipping user {user_data.get('uid')} due to data issue: {e}")
                continue 
    
    return search_results


@router.get("", response_model=List[UserResponse], dependencies=[Depends(require_permission("users", "list"))])
async def list_users(
    db: firestore.AsyncClient = Depends(get_db), # Use AsyncClient
):
    users_ref = db.collection(USERS_COLLECTION)
    docs_stream = users_ref.stream() # stream() is an async iterator
    
    user_list = []
    async for doc in docs_stream: # Use async for
        user_data = doc.to_dict()
        user_data['uid'] = doc.id
        user_data = _convert_user_data_for_response(user_data)
        user_list.append(UserResponse(**user_data))
    return user_list

@router.get("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_permission("users", "view"))])
async def get_user(
    user_id: str,
    db: firestore.AsyncClient = Depends(get_db) # Use AsyncClient
):
    user_doc_ref = db.collection(USERS_COLLECTION).document(user_id)
    user_doc = await user_doc_ref.get() # await
    if not user_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID {user_id} not found.")
    
    response_data = user_doc.to_dict()
    response_data['uid'] = user_doc.id
    response_data = _convert_user_data_for_response(response_data)
    return UserResponse(**response_data)

@router.put("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_permission("users", "edit"))])
async def update_user(
    user_id: str,
    user_update_data: UserUpdate, 
    db: firestore.AsyncClient = Depends(get_db) # Use AsyncClient
):
    user_doc_ref = db.collection(USERS_COLLECTION).document(user_id)
    
    user_doc_check = await user_doc_ref.get() # await
    if not user_doc_check.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID {user_id} not found.")

    update_payload = user_update_data.model_dump(exclude_unset=True)
    if not update_payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

    update_payload["updatedAt"] = firestore.SERVER_TIMESTAMP

    try:
        await user_doc_ref.update(update_payload) # await
        updated_doc = await user_doc_ref.get() # await
        
        response_data = updated_doc.to_dict()
        response_data['uid'] = updated_doc.id
        response_data = _convert_user_data_for_response(response_data)
        return UserResponse(**response_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Could not update user profile for {user_id}.")

@router.put("/{user_id}/roles", response_model=UserResponse, dependencies=[Depends(require_permission("users", "manage_roles"))])
async def update_user_roles(
    user_id: str,
    roles_update_data: UserRolesUpdate,
    db: firestore.AsyncClient = Depends(get_db) # Use AsyncClient
):
    user_doc_ref = db.collection(USERS_COLLECTION).document(user_id)
    user_doc = await user_doc_ref.get() # await
    if not user_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID {user_id} not found.")

    valid_role_ids = []
    invalid_role_ids = []
    for role_id_to_check in roles_update_data.assignedRoleIds: # Renamed variable for clarity
        role_doc_ref = db.collection(ROLES_COLLECTION).document(role_id_to_check)
        role_doc_check = await role_doc_ref.get() # await
        if role_doc_check.exists:
            valid_role_ids.append(role_id_to_check)
        else:
            invalid_role_ids.append(role_id_to_check)
    
    if invalid_role_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"The following role IDs are invalid or do not exist: {', '.join(invalid_role_ids)}."
        )

    update_payload = {
        "assignedRoleIds": valid_role_ids, 
        "updatedAt": firestore.SERVER_TIMESTAMP
    }

    try:
        await user_doc_ref.update(update_payload) # await
        updated_doc = await user_doc_ref.get() # await
        
        response_data = updated_doc.to_dict()
        response_data['uid'] = updated_doc.id
        response_data = _convert_user_data_for_response(response_data) 
        return UserResponse(**response_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Could not update roles for user {user_id}.")
