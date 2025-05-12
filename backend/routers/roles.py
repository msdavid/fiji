from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
import firebase_admin
from firebase_admin import firestore # For firestore.SERVER_TIMESTAMP and type hinting Client
import datetime

# Use relative imports from the 'backend' directory as root
from dependencies.database import get_db 
from dependencies.auth import get_firebase_user
from models.role import RoleCreate, RoleUpdate, RoleResponse 

router = APIRouter(
    prefix="/roles",
    tags=["roles"],
)

ROLES_COLLECTION = "roles"

async def verify_sysadmin_role(current_user: dict = Depends(get_firebase_user)):
    # This is a placeholder. In a real app, you'd check if the user has a 'sysadmin' role
    # by looking up their roles in Firestore based on current_user['uid'].
    # For now, just ensuring a user is authenticated is the basic check.
    # A more robust check would involve:
    # 1. Getting user's roles from Firestore (e.g., from a 'users' collection).
    # 2. Checking if 'sysadmin' (or a role with equivalent privileges) is among them.
    if not current_user: # Basic check: user must be authenticated
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    # Example of a more robust check (requires db access and user profile structure):
    # db = get_db_somehow() # This dependency needs to be available or passed differently
    # user_profile_ref = db.collection("users").document(current_user["uid"])
    # user_profile = user_profile_ref.get()
    # if not user_profile.exists or "sysadmin" not in user_profile.to_dict().get("assignedRoleIds", []):
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have sysadmin privileges.")
    print(f"User {current_user.get('uid')} attempting admin operation on roles.") # Log attempt
    return current_user


@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_sysadmin_role)])
async def create_role(role_data: RoleCreate, db: firestore.Client = Depends(get_db)):
    try:
        # Check if role with the same name already exists (case-sensitive)
        existing_roles_query = db.collection(ROLES_COLLECTION).where("roleName", "==", role_data.roleName).limit(1)
        existing_roles = list(existing_roles_query.stream()) # Execute query
        if existing_roles:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Role with name '{role_data.roleName}' already exists.")

        # Prepare data for Firestore
        new_role_dict = role_data.model_dump() # Pydantic V2
        # new_role_dict = role_data.dict() # Pydantic V1
        new_role_dict["isSystemRole"] = False # API-created roles are not system roles
        new_role_dict["createdAt"] = firestore.SERVER_TIMESTAMP
        new_role_dict["updatedAt"] = firestore.SERVER_TIMESTAMP
        
        # Add to Firestore
        doc_ref = db.collection(ROLES_COLLECTION).document() # Auto-generate ID
        doc_ref.set(new_role_dict)
        
        # Fetch the created document to include server-generated timestamps and ID
        created_role_doc = doc_ref.get()
        if created_role_doc.exists:
            # Use RoleResponse model for consistent output
            return RoleResponse(roleId=created_role_doc.id, **created_role_doc.to_dict())
        else:
            # This case should ideally not happen if set() was successful
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve role after creation.")
            
    except HTTPException: # Re-raise HTTPExceptions directly
        raise 
    except Exception as e:
        print(f"Error creating role: {e}") # Log the error for debugging
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.get("/", response_model=List[RoleResponse], dependencies=[Depends(verify_sysadmin_role)])
async def get_all_roles(db: firestore.Client = Depends(get_db)):
    try:
        roles_list = []
        docs = db.collection(ROLES_COLLECTION).stream()
        for doc in docs:
            role_dict = doc.to_dict()
            # Ensure all fields required by RoleResponse are present or have defaults
            roles_list.append(RoleResponse(roleId=doc.id, **role_dict))
        return roles_list
    except Exception as e:
        print(f"Error getting all roles: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.get("/{role_id}", response_model=RoleResponse, dependencies=[Depends(verify_sysadmin_role)])
async def get_role_by_id(role_id: str, db: firestore.Client = Depends(get_db)):
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
async def update_role(role_id: str, role_update_data: RoleUpdate, db: firestore.Client = Depends(get_db)):
    try:
        doc_ref = db.collection(ROLES_COLLECTION).document(role_id)
        role_doc = doc_ref.get()

        if not role_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

        # Prevent updating roleName to one that already exists (excluding the current role itself)
        if role_update_data.roleName:
            existing_roles_query = db.collection(ROLES_COLLECTION).where("roleName", "==", role_update_data.roleName).limit(1).stream()
            for existing_role_doc in existing_roles_query:
                if existing_role_doc.id != role_id:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Another role with name '{role_update_data.roleName}' already exists.")

        # Get update data, excluding fields that were not set in the request
        update_data = role_update_data.model_dump(exclude_unset=True) # Pydantic V2
        # update_data = role_update_data.dict(exclude_unset=True) # Pydantic V1
        
        if not update_data: # If no actual data fields were provided for update
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")
            
        # Add/update the 'updatedAt' timestamp
        update_data["updatedAt"] = firestore.SERVER_TIMESTAMP
        
        doc_ref.update(update_data)
        
        updated_role_doc = doc_ref.get() # Re-fetch the document to get the updated version
        return RoleResponse(roleId=updated_role_doc.id, **updated_role_doc.to_dict())
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating role {role_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_sysadmin_role)])
async def delete_role(role_id: str, db: firestore.Client = Depends(get_db)):
    try:
        doc_ref = db.collection(ROLES_COLLECTION).document(role_id)
        role_doc = doc_ref.get()

        if not role_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

        # Prevent deletion of system roles
        if role_doc.to_dict().get("isSystemRole"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="System roles cannot be deleted via API.")
            
        # TODO: Add logic to check if this role is currently assigned to any users.
        # If it is, decide on a policy: prevent deletion, or unassign, or reassign to a default role.
        # For now, we allow deletion even if assigned.
            
        doc_ref.delete()
        # No content is returned for 204, so no need to return anything here.
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting role {role_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")
