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
USERS_COLLECTION = "users" # For fetching user details for AssignmentResponse

# --- Event CRUD Endpoints (from previous step) ---
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

        doc_ref = db.collection(EVENTS_COLLECTION).document()
        doc_ref.set(new_event_dict)

        created_event_doc = doc_ref.get()
        if created_event_doc.exists:
            response_data = created_event_doc.to_dict()
            response_data['eventId'] = created_event_doc.id
            return EventResponse(**response_data)
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve event after creation.")
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
        
        docs = query.stream()
        events_list = []
        user_assignments = {}
        if current_rbac_user and current_rbac_user.uid:
            assignments_query = db.collection(ASSIGNMENTS_COLLECTION).where(filter=FieldFilter("userId", "==", current_rbac_user.uid)).where(filter=FieldFilter("assignableType", "==", "event"))
            for assign_doc in assignments_query.stream():
                assign_data = assign_doc.to_dict()
                user_assignments[assign_data.get("assignableId")] = assign_data.get("status", "unknown")

        for doc in docs:
            event_data = doc.to_dict()
            event_data['eventId'] = doc.id
            is_signed_up = user_assignments.get(doc.id) is not None if current_rbac_user else None
            assignment_status = user_assignments.get(doc.id) if is_signed_up else None
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
        if not doc_ref.get().exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Event '{event_id}' not found")
        update_data = event_update_data.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")
        update_data["updatedAt"] = firestore.SERVER_TIMESTAMP
        doc_ref.update(update_data)
        updated_event_doc = doc_ref.get()
        response_data = updated_event_doc.to_dict()
        response_data['eventId'] = updated_event_doc.id
        return EventResponse(**response_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("events", "delete"))])
async def delete_event(event_id: str, db: firestore.Client = Depends(get_db)):
    try:
        doc_ref = db.collection(EVENTS_COLLECTION).document(event_id)
        if not doc_ref.get().exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Event '{event_id}' not found")
        # Consider implications: delete related assignments or prevent deletion if assignments exist.
        doc_ref.delete()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


# --- Event Assignment & Signup Endpoints ---

@router.post("/{event_id}/signup", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def self_signup_for_event(
    event_id: str,
    db: firestore.Client = Depends(get_db),
    current_rbac_user: RBACUser = Depends(get_current_user_with_rbac) # Requires authenticated user
):
    """
    Allows the current authenticated user to self-signup for an event.
    """
    event_ref = db.collection(EVENTS_COLLECTION).document(event_id)
    event_doc = event_ref.get()
    if not event_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    
    event_data = event_doc.to_dict()
    if event_data.get("status") not in ["open_for_signup"]: # Add other statuses if applicable
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event is not open for signups.")

    # Check if user is already signed up
    existing_assignment_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
        .where(filter=FieldFilter("assignableId", "==", event_id)) \
        .where(filter=FieldFilter("assignableType", "==", "event")) \
        .limit(1)
    if next(existing_assignment_query.stream(), None):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already signed up for this event.")

    # TODO: Check volunteer capacity if volunteersRequired is set

    assignment_data = {
        "userId": current_rbac_user.uid,
        "assignableId": event_id,
        "assignableType": "event",
        "status": "confirmed", # Or "pending_approval" if moderation is needed
        "assignedByUserId": "self_signup", # Special marker for self-signup
        "assignmentDate": firestore.SERVER_TIMESTAMP,
    }
    assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document()
    assignment_ref.set(assignment_data)
    
    created_assignment_doc = assignment_ref.get()
    response_data = created_assignment_doc.to_dict()
    response_data['assignmentId'] = created_assignment_doc.id
    
    # Fetch user details for response enrichment
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
    """
    Allows the current authenticated user to withdraw their signup from an event.
    """
    assignment_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=FieldFilter("userId", "==", current_rbac_user.uid)) \
        .where(filter=FieldFilter("assignableId", "==", event_id)) \
        .where(filter=FieldFilter("assignableType", "==", "event")) \
        .limit(1)
    
    assignment_doc_snap = next(assignment_query.stream(), None)
    if not assignment_doc_snap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signup not found for this user and event.")

    # TODO: Check event status or deadlines for withdrawal if applicable
    
    assignment_doc_snap.reference.delete()
    return None


@router.get(
    "/{event_id}/assignments", 
    response_model=List[AssignmentResponse],
    dependencies=[Depends(require_permission("events", "manage_assignments"))] # Or a more specific permission
)
async def list_event_assignments(event_id: str, db: firestore.Client = Depends(get_db)):
    """
    List all assignments for a specific event. Requires 'events:manage_assignments' permission.
    """
    event_ref = db.collection(EVENTS_COLLECTION).document(event_id)
    if not event_ref.get().exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    assignments_query = db.collection(ASSIGNMENTS_COLLECTION) \
        .where(filter=FieldFilter("assignableId", "==", event_id)) \
        .where(filter=FieldFilter("assignableType", "==", "event"))
    
    assignments_list = []
    # Fetch all user details in a batch if possible for optimization, or one by one
    user_cache = {} # Simple cache for user details within this request

    for assign_doc in assignments_query.stream():
        assignment_data = assign_doc.to_dict()
        assignment_data['assignmentId'] = assign_doc.id
        
        user_id = assignment_data.get('userId')
        if user_id not in user_cache:
            user_doc = db.collection(USERS_COLLECTION).document(user_id).get()
            if user_doc.exists:
                user_cache[user_id] = user_doc.to_dict()
            else:
                user_cache[user_id] = {} # User not found
        
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
    """
    Manually assign a user to an event. Requires 'events:manage_assignments' permission.
    """
    event_ref = db.collection(EVENTS_COLLECTION).document(event_id)
    if not event_ref.get().exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    user_ref = db.collection(USERS_COLLECTION).document(assignment_create_data.userId)
    user_profile_doc = user_ref.get()
    if not user_profile_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User to be assigned not found.")
    user_profile = user_profile_doc.to_dict()

    # Check if user is already assigned
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
    event_id: str, # For path consistency, though assignableId is in assignment_doc
    assignment_id: str,
    assignment_update_data: AssignmentUpdate,
    db: firestore.Client = Depends(get_db)
):
    """
    Update an existing assignment (e.g., status, hours, notes). Requires 'events:manage_assignments' permission.
    """
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
    
    update_data["assignmentDate"] = firestore.SERVER_TIMESTAMP # Reflects last modification
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
    event_id: str, # For path consistency
    assignment_id: str,
    db: firestore.Client = Depends(get_db)
):
    """
    Delete/cancel a specific assignment for an event. Requires 'events:manage_assignments' permission.
    """
    assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document(assignment_id)
    assignment_doc = assignment_ref.get()
    if not assignment_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")

    assignment_current_data = assignment_doc.to_dict()
    if assignment_current_data.get("assignableId") != event_id or assignment_current_data.get("assignableType") != "event":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignment does not belong to the specified event.")
        
    assignment_ref.delete()
    return None