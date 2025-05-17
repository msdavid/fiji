from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional, Any, Dict
from firebase_admin import firestore, auth
import datetime # Required for date conversion if needed, though Pydantic handles it

from models.user import UserCreate, UserResponse, UserUpdate, UserListResponse, UserSearchResponseItem, UserAvailability
from dependencies.database import get_db
from dependencies.rbac import RBACUser, get_current_user_with_rbac, require_permission

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

USERS_COLLECTION = "users"
ROLES_COLLECTION = "roles" # For fetching role names

def _sanitize_user_data_fields(user_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ensures that fields expected to be lists or dicts are of the correct type,
    providing defaults if they are not. This is a workaround for potentially
    malformed data in Firestore.
    """
    if not isinstance(user_data.get("skills"), list):
        user_data["skills"] = []
    if not isinstance(user_data.get("qualifications"), list):
        user_data["qualifications"] = []
    if not isinstance(user_data.get("preferences"), dict):
        user_data["preferences"] = {}
    if not isinstance(user_data.get("assignedRoleIds"), list):
        user_data["assignedRoleIds"] = []
    
    # Sanitize availability field
    availability_data = user_data.get("availability")
    if availability_data is not None and not isinstance(availability_data, dict):
        # If it exists but is not a dict, reset to a default empty dict structure
        # or handle as an error. For now, reset to allow Pydantic to validate later.
        user_data["availability"] = UserAvailability().model_dump() 
    elif isinstance(availability_data, dict):
        # Ensure nested fields are of correct type if necessary, though Pydantic handles this on model creation.
        # For example, specificDatesUnavailable and specificDatesAvailable should be lists.
        if "specificDatesUnavailable" in availability_data and not isinstance(availability_data["specificDatesUnavailable"], list):
            availability_data["specificDatesUnavailable"] = []
        if "specificDatesAvailable" in availability_data and not isinstance(availability_data["specificDatesAvailable"], list):
            availability_data["specificDatesAvailable"] = []
            
    return user_data

async def _get_role_names(db: firestore.AsyncClient, role_ids: List[str]) -> List[str]:
    role_names = []
    if not isinstance(role_ids, list): # Defensive check
        return role_names
    for role_id in role_ids:
        role_doc = await db.collection(ROLES_COLLECTION).document(role_id).get()
        if role_doc.exists:
            # Assuming role document has a 'name' or 'roleName' field.
            # Based on RoleBase, it's 'roleName'.
            role_data = role_doc.to_dict()
            role_names.append(role_data.get("roleName", role_id)) 
        else:
            role_names.append(role_id) 
    return role_names

@router.get("", response_model=List[UserListResponse], dependencies=[Depends(require_permission("users", "list"))])
async def list_users(
    db: firestore.AsyncClient = Depends(get_db),
    offset: int = 0,
    limit: int = Query(default=20, le=100) 
):
    try:
        users_ref = db.collection(USERS_COLLECTION)
        # Consider adding more sophisticated sorting/filtering if needed
        query = users_ref.order_by("lastName").order_by("firstName").limit(limit).offset(offset)
        docs_snapshot = query.stream()
        
        users_list = []
        async for doc in docs_snapshot:
            user_data = doc.to_dict()
            user_data['id'] = doc.id
            
            user_data = _sanitize_user_data_fields(user_data) 
            
            user_data["assignedRoleNames"] = await _get_role_names(db, user_data.get("assignedRoleIds", []))
            
            users_list.append(UserListResponse(**user_data))
            
        return users_list
    except Exception as e:
        print(f"Error listing users: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.get("/search", response_model=List[UserSearchResponseItem], dependencies=[Depends(require_permission("users", "list"))])
async def search_users(
    q: str = Query(..., min_length=2, description="Search term for first name, last name, or email."),
    db: firestore.AsyncClient = Depends(get_db)
):
    if not q or len(q) < 2: # Already handled by Query min_length, but good for explicit check
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Search query must be at least 2 characters long.")

    search_term_lower = q.lower()
    users_list = []

    try:
        # Firestore does not support case-insensitive search or OR queries on different fields directly.
        # This requires fetching all users and filtering in Python, which is not scalable for large datasets.
        # For production, consider a dedicated search service like Algolia or Elasticsearch,
        # or structure data to support specific queries (e.g., store lowercase fields).
        all_users_snapshot = await db.collection(USERS_COLLECTION).get()

        for doc in all_users_snapshot:
            user_data = doc.to_dict()
            user_data['id'] = doc.id
            
            first_name = user_data.get("firstName", "").lower()
            last_name = user_data.get("lastName", "").lower()
            email = user_data.get("email", "").lower()

            if search_term_lower in first_name or \
               search_term_lower in last_name or \
               search_term_lower in email:
                users_list.append(UserSearchResponseItem(
                    id=user_data['id'],
                    firstName=user_data.get("firstName"),
                    lastName=user_data.get("lastName"),
                    email=user_data.get("email") # Ensure email is present
                ))
            
            if len(users_list) >= 20: # Limit results for performance
                break
        
        return users_list
    except Exception as e:
        print(f"Error searching users: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred during user search: {str(e)}")


@router.get("/me", response_model=UserResponse)
async def read_users_me(
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac),
    db: firestore.AsyncClient = Depends(get_db)
):
    user_doc_snap = await db.collection(USERS_COLLECTION).document(current_rbac_user.uid).get()
    if not user_doc_snap.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Current user not found in Firestore")
    
    user_data = user_doc_snap.to_dict()
    user_data['id'] = user_doc_snap.id
    
    user_data = _sanitize_user_data_fields(user_data) 
    
    user_data["assignedRoleNames"] = await _get_role_names(db, user_data.get("assignedRoleIds", []))
    
    return UserResponse(**user_data)

@router.put("/me", response_model=UserResponse)
async def update_users_me(
    user_update_data: UserUpdate,
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac),
    db: firestore.AsyncClient = Depends(get_db)
):
    user_ref = db.collection(USERS_COLLECTION).document(current_rbac_user.uid)
    
    # User cannot update their own roles or status via this endpoint.
    # Email is also not updatable here (managed by Firebase Auth).
    update_dict = user_update_data.model_dump(exclude_unset=True, exclude={"assignedRoleIds", "status", "email"}) 
    
    if not update_dict:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid update data provided.")

    update_dict["updatedAt"] = firestore.SERVER_TIMESTAMP
    
    try:
        await user_ref.update(update_dict)
        updated_doc_snap = await user_ref.get()
        response_data = updated_doc_snap.to_dict()
        response_data['id'] = updated_doc_snap.id
        
        response_data = _sanitize_user_data_fields(response_data) 
        
        response_data["assignedRoleNames"] = await _get_role_names(db, response_data.get("assignedRoleIds", []))
        return UserResponse(**response_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_permission("users", "view"))])
async def get_user(user_id: str, db: firestore.AsyncClient = Depends(get_db)):
    user_doc_snap = await db.collection(USERS_COLLECTION).document(user_id).get()
    if not user_doc_snap.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User '{user_id}' not found")
    
    user_data = user_doc_snap.to_dict()
    user_data['id'] = user_doc_snap.id
    
    user_data = _sanitize_user_data_fields(user_data) 
    
    user_data["assignedRoleNames"] = await _get_role_names(db, user_data.get("assignedRoleIds", []))
    
    return UserResponse(**user_data)


@router.put("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_permission("users", "edit"))])
async def update_user_by_admin(
    user_id: str,
    user_update_data: UserUpdate, 
    db: firestore.AsyncClient = Depends(get_db),
    # current_rbac_user: RBACUser = Depends(get_current_user_with_rbac) # Not strictly needed if permission covers admin action
):
    user_ref = db.collection(USERS_COLLECTION).document(user_id)
    user_doc = await user_ref.get()
    if not user_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User '{user_id}' not found")

    update_dict = user_update_data.model_dump(exclude_unset=True)
    
    # Prevent admin from changing email via this endpoint if it's part of the payload.
    # Email should be managed via Firebase Auth and synced.
    if "email" in update_dict and update_dict["email"] != user_doc.to_dict().get("email"):
        # Log this attempt or simply remove it from update_dict
        print(f"Attempt to change email for user {user_id} by admin was ignored.")
        del update_dict["email"] 

    if not update_dict:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid update data provided.")

    update_dict["updatedAt"] = firestore.SERVER_TIMESTAMP
    
    try:
        await user_ref.update(update_dict)
        updated_doc_snap = await user_ref.get()
        response_data = updated_doc_snap.to_dict()
        response_data['id'] = updated_doc_snap.id
        
        response_data = _sanitize_user_data_fields(response_data) 
        
        response_data["assignedRoleNames"] = await _get_role_names(db, response_data.get("assignedRoleIds", []))
        return UserResponse(**response_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))