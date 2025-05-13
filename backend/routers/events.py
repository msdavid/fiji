from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
import datetime

# Use direct imports from subdirectories of 'backend'
from dependencies.database import get_db
from dependencies.rbac import RBACUser, get_current_user_with_rbac, require_permission
from models.event import EventCreate, EventUpdate, EventResponse, EventWithSignupStatus 
from models.assignment import AssignmentCreate, AssignmentResponse, AssignmentUpdate

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
    user_doc = user_ref.get() 
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
            organizer_doc = db.collection(USERS_COLLECTION).document(new_event_dict["organizerUserId"]).get()
            if not organizer_doc.exists:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Organizer user with ID '{new_event_dict['organizerUserId']}' not found.")
        
        doc_ref = db.collection(EVENTS_COLLECTION).document()
        doc_ref.set(new_event_dict)

        created_event_doc = doc_ref.get()
        if created_event_doc.exists:
            response_data = created_event_doc.to_dict()
            response_data['eventId'] = created_event_doc.id

            # Fetch creator details for the response
            creator_details = await _get_user_details(db, response_data["createdByUserId"])
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
        events_list = []
        user_assignments = {}

        temp_event_data_list = []
        all_user_ids_to_fetch = set()

        for doc in docs_snapshot:
            event_data = doc.to_dict()
            event_data['eventId'] = doc.id
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
            for assign_doc in assignments_query.stream(): 
                assign_data = assign_doc.to_dict()
                user_assignments[assign_data.get("assignableId")] = assign_data.get("status", "unknown")

        for event_data in temp_event_data_list:
            is_signed_up = user_assignments.get(event_data['eventId']) is not None if current_rbac_user else None
            assignment_status = user_assignments.get(event_data['eventId']) if is_signed_up else None
            
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
        event_doc = doc_ref.get() 
        if not event_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Event '{event_id}' not found")
        
        event_data = event_doc.to_dict()
        event_data['eventId'] = event_doc.id
        
        creator_details = await _get_user_details(db, event_data["createdByUserId"])
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
            assignment_doc_snap = next(assignment_query.stream(), None) 
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
        event_doc_snapshot = doc_ref.get() 
        if not event_doc_snapshot.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Event '{event_id}' not found")
        
        update_data = event_update_data.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

        if "organizerUserId" in update_data:
            org_uid = update_data["organizerUserId"]
            if org_uid is not None: 
                organizer_doc = db.collection(USERS_COLLECTION).document(org_uid).get() 
                if not organizer_doc.exists:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Organizer user with ID '{org_uid}' not found.")
            
        update_data["updatedAt"] = firestore.SERVER_TIMESTAMP
        doc_ref.update(update_data)
        
        updated_event_doc = doc_ref.get() 
        response_data = updated_event_doc.to_dict()
        response_data['eventId'] = updated_event_doc.id

        creator_details = await _get_user_details(db, response_data["createdByUserId"])
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("events", "delete"))])
async def delete_event(event_id: str, db: firestore.Client = Depends(get_db)):
    try:
        doc_ref = db.collection(EVENTS_COLLECTION).document(event_id)
        if not doc_ref.get().exists: 
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Event '{event_id}' not found")
        doc_ref.delete()
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
    event_doc = event_ref.get() 
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
    if next(existing_assignment_query.stream(), None): 
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already signed up for this event.")

    assignment_data = {
        "userId": current_rbac_user.uid,
        "assignableId": event_id,
        "assignableType": "event",
        "status": "confirmed", 
        "assignedByUserId": "self_signup", 
        "assignmentDate": firestore.SERVER_TIMESTAMP,
    }
    assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document()
    assignment_ref.set(assignment_data)
    
    created_assignment_doc = assignment_ref.get() 
    response_data = created_assignment_doc.to_dict()
    response_data['assignmentId'] = created_assignment_doc.id
    
    user_profile_doc = db.collection(USERS_COLLECTION).document(current_rbac_user.uid).get() 
    if user_profile_doc.exists:
        user_profile = user_profile_doc.to_dict()
        response_data['userFirstName'] = user_profile.get('firstName')
        response_data['userLastName'] = user_profile.get('lastName')
        response_data['userEmail'] = user_profile.get('email')
        
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
    
    assignment_doc_snap = next(assignment_query.stream(), None) 
    if not assignment_doc_snap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signup not found for this user and event.")
    
    assignment_doc_snap.reference.delete()
    return None


@router.get(
    "/{event_id}/assignments", 
    response_model=List[AssignmentResponse],
    dependencies=[Depends(require_permission("events", "manage_assignments"))] 
)
async def list_event_assignments(event_id: str, db: firestore.Client = Depends(get_db)):
    event_ref = db.collection(EVENTS_COLLECTION).document(event_id)
    if not event_ref.get().exists: 
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    assignments_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=FieldFilter("assignableId", "==", event_id)) \
        .where(filter=FieldFilter("assignableType", "==", "event"))
    
    assignments_list = []
    user_cache = {} 

    for assign_doc in assignments_query.stream(): 
        assignment_data = assign_doc.to_dict()
        assignment_data['assignmentId'] = assign_doc.id
        
        user_id = assignment_data.get('userId')
        if user_id not in user_cache:
            user_doc = db.collection(USERS_COLLECTION).document(user_id).get() 
            if user_doc.exists:
                user_cache[user_id] = user_doc.to_dict()
            else:
                user_cache[user_id] = {} 
        
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
async def create_event_assignment(
    event_id: str,
    assignment_create_data: AssignmentCreate,
    db: firestore.Client = Depends(get_db),
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac)
):
    event_ref = db.collection(EVENTS_COLLECTION).document(event_id)
    if not event_ref.get().exists: 
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    user_ref = db.collection(USERS_COLLECTION).document(assignment_create_data.userId)
    user_profile_doc = user_ref.get() 
    if not user_profile_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User to be assigned not found.")
    user_profile = user_profile_doc.to_dict()

    existing_assignment_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=FieldFilter("userId", "==", assignment_create_data.userId)) \
        .where(filter=FieldFilter("assignableId", "==", event_id)) \
        .where(filter=FieldFilter("assignableType", "==", "event")) \
        .limit(1)
    if next(existing_assignment_query.stream(), None): 
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already assigned to this event.")

    assignment_data = {
        "userId": assignment_create_data.userId,
        "assignableId": event_id,
        "assignableType": "event",
        "status": assignment_create_data.status or "confirmed",
        "assignedByUserId": current_rbac_user.uid,
        "assignmentDate": firestore.SERVER_TIMESTAMP,
    }
    assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document()
    assignment_ref.set(assignment_data)
    
    created_assignment_doc = assignment_ref.get() 
    response_data = created_assignment_doc.to_dict()
    response_data['assignmentId'] = created_assignment_doc.id
    response_data['userFirstName'] = user_profile.get('firstName')
    response_data['userLastName'] = user_profile.get('lastName')
    response_data['userEmail'] = user_profile.get('email')
        
    return AssignmentResponse(**response_data)


@router.put(
    "/{event_id}/assignments/{assignment_id}", 
    response_model=AssignmentResponse,
    dependencies=[Depends(require_permission("events", "manage_assignments"))]
)
async def update_event_assignment(
    event_id: str, 
    assignment_id: str,
    assignment_update_data: AssignmentUpdate,
    db: firestore.Client = Depends(get_db)
):
    assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document(assignment_id)
    assignment_doc = assignment_ref.get() 
    if not assignment_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")
    
    assignment_current_data = assignment_doc.to_dict()
    if assignment_current_data.get("assignableId") != event_id or assignment_current_data.get("assignableType") != "event":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignment does not belong to the specified event.")

    update_data = assignment_update_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")
    
    update_data["assignmentDate"] = firestore.SERVER_TIMESTAMP # Consider if this should always be updated
    assignment_ref.update(update_data)

    updated_assignment_doc = assignment_ref.get() 
    response_data = updated_assignment_doc.to_dict()
    response_data['assignmentId'] = updated_assignment_doc.id

    user_profile_doc = db.collection(USERS_COLLECTION).document(response_data['userId']).get() 
    if user_profile_doc.exists:
        user_profile = user_profile_doc.to_dict()
        response_data['userFirstName'] = user_profile.get('firstName')
        response_data['userLastName'] = user_profile.get('lastName')
        response_data['userEmail'] = user_profile.get('email')

    return AssignmentResponse(**response_data)


@router.delete(
    "/{event_id}/assignments/{assignment_id}", 
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("events", "manage_assignments"))]
)
async def delete_event_assignment(
    event_id: str, 
    assignment_id: str,
    db: firestore.Client = Depends(get_db)
):
    assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document(assignment_id)
    assignment_doc = assignment_ref.get() 
    if not assignment_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")

    assignment_current_data = assignment_doc.to_dict()
    if assignment_current_data.get("assignableId") != event_id or assignment_current_data.get("assignableType") != "event":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignment does not belong to the specified event.")
        
    assignment_ref.delete()
    return None