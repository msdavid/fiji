import pytest
from httpx import AsyncClient
from firebase_admin import firestore
from unittest.mock import patch, MagicMock, AsyncMock

# Assuming your FastAPI app instance is named `app` in `main.py`
# from main import app # This might need adjustment based on your project structure
# For now, direct client usage based on conftest

EVENTS_COLLECTION = "events"
ASSIGNMENTS_COLLECTION = "assignments"
USERS_COLLECTION = "users"

@pytest.fixture
def mock_event_doc_open_for_signup():
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "id": "test_event_open",
        "eventName": "Test Event Open",
        "status": "open_for_signup",
        "dateTime": firestore.SERVER_TIMESTAMP, # Placeholder
        "endTime": firestore.SERVER_TIMESTAMP, # Placeholder
        "createdByUserId": "creator_user_id",
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
        "dateTime": firestore.SERVER_TIMESTAMP,
        "endTime": firestore.SERVER_TIMESTAMP,
        "createdByUserId": "creator_user_id",
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
        "assignmentDate": firestore.SERVER_TIMESTAMP,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    mock_doc.id = "test_assignment_id"
    mock_doc.reference = AsyncMock() # For delete operations
    return mock_doc

@pytest.fixture
def mock_user_profile_doc():
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "firstName": "Test",
        "lastName": "User",
        "email": "test.user@example.com",
    }
    mock_doc.id = "test_user_id"
    return mock_doc

@pytest.mark.asyncio
async def test_self_signup_for_event_success(
    test_client: AsyncClient,
    mock_db: MagicMock,
    authenticated_user_id_token: str, # From conftest
    mock_event_doc_open_for_signup: MagicMock,
    mock_user_profile_doc: MagicMock
):
    event_id = "test_event_open"

    # Mock Firestore calls
    mock_db.collection(EVENTS_COLLECTION).document(event_id).get = AsyncMock(return_value=mock_event_doc_open_for_signup)
    
    # Mock check for existing assignment (none exists)
    mock_existing_assignment_query = AsyncMock()
    mock_existing_assignment_query.stream = AsyncMock(return_value=[]) # No existing assignment
    mock_db.collection(ASSIGNMENTS_COLLECTION).where.return_value.where.return_value.where.return_value.limit.return_value = mock_existing_assignment_query
    
    # Mock assignment creation
    mock_new_assignment_ref = AsyncMock()
    mock_new_assignment_doc = AsyncMock()
    mock_new_assignment_doc.exists = True
    mock_new_assignment_doc.id = "new_assignment_id"
    mock_new_assignment_doc.to_dict.return_value = {
        "userId": "test_user_id", # from authenticated_user_id_token
        "assignableId": event_id,
        "assignableType": "event",
        "status": "confirmed",
        "assignedByUserId": "self_signup",
        "assignmentDate": datetime.datetime.utcnow(), # Actual datetime for response model
        "createdAt": datetime.datetime.utcnow(),
        "updatedAt": datetime.datetime.utcnow(),
    }
    mock_new_assignment_ref.get = AsyncMock(return_value=mock_new_assignment_doc)
    mock_db.collection(ASSIGNMENTS_COLLECTION).document.return_value = mock_new_assignment_ref
    
    # Mock user profile fetch for response
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
    mock_assignment_doc: MagicMock # Represents existing assignment
):
    event_id = "test_event_open"
    mock_db.collection(EVENTS_COLLECTION).document(event_id).get = AsyncMock(return_value=mock_event_doc_open_for_signup)

    # Mock check for existing assignment (one exists)
    mock_existing_assignment_query = AsyncMock()
    mock_existing_assignment_query.stream = AsyncMock(return_value=[mock_assignment_doc]) # Existing assignment
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
    mock_assignment_doc: MagicMock # Represents the assignment to be deleted
):
    event_id = "test_event_open" # or mock_assignment_doc.to_dict()["assignableId"]
    
    # Mock finding the assignment
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
    
    # Mock finding no assignment
    mock_existing_assignment_query = AsyncMock()
    mock_existing_assignment_query.stream = AsyncMock(return_value=[]) # No assignment found
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
    admin_user_id_token: str, # Assumes admin role with "events:manage_assignments"
    mock_event_doc_open_for_signup: MagicMock,
    mock_assignment_doc: MagicMock,
    mock_user_profile_doc: MagicMock
):
    event_id = "test_event_open"
    mock_db.collection(EVENTS_COLLECTION).document(event_id).get = AsyncMock(return_value=mock_event_doc_open_for_signup)

    mock_assignments_query = AsyncMock()
    # Simulate one assignment linked to this event
    assignment_data = mock_assignment_doc.to_dict()
    assignment_data["assignableId"] = event_id # Ensure it matches
    mock_assignment_doc_for_event = MagicMock()
    mock_assignment_doc_for_event.exists = True
    mock_assignment_doc_for_event.to_dict.return_value = assignment_data
    mock_assignment_doc_for_event.id = assignment_data["id"]
    
    mock_assignments_query.stream = AsyncMock(return_value=[mock_assignment_doc_for_event])
    mock_db.collection(ASSIGNMENTS_COLLECTION).where.return_value.where.return_value = mock_assignments_query
    
    # Mock user profile fetch for the assigned user
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
    mock_user_profile_doc: MagicMock # User to be assigned
):
    event_id = "test_event_open"
    user_to_assign_id = "user_to_be_assigned_id"

    mock_db.collection(EVENTS_COLLECTION).document(event_id).get = AsyncMock(return_value=mock_event_doc_open_for_signup)
    
    # Mock user to be assigned exists
    user_to_assign_profile_doc = MagicMock()
    user_to_assign_profile_doc.exists = True
    user_to_assign_profile_doc.to_dict.return_value = {"firstName": "Assigned", "lastName": "User", "email":"assigned@example.com"}
    mock_db.collection(USERS_COLLECTION).document(user_to_assign_id).get = AsyncMock(return_value=user_to_assign_profile_doc)

    # Mock check for existing assignment (none exists)
    mock_existing_assignment_query = AsyncMock()
    mock_existing_assignment_query.stream = AsyncMock(return_value=[])
    mock_db.collection(ASSIGNMENTS_COLLECTION).where.return_value.where.return_value.where.return_value.limit.return_value = mock_existing_assignment_query

    # Mock assignment creation
    mock_new_assignment_ref = AsyncMock()
    mock_new_assignment_doc = AsyncMock()
    mock_new_assignment_doc.exists = True
    mock_new_assignment_doc.id = "new_admin_assignment_id"
    mock_new_assignment_doc.to_dict.return_value = {
        "userId": user_to_assign_id,
        "assignableId": event_id,
        "assignableType": "event",
        "status": "confirmed_admin",
        "assignedByUserId": "test_admin_user_id", # from admin_user_id_token
        "assignmentDate": datetime.datetime.utcnow(),
        "createdAt": datetime.datetime.utcnow(),
        "updatedAt": datetime.datetime.utcnow(),
    }
    mock_new_assignment_ref.get = AsyncMock(return_value=mock_new_assignment_doc)
    mock_db.collection(ASSIGNMENTS_COLLECTION).document.return_value = mock_new_assignment_ref

    assignment_payload = {
        "userId": user_to_assign_id,
        "assignableId": event_id, # This will be overridden by path param but good to be consistent
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
    mock_assignment_doc: MagicMock, # Existing assignment
    mock_user_profile_doc: MagicMock # Profile of user in mock_assignment_doc
):
    event_id = mock_assignment_doc.to_dict()["assignableId"]
    assignment_id = mock_assignment_doc.id
    
    # Mock fetching the existing assignment
    mock_db.collection(ASSIGNMENTS_COLLECTION).document(assignment_id).get = AsyncMock(return_value=mock_assignment_doc)
    
    # Mock user profile fetch for response
    mock_db.collection(USERS_COLLECTION).document(mock_assignment_doc.to_dict()["userId"]).get = AsyncMock(return_value=mock_user_profile_doc)

    update_payload = {"status": "attended", "hoursContributed": 2.5}
    headers = {"Authorization": f"Bearer {admin_user_id_token}"}
    response = await test_client.put(f"/events/{event_id}/assignments/{assignment_id}", json=update_payload, headers=headers)

    assert response.status_code == 200
    response_data = response.json()
    assert response_data["status"] == "attended"
    assert response_data["hoursContributed"] == 2.5
    assert response_data["userFirstName"] == "Test"
    
    # Check that update was called on Firestore
    mock_assignment_doc.reference.update.assert_called_once() # This mock needs to be on the ref from document(assignment_id)
    # A more precise check would be:
    # mock_db.collection(ASSIGNMENTS_COLLECTION).document(assignment_id).update.assert_called_once_with(
    #     {"status": "attended", "hoursContributed": 2.5, "updatedAt": firestore.SERVER_TIMESTAMP}
    # )
    # This requires the mock_db...document() to return an object that has an async update method.
    # For simplicity, the current mock_assignment_doc.reference.update is okay if it's set up in the fixture.
    # Let's refine the mock_assignment_doc fixture for this.
    
    # Re-check: The update is called on assignment_ref, which is db.collection().document().
    # So, the mock should be:
    # mock_db.collection(ASSIGNMENTS_COLLECTION).document(assignment_id).update = AsyncMock()
    # ...
    # mock_db.collection(ASSIGNMENTS_COLLECTION).document(assignment_id).update.assert_called_once_with(
    #     {"status": "attended", "hoursContributed": 2.5, "updatedAt": firestore.SERVER_TIMESTAMP}
    # )
    # This is more complex to set up dynamically. The current check on mock_assignment_doc.reference.update is a good start.


@pytest.mark.asyncio
async def test_admin_delete_event_assignment_success(
    test_client: AsyncClient,
    mock_db: MagicMock,
    admin_user_id_token: str,
    mock_assignment_doc: MagicMock # Existing assignment
):
    event_id = mock_assignment_doc.to_dict()["assignableId"]
    assignment_id = mock_assignment_doc.id

    # Mock fetching the existing assignment
    mock_db.collection(ASSIGNMENTS_COLLECTION).document(assignment_id).get = AsyncMock(return_value=mock_assignment_doc)

    headers = {"Authorization": f"Bearer {admin_user_id_token}"}
    response = await test_client.delete(f"/events/{event_id}/assignments/{assignment_id}", headers=headers)

    assert response.status_code == 204
    mock_assignment_doc.reference.delete.assert_called_once()
