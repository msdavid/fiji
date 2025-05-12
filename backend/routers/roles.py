from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from firebase_admin import firestore # For firestore.SERVER_TIMESTAMP and type hinting Client

# Use direct imports from subdirectories of 'backend'
from dependencies.database import get_db 
from dependencies.rbac import require_permission # Import the new RBAC dependency
from models.role import RoleCreate, RoleUpdate, RoleResponse 

router = APIRouter(
    prefix="/roles",
    tags=["roles"],
)

ROLES_COLLECTION = "roles"
USERS_COLLECTION = "users" # For checking role assignments

@router.post(
    "/", 
    response_model=RoleResponse, 
    status_code=status.HTTP_201_CREATED, 
    dependencies=[Depends(require_permission("roles", "create"))]
)
async def create_role(role_data: RoleCreate, db: firestore.Client = Depends(get_db)):
    """
    Create a new role. 'roleName' from the request body will be used as the document ID.
    Requires 'roles:create' permission.
    """
    try:
        # roleName from role_data.roleName is the intended document ID
        doc_ref = db.collection(ROLES_COLLECTION).document(role_data.roleName)
        
        if doc_ref.get().exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Role with name '{role_data.roleName}' already exists.")

        new_role_dict = role_data.model_dump()
        new_role_dict["isSystemRole"] = False # API-created roles are not system roles
        new_role_dict["createdAt"] = firestore.SERVER_TIMESTAMP
        new_role_dict["updatedAt"] = firestore.SERVER_TIMESTAMP
        
        doc_ref.set(new_role_dict)
        
        created_role_doc = doc_ref.get()
        if created_role_doc.exists:
            # Populate RoleResponse, ensuring roleId is the document ID (roleName)
            response_data = created_role_doc.to_dict()
            response_data['roleId'] = created_role_doc.id # which is role_data.roleName
            return RoleResponse(**response_data)
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve role after creation.")
            
    except HTTPException:
        raise 
    except Exception as e:
        print(f"Error creating role: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.get("/", response_model=List[RoleResponse], dependencies=[Depends(require_permission("roles", "list"))])
async def get_all_roles(db: firestore.Client = Depends(get_db)):
    """
    Get all roles. Requires 'roles:list' permission.
    """
    try:
        roles_list = []
        docs = db.collection(ROLES_COLLECTION).stream()
        for doc in docs:
            role_dict = doc.to_dict()
            role_dict['roleId'] = doc.id # doc.id is the roleName
            roles_list.append(RoleResponse(**role_dict))
        return roles_list
    except Exception as e:
        print(f"Error getting all roles: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.get("/{role_name}", response_model=RoleResponse, dependencies=[Depends(require_permission("roles", "view"))])
async def get_role_by_name(role_name: str, db: firestore.Client = Depends(get_db)):
    """
    Get a specific role by its name (which is its ID). Requires 'roles:view' permission.
    """
    try:
        doc_ref = db.collection(ROLES_COLLECTION).document(role_name)
        role_doc = doc_ref.get()
        if role_doc.exists:
            response_data = role_doc.to_dict()
            response_data['roleId'] = role_doc.id # role_doc.id is role_name
            return RoleResponse(**response_data)
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Role '{role_name}' not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting role by name {role_name}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.put("/{role_name}", response_model=RoleResponse, dependencies=[Depends(require_permission("roles", "edit"))])
async def update_role(role_name: str, role_update_data: RoleUpdate, db: firestore.Client = Depends(get_db)):
    """
    Update an existing role by its name (ID). 'roleName' itself cannot be changed.
    Requires 'roles:edit' permission.
    """
    try:
        doc_ref = db.collection(ROLES_COLLECTION).document(role_name)
        role_doc = doc_ref.get()

        if not role_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Role '{role_name}' not found")
        
        # Prevent updates to system roles via API
        if role_doc.to_dict().get("isSystemRole", False):
             raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"System role '{role_name}' cannot be modified via API.")

        update_data = role_update_data.model_dump(exclude_unset=True)
        
        if not update_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")
            
        update_data["updatedAt"] = firestore.SERVER_TIMESTAMP
        
        doc_ref.update(update_data)
        
        updated_role_doc = doc_ref.get()
        response_data = updated_role_doc.to_dict()
        response_data['roleId'] = updated_role_doc.id # updated_role_doc.id is role_name
        return RoleResponse(**response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating role {role_name}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.delete("/{role_name}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("roles", "delete"))])
async def delete_role(role_name: str, db: firestore.Client = Depends(get_db)):
    """
    Delete a role by its name (ID). Requires 'roles:delete' permission.
    """
    try:
        doc_ref = db.collection(ROLES_COLLECTION).document(role_name)
        role_doc = doc_ref.get()

        if not role_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Role '{role_name}' not found")

        if role_doc.to_dict().get("isSystemRole"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"System role '{role_name}' cannot be deleted.")
            
        # Check if the role is assigned to any users
        users_with_role_query = db.collection(USERS_COLLECTION).where("assignedRoleIds", "array-contains", role_name).limit(1).stream()
        if next(users_with_role_query, None) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, 
                detail=f"Role '{role_name}' is currently assigned to one or more users and cannot be deleted. Please unassign it first."
            )
            
        doc_ref.delete()
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting role {role_name}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")
