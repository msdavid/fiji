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
    limit: int = Query(default=20, le=100),
    roleId: Optional[str] = Query(None, description="Filter users by assigned role ID (exact match on roleName).") 
):
    try:
        users_ref = db.collection(USERS_COLLECTION)
        
        query = users_ref.order_by("lastName").order_by("firstName")

        if roleId:
            query = query.where("assignedRoleIds", "array_contains", roleId) # Corrected operator to "array_contains"
        
        query = query.limit(limit).offset(offset)
        
        docs_snapshot = query.stream()
        
        users_list = []
        async for doc in docs_snapshot:
            user_data = doc.to_dict()
            user_data['id'] = doc.id 
            
            user_data = _sanitize_user_data_fields(user_data) 
            
            user_data["assignedRoleNames"] = await _get_role_names(db, user_data.get("assignedRoleIds", []))
            
            users_list.append(UserListResponse(
                id=user_data['id'],
                email=user_data.get('email', 'N/A'),
                firstName=user_data.get('firstName'),
                lastName=user_data.get('lastName'),
                status=user_data.get('status', 'unknown'),
                assignedRoleIds=user_data.get('assignedRoleIds', []), 
                assignedRoleNames=user_data.get('assignedRoleNames', []),
                createdAt=user_data.get('createdAt', datetime.datetime.now(datetime.timezone.utc)) 
            ))
            
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
            
            if len(users_list) >= 20: 
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
        response_data["privileges"] = {resource: list(actions) for resource, actions in current_rbac_user.privileges.items()}
        response_data["isSysadmin"] = current_rbac_user.is_sysadmin

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

    target_user_assigned_roles = user_data.get("assignedRoleIds", [])
    target_is_sysadmin = "sysadmin" in target_user_assigned_roles
    target_privileges: Dict[str, Set[str]] = {}

    if not target_is_sysadmin and target_user_assigned_roles:
        for role_id_val in target_user_assigned_roles: 
            role_doc_ref = db.collection(ROLES_COLLECTION).document(role_id_val)
            role_doc = await role_doc_ref.get()
            if role_doc.exists:
                role_data_for_priv = role_doc.to_dict() 
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
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac) 
):
    user_ref = db.collection(USERS_COLLECTION).document(user_id)
    user_doc_snap = await user_ref.get() 
    if not user_doc_snap.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User '{user_id}' not found")

    update_dict = user_update_data.model_dump(exclude_unset=True)
    
    current_user_data = user_doc_snap.to_dict()
    if "email" in update_dict and update_dict["email"] != current_user_data.get("email"):
        print(f"Admin {current_rbac_user.uid} attempt to change email for user {user_id} was ignored.")
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

        target_user_assigned_roles = response_data.get("assignedRoleIds", [])
        target_is_sysadmin = "sysadmin" in target_user_assigned_roles
        target_privileges: Dict[str, Set[str]] = {}
        if not target_is_sysadmin and target_user_assigned_roles:
            for role_id_val in target_user_assigned_roles: 
                role_doc_ref = db.collection(ROLES_COLLECTION).document(role_id_val)
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

# --- New Endpoints for Assigning/Unassigning Roles ---

@router.post(
    "/{user_id}/roles/{role_id_to_assign}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("roles", "manage_assignments"))] 
)
async def assign_role_to_user(
    user_id: str,
    role_id_to_assign: str, 
    db: firestore.AsyncClient = Depends(get_db)
):
    """
    Assigns a role to a user. The role_id_to_assign is the roleName.
    Requires 'roles:manage_assignments' permission.
    """
    user_doc_ref = db.collection(USERS_COLLECTION).document(user_id)
    role_doc_ref = db.collection(ROLES_COLLECTION).document(role_id_to_assign)

    user_doc = await user_doc_ref.get()
    if not user_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User '{user_id}' not found.")

    role_doc = await role_doc_ref.get()
    if not role_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Role '{role_id_to_assign}' not found.")

    try:
        await user_doc_ref.update({
            "assignedRoleIds": firestore.ArrayUnion([role_id_to_assign]),
            "updatedAt": firestore.SERVER_TIMESTAMP
        })
    except Exception as e:
        print(f"Error assigning role {role_id_to_assign} to user {user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")
    
    return 

@router.delete(
    "/{user_id}/roles/{role_id_to_unassign}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("roles", "manage_assignments"))] 
)
async def unassign_role_from_user(
    user_id: str,
    role_id_to_unassign: str, 
    db: firestore.AsyncClient = Depends(get_db)
):
    """
    Unassigns a role from a user. The role_id_to_unassign is the roleName.
    Requires 'roles:manage_assignments' permission.
    """
    user_doc_ref = db.collection(USERS_COLLECTION).document(user_id)

    user_doc = await user_doc_ref.get()
    if not user_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User '{user_id}' not found.")
    
    try:
        await user_doc_ref.update({
            "assignedRoleIds": firestore.ArrayRemove([role_id_to_unassign]),
            "updatedAt": firestore.SERVER_TIMESTAMP
        })
    except Exception as e:
        print(f"Error unassigning role {role_id_to_unassign} from user {user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

    return