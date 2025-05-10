from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
import firebase_admin
from firebase_admin import firestore

from models.role import RoleCreate, RoleUpdate, RoleResponse
from dependencies.auth import get_firebase_user # For user authentication

router = APIRouter(
    prefix="/roles",
    tags=["roles"],
    # dependencies=[Depends(get_firebase_user)] # Apply auth to all routes in this router
)

# Firestore client
db = firestore.client()
ROLES_COLLECTION = "roles"

# Placeholder for sysadmin check - This will need to be refined
# with full RBAC logic later. For now, it's a simplified check.
async def verify_sysadmin_role(current_user: dict = Depends(get_firebase_user)):
    """
    Placeholder dependency to check if the current user is a sysadmin.
    This needs to be replaced with actual RBAC logic that checks user's roles
    and privileges from Firestore.
    """
    # Example: Check if a custom claim 'is_sysadmin' is true, or if UID matches a known sysadmin UID.
    # This is NOT a secure or complete RBAC check for production.
    # For Sprint 0, we might assume the presence of a token implies sufficient rights for these initial endpoints,
    # or we can implement a very basic check.
    # A more robust check would involve:
    # 1. Get current_user_uid from decoded_token.
    # 2. Fetch user document from Firestore `users` collection using UID.
    # 3. Get `assignedRoleIds` from user document.
    # 4. Fetch role documents from `roles` collection for these IDs.
    # 5. Check if 'sysadmin' roleName is present or if specific privileges exist.
    
    # Simplified check for now: if the token is valid, allow.
    # This is a placeholder and MUST be replaced.
    if not current_user: # Should not happen if get_firebase_user works
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    # A slightly better placeholder: check for a specific UID known to be sysadmin
    # known_sysadmin_uid = "SOME_SYSADMIN_UID_CONFIGURED_ELSEWHERE" 
    # if current_user.get("uid") != known_sysadmin_uid:
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Requires sysadmin role")
    print(f"User {current_user.get('uid')} attempting admin operation on roles.") # Logging for now
    return current_user


@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_sysadmin_role)])
async def create_role(role_data: RoleCreate):
    """
    Create a new role. Only accessible by users with sysadmin privileges.
    """
    try:
        # Check if roleName already exists to ensure uniqueness
        existing_roles = db.collection(ROLES_COLLECTION).where("roleName", "==", role_data.roleName).limit(1).stream()
        if any(existing_roles):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Role with name '{role_data.roleName}' already exists.")

        new_role_dict = role_data.model_dump()
        new_role_dict["isSystemRole"] = False # API created roles are not system roles by default
        new_role_dict["createdAt"] = firestore.SERVER_TIMESTAMP
        new_role_dict["updatedAt"] = firestore.SERVER_TIMESTAMP
        
        doc_ref = db.collection(ROLES_COLLECTION).document()
        doc_ref.set(new_role_dict)
        
        created_role = doc_ref.get()
        if created_role.exists:
            return RoleResponse(roleId=created_role.id, **created_role.to_dict())
        else:
            # This case should ideally not happen if set() is successful
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve role after creation.")
            
    except HTTPException:
        raise # Re-raise HTTPException to ensure FastAPI handles it
    except Exception as e:
        print(f"Error creating role: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.get("/", response_model=List[RoleResponse], dependencies=[Depends(verify_sysadmin_role)])
async def get_all_roles():
    """
    Get a list of all roles. Only accessible by users with sysadmin privileges.
    """
    try:
        roles_list = []
        docs = db.collection(ROLES_COLLECTION).stream()
        for doc in docs:
            role_dict = doc.to_dict()
            # Ensure timestamps are handled correctly if they are not datetime objects yet
            if 'createdAt' in role_dict and not isinstance(role_dict['createdAt'], datetime.datetime):
                role_dict['createdAt'] = datetime.datetime.now() # Placeholder, ideally convert from Firestore timestamp
            if 'updatedAt' in role_dict and not isinstance(role_dict['updatedAt'], datetime.datetime):
                role_dict['updatedAt'] = datetime.datetime.now() # Placeholder
            roles_list.append(RoleResponse(roleId=doc.id, **role_dict))
        return roles_list
    except Exception as e:
        print(f"Error getting all roles: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.get("/{role_id}", response_model=RoleResponse, dependencies=[Depends(verify_sysadmin_role)])
async def get_role_by_id(role_id: str):
    """
    Get a specific role by its ID. Only accessible by users with sysadmin privileges.
    """
    try:
        doc_ref = db.collection(ROLES_COLLECTION).document(role_id)
        role_doc = doc_ref.get()
        if role_doc.exists:
            return RoleResponse(roleId=role_doc.id, **role_doc.to_dict())
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting role by ID {role_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.put("/{role_id}", response_model=RoleResponse, dependencies=[Depends(verify_sysadmin_role)])
async def update_role(role_id: str, role_update_data: RoleUpdate):
    """
    Update an existing role. Only accessible by users with sysadmin privileges.
    System roles (isSystemRole=true) should ideally not be updatable in critical ways via API.
    """
    try:
        doc_ref = db.collection(ROLES_COLLECTION).document(role_id)
        role_doc = doc_ref.get()

        if not role_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

        # Prevent modification of isSystemRole or critical fields of system roles if needed
        # current_role_data = role_doc.to_dict()
        # if current_role_data.get("isSystemRole"):
        #     # Add logic here to restrict updates to system roles
        #     pass

        update_data = role_update_data.model_dump(exclude_unset=True) # Only include fields that were set
        if not update_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")
            
        update_data["updatedAt"] = firestore.SERVER_TIMESTAMP
        
        doc_ref.update(update_data)
        
        updated_role_doc = doc_ref.get() # Fetch again to get the data with server timestamp
        return RoleResponse(roleId=updated_role_doc.id, **updated_role_doc.to_dict())
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating role {role_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_sysadmin_role)])
async def delete_role(role_id: str):
    """
    Delete a role. Only accessible by users with sysadmin privileges.
    System roles should ideally not be deletable.
    """
    try:
        doc_ref = db.collection(ROLES_COLLECTION).document(role_id)
        role_doc = doc_ref.get()

        if not role_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

        # Prevent deletion of system roles
        if role_doc.to_dict().get("isSystemRole"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="System roles cannot be deleted via API.")
            
        doc_ref.delete()
        return None # HTTP 204 No Content
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting role {role_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")
