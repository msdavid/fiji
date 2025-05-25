from fastapi import APIRouter, HTTPException, Depends, status, Query, Request 
from typing import List, Optional, Dict, Set
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter 
from google.cloud.firestore_v1.field_path import FieldPath 
import datetime
import json 
from dateutil import rrule 

from dependencies.database import get_db
from dependencies.rbac import RBACUser, get_current_user_with_rbac, require_permission, is_sysadmin_check
from dependencies.auth import get_current_session_user_with_rbac 
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
    response_model=EventResponse, 
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("events", "create"))]
)
async def create_event(
    event_data: EventCreate, 
    db: firestore.AsyncClient = Depends(get_db), 
    current_rbac_user: RBACUser = Depends(get_current_session_user_with_rbac)
):
    try:
        new_event_dict = event_data.model_dump()
        new_event_dict["createdByUserId"] = current_rbac_user.uid
        new_event_dict["createdAt"] = firestore.SERVER_TIMESTAMP
        new_event_dict["updatedAt"] = firestore.SERVER_TIMESTAMP
        
        if new_event_dict.get("recurrence_rule"):
            try:
                rrule.rrulestr(new_event_dict["recurrence_rule"], dtstart=new_event_dict["dateTime"])
            except ValueError as e:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid recurrence_rule format: {e}")

        valid_wg_ids = []
        wg_names_to_populate = []
        
        input_wg_ids = new_event_dict.get("workingGroupIds", [])

        if not input_wg_ids: 
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
    except Exception as e: 
        if "Pydantic validation error" in str(e) or "validation error" in str(e).lower(): 
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
        existing_event_data = event_doc_snapshot.to_dict()

        if not update_data_dict:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

        if "recurrence_rule" in update_data_dict and update_data_dict["recurrence_rule"] is not None:
            try:
                dt_start_for_rrule = update_data_dict.get("dateTime", existing_event_data.get("dateTime"))
                if not isinstance(dt_start_for_rrule, datetime.datetime): 
                    dt_start_for_rrule = datetime.datetime.fromisoformat(str(dt_start_for_rrule).replace("Z", "+00:00"))

                rrule.rrulestr(update_data_dict["recurrence_rule"], dtstart=dt_start_for_rrule)
            except ValueError as e:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid recurrence_rule format: {e}")
        elif "recurrence_rule" in update_data_dict and update_data_dict["recurrence_rule"] is None:
            pass


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
        
        final_start_time_str = update_data_dict.get("dateTime", existing_event_data.get("dateTime"))
        final_end_time_str = update_data_dict.get("endTime", existing_event_data.get("endTime"))

        final_start_time = final_start_time_str
        if isinstance(final_start_time_str, str): 
            final_start_time = datetime.datetime.fromisoformat(final_start_time_str.replace("Z", "+00:00"))
        elif isinstance(final_start_time_str, datetime.datetime): 
             final_start_time = final_start_time_str.replace(tzinfo=datetime.timezone.utc) if final_start_time_str.tzinfo is None else final_start_time_str

        final_end_time = final_end_time_str
        if isinstance(final_end_time_str, str): 
            final_end_time = datetime.datetime.fromisoformat(final_end_time_str.replace("Z", "+00:00"))
        elif isinstance(final_end_time_str, datetime.datetime): 
            final_end_time = final_end_time_str.replace(tzinfo=datetime.timezone.utc) if final_end_time_str.tzinfo is None else final_end_time_str


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

        if "workingGroupIds" not in response_data:
            if response_data.get("workingGroupId"):
                response_data["workingGroupIds"] = [response_data["workingGroupId"]]
            else:
                response_data["workingGroupIds"] = [] 


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
    except HTTPException as http_exc: 
        raise http_exc
    except Exception as e: 
        if "Pydantic validation error" in str(e) or "validation error" in str(e).lower():
             raise HTTPException(status_code=422, detail=str(e))
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.get("", response_model=List[EventWithSignupStatus])
async def list_events(
    db: firestore.AsyncClient = Depends(get_db), 
    current_rbac_user: Optional[RBACUser] = Depends(get_current_session_user_with_rbac),
    status_filter: Optional[str] = Query(None, alias="status"),
    working_group_id: Optional[str] = Query(None, alias="working_group_id"), 
    q: Optional[str] = Query(None, alias="q", description="Search term for event name, description, venue"), 
    from_date: Optional[datetime.date] = Query(None, description="Filter events from this date (YYYY-MM-DD). Defaults to today if days_range is also provided or if no date filters are set."),
    days_range: Optional[int] = Query(14, description="Number of days from from_date to include in the filter (e.g., 1 for just from_date, 7 for a week). Defaults to 14. Max 90.", ge=1, le=90)
):
    try:
        query = db.collection(EVENTS_COLLECTION)
        is_privileged_user = current_rbac_user.is_sysadmin if current_rbac_user else False 

        user_wg_ids_for_auth_filter = []
        if not is_privileged_user and current_rbac_user:
            user_wg_assignments_query = db.collection(ASSIGNMENTS_COLLECTION) \
                .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
                .where(filter=FieldFilter("assignableType", "==", "workingGroup"))
            
            user_wg_ids_for_auth_filter = [doc.to_dict()["assignableId"] async for doc in user_wg_assignments_query.stream()]

            if not user_wg_ids_for_auth_filter: 
                return [] 
            
            if len(user_wg_ids_for_auth_filter) > MAX_FIRESTORE_IN_QUERY_LIMIT:
                 user_wg_ids_for_auth_filter = user_wg_ids_for_auth_filter[:MAX_FIRESTORE_IN_QUERY_LIMIT]
            
            if working_group_id and working_group_id in user_wg_ids_for_auth_filter:
                user_wg_ids_for_auth_filter = [working_group_id] 
            elif working_group_id and working_group_id not in user_wg_ids_for_auth_filter:
                return [] 

            query = query.where(filter=FieldFilter("workingGroupIds", "array_contains_any", user_wg_ids_for_auth_filter))
        
        elif is_privileged_user and working_group_id: 
            query = query.where(filter=FieldFilter("workingGroupIds", "array_contains", working_group_id)) 
        
        elif not current_rbac_user and not is_privileged_user: 
            return [] 

        today = datetime.date.today()
        actual_from_date = from_date if from_date else today
        if days_range is None: days_range = 14 
        actual_to_date = actual_from_date + datetime.timedelta(days=days_range - 1)
        
        from_datetime_utc = datetime.datetime.combine(actual_from_date, datetime.time.min, tzinfo=datetime.timezone.utc)
        to_datetime_utc = datetime.datetime.combine(actual_to_date, datetime.time.max, tzinfo=datetime.timezone.utc)
        
        if status_filter: 
            query = query.where(filter=FieldFilter("status", "==", status_filter))
        
        query = query.order_by("dateTime", direction=firestore.Query.ASCENDING)
        # Temporarily disabled date filters to show all events for debugging
        # query = query.where(filter=FieldFilter("dateTime", ">=", from_datetime_utc))
        # query = query.where(filter=FieldFilter("dateTime", "<=", to_datetime_utc)) 

        if q:
            query = query.where(filter=FieldFilter("eventName", ">=", q)).where(filter=FieldFilter("eventName", "<=", q + '\uf8ff'))


        docs_snapshot = query.stream()
        user_assignments: Dict[str, Dict[str, str]] = {} 
        temp_event_data_list = [] 
        all_user_ids_to_fetch: Set[str] = set()
        all_event_wg_ids_flat: Set[str] = set() 

        async for doc in docs_snapshot: 
            event_data = doc.to_dict()
            event_data['id'] = doc.id
            
            if "workingGroupIds" not in event_data:
                if event_data.get("workingGroupId"):
                    event_data["workingGroupIds"] = [event_data["workingGroupId"]]
                else:
                    event_data["workingGroupIds"] = [] 
            
            if not event_data["workingGroupIds"]:
                # This print can be re-enabled if further WG issues arise
                # print(f"Warning: Skipping event with ID {event_data['id']} due to missing or empty workingGroupIds after normalization.")
                continue

            if not is_privileged_user:
                event_wgs = event_data.get("workingGroupIds", []) 
                user_is_member_of_event_wg = any(wg_id in user_wg_ids_for_auth_filter for wg_id in event_wgs)
                
                if working_group_id: 
                    if working_group_id not in event_wgs:
                        continue 
                elif not user_is_member_of_event_wg: 
                    continue 
            
            temp_event_data_list.append(event_data) 

            if event_data.get("organizerUserId"): all_user_ids_to_fetch.add(event_data["organizerUserId"])
            if event_data.get("createdByUserId"): all_user_ids_to_fetch.add(event_data["createdByUserId"])
            
            all_event_wg_ids_flat.update(event_data["workingGroupIds"])


        user_details_map = {}
        if all_user_ids_to_fetch:
            user_ids_list = list(all_user_ids_to_fetch)
            for i in range(0, len(user_ids_list), MAX_FIRESTORE_IN_QUERY_LIMIT):
                batch_ids = user_ids_list[i:i+MAX_FIRESTORE_IN_QUERY_LIMIT]
                if not batch_ids: continue
                users_snapshot_docs = await db.collection(USERS_COLLECTION).where(FieldPath.document_id(), "in", batch_ids).get()
                for user_doc_snap in users_snapshot_docs: user_details_map[user_doc_snap.id] = user_doc_snap.to_dict()
        
        wg_names_map = await _get_working_group_names_map(db, list(all_event_wg_ids_flat))

        if current_rbac_user and current_rbac_user.uid and temp_event_data_list:
            master_event_ids = [e['id'] for e in temp_event_data_list]
            for i in range(0, len(master_event_ids), MAX_FIRESTORE_IN_QUERY_LIMIT):
                batch_event_ids = master_event_ids[i:i+MAX_FIRESTORE_IN_QUERY_LIMIT]
                if not batch_event_ids: continue

                assignments_query_fs = db.collection(ASSIGNMENTS_COLLECTION) \
                    .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
                    .where(filter=FieldFilter("assignableType", "==", "event")) \
                    .where(filter=FieldFilter("assignableId", "in", batch_event_ids))
                
                async for assign_doc in assignments_query_fs.stream(): 
                    assign_data = assign_doc.to_dict()
                    event_id = assign_data.get("assignableId")
                    instance_start_dt = assign_data.get("event_instance_start_date_time")
                    if event_id and instance_start_dt:
                        if isinstance(instance_start_dt, datetime.datetime):
                            if instance_start_dt.tzinfo is None:
                                instance_start_dt = instance_start_dt.replace(tzinfo=datetime.timezone.utc)
                            instance_start_iso = instance_start_dt.isoformat()
                        else: 
                            instance_start_iso = str(instance_start_dt)

                        if event_id not in user_assignments:
                            user_assignments[event_id] = {}
                        user_assignments[event_id][instance_start_iso] = assign_data.get("status", "unknown")

        
        final_events_list = []
        for master_event_data in temp_event_data_list:
            if "workingGroupIds" not in master_event_data: 
                 master_event_data["workingGroupIds"] = [master_event_data["workingGroupId"]] if master_event_data.get("workingGroupId") else []


            if master_event_data.get("createdByUserId"):
                creator_details = user_details_map.get(master_event_data["createdByUserId"], {})
                master_event_data["creatorFirstName"] = creator_details.get("firstName")
                master_event_data["creatorLastName"] = creator_details.get("lastName")

            if master_event_data.get("organizerUserId"):
                org_details = user_details_map.get(master_event_data["organizerUserId"], {})
                master_event_data["organizerFirstName"] = org_details.get("firstName")
                master_event_data["organizerLastName"] = org_details.get("lastName")
                master_event_data["organizerEmail"] = org_details.get("email")
            
            current_event_wg_names = [wg_names_map.get(wg_id, "Unknown WG") for wg_id in master_event_data["workingGroupIds"] if wg_id in wg_names_map]
            master_event_data["workingGroupNames"] = current_event_wg_names


            recurrence_rule_str = master_event_data.get("recurrence_rule")
            master_event_dt_start = master_event_data.get("dateTime")
            master_event_dt_end = master_event_data.get("endTime")

            if isinstance(master_event_dt_start, str):
                master_event_dt_start = datetime.datetime.fromisoformat(master_event_dt_start.replace("Z", "+00:00"))
            elif isinstance(master_event_dt_start, datetime.datetime) and master_event_dt_start.tzinfo is None:
                master_event_dt_start = master_event_dt_start.replace(tzinfo=datetime.timezone.utc)
            
            if isinstance(master_event_dt_end, str):
                master_event_dt_end = datetime.datetime.fromisoformat(master_event_dt_end.replace("Z", "+00:00"))
            elif isinstance(master_event_dt_end, datetime.datetime) and master_event_dt_end.tzinfo is None:
                master_event_dt_end = master_event_dt_end.replace(tzinfo=datetime.timezone.utc)


            if recurrence_rule_str and master_event_dt_start and master_event_dt_end:
                try:
                    event_duration = master_event_dt_end - master_event_dt_start
                    ruleset = rrule.rrulestr(recurrence_rule_str, dtstart=master_event_dt_start)
                    
                    for instance_start_utc in ruleset.between(from_datetime_utc, to_datetime_utc, inc=True):
                        if instance_start_utc.tzinfo is None:
                             instance_start_utc = instance_start_utc.replace(tzinfo=datetime.timezone.utc)

                        instance_end_utc = instance_start_utc + event_duration
                        
                        instance_data = master_event_data.copy()
                        instance_data["dateTime"] = instance_start_utc 
                        instance_data["endTime"] = instance_end_utc
                        
                        instance_start_iso = instance_start_utc.isoformat()
                        is_signed_up = user_assignments.get(master_event_data['id'], {}).get(instance_start_iso) is not None if current_rbac_user else None
                        assignment_status = user_assignments.get(master_event_data['id'], {}).get(instance_start_iso) if is_signed_up else None
                        
                        final_events_list.append(EventWithSignupStatus(**instance_data, isCurrentUserSignedUp=is_signed_up, currentUserAssignmentStatus=assignment_status))
                except ValueError as e:
                    # print(f"Warning: Could not parse rrule for event {master_event_data['id']}: {e}") # Keep this for dev if needed
                    if master_event_dt_start >= from_datetime_utc and master_event_dt_start <= to_datetime_utc:
                        is_signed_up = user_assignments.get(master_event_data['id'], {}).get(master_event_dt_start.isoformat()) is not None if current_rbac_user else None
                        assignment_status = user_assignments.get(master_event_data['id'], {}).get(master_event_dt_start.isoformat()) if is_signed_up else None
                        final_events_list.append(EventWithSignupStatus(**master_event_data, isCurrentUserSignedUp=is_signed_up, currentUserAssignmentStatus=assignment_status))

            else: 
                if master_event_dt_start >= from_datetime_utc and master_event_dt_start <= to_datetime_utc:
                    event_start_iso = master_event_dt_start.isoformat()
                    is_signed_up = user_assignments.get(master_event_data['id'], {}).get(event_start_iso) is not None if current_rbac_user else None
                    assignment_status = user_assignments.get(master_event_data['id'], {}).get(event_start_iso) if is_signed_up else None
                    final_events_list.append(EventWithSignupStatus(**master_event_data, isCurrentUserSignedUp=is_signed_up, currentUserAssignmentStatus=assignment_status))
        
        final_events_list.sort(key=lambda e: e.dateTime)
        
        return final_events_list

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        import traceback
        print(f"Error in list_events: {str(e)}") # Keep this for critical errors
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred while listing events: {str(e)}")

@router.get("/{event_id}", response_model=EventWithSignupStatus)
async def get_event(
    event_id: str,
    instance_start_datetime_iso: Optional[str] = Query(None, alias="instanceStartDateTime", description="ISO datetime string for a specific recurring instance"),
    db: firestore.AsyncClient = Depends(get_db), 
    current_rbac_user: Optional[RBACUser] = Depends(get_current_session_user_with_rbac)
):
    try:
        doc_ref = db.collection(EVENTS_COLLECTION).document(event_id)
        event_doc = await doc_ref.get()
        if not event_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Event '{event_id}' not found")

        event_data_from_db = event_doc.to_dict() 
        event_data_from_db['id'] = event_doc.id 

        if "workingGroupIds" not in event_data_from_db:
            if event_data_from_db.get("workingGroupId"):
                event_data_from_db["workingGroupIds"] = [event_data_from_db["workingGroupId"]]
            else: 
                event_data_from_db["workingGroupIds"] = [] 
        
        if not event_data_from_db["workingGroupIds"]:
             raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Event {event_id} is invalid: missing working group association.")


        is_privileged_user = current_rbac_user.is_sysadmin if current_rbac_user else False 
        event_wg_ids_list = event_data_from_db.get("workingGroupIds") 
        
        authorized_to_view = False
        if is_privileged_user:
            authorized_to_view = True
        elif current_rbac_user:
            user_wg_assignments_query = db.collection(ASSIGNMENTS_COLLECTION) \
                .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
                .where(filter=FieldFilter("assignableType", "==", "workingGroup"))
            user_member_of_wg_ids = {doc.to_dict()["assignableId"] async for doc in user_wg_assignments_query.stream()}

            if any(wg_id in user_member_of_wg_ids for wg_id in event_wg_ids_list):
                authorized_to_view = True
        
        if not authorized_to_view:
             raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not authorized to view this event.")

        target_instance_start_dt = None
        if instance_start_datetime_iso:
            try:
                target_instance_start_dt = datetime.datetime.fromisoformat(instance_start_datetime_iso.replace("Z", "+00:00"))
                if target_instance_start_dt.tzinfo is None: 
                    target_instance_start_dt = target_instance_start_dt.replace(tzinfo=datetime.timezone.utc)

                master_start_dt_orig = event_data_from_db.get("dateTime")
                master_end_dt_orig = event_data_from_db.get("endTime")

                if isinstance(master_start_dt_orig, str):
                    master_start_dt_orig = datetime.datetime.fromisoformat(master_start_dt_orig.replace("Z", "+00:00"))
                if master_start_dt_orig and master_start_dt_orig.tzinfo is None: master_start_dt_orig = master_start_dt_orig.replace(tzinfo=datetime.timezone.utc)
                
                if isinstance(master_end_dt_orig, str):
                    master_end_dt_orig = datetime.datetime.fromisoformat(master_end_dt_orig.replace("Z", "+00:00"))
                if master_end_dt_orig and master_end_dt_orig.tzinfo is None: master_end_dt_orig = master_end_dt_orig.replace(tzinfo=datetime.timezone.utc)

                if master_start_dt_orig and master_end_dt_orig :
                    duration = master_end_dt_orig - master_start_dt_orig
                    event_data_from_db["dateTime"] = target_instance_start_dt
                    event_data_from_db["endTime"] = target_instance_start_dt + duration
                else: 
                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Master event has invalid date/time.")

            except ValueError:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid instanceStartDateTime format. Use ISO 8601 format.")
        else: 
            target_instance_start_dt = event_data_from_db.get("dateTime")
            if isinstance(target_instance_start_dt, str):
                 target_instance_start_dt = datetime.datetime.fromisoformat(target_instance_start_dt.replace("Z", "+00:00"))
            if target_instance_start_dt and target_instance_start_dt.tzinfo is None:
                 target_instance_start_dt = target_instance_start_dt.replace(tzinfo=datetime.timezone.utc)


        wg_names_to_populate = []
        if event_wg_ids_list: 
            fetched_wg_names_map = await _get_working_group_names_map(db, list(set(event_wg_ids_list)))
            wg_names_to_populate = [fetched_wg_names_map.get(wg_id, "Unknown WG") for wg_id in event_wg_ids_list if wg_id in fetched_wg_names_map]
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
        if current_rbac_user and current_rbac_user.uid and target_instance_start_dt:
            assignment_query = db.collection(ASSIGNMENTS_COLLECTION) \
                                 .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
                                 .where(filter=FieldFilter("assignableId", "==", event_id)) \
                                 .where(filter=FieldFilter("assignableType", "==", "event")) \
                                 .where(filter=FieldFilter("event_instance_start_date_time", "==", target_instance_start_dt)) \
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
        count = 0
        async for assignment_doc in assignments_snapshot:
            batch.delete(assignment_doc.reference)
            count += 1
            if count >= 499: 
                await batch.commit()
                batch = db.batch() 
                count = 0
        if count > 0: 
            await batch.commit()

        await event_doc_ref.delete() 
        
    except Exception as e:
        print(f"Error deleting event {event_id} and its assignments: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.post("/{event_id}/signup", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def self_signup_for_event(
    event_id: str,
    request: Request, 
    db: firestore.AsyncClient = Depends(get_db), 
    current_rbac_user: RBACUser = Depends(get_current_session_user_with_rbac)
):
    try:
        body = await request.json()
        instance_start_dt_iso = body.get("event_instance_start_date_time")
        instance_end_dt_iso = body.get("event_instance_end_date_time")

        if not instance_start_dt_iso or not instance_end_dt_iso:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="event_instance_start_date_time and event_instance_end_date_time are required for signup.")

        try:
            event_instance_start_dt = datetime.datetime.fromisoformat(instance_start_dt_iso.replace("Z", "+00:00"))
            event_instance_end_dt = datetime.datetime.fromisoformat(instance_end_dt_iso.replace("Z", "+00:00"))
            if event_instance_start_dt.tzinfo is None: event_instance_start_dt = event_instance_start_dt.replace(tzinfo=datetime.timezone.utc)
            if event_instance_end_dt.tzinfo is None: event_instance_end_dt = event_instance_end_dt.replace(tzinfo=datetime.timezone.utc)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid datetime format for instance times. Use ISO 8601.")

        if event_instance_end_dt <= event_instance_start_dt:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Instance end time must be after instance start time.")

    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON body.")


    event_ref = db.collection(EVENTS_COLLECTION).document(event_id)
    event_doc = await event_ref.get()
    if not event_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    event_data_dict = event_doc.to_dict() 
    
    is_privileged_user = current_rbac_user.is_sysadmin if current_rbac_user else False
    authorized_to_interact = False
    if is_privileged_user:
        authorized_to_interact = True
    elif current_rbac_user:
        user_wg_assignments_query = db.collection(ASSIGNMENTS_COLLECTION) \
            .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
            .where(filter=FieldFilter("assignableType", "==", "workingGroup"))
        user_member_of_wg_ids = {doc.to_dict()["assignableId"] async for doc in user_wg_assignments_query.stream()}

        event_wg_ids_list = event_data_dict.get("workingGroupIds", []) 
        if not event_wg_ids_list and event_data_dict.get("workingGroupId"): 
            event_wg_ids_list = [event_data_dict["workingGroupId"]]


        if any(wg_id in user_member_of_wg_ids for wg_id in event_wg_ids_list):
            authorized_to_interact = True
    
    if not authorized_to_interact:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not authorized to interact with this event.")

    if event_data_dict.get("status") == "cancelled":
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event series is cancelled.")
    
    if event_instance_end_dt < datetime.datetime.now(datetime.timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot sign up for a past event instance.")


    existing_assignment_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
        .where(filter=FieldFilter("assignableId", "==", event_id)) \
        .where(filter=FieldFilter("assignableType", "==", "event")) \
        .where(filter=FieldFilter("event_instance_start_date_time", "==", event_instance_start_dt)) \
        .limit(1)
    
    existing_doc = None
    async for doc in existing_assignment_query.stream(): existing_doc = doc; break
    if existing_doc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already signed up for this event instance.")
    
    assignment_data_dict_payload = { 
        "userId": current_rbac_user.uid, "assignableId": event_id, "assignableType": "event",
        "status": "confirmed", "assignedByUserId": "self_signup",
        "assignmentDate": firestore.SERVER_TIMESTAMP, 
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
        "event_instance_start_date_time": event_instance_start_dt,
        "event_instance_end_date_time": event_instance_end_dt,
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
    request: Request, 
    db: firestore.AsyncClient = Depends(get_db), 
    current_rbac_user: RBACUser = Depends(get_current_session_user_with_rbac)
):
    try:
        body = await request.json()
        instance_start_dt_iso = body.get("event_instance_start_date_time")
        if not instance_start_dt_iso:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="event_instance_start_date_time is required to withdraw.")
        
        try:
            event_instance_start_dt = datetime.datetime.fromisoformat(instance_start_dt_iso.replace("Z", "+00:00"))
            if event_instance_start_dt.tzinfo is None: event_instance_start_dt = event_instance_start_dt.replace(tzinfo=datetime.timezone.utc)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid datetime format for instance_start_date_time. Use ISO 8601.")

    except json.JSONDecodeError:
        instance_start_dt_iso_query = request.query_params.get("event_instance_start_date_time")
        if not instance_start_dt_iso_query:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON body and event_instance_start_date_time query parameter missing.")
        try:
            event_instance_start_dt = datetime.datetime.fromisoformat(instance_start_dt_iso_query.replace("Z", "+00:00"))
            if event_instance_start_dt.tzinfo is None: event_instance_start_dt = event_instance_start_dt.replace(tzinfo=datetime.timezone.utc)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid datetime format for event_instance_start_date_time query parameter. Use ISO 8601.")


    assignment_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
        .where(filter=FieldFilter("assignableId", "==", event_id)) \
        .where(filter=FieldFilter("assignableType", "==", "event")) \
        .where(filter=FieldFilter("event_instance_start_date_time", "==", event_instance_start_dt)) \
        .limit(1)

    assignment_doc_snap = None
    async for doc_snap in assignment_query.stream(): 
        assignment_doc_snap = doc_snap
        break
        
    if not assignment_doc_snap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signup not found for this user and event instance.")

    await assignment_doc_snap.reference.delete()
    return None 

@router.get(
    "/{event_id}/assignments",
    response_model=List[AssignmentResponse],
    dependencies=[Depends(require_permission("events", "manage_assignments"))]
)
async def list_event_assignments(
    event_id: str, 
    instance_start_datetime_iso: Optional[str] = Query(None, alias="instanceStartDateTime", description="ISO datetime string to filter assignments for a specific recurring instance"),
    db: firestore.AsyncClient = Depends(get_db)
    ): 
    event_ref = db.collection(EVENTS_COLLECTION).document(event_id)
    event_doc = await event_ref.get()
    if not event_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    assignments_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=FieldFilter("assignableId", "==", event_id)) \
        .where(filter=FieldFilter("assignableType", "==", "event"))

    if instance_start_datetime_iso:
        try:
            instance_start_dt = datetime.datetime.fromisoformat(instance_start_datetime_iso.replace("Z", "+00:00"))
            if instance_start_dt.tzinfo is None: instance_start_dt = instance_start_dt.replace(tzinfo=datetime.timezone.utc)
            assignments_query = assignments_query.where(filter=FieldFilter("event_instance_start_date_time", "==", instance_start_dt))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid instanceStartDateTime format. Use ISO 8601.")


    assignments_list = []
    user_cache = {} 

    async for assign_doc in assignments_query.stream():
        assignment_data = assign_doc.to_dict()
        assignment_data['id'] = assign_doc.id

        user_id = assignment_data.get('userId')
        if user_id: 
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
    current_rbac_user: RBACUser = Depends(get_current_session_user_with_rbac)
):
    event_ref = db.collection(EVENTS_COLLECTION).document(event_id)
    event_doc = await event_ref.get()
    if not event_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    event_data = event_doc.to_dict()

    event_instance_start_dt = assignment_create_data.event_instance_start_date_time
    event_instance_end_dt = assignment_create_data.event_instance_end_date_time

    if event_data.get("recurrence_rule"):
        if not event_instance_start_dt or not event_instance_end_dt:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="event_instance_start_date_time and event_instance_end_date_time are required when assigning to a recurring event.")
    else: 
        if not event_instance_start_dt:
            dt_val = event_data.get("dateTime")
            if isinstance(dt_val, str): event_instance_start_dt = datetime.datetime.fromisoformat(dt_val.replace("Z", "+00:00"))
            elif isinstance(dt_val, datetime.datetime): event_instance_start_dt = dt_val
            if event_instance_start_dt and event_instance_start_dt.tzinfo is None: event_instance_start_dt = event_instance_start_dt.replace(tzinfo=datetime.timezone.utc)

        if not event_instance_end_dt:
            dt_val = event_data.get("endTime")
            if isinstance(dt_val, str): event_instance_end_dt = datetime.datetime.fromisoformat(dt_val.replace("Z", "+00:00"))
            elif isinstance(dt_val, datetime.datetime): event_instance_end_dt = dt_val
            if event_instance_end_dt and event_instance_end_dt.tzinfo is None: event_instance_end_dt = event_instance_end_dt.replace(tzinfo=datetime.timezone.utc)

    if not event_instance_start_dt or not event_instance_end_dt: 
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Could not determine event instance times.")
    
    if event_instance_end_dt <= event_instance_start_dt:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Instance end time must be after instance start time.")


    user_to_assign_ref = db.collection(USERS_COLLECTION).document(assignment_create_data.userId)
    user_to_assign_doc = await user_to_assign_ref.get()
    if not user_to_assign_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID '{assignment_create_data.userId}' not found.")
    user_to_assign_profile = user_to_assign_doc.to_dict()

    existing_assignment_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=FieldFilter("userId", "==", assignment_create_data.userId)) \
        .where(filter=FieldFilter("assignableId", "==", event_id)) \
        .where(filter=FieldFilter("assignableType", "==", "event")) \
        .where(filter=FieldFilter("event_instance_start_date_time", "==", event_instance_start_dt)) \
        .limit(1)
    
    existing_doc = None
    async for doc in existing_assignment_query.stream(): existing_doc = doc; break
    if existing_doc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already assigned to this event instance.")

    assignment_data_dict_payload = assignment_create_data.model_dump(exclude_unset=True) 
    assignment_data_dict_payload["assignableId"] = event_id 
    assignment_data_dict_payload["assignableType"] = "event" 
    assignment_data_dict_payload["assignedByUserId"] = current_rbac_user.uid
    assignment_data_dict_payload["createdAt"] = firestore.SERVER_TIMESTAMP
    assignment_data_dict_payload["updatedAt"] = firestore.SERVER_TIMESTAMP
    assignment_data_dict_payload["event_instance_start_date_time"] = event_instance_start_dt
    assignment_data_dict_payload["event_instance_end_date_time"] = event_instance_end_dt
    
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignment does not belong to the specified event master ID.")

    update_data_dict = assignment_update_data.model_dump(exclude_unset=True) 
    if not update_data_dict:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

    new_start_time = update_data_dict.get("event_instance_start_date_time", assignment_current_data.get("event_instance_start_date_time"))
    new_end_time = update_data_dict.get("event_instance_end_date_time", assignment_current_data.get("event_instance_end_date_time"))

    if isinstance(new_start_time, str): new_start_time = datetime.datetime.fromisoformat(new_start_time.replace("Z", "+00:00"))
    if isinstance(new_end_time, str): new_end_time = datetime.datetime.fromisoformat(new_end_time.replace("Z", "+00:00"))
    
    if new_start_time and new_start_time.tzinfo is None: new_start_time = new_start_time.replace(tzinfo=datetime.timezone.utc)
    if new_end_time and new_end_time.tzinfo is None: new_end_time = new_end_time.replace(tzinfo=datetime.timezone.utc)


    if "event_instance_start_date_time" in update_data_dict or "event_instance_end_date_time" in update_data_dict:
        if not new_start_time or not new_end_time:
             raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Both instance start and end times must be present if one is updated.")
        if new_end_time <= new_start_time:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Instance end time must be after instance start time.")
        
        if (update_data_dict.get("event_instance_start_date_time") and 
            update_data_dict["event_instance_start_date_time"] != assignment_current_data.get("event_instance_start_date_time")):
            
            conflict_query = db.collection(ASSIGNMENTS_COLLECTION) \
                .where(filter=FieldFilter("userId", "==", assignment_current_data["userId"])) \
                .where(filter=FieldFilter("assignableId", "==", event_id)) \
                .where(filter=FieldFilter("assignableType", "==", "event")) \
                .where(filter=FieldFilter("event_instance_start_date_time", "==", new_start_time)) \
                .where(FieldPath.document_id(), "!=", assignment_id) \
                .limit(1)
            
            async for _ in conflict_query.stream(): 
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already assigned to the target event instance.")


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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignment does not belong to the specified event master ID.")

    await assignment_ref.delete()
    return None