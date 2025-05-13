from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
import datetime

# Use direct imports from subdirectories of 'backend'
from dependencies.database import get_db
from dependencies.rbac import RBACUser, get_current_user_with_rbac, require_permission
from models.event import EventCreate, EventUpdate, EventResponse, EventWithSignupStatus
from models.assignment import AssignmentCreate, AssignmentResponse, AssignmentUpdate # Ensure AssignmentResponse is used

router = APIRouter(
    prefix="/events",
    tags=["events"]
)

EVENTS_COLLECTION = "events"
ASSIGNMENTS_COLLECTION = "assignments"
USERS_COLLECTION = "users"

async def _get_user_details(db: firestore.Client, user_id: str) -> dict:
    """Helper function to fetch user details."""
    if not user_id:
        return {}
    user_ref = db.collection(USERS_COLLECTION).document(user_id)
    user_doc = await user_ref.get() # Use await for async Firestore client
    if user_doc.exists:
        return user_doc.to_dict()
    return {}

@router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("events", "create"))]
)
async def create_event(
    event_data: EventCreate,
    db: firestore.Client = Depends(get_db),
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac)
):
    try:
        new_event_dict = event_data.model_dump()
        new_event_dict["createdByUserId"] = current_rbac_user.uid
        new_event_dict["createdAt"] = firestore.SERVER_TIMESTAMP
        new_event_dict["updatedAt"] = firestore.SERVER_TIMESTAMP

        if new_event_dict.get("organizerUserId"):
            organizer_doc = await db.collection(USERS_COLLECTION).document(new_event_dict["organizerUserId"]).get()
            if not organizer_doc.exists:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Organizer user with ID '{new_event_dict['organizerUserId']}' not found.")

        doc_ref = db.collection(EVENTS_COLLECTION).document()
        await doc_ref.set(new_event_dict)

        created_event_doc = await doc_ref.get()
        if created_event_doc.exists:
            response_data = created_event_doc.to_dict()
            response_data['id'] = created_event_doc.id # Changed from eventId to id for consistency with Pydantic

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
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(ve))
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.get("", response_model=List[EventWithSignupStatus])
async def list_events(
    db: firestore.Client = Depends(get_db),
    current_rbac_user: Optional[RBACUser] = Depends(get_current_user_with_rbac),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    try:
        query = db.collection(EVENTS_COLLECTION)
        if status_filter:
            query = query.where(filter=FieldFilter("status", "==", status_filter))
        query = query.order_by("dateTime", direction=firestore.Query.ASCENDING)

        docs_snapshot = query.stream()
        user_assignments = {}
        temp_event_data_list = []
        all_user_ids_to_fetch = set()

        async for doc in docs_snapshot: # Use async for iteration
            event_data = doc.to_dict()
            event_data['id'] = doc.id # Changed from eventId to id
            temp_event_data_list.append(event_data)
            if event_data.get("organizerUserId"):
                all_user_ids_to_fetch.add(event_data["organizerUserId"])
            if event_data.get("createdByUserId"):
                all_user_ids_to_fetch.add(event_data["createdByUserId"])

        user_details_map = {}
        for uid in list(all_user_ids_to_fetch):
            details = await _get_user_details(db, uid)
            user_details_map[uid] = details

        if current_rbac_user and current_rbac_user.uid:
            assignments_query = db.collection(ASSIGNMENTS_COLLECTION).where(filter=FieldFilter("userId", "==", current_rbac_user.uid)).where(filter=FieldFilter("assignableType", "==", "event"))
            async for assign_doc in assignments_query.stream(): # Use async for iteration
                assign_data = assign_doc.to_dict()
                user_assignments[assign_data.get("assignableId")] = assign_data.get("status", "unknown")
        
        events_list = []
        for event_data in temp_event_data_list:
            is_signed_up = user_assignments.get(event_data['id']) is not None if current_rbac_user else None # Use 'id'
            assignment_status = user_assignments.get(event_data['id']) if is_signed_up else None # Use 'id'

            if event_data.get("createdByUserId"):
                creator_details = user_details_map.get(event_data["createdByUserId"], {})
                event_data["creatorFirstName"] = creator_details.get("firstName")
                event_data["creatorLastName"] = creator_details.get("lastName")

            if event_data.get("organizerUserId"):
                org_details = user_details_map.get(event_data["organizerUserId"], {})
                event_data["organizerFirstName"] = org_details.get("firstName")
                event_data["organizerLastName"] = org_details.get("lastName")
                event_data["organizerEmail"] = org_details.get("email")

            events_list.append(EventWithSignupStatus(**event_data, isCurrentUserSignedUp=is_signed_up, currentUserAssignmentStatus=assignment_status))
        return events_list
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.get("/{event_id}", response_model=EventWithSignupStatus)
async def get_event(
    event_id: str,
    db: firestore.Client = Depends(get_db),
    current_rbac_user: Optional[RBACUser] = Depends(get_current_user_with_rbac)
):
    try:
        doc_ref = db.collection(EVENTS_COLLECTION).document(event_id)
        event_doc = await doc_ref.get()
        if not event_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Event '{event_id}' not found")

        event_data = event_doc.to_dict()
        event_data['id'] = event_doc.id # Changed from eventId to id

        creator_details = await _get_user_details(db, event_data.get("createdByUserId"))
        event_data["creatorFirstName"] = creator_details.get("firstName")
        event_data["creatorLastName"] = creator_details.get("lastName")

        if event_data.get("organizerUserId"):
            organizer_details = await _get_user_details(db, event_data["organizerUserId"])
            event_data["organizerFirstName"] = organizer_details.get("firstName")
            event_data["organizerLastName"] = organizer_details.get("lastName")
            event_data["organizerEmail"] = organizer_details.get("email")

        is_signed_up = None
        assignment_status = None
        if current_rbac_user and current_rbac_user.uid:
            assignment_query = db.collection(ASSIGNMENTS_COLLECTION) \
                                 .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
                                 .where(filter=FieldFilter("assignableId", "==", event_id)) \
                                 .where(filter=FieldFilter("assignableType", "==", "event")) \
                                 .limit(1)
            
            assignment_doc_snap = None
            async for doc_snap in assignment_query.stream(): # Iterate to get the first doc
                assignment_doc_snap = doc_snap
                break
            
            if assignment_doc_snap:
                is_signed_up = True
                assignment_status = assignment_doc_snap.to_dict().get("status")
        return EventWithSignupStatus(**event_data, isCurrentUserSignedUp=is_signed_up, currentUserAssignmentStatus=assignment_status)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.put("/{event_id}", response_model=EventResponse, dependencies=[Depends(require_permission("events", "edit"))])
async def update_event(
    event_id: str, event_update_data: EventUpdate, db: firestore.Client = Depends(get_db)
):
    try:
        doc_ref = db.collection(EVENTS_COLLECTION).document(event_id)
        event_doc_snapshot = await doc_ref.get()
        if not event_doc_snapshot.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Event '{event_id}' not found")

        existing_event_data = event_doc_snapshot.to_dict()
        update_data_dict = event_update_data.model_dump(exclude_unset=True)

        if not update_data_dict:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

        final_start_time = update_data_dict.get("dateTime", existing_event_data.get("dateTime"))
        final_end_time = update_data_dict.get("endTime", existing_event_data.get("endTime"))

        if isinstance(final_start_time, str): final_start_time = datetime.datetime.fromisoformat(final_start_time.replace("Z", "+00:00"))
        if isinstance(final_end_time, str): final_end_time = datetime.datetime.fromisoformat(final_end_time.replace("Z", "+00:00"))
        
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
        response_data['id'] = updated_event_doc.id # Changed from eventId to id

        creator_details = await _get_user_details(db, response_data.get("createdByUserId"))
        response_data["creatorFirstName"] = creator_details.get("firstName")
        response_data["creatorLastName"] = creator_details.get("lastName")

        if response_data.get("organizerUserId"):
            organizer_details = await _get_user_details(db, response_data["organizerUserId"])
            response_data["organizerFirstName"] = organizer_details.get("firstName")
            response_data["organizerLastName"] = organizer_details.get("lastName")
            response_data["organizerEmail"] = organizer_details.get("email")

        return EventResponse(**response_data)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(ve))
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("events", "delete"))])
async def delete_event(event_id: str, db: firestore.Client = Depends(get_db)):
    try:
        doc_ref = db.collection(EVENTS_COLLECTION).document(event_id)
        event_doc = await doc_ref.get()
        if not event_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Event '{event_id}' not found")
        
        # Consider deleting related assignments or handling them as per application logic
        # For now, just deleting the event.
        await doc_ref.delete()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


# --- Event Assignment & Signup Endpoints ---
@router.post("/{event_id}/signup", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def self_signup_for_event(
    event_id: str,
    db: firestore.Client = Depends(get_db),
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac)
):
    event_ref = db.collection(EVENTS_COLLECTION).document(event_id)
    event_doc = await event_ref.get()
    if not event_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    event_data = event_doc.to_dict()
    if event_data.get("status") not in ["open_for_signup"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event is not open for signups.")

    existing_assignment_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
        .where(filter=FieldFilter("assignableId", "==", event_id)) \
        .where(filter=FieldFilter("assignableType", "==", "event")) \
        .limit(1)
    
    existing_doc = None
    async for doc in existing_assignment_query.stream(): # Iterate to get the first doc
        existing_doc = doc
        break
    if existing_doc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already signed up for this event.")

    assignment_data_dict = {
        "userId": current_rbac_user.uid,
        "assignableId": event_id,
        "assignableType": "event",
        "status": "confirmed", # Default status for self-signup
        "assignedByUserId": "self_signup",
        "assignmentDate": firestore.SERVER_TIMESTAMP,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document()
    await assignment_ref.set(assignment_data_dict)

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
    db: firestore.Client = Depends(get_db),
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac)
):
    assignment_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
        .where(filter=FieldFilter("assignableId", "==", event_id)) \
        .where(filter=FieldFilter("assignableType", "==", "event")) \
        .limit(1)

    assignment_doc_snap = None
    async for doc_snap in assignment_query.stream(): # Iterate to get the first doc
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
async def list_event_assignments(event_id: str, db: firestore.Client = Depends(get_db)):
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
        if user_id not in user_cache: # Cache user details to reduce Firestore reads
            user_details = await _get_user_details(db, user_id)
            user_cache[user_id] = user_details
        
        user_profile = user_cache[user_id]
        assignment_data['userFirstName'] = user_profile.get('firstName')
        assignment_data['userLastName'] = user_profile.get('lastName')
        assignment_data['userEmail'] = user_profile.get('email')

        assignments_list.append(AssignmentResponse(**assignment_data))
    return assignments_list


@router.post(
    "/{event_id}/assignments", # This is for admin to assign a user
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("events", "manage_assignments"))]
)
async def admin_create_event_assignment( # Renamed for clarity
    event_id: str,
    assignment_create_data: AssignmentCreate, # Contains userId and other details
    db: firestore.Client = Depends(get_db),
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

    # Use model_dump from AssignmentCreate and then override/add specific fields
    assignment_data_dict = assignment_create_data.model_dump()
    assignment_data_dict["assignableId"] = event_id # Ensure it's for this event
    assignment_data_dict["assignableType"] = "event" # Ensure it's an event assignment
    assignment_data_dict["assignedByUserId"] = current_rbac_user.uid
    assignment_data_dict["assignmentDate"] = firestore.SERVER_TIMESTAMP
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


@router.put(
    "/{event_id}/assignments/{assignment_id}",
    response_model=AssignmentResponse,
    dependencies=[Depends(require_permission("events", "manage_assignments"))]
)
async def admin_update_event_assignment( # Renamed for clarity
    event_id: str,
    assignment_id: str,
    assignment_update_data: AssignmentUpdate,
    db: firestore.Client = Depends(get_db)
):
    assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document(assignment_id)
    assignment_doc = await assignment_ref.get()
    if not assignment_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")

    assignment_current_data = assignment_doc.to_dict()
    if assignment_current_data.get("assignableId") != event_id or \
       assignment_current_data.get("assignableType") != "event":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignment does not belong to the specified event.")

    update_data = assignment_update_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

    update_data["updatedAt"] = firestore.SERVER_TIMESTAMP # Only updatedAt changes here
    await assignment_ref.update(update_data)

    updated_assignment_doc = await assignment_ref.get()
    response_data = updated_assignment_doc.to_dict()
    response_data['id'] = updated_assignment_doc.id

    user_profile_details = await _get_user_details(db, response_data['userId'])
    response_data['userFirstName'] = user_profile_details.get('firstName')
    response_data['userLastName'] = user_profile_details.get('lastName')
    response_data['userEmail'] = user_profile_details.get('email')

    return AssignmentResponse(**response_data)


@router.delete(
    "/{event_id}/assignments/{assignment_id}", # This is for admin to remove a specific assignment
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("events", "manage_assignments"))]
)
async def admin_delete_event_assignment( # Renamed for clarity
    event_id: str,
    assignment_id: str,
    db: firestore.Client = Depends(get_db)
):
    assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document(assignment_id)
    assignment_doc = await assignment_ref.get()
    if not assignment_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")

    assignment_current_data = assignment_doc.to_dict()
    # Verify assignment belongs to the event before deleting
    if assignment_current_data.get("assignableId") != event_id or \
       assignment_current_data.get("assignableType") != "event":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignment does not belong to the specified event.")

    await assignment_ref.delete()
    return None
