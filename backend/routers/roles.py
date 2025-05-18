from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from firebase_admin import firestore # For firestore.SERVER_TIMESTAMP and type hinting AsyncClient

# Use direct imports from subdirectories of 'backend'
from dependencies.database import get_db
from dependencies.rbac import require_permission 
from models.role import RoleCreate, RoleUpdate, RoleResponse

router = APIRouter(
    prefix="/roles",
    tags=["roles"],
)

ROLES_COLLECTION = "roles"
USERS_COLLECTION = "users" 

@router.post(
    "/",
    response_model=RoleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("roles", "create"))]
)
async def create_role(role_data: RoleCreate, db: firestore.AsyncClient = Depends(get_db)):
    """
    Create a new role. 'roleName' from the request body will be used as the document ID.
    Requires 'roles:create' permission.
    """
    try:
        doc_ref = db.collection(ROLES_COLLECTION).document(role_data.roleName)
        existing_doc = await doc_ref.get()
        if existing_doc.exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Role with name '{role_data.roleName}' already exists.")

        new_role_dict = role_data.model_dump()
        new_role_dict["isSystemRole"] = False 
        new_role_dict["createdAt"] = firestore.SERVER_TIMESTAMP
        new_role_dict["updatedAt"] = firestore.SERVER_TIMESTAMP

        await doc_ref.set(new_role_dict)

        created_role_doc = await doc_ref.get()
        if created_role_doc.exists:
            response_data = created_role_doc.to_dict()
            response_data['id'] = created_role_doc.id 
            # For a newly created role, userCount will be 0
            response_data['userCount'] = 0
            return RoleResponse(**response_data)
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve role after creation.")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating role: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.get("/", response_model=List[RoleResponse], dependencies=[Depends(require_permission("roles", "list"))])
async def get_all_roles(db: firestore.AsyncClient = Depends(get_db)):
    """
    Get all roles. Requires 'roles:list' permission.
    Includes the count of users assigned to each role.
    """
    try:
        roles_list = []
        roles_docs_stream = db.collection(ROLES_COLLECTION).stream()
        
        async for role_doc in roles_docs_stream: 
            role_dict = role_doc.to_dict()
            role_id = role_doc.id # This is the roleName
            role_dict['id'] = role_id
            
            # Query users collection to count users assigned to this role
            # The role_id (which is roleName) is stored in the user's assignedRoleIds array
            users_with_role_query = db.collection(USERS_COLLECTION).where("assignedRoleIds", "array_contains", role_id)
            # To get just the count efficiently, we can stream and count, or use a count aggregate if available and preferred.
            # Streaming and counting manually:
            count = 0
            async for _ in users_with_role_query.stream(): # Iterate over the stream to count
                count += 1
            role_dict['userCount'] = count
            
            roles_list.append(RoleResponse(**role_dict))
            
        return roles_list
    except Exception as e:
        print(f"Error getting all roles: {e}") 
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred while fetching roles: {str(e)}")


@router.get("/{role_name}", response_model=RoleResponse, dependencies=[Depends(require_permission("roles", "view"))])
async def get_role_by_name(role_name: str, db: firestore.AsyncClient = Depends(get_db)):
    """
    Get a specific role by its name (which is its ID). Requires 'roles:view' permission.
    Includes the count of users assigned to this role.
    """
    try:
        doc_ref = db.collection(ROLES_COLLECTION).document(role_name)
        role_doc = await doc_ref.get()
        if role_doc.exists:
            response_data = role_doc.to_dict()
            response_data['id'] = role_doc.id 

            # Calculate userCount for this specific role
            users_with_role_query = db.collection(USERS_COLLECTION).where("assignedRoleIds", "array_contains", role_name)
            count = 0
            async for _ in users_with_role_query.stream():
                count += 1
            response_data['userCount'] = count
            
            return RoleResponse(**response_data)
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Role '{role_name}' not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting role by name {role_name}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.put("/{role_name}", response_model=RoleResponse, dependencies=[Depends(require_permission("roles", "edit"))])
async def update_role(role_name: str, role_update_data: RoleUpdate, db: firestore.AsyncClient = Depends(get_db)):
    """
    Update an existing role by its name (ID). 'roleName' itself cannot be changed.
    Requires 'roles:edit' permission. User count is re-fetched for the response.
    """
    try:
        doc_ref = db.collection(ROLES_COLLECTION).document(role_name)
        role_doc = await doc_ref.get()

        if not role_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Role '{role_name}' not found")

        role_data = role_doc.to_dict()
        if role_data.get("isSystemRole", False):
             raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"System role '{role_name}' cannot be modified via API.")

        update_data = role_update_data.model_dump(exclude_unset=True)

        if not update_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

        update_data["updatedAt"] = firestore.SERVER_TIMESTAMP

        await doc_ref.update(update_data)

        updated_role_doc = await doc_ref.get()
        response_data = updated_role_doc.to_dict()
        response_data['id'] = updated_role_doc.id 

        # Re-calculate userCount for the updated role response
        users_with_role_query = db.collection(USERS_COLLECTION).where("assignedRoleIds", "array_contains", role_name)
        count = 0
        async for _ in users_with_role_query.stream():
            count += 1
        response_data['userCount'] = count
        
        return RoleResponse(**response_data)

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating role {role_name}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.delete("/{role_name}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("roles", "delete"))])
async def delete_role(role_name: str, db: firestore.AsyncClient = Depends(get_db)):
    """
    Delete a role by its name (ID). Requires 'roles:delete' permission.
    """
    try:
        doc_ref = db.collection(ROLES_COLLECTION).document(role_name)
        role_doc = await doc_ref.get()

        if not role_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Role '{role_name}' not found")

        if role_doc.to_dict().get("isSystemRole"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"System role '{role_name}' cannot be deleted.")

        users_with_role_query = db.collection(USERS_COLLECTION).where("assignedRoleIds", "array_contains", role_name).limit(1).stream() 
        
        user_assigned = False
        async for _ in users_with_role_query: 
            user_assigned = True
            break
        
        if user_assigned:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Role '{role_name}' is currently assigned to one or more users and cannot be deleted. Please unassign it first."
            )

        await doc_ref.delete()

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting role {role_name}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")