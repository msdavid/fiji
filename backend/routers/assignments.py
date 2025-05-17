from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional, Literal
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
import datetime # Required for fallback datetime

from models.assignment import AssignmentResponse
# UserListResponse not directly used, user details are fetched by helper
# from models.user import UserListResponse 
# WorkingGroupResponse and EventResponse not directly used for response model, but _get_assignable_details knows their structure
# from models.working_group import WorkingGroupResponse 
# from models.event import EventResponse 
from dependencies.database import get_db
from dependencies.rbac import RBACUser, get_current_user_with_rbac, require_permission 

router = APIRouter(
    prefix="/assignments",
    tags=["assignments"]
)

ASSIGNMENTS_COLLECTION = "assignments"
USERS_COLLECTION = "users"
WORKING_GROUPS_COLLECTION = "workingGroups"
EVENTS_COLLECTION = "events"

async def _get_user_details_for_assignment(db: firestore.AsyncClient, user_id: str) -> Optional[dict]:
    if not user_id:
        return None
    user_doc = await db.collection(USERS_COLLECTION).document(user_id).get()
    if user_doc.exists:
        user_data = user_doc.to_dict()
        return {
            "userFirstName": user_data.get("firstName"),
            "userLastName": user_data.get("lastName"),
            "userEmail": user_data.get("email"),
        }
    return None # Returns None if user not found

async def _get_assignable_details(db: firestore.AsyncClient, assignable_id: str, assignable_type: str) -> dict:
    details = {"name": "N/A", "description": None} # Default structure
    if not assignable_id or not assignable_type:
        return details # Return default if crucial info is missing
    
    collection_name = ""
    name_field = ""
    description_field = "" # Optional: for more context

    if assignable_type == "workingGroup":
        collection_name = WORKING_GROUPS_COLLECTION
        name_field = "groupName"
        description_field = "description"
    elif assignable_type == "event":
        collection_name = EVENTS_COLLECTION
        name_field = "name" 
        description_field = "description"
    else:
        details["name"] = "Unknown Type"
        return details

    doc_ref = db.collection(collection_name).document(assignable_id)
    doc_snap = await doc_ref.get()

    if doc_snap.exists:
        data = doc_snap.to_dict()
        details["name"] = data.get(name_field, f"{assignable_type.capitalize()} Name Not Found")
        details["description"] = data.get(description_field)
    else:
        details["name"] = f"{assignable_type.capitalize()} ID '{assignable_id}' Not Found"
    return details


@router.get("", response_model=List[AssignmentResponse])
async def list_assignments(
    user_id: Optional[str] = Query(None, description="Filter assignments by user ID. Use 'me' for current user."),
    assignable_type: Optional[Literal["event", "workingGroup"]] = Query(None, description="Filter assignments by type (event or workingGroup)."),
    assignable_id: Optional[str] = Query(None, description="Filter assignments by the ID of the assignable entity (event or working group ID)."),
    db: firestore.AsyncClient = Depends(get_db),
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac)
):
    actual_user_id = current_rbac_user.uid if user_id == "me" else user_id

    # Permission checks
    if actual_user_id and actual_user_id != current_rbac_user.uid:
        if not current_rbac_user.has_privilege("assignments", "list_others_by_user"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to list assignments for other users.")
    elif assignable_id and not actual_user_id: # Querying for an entity's assignments, not filtered by a specific user yet
        # This implies listing all users for a given event/group.
        # Permission could be entity-specific, e.g. "working_groups:view_assignments"
        # For now, using a general permission.
        if not current_rbac_user.has_privilege("assignments", "list_others_by_entity"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to list assignments for this entity.")
    elif not actual_user_id and not assignable_id: # Broadest query
        if not current_rbac_user.has_privilege("assignments", "list_all_system"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to list all system assignments.")
    # If actual_user_id is current_rbac_user.uid, it's allowed (listing own assignments).

    query = db.collection(ASSIGNMENTS_COLLECTION)

    if actual_user_id:
        query = query.where(filter=FieldFilter("userId", "==", actual_user_id))
    if assignable_type:
        query = query.where(filter=FieldFilter("assignableType", "==", assignable_type))
    # If assignable_id is provided, filter by it.
    # This is useful for "list members of X" if not combined with a specific user_id.
    # If combined with user_id, it finds specific user's assignment to specific entity.
    if assignable_id: 
        query = query.where(filter=FieldFilter("assignableId", "==", assignable_id))
    
    assignments_list = []
    try:
        docs_snapshot = query.stream()
        async for doc in docs_snapshot:
            assignment_data = doc.to_dict()
            assignment_data['id'] = doc.id

            user_details = await _get_user_details_for_assignment(db, assignment_data.get("userId"))
            if user_details:
                assignment_data.update(user_details)
            # Pydantic model AssignmentResponse requires userFirstName, userLastName, userEmail.
            # Ensure they have default values if user_details is None or user document is incomplete.
            for user_field_key, default_val in [('userFirstName', "Unknown"), ('userLastName', "User"), ('userEmail', "unknown@example.com")]:
                if user_field_key not in assignment_data or assignment_data[user_field_key] is None:
                    assignment_data[user_field_key] = default_val
            
            assignable_details = await _get_assignable_details(db, assignment_data.get("assignableId"), assignment_data.get("assignableType"))
            assignment_data["assignableName"] = assignable_details.get("name")
            # assignment_data["assignableDescription"] = assignable_details.get("description") # If added to model

            # Ensure datetime fields are present and are actual datetime objects for Pydantic.
            # Firestore returns datetime objects for Timestamp fields.
            # If a field is missing from the document, it will be None here.
            # AssignmentResponse model expects non-optional datetimes.
            for dt_field in ["createdAt", "updatedAt", "assignmentDate"]:
                if not isinstance(assignment_data.get(dt_field), datetime.datetime):
                    print(f"Warning: Assignment {doc.id} has invalid or missing datetime for field {dt_field}. Value: {assignment_data.get(dt_field)}")
                    # Fallback or error. For now, let Pydantic catch it to highlight data issues.
                    # If it's a common issue, make fields Optional in Pydantic model or ensure data quality.
                    # assignment_data[dt_field] = datetime.datetime.utcnow() # Example fallback - not ideal

            try:
                assignments_list.append(AssignmentResponse(**assignment_data))
            except Exception as pydantic_error:
                print(f"Pydantic validation error for assignment {doc.id} during list_assignments: {pydantic_error}. Data: {assignment_data}")
                # Optionally skip this item
                continue
        return assignments_list
    except Exception as e:
        print(f"Error listing assignments: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")
