import pytest
from httpx import AsyncClient
from firebase_admin import firestore
from unittest.mock import patch, MagicMock, AsyncMock
import datetime

# Assuming your FastAPI app instance is named `app` in `main.py`
# from main import app # This might need adjustment based on your project structure
# For now, direct client usage based on conftest

EVENTS_COLLECTION = "events"
ASSIGNMENTS_COLLECTION = "assignments"
USERS_COLLECTION = "users"

# --- New Fixtures for Core Event CRUD ---
@pytest.fixture
def mock_event_payload_with_poc():
    return {
        "eventName": "Community Cleanup Day",
        "eventType": "Volunteering",
        "purpose": "Clean up the local park",
        "description": "Join us for a day of cleaning and greening our community park.",
        "dateTime": (datetime.datetime.utcnow() + datetime.timedelta(days=30)).isoformat(),
        "endTime": (datetime.datetime.utcnow() + datetime.timedelta(days=30, hours=3)).isoformat(),
        "venue": "Central Park",
        "volunteersRequired": 50,
        "status": "open_for_signup",
        "organizerUserId": "organizer_user_id_123",
        "icon": "eco",
        "point_of_contact": "Jane Doe - jane.doe@example.com"
    }

@pytest.fixture
def mock_created_event_doc_with_poc(mock_event_payload_with_poc):
    mock_doc = MagicMock()
    mock_doc.exists = True
    doc_data = {
        **mock_event_payload_with_poc,
        "id": "new_event_with_poc_id",
        "createdByUserId": "test_admin_user_id", # Assuming admin creates it
        "createdAt": firestore.SERVER_TIMESTAMP, # Placeholder, will be datetime in reality
        "updatedAt": firestore.SERVER_TIMESTAMP, # Placeholder
    }
    # Convert datetimes back to datetime objects for to_dict if they were ISO strings in payload
    doc_data["dateTime"] = datetime.datetime.fromisoformat(doc_data["dateTime"])
    doc_data["endTime"] = datetime.datetime.fromisoformat(doc_data["endTime"])
    
    mock_doc.to_dict.return_value = doc_data
    mock_doc.id = "new_event_with_poc_id"
    return mock_doc

@pytest.fixture
def mock_organizer_user_doc():
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "firstName": "Organizer",
        "lastName": "Person",
        "email": "organizer@example.com",
    }
    mock_doc.id = "organizer_user_id_123"
    return mock_doc

@pytest.fixture
def mock_creator_user_doc(): # For the admin user who creates the event
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "firstName": "Admin",
        "lastName": "User",
        "email": "admin@example.com", # Not strictly needed for EventResponse but good for completeness
    }
    mock_doc.id = "test_admin_user_id"
    return mock_doc


# --- Existing Fixtures ---
@pytest.fixture
def mock_event_doc_open_for_signup():
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "id": "test_event_open",
        "eventName": "Test Event Open",
        "status": "open_for_signup",
        "dateTime": datetime.datetime.utcnow() + datetime.timedelta(days=1), 
        "endTime": datetime.datetime.utcnow() + datetime.timedelta(days=1, hours=2),
        "createdByUserId": "creator_user_id",
        "point_of_contact": "POC for open event" # Added for consistency
    }
    mock_doc.id = "test_event_open"
    return mock_doc

@pytest.fixture
def mock_event_doc_closed_for_signup():
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "id": "test_event_closed",
        "eventName": "Test Event Closed",
        "status": "draft", # Not open
        "dateTime": datetime.datetime.utcnow() + datetime.timedelta(days=1),
        "endTime": datetime.datetime.utcnow() + datetime.timedelta(days=1, hours=2),
        "createdByUserId": "creator_user_id",
        "point_of_contact": "POC for closed event" # Added
    }
    mock_doc.id = "test_event_closed"
    return mock_doc

@pytest.fixture
def mock_assignment_doc():
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "id": "test_assignment_id",
        "userId": "test_user_id",
        "assignableId": "test_event_open",
        "assignableType": "event",
        "status": "confirmed",
        "assignedByUserId": "self_signup",
        "assignmentDate": datetime.datetime.utcnow(),
        "createdAt": datetime.datetime.utcnow(),
        "updatedAt": datetime.datetime.utcnow(),
    }
    mock_doc.id = "test_assignment_id"
    mock_doc.reference = AsyncMock() # For delete operations
    return mock_doc

@pytest.fixture
def mock_user_profile_doc(): # User performing signup / being assigned
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "firstName": "Test",
        "lastName": "User",
        "email": "test.user@example.com",
    }
    mock_doc.id = "test_user_id"
    return mock_doc


# --- New Core Event CRUD Tests ---
@pytest.mark.asyncio
async def test_create_event_with_poc(
    test_client: AsyncClient,
    mock_db: MagicMock,
    admin_user_id_token: str, # Assuming admin creates events
    mock_event_payload_with_poc: dict,
    mock_created_event_doc_with_poc: MagicMock,
    mock_organizer_user_doc: MagicMock,
    mock_creator_user_doc: MagicMock
):
    # Mock Firestore calls for creation
    mock_doc_ref = AsyncMock()
    mock_doc_ref.set = AsyncMock()
    mock_doc_ref.get = AsyncMock(return_value=mock_created_event_doc_with_poc)
    mock_db.collection(EVENTS_COLLECTION).document.return_value = mock_doc_ref
    
    # Mock organizer user check
    mock_db.collection(USERS_COLLECTION).document(mock_event_payload_with_poc["organizerUserId"]).get = AsyncMock(return_value=mock_organizer_user_doc)
    # Mock creator user details for response
    mock_db.collection(USERS_COLLECTION).document("test_admin_user_id").get = AsyncMock(return_value=mock_creator_user_doc)


    headers = {"Authorization": f"Bearer {admin_user_id_token}"}
    response = await test_client.post("/events", json=mock_event_payload_with_poc, headers=headers)

    assert response.status_code == 201
    response_data = response.json()
    assert response_data["eventName"] == mock_event_payload_with_poc["eventName"]
    assert response_data["point_of_contact"] == mock_event_payload_with_poc["point_of_contact"]
    assert response_data["organizerUserId"] == mock_event_payload_with_poc["organizerUserId"]
    assert response_data["organizerFirstName"] == "Organizer"
    assert response_data["creatorFirstName"] == "Admin"
    mock_doc_ref.set.assert_called_once()


@pytest.mark.asyncio
async def test_get_event_with_poc(
    test_client: AsyncClient,
    mock_db: MagicMock,
    authenticated_user_id_token: str, # Any authenticated user can get
    mock_created_event_doc_with_poc: MagicMock, # Use the same doc as if it was created
    mock_organizer_user_doc: MagicMock,
    mock_creator_user_doc: MagicMock
):
    event_id = mock_created_event_doc_with_poc.id
    
    # Mock Firestore get for the event
    mock_db.collection(EVENTS_COLLECTION).document(event_id).get = AsyncMock(return_value=mock_created_event_doc_with_poc)
    
    # Mock user details for organizer and creator
    event_dict = mock_created_event_doc_with_poc.to_dict()
    mock_db.collection(USERS_COLLECTION).document(event_dict["organizerUserId"]).get = AsyncMock(return_value=mock_organizer_user_doc)
    mock_db.collection(USERS_COLLECTION).document(event_dict["createdByUserId"]).get = AsyncMock(return_value=mock_creator_user_doc)

    # Mock assignment check for EventWithSignupStatus (assume no signup for simplicity here)
    mock_assignment_query = AsyncMock()
    mock_assignment_query.stream = AsyncMock(return_value=[]) # No assignment
    mock_db.collection(ASSIGNMENTS_COLLECTION).where.return_value.where.return_value.where.return_value.limit.return_value = mock_assignment_query
    
    headers = {"Authorization": f"Bearer {authenticated_user_id_token}"}
    response = await test_client.get(f"/events/{event_id}", headers=headers)

    assert response.status_code == 200
    response_data = response.json()
    assert response_data["id"] == event_id
    assert response_data["eventName"] == event_dict["eventName"]
    assert response_data["point_of_contact"] == event_dict["point_of_contact"]
    assert response_data["isCurrentUserSignedUp"] is None # Or False, depending on how None is handled vs empty stream

@pytest.mark.asyncio
async def test_update_event_with_poc(
    test_client: AsyncClient,
    mock_db: MagicMock,
    admin_user_id_token: str, # Assuming admin updates events
    mock_created_event_doc_with_poc: MagicMock, # Existing event
    mock_organizer_user_doc: MagicMock,
    mock_creator_user_doc: MagicMock
):
    event_id = mock_created_event_doc_with_poc.id
    update_payload = {
        "eventName": "Updated Community Cleanup Day",
        "point_of_contact": "John Smith - john.smith@example.com",
        "status": "draft"
    }

    # Mock get current event
    mock_event_ref = AsyncMock()
    mock_event_ref.get = AsyncMock(return_value=mock_created_event_doc_with_poc) # Initial get
    mock_event_ref.update = AsyncMock() # For the update call
    
    # Simulate the state after update for the second get
    updated_event_data = mock_created_event_doc_with_poc.to_dict().copy()
    updated_event_data.update(update_payload)
    updated_event_data["updatedAt"] = datetime.datetime.utcnow() # Simulate update
    
    mock_updated_doc = MagicMock()
    mock_updated_doc.exists = True
    mock_updated_doc.to_dict.return_value = updated_event_data
    mock_updated_doc.id = event_id
    
    # Chain the get calls: first for existing, second for after update
    mock_event_ref.get.side_effect = [
        AsyncMock(return_value=mock_created_event_doc_with_poc), # First get() in endpoint
        AsyncMock(return_value=mock_updated_doc) # Second get() after update
    ]
    mock_db.collection(EVENTS_COLLECTION).document(event_id).get = mock_event_ref.get # Assign the side_effect mock
    mock_db.collection(EVENTS_COLLECTION).document(event_id).update = mock_event_ref.update


    # Mock user details for response (organizer might change, creator stays same)
    mock_db.collection(USERS_COLLECTION).document(updated_event_data["organizerUserId"]).get = AsyncMock(return_value=mock_organizer_user_doc)
    mock_db.collection(USERS_COLLECTION).document(updated_event_data["createdByUserId"]).get = AsyncMock(return_value=mock_creator_user_doc)

    headers = {"Authorization": f"Bearer {admin_user_id_token}"}
    response = await test_client.put(f"/events/{event_id}", json=update_payload, headers=headers)

    assert response.status_code == 200
    response_data = response.json()
    assert response_data["eventName"] == update_payload["eventName"]
    assert response_data["point_of_contact"] == update_payload["point_of_contact"]
    assert response_data["status"] == update_payload["status"]
    
    mock_event_ref.update.assert_called_once()
    # More precise check for what was updated:
    # called_update_data = mock_event_ref.update.call_args[0][0]
    # assert called_update_data["point_of_contact"] == update_payload["point_of_contact"]
    # assert "updatedAt" in called_update_data


# --- Existing Signup/Assignment Tests (modified slightly for datetime and POC consistency) ---

@pytest.mark.asyncio
async def test_self_signup_for_event_success(
    test_client: AsyncClient,
    mock_db: MagicMock,
    authenticated_user_id_token: str, 
    mock_event_doc_open_for_signup: MagicMock,
    mock_user_profile_doc: MagicMock
):
    event_id = "test_event_open"

    mock_db.collection(EVENTS_COLLECTION).document(event_id).get = AsyncMock(return_value=mock_event_doc_open_for_signup)
    
    mock_existing_assignment_query = AsyncMock()
    mock_existing_assignment_query.stream = AsyncMock(return_value=[]) 
    mock_db.collection(ASSIGNMENTS_COLLECTION).where.return_value.where.return_value.where.return_value.limit.return_value = mock_existing_assignment_query
    
    mock_new_assignment_ref = AsyncMock()
    mock_new_assignment_doc = AsyncMock()
    mock_new_assignment_doc.exists = True
    mock_new_assignment_doc.id = "new_assignment_id"
    # Ensure datetime objects for response model compatibility
    current_time = datetime.datetime.utcnow()
    mock_new_assignment_doc.to_dict.return_value = {
        "userId": "test_user_id", 
        "assignableId": event_id,
        "assignableType": "event",
        "status": "confirmed",
        "assignedByUserId": "self_signup",
        "assignmentDate": current_time, 
        "createdAt": current_time,
        "updatedAt": current_time,
    }
    mock_new_assignment_ref.get = AsyncMock(return_value=mock_new_assignment_doc)
    mock_db.collection(ASSIGNMENTS_COLLECTION).document.return_value = mock_new_assignment_ref
    
    mock_db.collection(USERS_COLLECTION).document("test_user_id").get = AsyncMock(return_value=mock_user_profile_doc)

    headers = {"Authorization": f"Bearer {authenticated_user_id_token}"}
    response = await test_client.post(f"/events/{event_id}/signup", headers=headers)

    assert response.status_code == 201
    response_data = response.json()
    assert response_data["assignableId"] == event_id
    assert response_data["userId"] == "test_user_id"
    assert response_data["status"] == "confirmed"
    assert response_data["userFirstName"] == "Test"

@pytest.mark.asyncio
async def test_self_signup_for_event_not_open(
    test_client: AsyncClient,
    mock_db: MagicMock,
    authenticated_user_id_token: str,
    mock_event_doc_closed_for_signup: MagicMock
):
    event_id = "test_event_closed"
    mock_db.collection(EVENTS_COLLECTION).document(event_id).get = AsyncMock(return_value=mock_event_doc_closed_for_signup)

    headers = {"Authorization": f"Bearer {authenticated_user_id_token}"}
    response = await test_client.post(f"/events/{event_id}/signup", headers=headers)

    assert response.status_code == 400
    assert "not open for signups" in response.json()["detail"]

@pytest.mark.asyncio
async def test_self_signup_for_event_already_signed_up(
    test_client: AsyncClient,
    mock_db: MagicMock,
    authenticated_user_id_token: str,
    mock_event_doc_open_for_signup: MagicMock,
    mock_assignment_doc: MagicMock 
):
    event_id = "test_event_open"
    mock_db.collection(EVENTS_COLLECTION).document(event_id).get = AsyncMock(return_value=mock_event_doc_open_for_signup)

    mock_existing_assignment_query = AsyncMock()
    mock_existing_assignment_query.stream = AsyncMock(return_value=[mock_assignment_doc]) 
    mock_db.collection(ASSIGNMENTS_COLLECTION).where.return_value.where.return_value.where.return_value.limit.return_value = mock_existing_assignment_query

    headers = {"Authorization": f"Bearer {authenticated_user_id_token}"}
    response = await test_client.post(f"/events/{event_id}/signup", headers=headers)

    assert response.status_code == 409
    assert "already signed up" in response.json()["detail"]

@pytest.mark.asyncio
async def test_withdraw_event_signup_success(
    test_client: AsyncClient,
    mock_db: MagicMock,
    authenticated_user_id_token: str,
    mock_assignment_doc: MagicMock 
):
    event_id = mock_assignment_doc.to_dict()["assignableId"]
    
    mock_existing_assignment_query = AsyncMock()
    mock_existing_assignment_query.stream = AsyncMock(return_value=[mock_assignment_doc])
    mock_db.collection(ASSIGNMENTS_COLLECTION).where.return_value.where.return_value.where.return_value.limit.return_value = mock_existing_assignment_query

    headers = {"Authorization": f"Bearer {authenticated_user_id_token}"}
    response = await test_client.delete(f"/events/{event_id}/signup", headers=headers)

    assert response.status_code == 204
    mock_assignment_doc.reference.delete.assert_called_once()

@pytest.mark.asyncio
async def test_withdraw_event_signup_not_found(
    test_client: AsyncClient,
    mock_db: MagicMock,
    authenticated_user_id_token: str
):
    event_id = "test_event_non_existent_signup"
    
    mock_existing_assignment_query = AsyncMock()
    mock_existing_assignment_query.stream = AsyncMock(return_value=[]) 
    mock_db.collection(ASSIGNMENTS_COLLECTION).where.return_value.where.return_value.where.return_value.limit.return_value = mock_existing_assignment_query

    headers = {"Authorization": f"Bearer {authenticated_user_id_token}"}
    response = await test_client.delete(f"/events/{event_id}/signup", headers=headers)

    assert response.status_code == 404
    assert "Signup not found" in response.json()["detail"]

# --- Admin Assignment Tests ---

@pytest.mark.asyncio
async def test_admin_list_event_assignments(
    test_client: AsyncClient,
    mock_db: MagicMock,
    admin_user_id_token: str, 
    mock_event_doc_open_for_signup: MagicMock,
    mock_assignment_doc: MagicMock,
    mock_user_profile_doc: MagicMock
):
    event_id = "test_event_open"
    mock_db.collection(EVENTS_COLLECTION).document(event_id).get = AsyncMock(return_value=mock_event_doc_open_for_signup)

    mock_assignments_query = AsyncMock()
    assignment_data = mock_assignment_doc.to_dict()
    assignment_data["assignableId"] = event_id 
    mock_assignment_doc_for_event = MagicMock()
    mock_assignment_doc_for_event.exists = True
    mock_assignment_doc_for_event.to_dict.return_value = assignment_data
    mock_assignment_doc_for_event.id = assignment_data["id"]
    
    mock_assignments_query.stream = AsyncMock(return_value=[mock_assignment_doc_for_event])
    mock_db.collection(ASSIGNMENTS_COLLECTION).where.return_value.where.return_value = mock_assignments_query
    
    mock_db.collection(USERS_COLLECTION).document(assignment_data["userId"]).get = AsyncMock(return_value=mock_user_profile_doc)

    headers = {"Authorization": f"Bearer {admin_user_id_token}"}
    response = await test_client.get(f"/events/{event_id}/assignments", headers=headers)

    assert response.status_code == 200
    response_data = response.json()
    assert len(response_data) == 1
    assert response_data[0]["id"] == assignment_data["id"]
    assert response_data[0]["userId"] == assignment_data["userId"]
    assert response_data[0]["userFirstName"] == "Test"


@pytest.mark.asyncio
async def test_admin_create_event_assignment_success(
    test_client: AsyncClient,
    mock_db: MagicMock,
    admin_user_id_token: str,
    mock_event_doc_open_for_signup: MagicMock,
):
    event_id = "test_event_open"
    user_to_assign_id = "user_to_be_assigned_id"

    mock_db.collection(EVENTS_COLLECTION).document(event_id).get = AsyncMock(return_value=mock_event_doc_open_for_signup)
    
    user_to_assign_profile_doc = MagicMock()
    user_to_assign_profile_doc.exists = True
    user_to_assign_profile_doc.to_dict.return_value = {"firstName": "Assigned", "lastName": "User", "email":"assigned@example.com"}
    mock_db.collection(USERS_COLLECTION).document(user_to_assign_id).get = AsyncMock(return_value=user_to_assign_profile_doc)

    mock_existing_assignment_query = AsyncMock()
    mock_existing_assignment_query.stream = AsyncMock(return_value=[])
    mock_db.collection(ASSIGNMENTS_COLLECTION).where.return_value.where.return_value.where.return_value.limit.return_value = mock_existing_assignment_query

    mock_new_assignment_ref = AsyncMock()
    mock_new_assignment_doc = AsyncMock()
    mock_new_assignment_doc.exists = True
    mock_new_assignment_doc.id = "new_admin_assignment_id"
    current_time = datetime.datetime.utcnow()
    mock_new_assignment_doc.to_dict.return_value = {
        "userId": user_to_assign_id,
        "assignableId": event_id,
        "assignableType": "event",
        "status": "confirmed_admin",
        "assignedByUserId": "test_admin_user_id", 
        "assignmentDate": current_time,
        "createdAt": current_time,
        "updatedAt": current_time,
    }
    mock_new_assignment_ref.get = AsyncMock(return_value=mock_new_assignment_doc)
    mock_db.collection(ASSIGNMENTS_COLLECTION).document.return_value = mock_new_assignment_ref

    assignment_payload = {
        "userId": user_to_assign_id,
        "assignableId": event_id, 
        "assignableType": "event",
        "status": "confirmed_admin"
    }
    headers = {"Authorization": f"Bearer {admin_user_id_token}"}
    response = await test_client.post(f"/events/{event_id}/assignments", json=assignment_payload, headers=headers)

    assert response.status_code == 201
    response_data = response.json()
    assert response_data["userId"] == user_to_assign_id
    assert response_data["assignableId"] == event_id
    assert response_data["status"] == "confirmed_admin"
    assert response_data["userFirstName"] == "Assigned"


@pytest.mark.asyncio
async def test_admin_update_event_assignment_success(
    test_client: AsyncClient,
    mock_db: MagicMock,
    admin_user_id_token: str,
    mock_assignment_doc: MagicMock, 
    mock_user_profile_doc: MagicMock 
):
    event_id = mock_assignment_doc.to_dict()["assignableId"]
    assignment_id = mock_assignment_doc.id
    
    # Mock fetching the existing assignment for validation and update
    mock_assignment_get_ref = AsyncMock()
    mock_assignment_get_ref.get = AsyncMock(return_value=mock_assignment_doc) # Initial get
    mock_assignment_get_ref.update = AsyncMock() # For the update call
    
    # Simulate the state after update for the second get in the endpoint
    updated_assignment_data = mock_assignment_doc.to_dict().copy()
    updated_assignment_data.update({"status": "attended", "hoursContributed": 2.5, "updatedAt": datetime.datetime.utcnow()})
    
    mock_updated_assignment_doc_after_put = MagicMock()
    mock_updated_assignment_doc_after_put.exists = True
    mock_updated_assignment_doc_after_put.to_dict.return_value = updated_assignment_data
    mock_updated_assignment_doc_after_put.id = assignment_id
    
    # Chain the get calls: first for existing, second for after update
    mock_assignment_get_ref.get.side_effect = [
        AsyncMock(return_value=mock_assignment_doc), 
        AsyncMock(return_value=mock_updated_assignment_doc_after_put)
    ]
    
    mock_db.collection(ASSIGNMENTS_COLLECTION).document(assignment_id).get = mock_assignment_get_ref.get
    mock_db.collection(ASSIGNMENTS_COLLECTION).document(assignment_id).update = mock_assignment_get_ref.update
    
    mock_db.collection(USERS_COLLECTION).document(mock_assignment_doc.to_dict()["userId"]).get = AsyncMock(return_value=mock_user_profile_doc)

    update_payload = {"status": "attended", "hoursContributed": 2.5}
    headers = {"Authorization": f"Bearer {admin_user_id_token}"}
    response = await test_client.put(f"/events/{event_id}/assignments/{assignment_id}", json=update_payload, headers=headers)

    assert response.status_code == 200
    response_data = response.json()
    assert response_data["status"] == "attended"
    assert response_data["hoursContributed"] == 2.5
    assert response_data["userFirstName"] == "Test"
    
    mock_assignment_get_ref.update.assert_called_once()
    called_update_data = mock_assignment_get_ref.update.call_args[0][0]
    assert called_update_data["status"] == "attended"
    assert called_update_data["hoursContributed"] == 2.5
    assert "updatedAt" in called_update_data


@pytest.mark.asyncio
async def test_admin_delete_event_assignment_success(
    test_client: AsyncClient,
    mock_db: MagicMock,
    admin_user_id_token: str,
    mock_assignment_doc: MagicMock 
):
    event_id = mock_assignment_doc.to_dict()["assignableId"]
    assignment_id = mock_assignment_doc.id

    mock_db.collection(ASSIGNMENTS_COLLECTION).document(assignment_id).get = AsyncMock(return_value=mock_assignment_doc)

    headers = {"Authorization": f"Bearer {admin_user_id_token}"}
    response = await test_client.delete(f"/events/{event_id}/assignments/{assignment_id}", headers=headers)

    assert response.status_code == 204
    mock_assignment_doc.reference.delete.assert_called_once()
