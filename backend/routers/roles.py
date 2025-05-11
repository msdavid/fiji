from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
import firebase_admin
from firebase_admin import firestore # For firestore.SERVER_TIMESTAMP and type hinting Client
import datetime

# Use absolute imports from 'backend'
from backend.dependencies.database import get_db 
from backend.dependencies.auth import get_firebase_user
from backend.models.role import RoleCreate, RoleUpdate, RoleResponse # Assuming models are also part of 'backend'

router = APIRouter(
    prefix="/roles",
    tags=["roles"],
)

ROLES_COLLECTION = "roles"

async def verify_sysadmin_role(current_user: dict = Depends(get_firebase_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    print(f"User {current_user.get('uid')} attempting admin operation on roles.")
    return current_user


@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_sysadmin_role)])
async def create_role(role_data: RoleCreate, db: firestore.Client = Depends(get_db)):
    try:
        existing_roles_query = db.collection(ROLES_COLLECTION).where("roleName", "==", role_data.roleName).limit(1)
        existing_roles = list(existing_roles_query.stream())
        if existing_roles:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Role with name '{role_data.roleName}' already exists.")

        new_role_dict = role_data.model_dump()
        new_role_dict["isSystemRole"] = False
        new_role_dict["createdAt"] = firestore.SERVER_TIMESTAMP
        new_role_dict["updatedAt"] = firestore.SERVER_TIMESTAMP
        
        doc_ref = db.collection(ROLES_COLLECTION).document()
        doc_ref.set(new_role_dict)
        
        created_role_doc = doc_ref.get()
        if created_role_doc.exists:
            return RoleResponse(roleId=created_role_doc.id, **created_role_doc.to_dict())
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve role after creation.")
            
    except HTTPException:
        raise 
    except Exception as e:
        print(f"Error creating role: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.get("/", response_model=List[RoleResponse], dependencies=[Depends(verify_sysadmin_role)])
async def get_all_roles(db: firestore.Client = Depends(get_db)):
    try:
        roles_list = []
        docs = db.collection(ROLES_COLLECTION).stream()
        for doc in docs:
            role_dict = doc.to_dict()
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

        update_data = role_update_data.model_dump(exclude_unset=True) 
        if not update_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")
            
        update_data["updatedAt"] = firestore.SERVER_TIMESTAMP
        
        doc_ref.update(update_data)
        
        updated_role_doc = doc_ref.get() 
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

        if role_doc.to_dict().get("isSystemRole"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="System roles cannot be deleted via API.")
            
        doc_ref.delete()
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting role {role_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")
