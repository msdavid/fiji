from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional, Any, Dict, Set
from firebase_admin import firestore, auth
from google.cloud.firestore_v1.base_query import FieldFilter
import datetime

from models.user import (
    UserResponse, UserUpdate, UserListResponse,
    UserSearchResponseItem, UserAvailability, UserAdminCreatePayload, UserAdminCreateResponse
)
from dependencies.database import get_db
# Updated imports for auth dependencies
from dependencies.auth import get_current_session_user # For /me routes
from dependencies.rbac import RBACUser, require_permission # For other admin routes
from dependencies.auth import get_current_session_user_with_rbac # For session-based auth
from utils.password_generator import generate_random_password

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

USERS_COLLECTION = "users"
ROLES_COLLECTION = "roles"
ASSIGNMENTS_COLLECTION = "assignments"
EVENTS_COLLECTION = "events"

USER_DELETED_PLACEHOLDER_ID = "deleted_user_placeholder"

def _sanitize_user_data_fields(user_data: Dict[str, Any]) -> Dict[str, Any]:
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
    else:
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
            role_names.append(role_id)
    return role_names

async def _get_privileges_and_sysadmin(db: firestore.AsyncClient, assigned_role_ids: List[str]) -> tuple[Dict[str, List[str]], bool]:
    is_sysadmin = "sysadmin" in assigned_role_ids
    consolidated_privileges_set: Dict[str, Set[str]] = {}
    if not is_sysadmin and assigned_role_ids:
        for role_id in assigned_role_ids:
            role_doc_ref = db.collection(ROLES_COLLECTION).document(role_id)
            role_doc = await role_doc_ref.get()
            if role_doc.exists:
                role_data = role_doc.to_dict()
                privileges_for_role = role_data.get("privileges", {})
                for resource, actions in privileges_for_role.items():
                    if not isinstance(actions, list): continue
                    if resource not in consolidated_privileges_set:
                        consolidated_privileges_set[resource] = set()
                    consolidated_privileges_set[resource].update(actions)
    
    consolidated_privileges_list = {resource: list(actions) for resource, actions in consolidated_privileges_set.items()}
    return consolidated_privileges_list, is_sysadmin

@router.post(
    "/admin-create",
    response_model=UserAdminCreateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("users", "admin_create"))]
)
async def admin_create_user(
    user_create_data: UserAdminCreatePayload,
    db: firestore.AsyncClient = Depends(get_db),
):
    try:
        try:
            auth.get_user_by_email(user_create_data.email)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with email '{user_create_data.email}' already exists in Firebase Authentication."
            )
        except auth.UserNotFoundError:
            pass
        generated_password = generate_random_password(12)
        try:
            firebase_user = auth.create_user(
                email=user_create_data.email,
                password=generated_password,
                display_name=f"{user_create_data.firstName} {user_create_data.lastName}",
                email_verified=False
            )
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create user in authentication system: {str(e)}")

        firestore_user_data = {
            "email": user_create_data.email,
            "firstName": user_create_data.firstName,
            "lastName": user_create_data.lastName,
            "status": user_create_data.status,
            "assignedRoleIds": user_create_data.assignedRoleIds or [],
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "skills": [], "qualifications": [],
            "availability": UserAvailability().model_dump(),
        }
        user_doc_ref = db.collection(USERS_COLLECTION).document(firebase_user.uid)
        await user_doc_ref.set(firestore_user_data)
        created_user_doc = await user_doc_ref.get()
        if not created_user_doc.exists:
            try: auth.delete_user(firebase_user.uid)
            except Exception as cleanup_e: print(f"Error cleaning up Firebase Auth user {firebase_user.uid}: {cleanup_e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save user profile after auth creation.")

        response_data = created_user_doc.to_dict()
        response_data['id'] = created_user_doc.id
        response_data['generatedPassword'] = generated_password
        response_data["assignedRoleNames"] = await _get_role_names(db, response_data.get("assignedRoleIds", []))
        response_data["privileges"], response_data["isSysadmin"] = await _get_privileges_and_sysadmin(db, response_data.get("assignedRoleIds", []))
        return UserAdminCreateResponse(**response_data)
    except HTTPException:
        raise
    except Exception as e:
        if 'firebase_user' in locals() and firebase_user and firebase_user.uid:
             try: auth.delete_user(firebase_user.uid)
             except Exception as cleanup_e: print(f"Error cleaning up Firebase Auth user {firebase_user.uid}: {cleanup_e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error: {str(e)}")

@router.get("", response_model=List[UserListResponse], dependencies=[Depends(require_permission("users", "list"))])
async def list_users(
    db: firestore.AsyncClient = Depends(get_db),
    offset: int = 0,
    limit: int = Query(default=20, le=200),
    roleId: Optional[str] = Query(None)
):
    try:
        users_ref = db.collection(USERS_COLLECTION)
        query = users_ref.order_by("lastName").order_by("firstName")
        if roleId:
            query = query.where("assignedRoleIds", "array_contains", roleId)
        query = query.limit(limit).offset(offset)
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error: {str(e)}")

@router.get("/search", response_model=List[UserSearchResponseItem], dependencies=[Depends(require_permission("users", "list"))])
async def search_users(
    q: str = Query(..., min_length=2),
    db: firestore.AsyncClient = Depends(get_db)
):
    search_term_lower = q.lower()
    users_list = []
    try:
        all_users_snapshot = await db.collection(USERS_COLLECTION).get()
        for doc in all_users_snapshot:
            user_data = doc.to_dict()
            user_data['id'] = doc.id
            if search_term_lower in user_data.get("firstName", "").lower() or \
               search_term_lower in user_data.get("lastName", "").lower() or \
               search_term_lower in user_data.get("email", "").lower():
                users_list.append(UserSearchResponseItem(**user_data))
            if len(users_list) >= 20: break
        return users_list
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"User search error: {str(e)}")

@router.get("/me", response_model=UserResponse)
async def read_users_me(
    # Changed dependency to use the new session user
    current_session_user: dict = Depends(get_current_session_user),
    db: firestore.AsyncClient = Depends(get_db)
):
    user_id = current_session_user.get("uid")
    user_doc_snap = await db.collection(USERS_COLLECTION).document(user_id).get()
    if not user_doc_snap.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Current user not found in Firestore")
    
    user_data = user_doc_snap.to_dict()
    user_data['id'] = user_doc_snap.id
    user_data = _sanitize_user_data_fields(user_data)
    user_data["assignedRoleNames"] = await _get_role_names(db, user_data.get("assignedRoleIds", []))
    
    # Re-fetch/calculate privileges and isSysadmin based on user_id from session
    user_data["privileges"], user_data["isSysadmin"] = await _get_privileges_and_sysadmin(db, user_data.get("assignedRoleIds", []))
    
    return UserResponse(**user_data)

@router.put("/me", response_model=UserResponse)
async def update_users_me(
    user_update_data: UserUpdate,
    # Changed dependency to use the new session user
    current_session_user: dict = Depends(get_current_session_user),
    db: firestore.AsyncClient = Depends(get_db)
):
    user_id = current_session_user.get("uid")
    user_ref = db.collection(USERS_COLLECTION).document(user_id)
    
    update_dict = user_update_data.model_dump(exclude_unset=True, exclude={"assignedRoleIds", "status", "email", "notes"})
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
        
        # Re-fetch/calculate privileges and isSysadmin based on user_id from session
        response_data["privileges"], response_data["isSysadmin"] = await _get_privileges_and_sysadmin(db, response_data.get("assignedRoleIds", []))

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
    user_data["privileges"], user_data["isSysadmin"] = await _get_privileges_and_sysadmin(db, user_data.get("assignedRoleIds", []))
    return UserResponse(**user_data)


@router.put("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_permission("users", "edit"))])
async def update_user_by_admin(
    user_id: str,
    user_update_data: UserUpdate,
    db: firestore.AsyncClient = Depends(get_db),
    # Updated to use session-based authentication for admins
    current_admin_user: RBACUser = Depends(get_current_session_user_with_rbac) 
):
    user_ref = db.collection(USERS_COLLECTION).document(user_id)
    user_doc_snap = await user_ref.get()
    if not user_doc_snap.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User '{user_id}' not found")

    update_dict = user_update_data.model_dump(exclude_unset=True)
    if "email" in update_dict and update_dict["email"] != user_doc_snap.to_dict().get("email"):
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
        response_data["privileges"], response_data["isSysadmin"] = await _get_privileges_and_sysadmin(db, response_data.get("assignedRoleIds", []))
        return UserResponse(**response_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("users", "delete"))]
)
async def delete_user_by_admin(
    user_id: str,
    db: firestore.AsyncClient = Depends(get_db),
    current_admin_user: RBACUser = Depends(get_current_session_user_with_rbac)
):
    if user_id == current_admin_user.uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins cannot delete their own accounts.")
    try:
        auth.get_user(user_id)
        auth.delete_user(user_id)
    except auth.UserNotFoundError:
        pass # User not in Firebase Auth, proceed to Firestore
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Firebase Auth delete error: {str(e)}")
    
    user_doc_ref = db.collection(USERS_COLLECTION).document(user_id)
    try:
        if (await user_doc_ref.get()).exists:
            await user_doc_ref.delete()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Firestore delete error: {str(e)}")

    # Comprehensive cleanup of user references across all collections
    try:
        # 1. Delete all assignments where user is the assignee (all types: event, workingGroup, etc.)
        assignments_query = db.collection(ASSIGNMENTS_COLLECTION).where(filter=FieldFilter("userId", "==", user_id))
        assignments_docs = await assignments_query.get()
        for doc_snap in assignments_docs:
            await doc_snap.reference.delete()

        # 2. Update assignments where user was the assigner (except "self_signup")
        assignments_by_user_query = db.collection(ASSIGNMENTS_COLLECTION).where(filter=FieldFilter("assignedByUserId", "==", user_id))
        assignments_by_user_docs = await assignments_by_user_query.get()
        for doc_snap in assignments_by_user_docs:
            await doc_snap.reference.update({"assignedByUserId": USER_DELETED_PLACEHOLDER_ID})
        
        # 3. Update events created by this user
        events_created_query = db.collection(EVENTS_COLLECTION).where(filter=FieldFilter("createdByUserId", "==", user_id))
        events_created_docs = await events_created_query.get()
        for doc_snap in events_created_docs:
            await doc_snap.reference.update({"createdByUserId": USER_DELETED_PLACEHOLDER_ID})

        # 4. Update events organized by this user
        events_organized_query = db.collection(EVENTS_COLLECTION).where(filter=FieldFilter("organizerUserId", "==", user_id))
        events_organized_docs = await events_organized_query.get()
        for doc_snap in events_organized_docs:
            await doc_snap.reference.update({
                "organizerUserId": None, 
                "organizerFirstName": None, 
                "organizerLastName": None, 
                "organizerEmail": None
            })

        # 5. Update working groups created by this user
        wg_created_query = db.collection("working_groups").where(filter=FieldFilter("createdByUserId", "==", user_id))
        wg_created_docs = await wg_created_query.get()
        for doc_snap in wg_created_docs:
            await doc_snap.reference.update({"createdByUserId": USER_DELETED_PLACEHOLDER_ID})

        # 6. Remove user from working group member lists
        wg_member_query = db.collection("working_groups").where(filter=FieldFilter("memberUserIds", "array_contains", user_id))
        wg_member_docs = await wg_member_query.get()
        for doc_snap in wg_member_docs:
            await doc_snap.reference.update({"memberUserIds": firestore.ArrayRemove([user_id])})

        # 7. Update donations recorded by this user
        donations_recorded_query = db.collection("donations").where(filter=FieldFilter("recordedByUserId", "==", user_id))
        donations_recorded_docs = await donations_recorded_query.get()
        for doc_snap in donations_recorded_docs:
            await doc_snap.reference.update({
                "recordedByUserId": USER_DELETED_PLACEHOLDER_ID,
                "recordedByUserFirstName": None,
                "recordedByUserLastName": None
            })

        # 8. Update invitations created by this user  
        invitations_created_query = db.collection("invitations").where(filter=FieldFilter("createdByUserId", "==", user_id))
        invitations_created_docs = await invitations_created_query.get()
        for doc_snap in invitations_created_docs:
            await doc_snap.reference.update({"createdByUserId": USER_DELETED_PLACEHOLDER_ID})

        print(f"Successfully cleaned up user data for deleted user: {user_id}")
    except Exception as e:
        print(f"Error during user data cleanup for {user_id}: {e}") # Log and continue
    return

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
    user_doc_ref = db.collection(USERS_COLLECTION).document(user_id)
    role_doc_ref = db.collection(ROLES_COLLECTION).document(role_id_to_assign)
    if not (await user_doc_ref.get()).exists: raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")
    if not (await role_doc_ref.get()).exists: raise HTTPException(status_code=404, detail=f"Role '{role_id_to_assign}' not found.")
    try:
        await user_doc_ref.update({"assignedRoleIds": firestore.ArrayUnion([role_id_to_assign]), "updatedAt": firestore.SERVER_TIMESTAMP})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error assigning role: {str(e)}")
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
    user_doc_ref = db.collection(USERS_COLLECTION).document(user_id)
    if not (await user_doc_ref.get()).exists: raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")
    try:
        await user_doc_ref.update({"assignedRoleIds": firestore.ArrayRemove([role_id_to_unassign]), "updatedAt": firestore.SERVER_TIMESTAMP})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error unassigning role: {str(e)}")
    return
