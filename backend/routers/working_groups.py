from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from firebase_admin import firestore

from dependencies.database import get_db
from dependencies.rbac import RBACUser, get_current_user_with_rbac, require_permission
from models.working_group import WorkingGroupCreate, WorkingGroupUpdate, WorkingGroupResponse
from models.assignment import AssignmentCreate, AssignmentResponse, AssignmentUpdate # Reusing Assignment models

router = APIRouter(
    prefix="/working-groups",
    tags=["working-groups"]
)

WORKING_GROUPS_COLLECTION = "workingGroups"
ASSIGNMENTS_COLLECTION = "assignments"
USERS_COLLECTION = "users"

async def _get_user_details_wg(db: firestore.AsyncClient, user_id: str) -> dict:
    if not user_id:
        return {}
    user_ref = db.collection(USERS_COLLECTION).document(user_id)
    user_doc = await user_ref.get()
    if user_doc.exists:
        return user_doc.to_dict()
    return {}

@router.post(
    "",
    response_model=WorkingGroupResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("working_groups", "create"))]
)
async def create_working_group(
    wg_data: WorkingGroupCreate,
    db: firestore.AsyncClient = Depends(get_db),
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac)
):
    try:
        new_wg_dict = wg_data.model_dump()
        new_wg_dict["createdByUserId"] = current_rbac_user.uid
        new_wg_dict["createdAt"] = firestore.SERVER_TIMESTAMP
        new_wg_dict["updatedAt"] = firestore.SERVER_TIMESTAMP

        doc_ref = db.collection(WORKING_GROUPS_COLLECTION).document()
        await doc_ref.set(new_wg_dict)

        created_wg_doc = await doc_ref.get()
        if created_wg_doc.exists:
            response_data = created_wg_doc.to_dict()
            response_data['id'] = created_wg_doc.id

            creator_details = await _get_user_details_wg(db, response_data.get("createdByUserId"))
            response_data["creatorFirstName"] = creator_details.get("firstName")
            response_data["creatorLastName"] = creator_details.get("lastName")
            
            return WorkingGroupResponse(**response_data)
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve working group after creation.")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.get("", response_model=List[WorkingGroupResponse], dependencies=[Depends(require_permission("working_groups", "view"))])
async def list_working_groups(db: firestore.AsyncClient = Depends(get_db)):
    try:
        query = db.collection(WORKING_GROUPS_COLLECTION).order_by("groupName")
        docs_snapshot = query.stream()
        
        groups_list = []
        user_details_cache = {}

        async for doc in docs_snapshot:
            group_data = doc.to_dict()
            group_data['id'] = doc.id

            creator_id = group_data.get("createdByUserId")
            if creator_id and creator_id not in user_details_cache:
                user_details_cache[creator_id] = await _get_user_details_wg(db, creator_id)
            
            creator_details = user_details_cache.get(creator_id, {})
            group_data["creatorFirstName"] = creator_details.get("firstName")
            group_data["creatorLastName"] = creator_details.get("lastName")

            groups_list.append(WorkingGroupResponse(**group_data))
        return groups_list
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.get("/{group_id}", response_model=WorkingGroupResponse, dependencies=[Depends(require_permission("working_groups", "view"))])
async def get_working_group(group_id: str, db: firestore.AsyncClient = Depends(get_db)):
    try:
        doc_ref = db.collection(WORKING_GROUPS_COLLECTION).document(group_id)
        wg_doc = await doc_ref.get()
        if not wg_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Working group '{group_id}' not found")

        response_data = wg_doc.to_dict()
        response_data['id'] = wg_doc.id

        creator_details = await _get_user_details_wg(db, response_data.get("createdByUserId"))
        response_data["creatorFirstName"] = creator_details.get("firstName")
        response_data["creatorLastName"] = creator_details.get("lastName")

        return WorkingGroupResponse(**response_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.put("/{group_id}", response_model=WorkingGroupResponse, dependencies=[Depends(require_permission("working_groups", "edit"))])
async def update_working_group(
    group_id: str,
    wg_update_data: WorkingGroupUpdate,
    db: firestore.AsyncClient = Depends(get_db)
):
    try:
        doc_ref = db.collection(WORKING_GROUPS_COLLECTION).document(group_id)
        wg_doc_snapshot = await doc_ref.get()
        if not wg_doc_snapshot.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Working group '{group_id}' not found")

        update_data_dict = wg_update_data.model_dump(exclude_unset=True)
        if not update_data_dict:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

        update_data_dict["updatedAt"] = firestore.SERVER_TIMESTAMP
        await doc_ref.update(update_data_dict)

        updated_wg_doc = await doc_ref.get()
        response_data = updated_wg_doc.to_dict()
        response_data['id'] = updated_wg_doc.id
        
        creator_details = await _get_user_details_wg(db, response_data.get("createdByUserId"))
        response_data["creatorFirstName"] = creator_details.get("firstName")
        response_data["creatorLastName"] = creator_details.get("lastName")
            
        return WorkingGroupResponse(**response_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("working_groups", "delete"))])
async def delete_working_group(group_id: str, db: firestore.AsyncClient = Depends(get_db)):
    try:
        doc_ref = db.collection(WORKING_GROUPS_COLLECTION).document(group_id)
        wg_doc = await doc_ref.get()
        if not wg_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Working group '{group_id}' not found")
        
        await doc_ref.delete()
        
        # Also, delete related assignments
        assignments_query = db.collection(ASSIGNMENTS_COLLECTION) \
            .where(filter=firestore.FieldFilter("assignableId", "==", group_id)) \
            .where(filter=firestore.FieldFilter("assignableType", "==", "workingGroup"))
        
        async for assignment_doc in assignments_query.stream():
            await assignment_doc.reference.delete()

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


# --- Working Group Assignment Endpoints ---

@router.post(
    "/{group_id}/assignments",
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("working_groups", "manage_assignments"))] # New permission
)
async def assign_user_to_working_group(
    group_id: str,
    assignment_create_data: AssignmentCreate, # Contains userId, status etc.
    db: firestore.AsyncClient = Depends(get_db),
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac)
):
    # Verify working group exists
    wg_ref = db.collection(WORKING_GROUPS_COLLECTION).document(group_id)
    wg_doc = await wg_ref.get()
    if not wg_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Working group not found.")

    # Verify user to be assigned exists
    user_to_assign_ref = db.collection(USERS_COLLECTION).document(assignment_create_data.userId)
    user_to_assign_doc = await user_to_assign_ref.get()
    if not user_to_assign_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID '{assignment_create_data.userId}' not found.")
    user_to_assign_profile = user_to_assign_doc.to_dict()

    # Check if user is already assigned to this working group
    existing_assignment_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=firestore.FieldFilter("userId", "==", assignment_create_data.userId)) \
        .where(filter=firestore.FieldFilter("assignableId", "==", group_id)) \
        .where(filter=firestore.FieldFilter("assignableType", "==", "workingGroup")) \
        .limit(1)
    
    existing_doc_snap = None
    async for doc_snap in existing_assignment_query.stream():
        existing_doc_snap = doc_snap
        break
    if existing_doc_snap:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already assigned to this working group.")

    assignment_data_dict = assignment_create_data.model_dump()
    assignment_data_dict["assignableId"] = group_id
    assignment_data_dict["assignableType"] = "workingGroup"
    assignment_data_dict["assignedByUserId"] = current_rbac_user.uid
    assignment_data_dict["assignmentDate"] = firestore.SERVER_TIMESTAMP # Or from payload if allowed
    assignment_data_dict["createdAt"] = firestore.SERVER_TIMESTAMP
    assignment_data_dict["updatedAt"] = firestore.SERVER_TIMESTAMP
    
    assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document()
    await assignment_ref.set(assignment_data_dict)

    created_assignment_doc = await assignment_ref.get()
    response_data = created_assignment_doc.to_dict()
    response_data['id'] = created_assignment_doc.id
    response_data['userFirstName'] = user_to_assign_profile.get('firstName')
    response_data['userLastName'] = user_to_assign_profile.get('lastName')
    response_data['userEmail'] = user_to_assign_profile.get('email')
    
    return AssignmentResponse(**response_data)

@router.get(
    "/{group_id}/assignments",
    response_model=List[AssignmentResponse],
    dependencies=[Depends(require_permission("working_groups", "manage_assignments"))] # Or "view_assignments"
)
async def list_working_group_assignments(group_id: str, db: firestore.AsyncClient = Depends(get_db)):
    wg_ref = db.collection(WORKING_GROUPS_COLLECTION).document(group_id)
    if not (await wg_ref.get()).exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Working group not found.")

    assignments_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=firestore.FieldFilter("assignableId", "==", group_id)) \
        .where(filter=firestore.FieldFilter("assignableType", "==", "workingGroup"))
    
    assignments_list = []
    user_cache = {}
    async for assign_doc in assignments_query.stream():
        assignment_data = assign_doc.to_dict()
        assignment_data['id'] = assign_doc.id
        
        user_id = assignment_data.get('userId')
        if user_id not in user_cache:
            user_details = await _get_user_details_wg(db, user_id)
            user_cache[user_id] = user_details
        
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
    group_id: str, # For path consistency, though assignment_id is unique
    assignment_id: str,
    db: firestore.AsyncClient = Depends(get_db)
):
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
