import pytest
from httpx import AsyncClient
from firebase_admin import firestore
from unittest.mock import MagicMock, AsyncMock
import datetime

# Assuming app instance is in main.py, client fixture from conftest.py
WORKING_GROUPS_COLLECTION = "workingGroups"
ASSIGNMENTS_COLLECTION = "assignments"
USERS_COLLECTION = "users"

@pytest.fixture
def mock_wg_doc():
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "id": "test_wg_id",
        "groupName": "Test WG",
        "description": "A test working group",
        "status": "active",
        "createdByUserId": "test_admin_user_id",
        "createdAt": datetime.datetime.utcnow(),
        "updatedAt": datetime.datetime.utcnow(),
    }
    mock_doc.id = "test_wg_id"
    mock_doc.reference = AsyncMock() # For delete
    return mock_doc

@pytest.fixture
def mock_wg_assignment_doc():
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "id": "test_wg_assign_id",
        "userId": "test_assigned_user_id",
        "assignableId": "test_wg_id",
        "assignableType": "workingGroup",
        "status": "active",
        "assignedByUserId": "test_admin_user_id",
        "assignmentDate": datetime.datetime.utcnow(),
        "createdAt": datetime.datetime.utcnow(),
        "updatedAt": datetime.datetime.utcnow(),
    }
    mock_doc.id = "test_wg_assign_id"
    mock_doc.reference = AsyncMock() # For delete
    return mock_doc

@pytest.fixture
def mock_admin_profile_doc(): # For creator/assigner
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {"firstName": "Admin", "lastName": "User", "email": "admin@example.com"}
    mock_doc.id = "test_admin_user_id"
    return mock_doc

@pytest.fixture
def mock_assigned_user_profile_doc(): # For user being assigned
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {"firstName": "Assigned", "lastName": "Person", "email": "assigned@example.com"}
    mock_doc.id = "test_assigned_user_id"
    return mock_doc

# --- Working Group CRUD Tests ---
@pytest.mark.asyncio
async def test_create_working_group(
    test_client: AsyncClient, mock_db: MagicMock, admin_user_id_token: str, mock_admin_profile_doc: MagicMock
):
    mock_db.collection(USERS_COLLECTION).document("test_admin_user_id").get = AsyncMock(return_value=mock_admin_profile_doc)
    
    new_wg_data_payload = {"groupName": "New WG", "description": "New Desc", "status": "active"}
    
    mock_new_wg_ref = AsyncMock()
    mock_created_doc = AsyncMock()
    mock_created_doc.exists = True
    mock_created_doc.id = "new_wg_firestore_id"
    mock_created_doc.to_dict.return_value = {
        **new_wg_data_payload,
        "createdByUserId": "test_admin_user_id", # from token
        "createdAt": datetime.datetime.utcnow(),
        "updatedAt": datetime.datetime.utcnow(),
    }
    mock_new_wg_ref.get = AsyncMock(return_value=mock_created_doc)
    mock_db.collection(WORKING_GROUPS_COLLECTION).document.return_value = mock_new_wg_ref

    headers = {"Authorization": f"Bearer {admin_user_id_token}"}
    response = await test_client.post("/working-groups", json=new_wg_data_payload, headers=headers)

    assert response.status_code == 201
    data = response.json()
    assert data["groupName"] == "New WG"
    assert data["createdByUserId"] == "test_admin_user_id"
    assert data["creatorFirstName"] == "Admin"
    mock_new_wg_ref.set.assert_called_once()

@pytest.mark.asyncio
async def test_list_working_groups(
    test_client: AsyncClient, mock_db: MagicMock, admin_user_id_token: str, mock_wg_doc: MagicMock, mock_admin_profile_doc: MagicMock
):
    mock_stream = AsyncMock()
    mock_stream.stream = AsyncMock(return_value=[mock_wg_doc]) # Simulate one WG
    mock_db.collection(WORKING_GROUPS_COLLECTION).order_by.return_value = mock_stream
    mock_db.collection(USERS_COLLECTION).document(mock_wg_doc.to_dict()["createdByUserId"]).get = AsyncMock(return_value=mock_admin_profile_doc)

    headers = {"Authorization": f"Bearer {admin_user_id_token}"}
    response = await test_client.get("/working-groups", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == mock_wg_doc.id
    assert data[0]["creatorFirstName"] == "Admin"

@pytest.mark.asyncio
async def test_get_working_group(
    test_client: AsyncClient, mock_db: MagicMock, admin_user_id_token: str, mock_wg_doc: MagicMock, mock_admin_profile_doc: MagicMock
):
    wg_id = mock_wg_doc.id
    mock_db.collection(WORKING_GROUPS_COLLECTION).document(wg_id).get = AsyncMock(return_value=mock_wg_doc)
    mock_db.collection(USERS_COLLECTION).document(mock_wg_doc.to_dict()["createdByUserId"]).get = AsyncMock(return_value=mock_admin_profile_doc)

    headers = {"Authorization": f"Bearer {admin_user_id_token}"}
    response = await test_client.get(f"/working-groups/{wg_id}", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == wg_id
    assert data["groupName"] == mock_wg_doc.to_dict()["groupName"]
    assert data["creatorFirstName"] == "Admin"

@pytest.mark.asyncio
async def test_update_working_group(
    test_client: AsyncClient, mock_db: MagicMock, admin_user_id_token: str, mock_wg_doc: MagicMock, mock_admin_profile_doc: MagicMock
):
    wg_id = mock_wg_doc.id
    update_payload = {"groupName": "Updated WG Name", "status": "archived"}

    # Mock initial fetch
    mock_db.collection(WORKING_GROUPS_COLLECTION).document(wg_id).get = AsyncMock(return_value=mock_wg_doc)
    # Mock update call
    mock_wg_doc.reference.update = AsyncMock() # This should be on the document reference itself
    
    # Mock fetch after update
    updated_data = {**mock_wg_doc.to_dict(), **update_payload, "updatedAt": datetime.datetime.utcnow()}
    mock_updated_doc_snap = AsyncMock()
    mock_updated_doc_snap.exists = True
    mock_updated_doc_snap.to_dict.return_value = updated_data
    mock_updated_doc_snap.id = wg_id
    
    # This is tricky: the get() after update should return the new data.
    # We can mock the document reference to control its get() calls sequentially or make it simpler.
    # For now, let's assume the update happens and the subsequent get reflects it.
    # A more robust way is to mock the document reference's update method and then have the get return the updated mock.
    
    mock_doc_ref = AsyncMock()
    mock_doc_ref.get = AsyncMock(side_effect=[mock_wg_doc, mock_updated_doc_snap]) # First get, then get after update
    mock_doc_ref.update = AsyncMock()
    mock_db.collection(WORKING_GROUPS_COLLECTION).document.return_value = mock_doc_ref

    mock_db.collection(USERS_COLLECTION).document(updated_data["createdByUserId"]).get = AsyncMock(return_value=mock_admin_profile_doc)


    headers = {"Authorization": f"Bearer {admin_user_id_token}"}
    response = await test_client.put(f"/working-groups/{wg_id}", json=update_payload, headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["groupName"] == "Updated WG Name"
    assert data["status"] == "archived"
    mock_doc_ref.update.assert_called_once()
    # Check that updatedAt was part of the update call to Firestore
    args, kwargs = mock_doc_ref.update.call_args
    assert "updatedAt" in args[0]


@pytest.mark.asyncio
async def test_delete_working_group(
    test_client: AsyncClient, mock_db: MagicMock, admin_user_id_token: str, mock_wg_doc: MagicMock
):
    wg_id = mock_wg_doc.id
    
    mock_doc_ref = AsyncMock()
    mock_doc_ref.get = AsyncMock(return_value=mock_wg_doc)
    mock_doc_ref.delete = AsyncMock()
    mock_db.collection(WORKING_GROUPS_COLLECTION).document(wg_id).return_value = mock_doc_ref

    # Mock assignment deletion query
    mock_assignment_stream = AsyncMock()
    mock_assignment_doc_to_delete = MagicMock() # A mock assignment document
    mock_assignment_doc_to_delete.reference = AsyncMock()
    mock_assignment_stream.stream = AsyncMock(return_value=[mock_assignment_doc_to_delete]) # Simulate one assignment
    
    mock_db.collection(ASSIGNMENTS_COLLECTION).where.return_value.where.return_value = mock_assignment_stream

    headers = {"Authorization": f"Bearer {admin_user_id_token}"}
    response = await test_client.delete(f"/working-groups/{wg_id}", headers=headers)

    assert response.status_code == 204
    mock_doc_ref.delete.assert_called_once()
    mock_assignment_doc_to_delete.reference.delete.assert_called_once() # Check related assignment deleted


# --- Working Group Assignment Tests ---
@pytest.mark.asyncio
async def test_assign_user_to_working_group(
    test_client: AsyncClient, mock_db: MagicMock, admin_user_id_token: str,
    mock_wg_doc: MagicMock, mock_assigned_user_profile_doc: MagicMock
):
    group_id = mock_wg_doc.id
    user_to_assign_id = mock_assigned_user_profile_doc.id

    mock_db.collection(WORKING_GROUPS_COLLECTION).document(group_id).get = AsyncMock(return_value=mock_wg_doc)
    mock_db.collection(USERS_COLLECTION).document(user_to_assign_id).get = AsyncMock(return_value=mock_assigned_user_profile_doc)

    # Mock check for existing assignment (none)
    mock_existing_assign_query = AsyncMock()
    mock_existing_assign_query.stream = AsyncMock(return_value=[])
    mock_db.collection(ASSIGNMENTS_COLLECTION).where.return_value.where.return_value.where.return_value.limit.return_value = mock_existing_assign_query

    # Mock new assignment creation
    mock_new_assign_ref = AsyncMock()
    mock_created_assign_doc = AsyncMock()
    mock_created_assign_doc.exists = True
    mock_created_assign_doc.id = "new_wg_assign_firestore_id"
    mock_created_assign_doc.to_dict.return_value = {
        "userId": user_to_assign_id,
        "assignableId": group_id,
        "assignableType": "workingGroup",
        "status": "active",
        "assignedByUserId": "test_admin_user_id", # from token
        "assignmentDate": datetime.datetime.utcnow(),
        "createdAt": datetime.datetime.utcnow(),
        "updatedAt": datetime.datetime.utcnow(),
    }
    mock_new_assign_ref.get = AsyncMock(return_value=mock_created_assign_doc)
    mock_db.collection(ASSIGNMENTS_COLLECTION).document.return_value = mock_new_assign_ref

    assignment_payload = {"userId": user_to_assign_id, "assignableId": group_id, "assignableType": "workingGroup", "status": "active"}
    headers = {"Authorization": f"Bearer {admin_user_id_token}"}
    response = await test_client.post(f"/working-groups/{group_id}/assignments", json=assignment_payload, headers=headers)

    assert response.status_code == 201
    data = response.json()
    assert data["userId"] == user_to_assign_id
    assert data["assignableId"] == group_id
    assert data["assignableType"] == "workingGroup"
    assert data["userFirstName"] == "Assigned"
    mock_new_assign_ref.set.assert_called_once()


@pytest.mark.asyncio
async def test_list_working_group_assignments(
    test_client: AsyncClient, mock_db: MagicMock, admin_user_id_token: str,
    mock_wg_doc: MagicMock, mock_wg_assignment_doc: MagicMock, mock_assigned_user_profile_doc: MagicMock
):
    group_id = mock_wg_doc.id
    mock_db.collection(WORKING_GROUPS_COLLECTION).document(group_id).get = AsyncMock(return_value=mock_wg_doc)

    # Ensure the mock assignment is for this group
    mock_wg_assignment_doc.to_dict.return_value["assignableId"] = group_id
    
    mock_assign_stream = AsyncMock()
    mock_assign_stream.stream = AsyncMock(return_value=[mock_wg_assignment_doc])
    mock_db.collection(ASSIGNMENTS_COLLECTION).where.return_value.where.return_value = mock_assign_stream
    
    mock_db.collection(USERS_COLLECTION).document(mock_wg_assignment_doc.to_dict()["userId"]).get = AsyncMock(return_value=mock_assigned_user_profile_doc)

    headers = {"Authorization": f"Bearer {admin_user_id_token}"}
    response = await test_client.get(f"/working-groups/{group_id}/assignments", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == mock_wg_assignment_doc.id
    assert data[0]["userId"] == mock_assigned_user_profile_doc.id
    assert data[0]["userFirstName"] == "Assigned"


@pytest.mark.asyncio
async def test_remove_user_from_working_group(
    test_client: AsyncClient, mock_db: MagicMock, admin_user_id_token: str,
    mock_wg_doc: MagicMock, mock_wg_assignment_doc: MagicMock
):
    group_id = mock_wg_doc.id
    assignment_id = mock_wg_assignment_doc.id

    # Ensure the mock assignment is for this group
    mock_wg_assignment_doc.to_dict.return_value["assignableId"] = group_id
    
    mock_assign_doc_ref = AsyncMock()
    mock_assign_doc_ref.get = AsyncMock(return_value=mock_wg_assignment_doc)
    mock_assign_doc_ref.delete = AsyncMock()
    mock_db.collection(ASSIGNMENTS_COLLECTION).document(assignment_id).return_value = mock_assign_doc_ref
    
    headers = {"Authorization": f"Bearer {admin_user_id_token}"}
    response = await test_client.delete(f"/working-groups/{group_id}/assignments/{assignment_id}", headers=headers)

    assert response.status_code == 204
    mock_assign_doc_ref.delete.assert_called_once()
