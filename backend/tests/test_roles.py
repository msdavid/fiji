from fastapi.testclient import TestClient
from fastapi import status
from unittest.mock import MagicMock, ANY
import datetime

ROLES_COLLECTION = "roles" 

def get_auth_headers():
    return {"Authorization": "Bearer dummytoken"}

def test_create_role_success(client: TestClient, db_mock: MagicMock):
    role_name = "Test Role Alpha"
    role_description = "A description for Test Role Alpha"
    # Corrected to use 'privileges' and a Dict structure
    privileges_data = {"tasks": ["create", "view"], "documents": ["upload"]}
    role_data_in = {"roleName": role_name, "description": role_description, "privileges": privileges_data}

    mock_query_existing = MagicMock()
    mock_query_existing.stream.return_value = [] 
    db_mock.collection.return_value.where.return_value.limit.return_value = mock_query_existing

    mock_doc_ref_id = "test-role-id-123"
    mock_doc_ref = MagicMock()
    mock_doc_ref.id = mock_doc_ref_id
    db_mock.collection.return_value.document.return_value = mock_doc_ref

    mock_created_doc_snapshot = MagicMock()
    mock_created_doc_snapshot.exists = True
    mock_created_doc_snapshot.id = mock_doc_ref_id
    current_time = datetime.datetime.now(datetime.timezone.utc)
    # This data is for the .to_dict() mock, should match what RoleResponse expects from the DB
    expected_role_data_from_db = {
        "roleName": role_name,
        "description": role_description,
        "privileges": privileges_data, # Should be 'privileges' here too
        "isSystemRole": False,
        "createdAt": current_time,
        "updatedAt": current_time
    }
    mock_created_doc_snapshot.to_dict.return_value = expected_role_data_from_db
    mock_doc_ref.get.return_value = mock_created_doc_snapshot
    
    response = client.post("/roles/", json=role_data_in, headers=get_auth_headers())

    assert response.status_code == status.HTTP_201_CREATED, response.json() # Include response.json() in assert message
    response_json = response.json()
    assert response_json["roleId"] == mock_doc_ref_id 
    assert response_json["roleName"] == role_name
    assert response_json["description"] == role_description
    assert response_json["privileges"] == privileges_data # Check for privileges in response
    assert response_json["isSystemRole"] is False
    assert "createdAt" in response_json 
    assert "updatedAt" in response_json

    db_mock.collection.assert_any_call(ROLES_COLLECTION)
    db_mock.collection.return_value.where.assert_called_once_with("roleName", "==", role_name)
    db_mock.collection.return_value.where.return_value.limit.assert_called_once_with(1)
    mock_query_existing.stream.assert_called_once()
    db_mock.collection.return_value.document.assert_called_once_with() 
    # This is the data passed to Firestore's set() method
    expected_set_data = {
        "roleName": role_name,
        "description": role_description,
        "privileges": privileges_data, # Corrected to 'privileges'
        "isSystemRole": False,
        "createdAt": ANY, 
        "updatedAt": ANY
    }
    mock_doc_ref.set.assert_called_once_with(expected_set_data)
    mock_doc_ref.get.assert_called_once()


def test_create_role_already_exists(client: TestClient, db_mock: MagicMock):
    role_name = "Existing Role"
    # Use 'privileges' for consistency, though it might not matter for this specific test logic
    role_data_in = {"roleName": role_name, "description": "desc", "privileges": {}} 

    mock_existing_doc_snapshot = MagicMock()
    mock_query_existing = MagicMock()
    mock_query_existing.stream.return_value = [mock_existing_doc_snapshot]
    db_mock.collection.return_value.where.return_value.limit.return_value = mock_query_existing

    response = client.post("/roles/", json=role_data_in, headers=get_auth_headers())

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["detail"] == f"Role with name '{role_name}' already exists."
    
    db_mock.collection.assert_called_with(ROLES_COLLECTION)
    db_mock.collection.return_value.where.assert_called_with("roleName", "==", role_name)

def test_get_all_roles_success(client: TestClient, db_mock: MagicMock):
    current_time = datetime.datetime.now(datetime.timezone.utc)
    # Use 'privileges' in mock data from DB
    roles_data_from_db = [
        {"roleId": "role1", "roleName": "Admin", "description": "Administrator role", "privileges": {"system": ["all"]}, "isSystemRole": True, "createdAt": current_time, "updatedAt": current_time},
        {"roleId": "role2", "roleName": "Editor", "description": "Editor role", "privileges": {"content": ["edit"]}, "isSystemRole": False, "createdAt": current_time, "updatedAt": current_time},
    ]

    mock_docs = []
    for role_data in roles_data_from_db:
        doc_snapshot = MagicMock()
        doc_snapshot.id = role_data["roleId"]
        dict_data = {k: v for k, v in role_data.items() if k != "roleId"}
        doc_snapshot.to_dict.return_value = dict_data
        mock_docs.append(doc_snapshot)

    db_mock.collection.return_value.stream.return_value = mock_docs

    response = client.get("/roles/", headers=get_auth_headers())

    assert response.status_code == status.HTTP_200_OK
    response_json = response.json()
    assert len(response_json) == len(roles_data_from_db)
    for i, role_resp in enumerate(response_json):
        assert role_resp["roleId"] == roles_data_from_db[i]["roleId"]
        assert role_resp["roleName"] == roles_data_from_db[i]["roleName"]
        assert role_resp["privileges"] == roles_data_from_db[i]["privileges"] # Check privileges
        assert isinstance(role_resp["createdAt"], str)
        assert isinstance(role_resp["updatedAt"], str)

    db_mock.collection.assert_called_once_with(ROLES_COLLECTION)
    db_mock.collection.return_value.stream.assert_called_once()

def test_get_all_roles_empty(client: TestClient, db_mock: MagicMock):
    db_mock.collection.return_value.stream.return_value = []

    response = client.get("/roles/", headers=get_auth_headers())

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == []

    db_mock.collection.assert_called_once_with(ROLES_COLLECTION)
    db_mock.collection.return_value.stream.assert_called_once()
