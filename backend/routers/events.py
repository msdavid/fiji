from fastapi import APIRouter, HTTPException, Depends, status, Query, Request 
from typing import List, Optional, Dict, Set
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter 
from google.cloud.firestore_v1.field_path import FieldPath 
import datetime
import json 

from dependencies.database import get_db
from dependencies.rbac import RBACUser, get_current_user_with_rbac, require_permission, is_sysadmin_check 
from models.event import EventCreate, EventUpdate, EventResponse, EventWithSignupStatus
from models.assignment import AssignmentCreate, AssignmentResponse, AssignmentUpdate 

router = APIRouter(
    prefix="/events",
    tags=["events"]
)

EVENTS_COLLECTION = "events"
ASSIGNMENTS_COLLECTION = "assignments"
USERS_COLLECTION = "users"
WORKING_GROUPS_COLLECTION = "workingGroups"
MAX_FIRESTORE_IN_QUERY_LIMIT = 30


async def _get_user_details(db: firestore.AsyncClient, user_id: str) -> dict:
    if not user_id: return {}
    user_ref = db.collection(USERS_COLLECTION).document(user_id)
    user_doc = await user_ref.get() 
    return user_doc.to_dict() if user_doc.exists else {}

async def _get_working_group_names_map(db: firestore.AsyncClient, wg_ids: List[str]) -> Dict[str, str]:
    if not wg_ids: return {}
    wg_names_map = {}
    unique_wg_ids = list(set(wg_ids)) 
    for i in range(0, len(unique_wg_ids), MAX_FIRESTORE_IN_QUERY_LIMIT):
        batch_ids = unique_wg_ids[i:i+MAX_FIRESTORE_IN_QUERY_LIMIT]
        if not batch_ids: continue
        
        wg_docs_snapshots = await db.collection(WORKING_GROUPS_COLLECTION).where(
            FieldPath.document_id(), "in", batch_ids
        ).get()
        for doc_snapshot in wg_docs_snapshots:
            if doc_snapshot.exists:
                data = doc_snapshot.to_dict()
                name_to_use = data.get("groupName", data.get("name", "Unknown WG"))
                wg_names_map[doc_snapshot.id] = name_to_use
    return wg_names_map


@router.post(
    "",
    response_model=EventResponse, # Restored response_model
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("events", "create"))]
)
async def create_event(
    event_data: EventCreate, # Reverted to use Pydantic model directly
    db: firestore.AsyncClient = Depends(get_db), 
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac)
):
    try:
        new_event_dict = event_data.model_dump()
        new_event_dict["createdByUserId"] = current_rbac_user.uid
        new_event_dict["createdAt"] = firestore.SERVER_TIMESTAMP
        new_event_dict["updatedAt"] = firestore.SERVER_TIMESTAMP
        
        valid_wg_ids = []
        wg_names_to_populate = []
        
        input_wg_ids = new_event_dict.get("workingGroupIds", [])

        if not input_wg_ids: # This check is technically redundant due to Pydantic's min_length=1
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="workingGroupIds list cannot be empty.")

        wg_docs_to_check_refs = [db.collection(WORKING_GROUPS_COLLECTION).document(wg_id) for wg_id in input_wg_ids]
        
        checked_wg_docs_temp = []
        if wg_docs_to_check_refs: 
            async for doc_snapshot in db.get_all(wg_docs_to_check_refs): 
                checked_wg_docs_temp.append(doc_snapshot)
        checked_wg_docs = checked_wg_docs_temp
        
        for wg_doc in checked_wg_docs: 
            if wg_doc.exists:
                valid_wg_ids.append(wg_doc.id)
                wg_data = wg_doc.to_dict()
                wg_name = wg_data.get("groupName", wg_data.get("name", "Unknown WG"))
                wg_names_to_populate.append(wg_name)

        if not valid_wg_ids or len(valid_wg_ids) != len(input_wg_ids): 
            # This ensures all provided IDs were valid and found.
            # If you want to allow partial success (some IDs valid, some not), adjust this logic.
            # For now, strict: all must be valid.
            invalid_ids = list(set(input_wg_ids) - set(valid_wg_ids))
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"One or more provided workingGroupIds are invalid or not found: {invalid_ids if invalid_ids else input_wg_ids}")
        
        new_event_dict["workingGroupIds"] = valid_wg_ids 

        if new_event_dict.get("organizerUserId"):
            organizer_doc = await db.collection(USERS_COLLECTION).document(new_event_dict["organizerUserId"]).get()
            if not organizer_doc.exists:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Organizer user with ID '{new_event_dict['organizerUserId']}' not found.")

        doc_ref = db.collection(EVENTS_COLLECTION).document()
        await doc_ref.set(new_event_dict)
        created_event_doc = await doc_ref.get()

        if created_event_doc.exists:
            response_data = created_event_doc.to_dict()
            response_data['id'] = created_event_doc.id 
            response_data['workingGroupNames'] = wg_names_to_populate

            creator_details = await _get_user_details(db, response_data.get("createdByUserId"))
            response_data["creatorFirstName"] = creator_details.get("firstName")
            response_data["creatorLastName"] = creator_details.get("lastName")

            if response_data.get("organizerUserId"):
                organizer_details = await _get_user_details(db, response_data["organizerUserId"])
                response_data["organizerFirstName"] = organizer_details.get("firstName")
                response_data["organizerLastName"] = organizer_details.get("lastName")
                response_data["organizerEmail"] = organizer_details.get("email")
            
            return EventResponse(**response_data) 
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve event after creation.")

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e: # Catches Pydantic validation errors as well if not caught by specific try-except
        # If it's a Pydantic error, it might be more user-friendly to return its specific details
        if "Pydantic validation error" in str(e) or "validation error" in str(e).lower(): # Basic check
             raise HTTPException(status_code=422, detail=str(e))
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected server error occurred: {str(e)}")

@router.put("/{event_id}", response_model=EventResponse, dependencies=[Depends(require_permission("events", "edit"))])
async def update_event(
    event_id: str, event_update_data: EventUpdate, db: firestore.AsyncClient = Depends(get_db) 
):
    try:
        doc_ref = db.collection(EVENTS_COLLECTION).document(event_id)
        event_doc_snapshot = await doc_ref.get()
        if not event_doc_snapshot.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Event '{event_id}' not found")

        update_data_dict = event_update_data.model_dump(exclude_unset=True)

        if not update_data_dict:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

        wg_names_to_populate_on_success = []
        if "workingGroupIds" in update_data_dict and update_data_dict["workingGroupIds"] is not None:
            input_wg_ids_update = update_data_dict["workingGroupIds"]
            if not input_wg_ids_update: 
                 raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="workingGroupIds, if provided for update, must not be empty.")

            valid_updated_wg_ids = []
            wg_update_docs_refs = [db.collection(WORKING_GROUPS_COLLECTION).document(wg_id) for wg_id in input_wg_ids_update]
            
            checked_update_wg_docs_temp = []
            if wg_update_docs_refs:
                async for doc_snapshot in db.get_all(wg_update_docs_refs): 
                    checked_update_wg_docs_temp.append(doc_snapshot)
            checked_update_wg_docs = checked_update_wg_docs_temp
            
            for wg_doc in checked_update_wg_docs:
                if wg_doc.exists:
                    valid_updated_wg_ids.append(wg_doc.id)
                    wg_data = wg_doc.to_dict()
                    wg_names_to_populate_on_success.append(wg_data.get("groupName") or wg_data.get("name") or "Unknown WG")
            
            if len(valid_updated_wg_ids) != len(input_wg_ids_update):
                 invalid_ids = list(set(input_wg_ids_update) - set(valid_updated_wg_ids))
                 raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"One or more provided workingGroupIds for update are invalid: {invalid_ids}")
            
            update_data_dict["workingGroupIds"] = valid_updated_wg_ids
            update_data_dict["workingGroupId"] = None 
        
        existing_event_data = event_doc_snapshot.to_dict()
        final_start_time_str = update_data_dict.get("dateTime", existing_event_data.get("dateTime"))
        final_end_time_str = update_data_dict.get("endTime", existing_event_data.get("endTime"))
        final_start_time = final_start_time_str
        if isinstance(final_start_time_str, str): final_start_time = datetime.datetime.fromisoformat(final_start_time_str.replace("Z", "+00:00"))
        final_end_time = final_end_time_str
        if isinstance(final_end_time_str, str): final_end_time = datetime.datetime.fromisoformat(final_end_time_str.replace("Z", "+00:00"))
        if final_start_time and final_end_time and final_end_time <= final_start_time:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="End time must be after start time.")
        if "organizerUserId" in update_data_dict:
            org_uid = update_data_dict["organizerUserId"]
            if org_uid is not None: 
                organizer_doc = await db.collection(USERS_COLLECTION).document(org_uid).get()
                if not organizer_doc.exists:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Organizer user with ID '{org_uid}' not found.")

        update_data_dict["updatedAt"] = firestore.SERVER_TIMESTAMP
        await doc_ref.update(update_data_dict)

        updated_event_doc = await doc_ref.get()
        response_data = updated_event_doc.to_dict()
        response_data['id'] = updated_event_doc.id

        if response_data.get("workingGroupIds"):
            if not wg_names_to_populate_on_success and response_data["workingGroupIds"]:
                 wg_names_map = await _get_working_group_names_map(db, response_data["workingGroupIds"])
                 wg_names_to_populate_on_success = [wg_names_map.get(wg_id, "Unknown WG") for wg_id in response_data["workingGroupIds"]]
            response_data["workingGroupNames"] = wg_names_to_populate_on_success
        elif response_data.get("workingGroupId"): 
            wg_details_map = await _get_working_group_names_map(db, [response_data["workingGroupId"]])
            response_data["workingGroupNames"] = [wg_details_map.get(response_data["workingGroupId"], "Unknown WG")] if response_data.get("workingGroupId") in wg_details_map else []

        creator_details = await _get_user_details(db, response_data.get("createdByUserId"))
        response_data["creatorFirstName"] = creator_details.get("firstName")
        response_data["creatorLastName"] = creator_details.get("lastName")

        if response_data.get("organizerUserId"):
            organizer_details = await _get_user_details(db, response_data["organizerUserId"])
            response_data["organizerFirstName"] = organizer_details.get("firstName")
            response_data["organizerLastName"] = organizer_details.get("lastName")
            response_data["organizerEmail"] = organizer_details.get("email")

        return EventResponse(**response_data)
    except HTTPException as http_exc: # Catch specific HTTPExceptions first
        raise http_exc
    except Exception as e: # Catch other errors, including Pydantic validation if not caught by FastAPI
        if "Pydantic validation error" in str(e) or "validation error" in str(e).lower():
             raise HTTPException(status_code=422, detail=str(e))
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.get("", response_model=List[EventWithSignupStatus])
async def list_events(
    db: firestore.AsyncClient = Depends(get_db), 
    current_rbac_user: Optional[RBACUser] = Depends(get_current_user_with_rbac),
    status_filter: Optional[str] = Query(None, alias="status"),
    from_date: Optional[datetime.date] = Query(None, description="Filter events from this date (YYYY-MM-DD). Defaults to today if days_range is also provided or if no date filters are set."),
    days_range: Optional[int] = Query(14, description="Number of days from from_date to include in the filter (e.g., 1 for just from_date, 7 for a week). Defaults to 14. Max 90.", ge=1, le=90)
):
    try:
        query = db.collection(EVENTS_COLLECTION)
        is_privileged_user = await is_sysadmin_check(current_rbac_user) 

        if not is_privileged_user and current_rbac_user:
            user_wg_assignments_query = db.collection(ASSIGNMENTS_COLLECTION) \
                .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
                .where(filter=FieldFilter("assignableType", "==", "working_group"))
            
            user_wg_ids = [doc.to_dict()["assignableId"] async for doc in user_wg_assignments_query.stream()]

            if not user_wg_ids: return [] 
            
            if len(user_wg_ids) > MAX_FIRESTORE_IN_QUERY_LIMIT:
                 user_wg_ids = user_wg_ids[:MAX_FIRESTORE_IN_QUERY_LIMIT]

            query = query.where(filter=FieldFilter("workingGroupIds", "array-contains-any", user_wg_ids))
        
        elif not current_rbac_user: return [] 

        today = datetime.date.today()
        actual_from_date = from_date if from_date else today
        if days_range is None: days_range = 14 
        actual_to_date = actual_from_date + datetime.timedelta(days=days_range - 1)
        
        from_datetime_utc = datetime.datetime.combine(actual_from_date, datetime.time.min, tzinfo=datetime.timezone.utc)
        to_datetime_utc = datetime.datetime.combine(actual_to_date, datetime.time.max, tzinfo=datetime.timezone.utc)
        
        if status_filter: query = query.where(filter=FieldFilter("status", "==", status_filter))
        query = query.where(filter=FieldFilter("dateTime", ">=", from_datetime_utc))
        query = query.where(filter=FieldFilter("dateTime", "<=", to_datetime_utc))
        query = query.order_by("dateTime", direction=firestore.Query.ASCENDING)

        docs_snapshot = query.stream()
        user_assignments: Dict[str, str] = {}
        temp_event_data_list = []
        all_user_ids_to_fetch: Set[str] = set()
        all_event_wg_ids_flat: Set[str] = set() 

        async for doc in docs_snapshot: 
            event_data = doc.to_dict()
            
            if not is_privileged_user and not event_data.get("workingGroupIds"):
                 continue

            event_data['id'] = doc.id 
            temp_event_data_list.append(event_data)

            if event_data.get("organizerUserId"): all_user_ids_to_fetch.add(event_data["organizerUserId"])
            if event_data.get("createdByUserId"): all_user_ids_to_fetch.add(event_data["createdByUserId"])
            
            if event_data.get("workingGroupIds"): 
                all_event_wg_ids_flat.update(event_data["workingGroupIds"])
            elif event_data.get("workingGroupId"): 
                all_event_wg_ids_flat.add(event_data["workingGroupId"])


        user_details_map = {}
        if all_user_ids_to_fetch:
            user_ids_list = list(all_user_ids_to_fetch)
            for i in range(0, len(user_ids_list), MAX_FIRESTORE_IN_QUERY_LIMIT):
                batch_ids = user_ids_list[i:i+MAX_FIRESTORE_IN_QUERY_LIMIT]
                if not batch_ids: continue
                users_snapshot_docs = await db.collection(USERS_COLLECTION).where(FieldPath.document_id(), "in", batch_ids).get()
                for user_doc_snap in users_snapshot_docs: user_details_map[user_doc_snap.id] = user_doc_snap.to_dict()
        
        wg_names_map = await _get_working_group_names_map(db, list(all_event_wg_ids_flat))

        if current_rbac_user and current_rbac_user.uid:
            assignments_query_fs = db.collection(ASSIGNMENTS_COLLECTION).where(filter=FieldFilter("userId", "==", current_rbac_user.uid)).where(filter=FieldFilter("assignableType", "==", "event"))
            async for assign_doc in assignments_query_fs.stream(): 
                assign_data = assign_doc.to_dict()
                user_assignments[assign_data.get("assignableId")] = assign_data.get("status", "unknown")
        
        events_list = []
        for event_data_item in temp_event_data_list: 
            is_signed_up = user_assignments.get(event_data_item['id']) is not None if current_rbac_user else None 
            assignment_status = user_assignments.get(event_data_item['id']) if is_signed_up else None 

            if event_data_item.get("createdByUserId"):
                creator_details = user_details_map.get(event_data_item["createdByUserId"], {})
                event_data_item["creatorFirstName"] = creator_details.get("firstName")
                event_data_item["creatorLastName"] = creator_details.get("lastName")

            if event_data_item.get("organizerUserId"):
                org_details = user_details_map.get(event_data_item["organizerUserId"], {})
                event_data_item["organizerFirstName"] = org_details.get("firstName")
                event_data_item["organizerLastName"] = org_details.get("lastName")
                event_data_item["organizerEmail"] = org_details.get("email")
            
            current_event_wg_names = []
            if event_data_item.get("workingGroupIds"):
                current_event_wg_names = [wg_names_map.get(wg_id, "Unknown WG") for wg_id in event_data_item["workingGroupIds"] if wg_id in wg_names_map]
            elif event_data_item.get("workingGroupId"): 
                legacy_wg_name = wg_names_map.get(event_data_item["workingGroupId"], "Unknown WG")
                if legacy_wg_name != "Unknown WG" or event_data_item["workingGroupId"]: 
                     current_event_wg_names.append(legacy_wg_name)
            event_data_item["workingGroupNames"] = current_event_wg_names

            events_list.append(EventWithSignupStatus(**event_data_item, isCurrentUserSignedUp=is_signed_up, currentUserAssignmentStatus=assignment_status))
        return events_list
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        import traceback
        print(f"Error in list_events: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred while listing events: {str(e)}")

@router.get("/{event_id}", response_model=EventWithSignupStatus)
async def get_event(
    event_id: str,
    db: firestore.AsyncClient = Depends(get_db), 
    current_rbac_user: Optional[RBACUser] = Depends(get_current_user_with_rbac)
):
    try:
        doc_ref = db.collection(EVENTS_COLLECTION).document(event_id)
        event_doc = await doc_ref.get()
        if not event_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Event '{event_id}' not found")

        event_data_from_db = event_doc.to_dict() 
        event_data_from_db['id'] = event_doc.id 
        
        is_privileged_user = await is_sysadmin_check(current_rbac_user) 
        
        event_wg_ids_list = event_data_from_db.get("workingGroupIds")
        event_legacy_wg_id = event_data_from_db.get("workingGroupId")
        
        authorized_to_view = False
        if is_privileged_user:
            authorized_to_view = True
        elif current_rbac_user:
            user_wg_assignments_query = db.collection(ASSIGNMENTS_COLLECTION) \
                .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
                .where(filter=FieldFilter("assignableType", "==", "working_group"))
            user_member_of_wg_ids = {doc.to_dict()["assignableId"] async for doc in user_wg_assignments_query.stream()}

            if event_wg_ids_list: 
                if any(wg_id in user_member_of_wg_ids for wg_id in event_wg_ids_list):
                    authorized_to_view = True
            elif event_legacy_wg_id: 
                if event_legacy_wg_id in user_member_of_wg_ids:
                    authorized_to_view = True
        
        if not authorized_to_view:
             raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not authorized to view this event.")

        wg_names_to_populate = []
        ids_to_fetch_names_for = []
        if event_wg_ids_list:
            ids_to_fetch_names_for.extend(event_wg_ids_list)
        elif event_legacy_wg_id:
            ids_to_fetch_names_for.append(event_legacy_wg_id)
        
        if ids_to_fetch_names_for:
            fetched_wg_names_map = await _get_working_group_names_map(db, list(set(ids_to_fetch_names_for)))
            wg_names_to_populate = [fetched_wg_names_map.get(wg_id, "Unknown WG") for wg_id in ids_to_fetch_names_for if wg_id in fetched_wg_names_map]
        event_data_from_db["workingGroupNames"] = wg_names_to_populate


        creator_details = await _get_user_details(db, event_data_from_db.get("createdByUserId"))
        event_data_from_db["creatorFirstName"] = creator_details.get("firstName")
        event_data_from_db["creatorLastName"] = creator_details.get("lastName")

        if event_data_from_db.get("organizerUserId"):
            organizer_details = await _get_user_details(db, event_data_from_db["organizerUserId"])
            event_data_from_db["organizerFirstName"] = organizer_details.get("firstName") 
            event_data_from_db["organizerLastName"] = organizer_details.get("lastName")  
            event_data_from_db["organizerEmail"] = organizer_details.get("email")        

        is_signed_up = None
        assignment_status = None
        if current_rbac_user and current_rbac_user.uid:
            assignment_query = db.collection(ASSIGNMENTS_COLLECTION) \
                                 .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
                                 .where(filter=FieldFilter("assignableId", "==", event_id)) \
                                 .where(filter=FieldFilter("assignableType", "==", "event")) \
                                 .limit(1)
            
            assignment_doc_snap = None
            async for doc_snap in assignment_query.stream(): 
                assignment_doc_snap = doc_snap
                break
            
            if assignment_doc_snap:
                is_signed_up = True
                assignment_status = assignment_doc_snap.to_dict().get("status")
        return EventWithSignupStatus(**event_data_from_db, isCurrentUserSignedUp=is_signed_up, currentUserAssignmentStatus=assignment_status)
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error in get_event for event_id {event_id}: {str(e)}") 
        import traceback
        traceback.print_exc() 
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("events", "delete"))])
async def delete_event(event_id: str, db: firestore.AsyncClient = Depends(get_db)): 
    try:
        event_doc_ref = db.collection(EVENTS_COLLECTION).document(event_id)
        event_doc = await event_doc_ref.get()
        if not event_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Event '{event_id}' not found")
        
        assignments_query = db.collection(ASSIGNMENTS_COLLECTION) \
            .where(filter=FieldFilter("assignableId", "==", event_id)) \
            .where(filter=FieldFilter("assignableType", "==", "event"))
        
        assignments_snapshot = assignments_query.stream()
        
        batch = db.batch()
        async for assignment_doc in assignments_snapshot:
            batch.delete(assignment_doc.reference)
        await batch.commit() 

        await event_doc_ref.delete()
        
    except Exception as e:
        print(f"Error deleting event {event_id} and its assignments: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.post("/{event_id}/signup", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def self_signup_for_event(
    event_id: str,
    db: firestore.AsyncClient = Depends(get_db), 
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac)
):
    event_ref = db.collection(EVENTS_COLLECTION).document(event_id)
    event_doc = await event_ref.get()
    if not event_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    event_data_dict = event_doc.to_dict() 
    
    is_privileged_user = await is_sysadmin_check(current_rbac_user)
    authorized_to_interact = False
    if is_privileged_user:
        authorized_to_interact = True
    elif current_rbac_user:
        user_wg_assignments_query = db.collection(ASSIGNMENTS_COLLECTION) \
            .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
            .where(filter=FieldFilter("assignableType", "==", "working_group"))
        user_member_of_wg_ids = {doc.to_dict()["assignableId"] async for doc in user_wg_assignments_query.stream()}

        event_wg_ids_list = event_data_dict.get("workingGroupIds")
        event_legacy_wg_id = event_data_dict.get("workingGroupId")

        if event_wg_ids_list:
            if any(wg_id in user_member_of_wg_ids for wg_id in event_wg_ids_list):
                authorized_to_interact = True
        elif event_legacy_wg_id:
            if event_legacy_wg_id in user_member_of_wg_ids:
                authorized_to_interact = True
    
    if not authorized_to_interact:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not authorized to interact with this event.")


    if event_data_dict.get("status") not in ["open_for_signup", "Open for Signup"]: 
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event is not open for signups.")

    existing_assignment_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
        .where(filter=FieldFilter("assignableId", "==", event_id)) \
        .where(filter=FieldFilter("assignableType", "==", "event")) \
        .limit(1)
    existing_doc = None
    async for doc in existing_assignment_query.stream(): existing_doc = doc; break
    if existing_doc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already signed up for this event.")
    assignment_data_dict_payload = { 
        "userId": current_rbac_user.uid, "assignableId": event_id, "assignableType": "event",
        "status": "confirmed", "assignedByUserId": "self_signup",
        "assignmentDate": firestore.SERVER_TIMESTAMP, "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document()
    await assignment_ref.set(assignment_data_dict_payload) 
    created_assignment_doc = await assignment_ref.get()
    response_data = created_assignment_doc.to_dict()
    response_data['id'] = created_assignment_doc.id
    user_profile_details = await _get_user_details(db, current_rbac_user.uid)
    response_data['userFirstName'] = user_profile_details.get('firstName')
    response_data['userLastName'] = user_profile_details.get('lastName')
    response_data['userEmail'] = user_profile_details.get('email')
    return AssignmentResponse(**response_data)

@router.delete("/{event_id}/signup", status_code=status.HTTP_204_NO_CONTENT)
async def withdraw_event_signup(
    event_id: str,
    db: firestore.AsyncClient = Depends(get_db), 
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac)
):
    assignment_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
        .where(filter=FieldFilter("assignableId", "==", event_id)) \
        .where(filter=FieldFilter("assignableType", "==", "event")) \
        .limit(1)

    assignment_doc_snap = None
    async for doc_snap in assignment_query.stream(): 
        assignment_doc_snap = doc_snap
        break
        
    if not assignment_doc_snap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signup not found for this user and event.")

    await assignment_doc_snap.reference.delete()
    return None

@router.get(
    "/{event_id}/assignments",
    response_model=List[AssignmentResponse],
    dependencies=[Depends(require_permission("events", "manage_assignments"))]
)
async def list_event_assignments(event_id: str, db: firestore.AsyncClient = Depends(get_db)): 
    event_ref = db.collection(EVENTS_COLLECTION).document(event_id)
    event_doc = await event_ref.get()
    if not event_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    assignments_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=FieldFilter("assignableId", "==", event_id)) \
        .where(filter=FieldFilter("assignableType", "==", "event"))

    assignments_list = []
    user_cache = {}

    async for assign_doc in assignments_query.stream():
        assignment_data = assign_doc.to_dict()
        assignment_data['id'] = assign_doc.id

        user_id = assignment_data.get('userId')
        if user_id not in user_cache: 
            user_details = await _get_user_details(db, user_id)
            user_cache[user_id] = user_details
        
        user_profile = user_cache[user_id]
        assignment_data['userFirstName'] = user_profile.get('firstName')
        assignment_data['userLastName'] = user_profile.get('lastName')
        assignment_data['userEmail'] = user_profile.get('email')

        assignments_list.append(AssignmentResponse(**assignment_data))
    return assignments_list

@router.post(
    "/{event_id}/assignments", 
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("events", "manage_assignments"))]
)
async def admin_create_event_assignment( 
    event_id: str,
    assignment_create_data: AssignmentCreate, 
    db: firestore.AsyncClient = Depends(get_db), 
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac)
):
    event_ref = db.collection(EVENTS_COLLECTION).document(event_id)
    event_doc = await event_ref.get()
    if not event_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    user_to_assign_ref = db.collection(USERS_COLLECTION).document(assignment_create_data.userId)
    user_to_assign_doc = await user_to_assign_ref.get()
    if not user_to_assign_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID '{assignment_create_data.userId}' not found.")
    user_to_assign_profile = user_to_assign_doc.to_dict()

    existing_assignment_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=FieldFilter("userId", "==", assignment_create_data.userId)) \
        .where(filter=FieldFilter("assignableId", "==", event_id)) \
        .where(filter=FieldFilter("assignableType", "==", "event")) \
        .limit(1)
    
    existing_doc = None
    async for doc in existing_assignment_query.stream():
        existing_doc = doc
        break
    if existing_doc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already assigned to this event.")

    assignment_data_dict_payload = assignment_create_data.model_dump() 
    assignment_data_dict_payload["assignableId"] = event_id 
    assignment_data_dict_payload["assignableType"] = "event" 
    assignment_data_dict_payload["assignedByUserId"] = current_rbac_user.uid
    assignment_data_dict_payload["createdAt"] = firestore.SERVER_TIMESTAMP
    assignment_data_dict_payload["updatedAt"] = firestore.SERVER_TIMESTAMP
    
    assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document()
    await assignment_ref.set(assignment_data_dict_payload) 

    created_assignment_doc = await assignment_ref.get()
    response_data = created_assignment_doc.to_dict()
    response_data['id'] = created_assignment_doc.id
    response_data['userFirstName'] = user_to_assign_profile.get('firstName')
    response_data['userLastName'] = user_to_assign_profile.get('lastName')
    response_data['userEmail'] = user_to_assign_profile.get('email')

    return AssignmentResponse(**response_data)

@router.put(
    "/{event_id}/assignments/{assignment_id}",
    response_model=AssignmentResponse,
    dependencies=[Depends(require_permission("events", "manage_assignments"))]
)
async def admin_update_event_assignment( 
    event_id: str,
    assignment_id: str,
    assignment_update_data: AssignmentUpdate,
    db: firestore.AsyncClient = Depends(get_db) 
):
    assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document(assignment_id)
    assignment_doc = await assignment_ref.get()
    if not assignment_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")

    assignment_current_data = assignment_doc.to_dict()
    if assignment_current_data.get("assignableId") != event_id or \
       assignment_current_data.get("assignableType") != "event":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignment does not belong to the specified event.")

    update_data_dict = assignment_update_data.model_dump(exclude_unset=True) 
    if not update_data_dict:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

    update_data_dict["updatedAt"] = firestore.SERVER_TIMESTAMP 
    await assignment_ref.update(update_data_dict) 

    updated_assignment_doc = await assignment_ref.get()
    response_data = updated_assignment_doc.to_dict()
    response_data['id'] = updated_assignment_doc.id

    user_profile_details = await _get_user_details(db, response_data['userId'])
    response_data['userFirstName'] = user_profile_details.get('firstName')
    response_data['userLastName'] = user_profile_details.get('lastName')
    response_data['userEmail'] = user_profile_details.get('email')

    return AssignmentResponse(**response_data)

@router.delete(
    "/{event_id}/assignments/{assignment_id}", 
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("events", "manage_assignments"))]
)
async def admin_delete_event_assignment( 
    event_id: str,
    assignment_id: str,
    db: firestore.AsyncClient = Depends(get_db) 
):
    assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document(assignment_id)
    assignment_doc = await assignment_ref.get()
    if not assignment_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")

    assignment_current_data = assignment_doc.to_dict()
    if assignment_current_data.get("assignableId") != event_id or \
       assignment_current_data.get("assignableType") != "event":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignment does not belong to the specified event.")

    await assignment_ref.delete()
    return None