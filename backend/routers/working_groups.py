from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from pydantic import BaseModel, Field

from dependencies.database import get_db
from dependencies.rbac import RBACUser, require_permission, is_sysadmin_check
from dependencies.auth import get_current_session_user_with_rbac, get_current_session_user
from models.working_group import WorkingGroupCreate, WorkingGroupUpdate, WorkingGroupResponse
from models.assignment import AssignmentCreate, AssignmentResponse, AssignmentUpdate # Using AssignmentResponse from models
# Removed UserResponse import as it's not directly used here, user details are in AssignmentResponse
# from models.user import UserResponse 

router = APIRouter(
    prefix="/working-groups",
    tags=["working-groups"]
)

WORKING_GROUPS_COLLECTION = "workingGroups"
USERS_COLLECTION = "users"
ASSIGNMENTS_COLLECTION = "assignments"
GLOBAL_WG_ID = "organization-wide"  # Fixed ID for the global working group

async def _get_user_details(db: firestore.AsyncClient, user_id: str) -> Optional[dict]:
    """Helper function to fetch user details."""
    if not user_id:
        return None
    user_ref = db.collection(USERS_COLLECTION).document(user_id)
    user_doc = await user_ref.get()
    if user_doc.exists:
        return user_doc.to_dict()
    return None

async def _ensure_global_working_group_exists(db: firestore.AsyncClient) -> None:
    """
    Ensure the global working group exists. Creates it if missing.
    This is called automatically when listing working groups to ensure
    the global working group is always available.
    """
    try:
        # Check if global working group exists
        global_wg_ref = db.collection(WORKING_GROUPS_COLLECTION).document(GLOBAL_WG_ID)
        global_wg_doc = await global_wg_ref.get()
        
        if not global_wg_doc.exists:
            print(f"Creating missing global working group: {GLOBAL_WG_ID}")
            
            # Create the global working group
            global_wg_data = {
                "groupName": "Organization Wide",
                "description": "Default organization-wide working group. All users are automatically members of this group to enable global events and announcements.",
                "status": "active",
                "createdByUserId": "system",
                "createdAt": firestore.SERVER_TIMESTAMP,
                "updatedAt": firestore.SERVER_TIMESTAMP,
                "isGlobal": True
            }
            
            await global_wg_ref.set(global_wg_data)
            print(f"✅ Created global working group: Organization Wide")
        
    except Exception as e:
        print(f"Warning: Failed to ensure global working group exists: {str(e)}")
        # Don't fail the request if global WG creation fails

@router.post(
    "",
    response_model=WorkingGroupResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("working_groups", "create"))]
)
async def create_working_group(
    group_data: WorkingGroupCreate,
    db: firestore.AsyncClient = Depends(get_db),
    current_rbac_user: RBACUser = Depends(get_current_session_user_with_rbac)
):
    try:
        new_group_dict = group_data.model_dump()
        new_group_dict["createdByUserId"] = current_rbac_user.uid
        new_group_dict["createdAt"] = firestore.SERVER_TIMESTAMP
        new_group_dict["updatedAt"] = firestore.SERVER_TIMESTAMP

        doc_ref = db.collection(WORKING_GROUPS_COLLECTION).document()
        await doc_ref.set(new_group_dict)

        created_group_doc = await doc_ref.get()
        if created_group_doc.exists:
            response_data = created_group_doc.to_dict()
            response_data['id'] = created_group_doc.id
            
            creator_details = await _get_user_details(db, response_data.get("createdByUserId"))
            if creator_details:
                response_data["creatorFirstName"] = creator_details.get("firstName")
                response_data["creatorLastName"] = creator_details.get("lastName")
            
            return WorkingGroupResponse(**response_data)
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve working group after creation.")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


async def _check_working_groups_access(
    current_rbac_user: RBACUser = Depends(get_current_session_user_with_rbac)
) -> RBACUser:
    """
    Custom permission check for working groups endpoint.
    Allows access if user has either:
    - working_groups.view permission (for general working group management)
    - events.create permission (for event creation requiring working group selection)
    """
    if (current_rbac_user.has_permission("working_groups", "view") or 
        current_rbac_user.has_permission("events", "create")):
        return current_rbac_user
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="User does not have permission to view working groups. Requires either 'working_groups:view' or 'events:create' permission."
    )

@router.get("", response_model=List[WorkingGroupResponse])
async def list_working_groups(
    db: firestore.AsyncClient = Depends(get_db),
    current_rbac_user: RBACUser = Depends(_check_working_groups_access)
):
    try:
        # Ensure global working group exists (auto-create if missing)
        await _ensure_global_working_group_exists(db)
        
        # Check if user is sysadmin
        is_privileged_user = current_rbac_user.is_sysadmin if current_rbac_user else False
        
        # For non-sysadmin users, filter working groups by user assignments
        allowed_wg_ids = []
        if not is_privileged_user and current_rbac_user:
            user_wg_assignments_query = db.collection(ASSIGNMENTS_COLLECTION) \
                .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
                .where(filter=FieldFilter("assignableType", "==", "workingGroup"))
            
            allowed_wg_ids = [doc.to_dict()["assignableId"] async for doc in user_wg_assignments_query.stream()]
            
            # Always include the global working group for all authenticated users
            # This ensures the global working group is available in forms and lists
            # since all users are automatically members of the global working group
            if GLOBAL_WG_ID not in allowed_wg_ids:
                allowed_wg_ids.append(GLOBAL_WG_ID)
            
            print(f"DEBUG: User {current_rbac_user.uid} allowed working groups: {allowed_wg_ids}")
            
            # If user has no working group assignments and no event permissions, return empty list
            if not allowed_wg_ids:
                return []
        
        groups_query = db.collection(WORKING_GROUPS_COLLECTION).order_by("groupName", direction=firestore.Query.ASCENDING)
        docs_snapshot = groups_query.stream()
        
        groups_list = []
        user_details_cache = {}
        all_groups_debug = []

        async for doc in docs_snapshot:
            group_data = doc.to_dict()
            group_data['id'] = doc.id
            all_groups_debug.append(f"{doc.id}:{group_data.get('groupName')}")
            
            # Filter by user assignments for non-sysadmin users
            if not is_privileged_user and doc.id not in allowed_wg_ids:
                continue
            
            created_by_user_id = group_data.get("createdByUserId")
            if created_by_user_id:
                if created_by_user_id not in user_details_cache:
                    user_details_cache[created_by_user_id] = await _get_user_details(db, created_by_user_id)
                creator_details = user_details_cache[created_by_user_id]
                if creator_details:
                    group_data["creatorFirstName"] = creator_details.get("firstName")
                    group_data["creatorLastName"] = creator_details.get("lastName")

            groups_list.append(WorkingGroupResponse(**group_data))
        
        print(f"DEBUG: All working groups in DB: {all_groups_debug}")
        print(f"DEBUG: Returning {len(groups_list)} working groups for user")
        return groups_list
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.get("/{group_id}", response_model=WorkingGroupResponse, dependencies=[Depends(require_permission("working_groups", "view"))])
async def get_working_group(group_id: str, db: firestore.AsyncClient = Depends(get_db)):
    try:
        doc_ref = db.collection(WORKING_GROUPS_COLLECTION).document(group_id)
        group_doc = await doc_ref.get()
        if not group_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Working group '{group_id}' not found")

        group_data = group_doc.to_dict()
        group_data['id'] = group_doc.id

        creator_details = await _get_user_details(db, group_data.get("createdByUserId"))
        if creator_details:
            group_data["creatorFirstName"] = creator_details.get("firstName")
            group_data["creatorLastName"] = creator_details.get("lastName")
            
        return WorkingGroupResponse(**group_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.put(
    "/{group_id}",
    response_model=WorkingGroupResponse,
    dependencies=[Depends(require_permission("working_groups", "edit"))]
)
async def update_working_group(
    group_id: str,
    group_update_data: WorkingGroupUpdate,
    db: firestore.AsyncClient = Depends(get_db)
):
    try:
        # Protect the global working group from being edited
        if group_id == GLOBAL_WG_ID:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="The 'Organization Wide' working group is a system group and cannot be edited."
            )
            
        doc_ref = db.collection(WORKING_GROUPS_COLLECTION).document(group_id)
        group_doc_snapshot = await doc_ref.get()
        if not group_doc_snapshot.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Working group '{group_id}' not found")

        update_data_dict = group_update_data.model_dump(exclude_unset=True)
        if not update_data_dict:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

        update_data_dict["updatedAt"] = firestore.SERVER_TIMESTAMP
        await doc_ref.update(update_data_dict)

        updated_group_doc = await doc_ref.get()
        response_data = updated_group_doc.to_dict()
        response_data['id'] = updated_group_doc.id
        
        creator_details = await _get_user_details(db, response_data.get("createdByUserId"))
        if creator_details:
            response_data["creatorFirstName"] = creator_details.get("firstName")
            response_data["creatorLastName"] = creator_details.get("lastName")

        return WorkingGroupResponse(**response_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.delete(
    "/{group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("working_groups", "delete"))]
)
async def delete_working_group(group_id: str, db: firestore.AsyncClient = Depends(get_db)):
    try:
        # Protect the global working group from being deleted
        if group_id == GLOBAL_WG_ID:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="The 'Organization Wide' working group is a system group and cannot be deleted."
            )
            
        group_doc_ref = db.collection(WORKING_GROUPS_COLLECTION).document(group_id)
        group_doc = await group_doc_ref.get()
        if not group_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Working group '{group_id}' not found")

        assignments_query = db.collection(ASSIGNMENTS_COLLECTION) \
            .where(filter=FieldFilter("assignableId", "==", group_id)) \
            .where(filter=FieldFilter("assignableType", "==", "workingGroup"))
        
        assignments_snapshot = assignments_query.stream()
        
        batch = db.batch()
        async for assignment_doc in assignments_snapshot:
            batch.delete(assignment_doc.reference)
        await batch.commit()

        await group_doc_ref.delete()
    except Exception as e:
        print(f"Error deleting working group {group_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

# --- Working Group Assignment Endpoints ---

class WorkingGroupAssignmentCreate(BaseModel):
    userId: str = Field(..., description="ID of the user to assign.")
    status: Optional[str] = Field("active", description="Status of the assignment, e.g., 'active'.")


@router.post(
    "/{group_id}/assignments",
    response_model=AssignmentResponse, # Using global AssignmentResponse
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("working_groups", "manage_assignments"))]
)
async def assign_user_to_working_group(
    group_id: str,
    assignment_data: WorkingGroupAssignmentCreate,
    db: firestore.AsyncClient = Depends(get_db),
    current_rbac_user: RBACUser = Depends(get_current_session_user_with_rbac)
):
    # Protect the global working group from manual assignment management
    if group_id == GLOBAL_WG_ID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="The 'Organization Wide' working group has automatic membership. Users cannot be manually assigned."
        )
        
    group_ref = db.collection(WORKING_GROUPS_COLLECTION).document(group_id)
    group_doc = await group_ref.get()
    if not group_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Working group not found.")

    user_to_assign_ref = db.collection(USERS_COLLECTION).document(assignment_data.userId)
    user_to_assign_doc = await user_to_assign_ref.get()
    if not user_to_assign_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID '{assignment_data.userId}' not found.")
    user_to_assign_profile = user_to_assign_doc.to_dict()

    existing_assignment_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=FieldFilter("userId", "==", assignment_data.userId)) \
        .where(filter=FieldFilter("assignableId", "==", group_id)) \
        .where(filter=FieldFilter("assignableType", "==", "workingGroup")) \
        .limit(1)
    
    existing_doc_snap = None
    async for doc_snap in existing_assignment_query.stream(): # Iterate async
        existing_doc_snap = doc_snap
        break # Found one, no need to continue
        
    if existing_doc_snap:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already assigned to this working group.")

    new_assignment_dict = {
        "userId": assignment_data.userId,
        "assignableId": group_id,
        "assignableType": "workingGroup",
        "status": assignment_data.status,
        "assignedByUserId": current_rbac_user.uid,
        "assignmentDate": firestore.SERVER_TIMESTAMP, # Should be assignmentDate as per model
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    # Ensure all fields for AssignmentCreate are present or handled by AssignmentBase defaults
    # performanceNotes and hoursContributed are Optional and default to None in AssignmentBase

    assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document()
    await assignment_ref.set(new_assignment_dict)
    
    created_assignment_doc = await assignment_ref.get()
    response_data = created_assignment_doc.to_dict()
    response_data['id'] = created_assignment_doc.id
    
    response_data['userFirstName'] = user_to_assign_profile.get('firstName')
    response_data['userLastName'] = user_to_assign_profile.get('lastName')
    response_data['userEmail'] = user_to_assign_profile.get('email')

    return AssignmentResponse(**response_data)


# Removed local UserAssignmentResponse class as models.assignment.AssignmentResponse already includes user details.

@router.get(
    "/{group_id}/assignments",
    response_model=List[AssignmentResponse], # Using global AssignmentResponse
    dependencies=[Depends(require_permission("working_groups", "manage_assignments"))] # Or a more general view permission
)
async def list_working_group_assignments(group_id: str, db: firestore.AsyncClient = Depends(get_db)):
    group_ref = db.collection(WORKING_GROUPS_COLLECTION).document(group_id)
    group_doc = await group_ref.get()
    if not group_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Working group not found.")

    assignments_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=FieldFilter("assignableId", "==", group_id)) \
        .where(filter=FieldFilter("assignableType", "==", "workingGroup"))

    assignments_list = []
    user_cache = {}

    async for assign_doc in assignments_query.stream():
        assignment_data = assign_doc.to_dict()
        assignment_data['id'] = assign_doc.id
        
        user_id = assignment_data.get('userId')
        if user_id:
            if user_id not in user_cache:
                user_details = await _get_user_details(db, user_id)
                user_cache[user_id] = user_details if user_details else {}
            
            user_profile = user_cache[user_id]
            assignment_data['userFirstName'] = user_profile.get('firstName')
            assignment_data['userLastName'] = user_profile.get('lastName')
            assignment_data['userEmail'] = user_profile.get('email')
        
        assignments_list.append(AssignmentResponse(**assignment_data))
    return assignments_list


@router.delete(
    "/{group_id}/assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("working_groups", "manage_assignments"))]
)
async def remove_user_from_working_group(
    group_id: str,
    assignment_id: str,
    db: firestore.AsyncClient = Depends(get_db)
):
    # Protect the global working group from manual assignment management
    if group_id == GLOBAL_WG_ID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="The 'Organization Wide' working group has automatic membership. Users cannot be manually removed."
        )
        
    assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document(assignment_id)
    assignment_doc = await assignment_ref.get()
    if not assignment_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")

    assignment_data = assignment_doc.to_dict()
    if assignment_data.get("assignableId") != group_id or \
       assignment_data.get("assignableType") != "workingGroup":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignment does not belong to the specified working group.")

    await assignment_ref.delete()
    return None