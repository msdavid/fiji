from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional, Literal, Dict
from firebase_admin import firestore # For FieldPath
from google.cloud.firestore_v1.base_query import FieldFilter
import datetime # Required for fallback datetime

from models.assignment import AssignmentResponse
from dependencies.database import get_db
from dependencies.rbac import RBACUser, get_current_user_with_rbac, require_permission
from dependencies.auth import get_current_session_user_with_rbac 

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
    return None

async def _get_assignable_details(db: firestore.AsyncClient, assignable_id: str, assignable_type: str) -> dict:
    details = {
        "name": "N/A", 
        "description": None,
        "startDate": None # For assignableStartDate
    }
    if not assignable_id or not assignable_type:
        details["name"] = f"Invalid assignable_id or assignable_type provided ({assignable_id}, {assignable_type})"
        print(f"Warning: Invalid assignable_id or assignable_type in _get_assignable_details: ID='{assignable_id}', Type='{assignable_type}'")
        return details
    
    collection_name = ""
    name_field = ""
    description_field = ""
    date_field = "" 

    if assignable_type == "workingGroup":
        collection_name = WORKING_GROUPS_COLLECTION
        name_field = "groupName"
        description_field = "description"
        # No specific date_field for working groups in this context
    elif assignable_type == "event":
        collection_name = EVENTS_COLLECTION
        name_field = "eventName" 
        description_field = "description" 
        date_field = "dateTime" 
    else:
        details["name"] = f"Unknown Assignable Type: {assignable_type}"
        print(f"Warning: Unknown assignable_type in _get_assignable_details: Type='{assignable_type}', ID='{assignable_id}'")
        return details

    doc_ref = db.collection(collection_name).document(assignable_id)
    doc_snap = await doc_ref.get()

    if doc_snap.exists:
        data = doc_snap.to_dict()
        retrieved_name = data.get(name_field)
        if retrieved_name:
            details["name"] = retrieved_name
        else:
            details["name"] = f"{assignable_type.capitalize()} Name Not Found (Field: {name_field})"
            print(f"Warning: Document found for {assignable_type} ID '{assignable_id}' in collection '{collection_name}' but its '{name_field}' field is missing or null.")
        
        details["description"] = data.get(description_field)
        
        if date_field and data.get(date_field):
            dt_value = data.get(date_field)
            if isinstance(dt_value, datetime.datetime):
                details["startDate"] = dt_value.isoformat() # Store as ISO string
            elif isinstance(dt_value, str): # If it's already an ISO string from Firestore
                try:
                    # Validate if it's a parseable ISO string, then store
                    datetime.datetime.fromisoformat(dt_value.replace("Z", "+00:00")) 
                    details["startDate"] = dt_value
                except ValueError:
                    print(f"Warning: Found string for {date_field} for {assignable_type} ID '{assignable_id}' but it's not a valid ISO date string: {dt_value}")
                    details["startDate"] = None # Or handle as an error
            else:
                print(f"Warning: Unexpected type for {date_field} for {assignable_type} ID '{assignable_id}': {type(dt_value)}. Value: {dt_value}")
                details["startDate"] = None
    else:
        details["name"] = f"{assignable_type.capitalize()} ID '{assignable_id}' Not Found"
        print(f"Warning: Document not found for {assignable_type} ID '{assignable_id}' in collection '{collection_name}'.")
    return details


@router.get("", response_model=List[AssignmentResponse])
async def list_assignments(
    user_id: Optional[str] = Query(None, description="Filter assignments by user ID. Use 'me' for current user."),
    assignable_type: Optional[Literal["event", "workingGroup"]] = Query(None, description="Filter assignments by type (event or workingGroup)."),
    assignable_id: Optional[str] = Query(None, description="Filter assignments by the ID of the assignable entity (event or working group ID)."),
    db: firestore.AsyncClient = Depends(get_db),
    current_rbac_user: RBACUser = Depends(get_current_session_user_with_rbac)
):
    actual_user_id = current_rbac_user.uid if user_id == "me" else user_id

    if actual_user_id and actual_user_id != current_rbac_user.uid:
        if not current_rbac_user.has_permission("assignments", "list_others_by_user"): 
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to list assignments for other users.")
    elif assignable_id and not actual_user_id: 
        if not current_rbac_user.has_permission("assignments", "list_others_by_entity"): 
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to list assignments for this entity.")
    elif not actual_user_id and not assignable_id: 
        if not current_rbac_user.has_permission("assignments", "list_all_system"): 
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to list all system assignments.")

    query = db.collection(ASSIGNMENTS_COLLECTION)
    if actual_user_id:
        query = query.where(filter=FieldFilter("userId", "==", actual_user_id))
    if assignable_type:
        query = query.where(filter=FieldFilter("assignableType", "==", assignable_type))
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
            for user_field_key, default_val in [('userFirstName', "Unknown"), ('userLastName', "User"), ('userEmail', "unknown@example.com")]:
                if user_field_key not in assignment_data or assignment_data[user_field_key] is None:
                    assignment_data[user_field_key] = default_val
            
            assignable_item_details = await _get_assignable_details(db, assignment_data.get("assignableId"), assignment_data.get("assignableType"))
            assignment_data["assignableName"] = assignable_item_details.get("name")
            assignment_data["assignableStartDate"] = assignable_item_details.get("startDate") 

            for dt_field in ["createdAt", "updatedAt", "assignmentDate"]:
                if not isinstance(assignment_data.get(dt_field), datetime.datetime):
                    if assignment_data.get(dt_field) is None: 
                         assignment_data[dt_field] = datetime.datetime.now(datetime.timezone.utc) 

            try:
                assignments_list.append(AssignmentResponse(**assignment_data))
            except Exception as pydantic_error:
                print(f"Pydantic validation error for assignment {doc.id} during list_assignments: {pydantic_error}. Data: {assignment_data}")
                continue
        return assignments_list
    except Exception as e:
        print(f"Error listing assignments: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")
