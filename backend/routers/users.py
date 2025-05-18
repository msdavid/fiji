from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional, Any, Dict, Set
from firebase_admin import firestore, auth
import datetime 

from models.user import UserCreate, UserResponse, UserUpdate, UserListResponse, UserSearchResponseItem, UserAvailability, GeneralAvailabilityRule, SpecificDateSlot
from dependencies.database import get_db
from dependencies.rbac import RBACUser, get_current_user_with_rbac, require_permission

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

USERS_COLLECTION = "users"
ROLES_COLLECTION = "roles"

def _sanitize_user_data_fields(user_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ensures that fields expected to be lists or specific types are correctly handled,
    providing defaults if they are not.
    """
    if not isinstance(user_data.get("skills"), list):
        user_data["skills"] = []
    if not isinstance(user_data.get("qualifications"), list):
        user_data["qualifications"] = []
    
    if "preferences" in user_data and not isinstance(user_data["preferences"], str):
        user_data["preferences"] = None 
    
    if "emergencyContactDetails" in user_data and not isinstance(user_data["emergencyContactDetails"], str):
        user_data["emergencyContactDetails"] = None

    if not isinstance(user_data.get("assignedRoleIds"), list):
        user_data["assignedRoleIds"] = []
    
    availability_data = user_data.get("availability")
    if availability_data is None:
        user_data["availability"] = UserAvailability(general_rules=[], specific_slots=[]).model_dump()
    elif isinstance(availability_data, dict):
        if not isinstance(availability_data.get("general_rules"), list):
            availability_data["general_rules"] = []
        if not isinstance(availability_data.get("specific_slots"), list):
            availability_data["specific_slots"] = []
    else: # Not a dict or None, force default
        user_data["availability"] = UserAvailability(general_rules=[], specific_slots=[]).model_dump()
            
    return user_data

async def _get_role_names(db: firestore.AsyncClient, role_ids: List[str]) -> List[str]:
    role_names = []
    if not isinstance(role_ids, list): 
        return role_names
    for role_id in role_ids:
        role_doc = await db.collection(ROLES_COLLECTION).document(role_id).get()
        if role_doc.exists:
            role_data = role_doc.to_dict()
            role_names.append(role_data.get("roleName", role_id)) 
        else:
            role_names.append(role_id) # Append ID if name not found
    return role_names

@router.get("", response_model=List[UserListResponse], dependencies=[Depends(require_permission("users", "list"))])
async def list_users(
    db: firestore.AsyncClient = Depends(get_db),
    offset: int = 0,
    limit: int = Query(default=20, le=100) 
):
    try:
        users_ref = db.collection(USERS_COLLECTION)
        # Basic pagination and ordering
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
    if not q or len(q) < 2: 
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Search query must be at least 2 characters long.")

    search_term_lower = q.lower()
    users_list = []

    try:
        # This is a very basic search. For production, consider Firestore native indexing or a dedicated search service.
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
                    email=user_data.get("email") 
                ))
            
            if len(users_list) >= 20: # Limit results for performance
                break
        
        return users_list
    except Exception as e:
        print(f"Error searching users: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred during user search: {str(e)}")


@router.get("/me", response_model=UserResponse)
async def read_users_me(
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac), # This now contains privileges
    db: firestore.AsyncClient = Depends(get_db)
):
    user_doc_snap = await db.collection(USERS_COLLECTION).document(current_rbac_user.uid).get()
    if not user_doc_snap.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Current user not found in Firestore")
    
    user_data = user_doc_snap.to_dict()
    user_data['id'] = user_doc_snap.id # Ensure 'id' field is present for Pydantic model
    
    user_data = _sanitize_user_data_fields(user_data) 
    
    # Get role names
    user_data["assignedRoleNames"] = await _get_role_names(db, user_data.get("assignedRoleIds", []))
    
    # Add privileges and isSysadmin from RBACUser to the response data
    # Convert sets of privileges to lists for JSON serialization compatibility with Pydantic model
    user_data["privileges"] = {resource: list(actions) for resource, actions in current_rbac_user.privileges.items()}
    user_data["isSysadmin"] = current_rbac_user.is_sysadmin
    
    return UserResponse(**user_data)

@router.put("/me", response_model=UserResponse)
async def update_users_me(
    user_update_data: UserUpdate,
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac),
    db: firestore.AsyncClient = Depends(get_db)
):
    user_ref = db.collection(USERS_COLLECTION).document(current_rbac_user.uid)
    
    # Exclude fields that users should not update for themselves directly via this endpoint
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
        # Re-add privileges and isSysadmin for the response after update
        response_data["privileges"] = {resource: list(actions) for resource, actions in current_rbac_user.privileges.items()}
        response_data["isSysadmin"] = current_rbac_user.is_sysadmin

        return UserResponse(**response_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_permission("users", "view"))])
async def get_user(user_id: str, db: firestore.AsyncClient = Depends(get_db)):
    # Note: This endpoint currently doesn't return the target user's specific privileges,
    # only the calling user's context would have that via RBACUser.
    # If we need to show target user's privileges, we'd need to compute them here similarly to get_current_user_with_rbac.
    # For now, UserResponse model expects 'privileges', so we might need to adjust or provide empty.
    # Let's assume for now this endpoint is primarily for user data, not their full privilege set.
    # The UserResponse model now requires 'privileges' and 'isSysadmin'.
    # We need to calculate these for the target user.

    user_doc_snap = await db.collection(USERS_COLLECTION).document(user_id).get()
    if not user_doc_snap.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User '{user_id}' not found")
    
    user_data = user_doc_snap.to_dict()
    user_data['id'] = user_doc_snap.id
    
    user_data = _sanitize_user_data_fields(user_data) 
    
    user_data["assignedRoleNames"] = await _get_role_names(db, user_data.get("assignedRoleIds", []))

    # Calculate privileges and isSysadmin for the target user
    target_user_assigned_roles = user_data.get("assignedRoleIds", [])
    target_is_sysadmin = "sysadmin" in target_user_assigned_roles
    target_privileges: Dict[str, Set[str]] = {}

    if not target_is_sysadmin and target_user_assigned_roles:
        for role_id in target_user_assigned_roles:
            role_doc_ref = db.collection(ROLES_COLLECTION).document(role_id)
            role_doc = await role_doc_ref.get()
            if role_doc.exists:
                role_data_for_priv = role_doc.to_dict() # Renamed to avoid conflict
                privs_for_role = role_data_for_priv.get("privileges", {})
                for resource, actions in privs_for_role.items():
                    if not isinstance(actions, list): continue
                    if resource not in target_privileges:
                        target_privileges[resource] = set()
                    target_privileges[resource].update(actions)
    
    user_data["privileges"] = {resource: list(actions) for resource, actions in target_privileges.items()}
    user_data["isSysadmin"] = target_is_sysadmin
    
    return UserResponse(**user_data)


@router.put("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_permission("users", "edit"))])
async def update_user_by_admin(
    user_id: str,
    user_update_data: UserUpdate, 
    db: firestore.AsyncClient = Depends(get_db),
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac) # To get current admin's context if needed
):
    user_ref = db.collection(USERS_COLLECTION).document(user_id)
    user_doc_snap = await user_ref.get() # Renamed from user_doc to user_doc_snap
    if not user_doc_snap.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User '{user_id}' not found")

    update_dict = user_update_data.model_dump(exclude_unset=True)
    
    # Prevent email change by admin through this endpoint; should be a separate process if allowed
    if "email" in update_dict and update_dict["email"] != user_doc_snap.to_dict().get("email"):
        # Log this attempt or handle as per policy, for now, just removing it from update
        print(f"Admin {current_rbac_user.uid} attempt to change email for user {user_id} was ignored.")
        del update_dict["email"] 

    if not update_dict: # If only email was provided and then removed, dict might be empty
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid update data provided.")

    update_dict["updatedAt"] = firestore.SERVER_TIMESTAMP
    
    try:
        await user_ref.update(update_dict)
        updated_doc_snap = await user_ref.get()
        response_data = updated_doc_snap.to_dict()
        response_data['id'] = updated_doc_snap.id
        
        response_data = _sanitize_user_data_fields(response_data) 
        
        response_data["assignedRoleNames"] = await _get_role_names(db, response_data.get("assignedRoleIds", []))

        # Recalculate privileges and isSysadmin for the response
        target_user_assigned_roles = response_data.get("assignedRoleIds", [])
        target_is_sysadmin = "sysadmin" in target_user_assigned_roles
        target_privileges: Dict[str, Set[str]] = {}
        if not target_is_sysadmin and target_user_assigned_roles:
            for role_id in target_user_assigned_roles:
                role_doc_ref = db.collection(ROLES_COLLECTION).document(role_id)
                role_doc = await role_doc_ref.get()
                if role_doc.exists:
                    role_data_for_priv = role_doc.to_dict()
                    privs_for_role = role_data_for_priv.get("privileges", {})
                    for resource, actions in privs_for_role.items():
                        if not isinstance(actions, list): continue
                        if resource not in target_privileges:
                            target_privileges[resource] = set()
                        target_privileges[resource].update(actions)
        
        response_data["privileges"] = {resource: list(actions) for resource, actions in target_privileges.items()}
        response_data["isSysadmin"] = target_is_sysadmin

        return UserResponse(**response_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
