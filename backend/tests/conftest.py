import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
import os
import firebase_admin # Import for manipulating _apps

# Use absolute import from 'backend'
from backend.main import app  # The FastAPI application instance

# The actual default app name used by Firebase Admin SDK
DEFAULT_APP_NAME_INTERNAL = "[DEFAULT]"

@pytest.fixture(scope="session", autouse=True)
def setup_firebase_environment():
    """
    Sets up necessary environment variables for Firebase before any app import.
    This fixture is autouse and session-scoped to run once.
    """
    os.environ["GOOGLE_CLOUD_PROJECT"] = "test-fiji-project-id"

@pytest.fixture(scope="session")
def mock_firebase_admin_session(session_mocker):
    """
    Mocks firebase_admin components at the session level.
    """
    session_mocker.patch("firebase_admin.credentials.ApplicationDefault", return_value=MagicMock())

    mock_app_instance = MagicMock(spec=firebase_admin.App)
    mock_app_instance.project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    mock_app_instance.name = DEFAULT_APP_NAME_INTERNAL # Set the name attribute for the mock app
    
    # Mock firebase_admin.initialize_app()
    def _mock_initialize_app(credential=None, options=None, name=DEFAULT_APP_NAME_INTERNAL): # Use the string literal
        if name not in firebase_admin._apps:
             firebase_admin._apps[name] = mock_app_instance
        return firebase_admin._apps[name]
    session_mocker.patch("firebase_admin.initialize_app", side_effect=_mock_initialize_app)
    
    # Mock firebase_admin.get_app()
    def _mock_get_app(name=DEFAULT_APP_NAME_INTERNAL): # Use the string literal
        if name not in firebase_admin._apps:
            raise ValueError(f"The Firebase app named '{name}' has not been initialized.")
        return firebase_admin._apps[name]
    session_mocker.patch("firebase_admin.get_app", side_effect=_mock_get_app)

    mock_firestore_client_instance = MagicMock(spec=firebase_admin.firestore.firestore.Client)
    session_mocker.patch("firebase_admin.firestore.client", return_value=mock_firestore_client_instance)
    
    return {
        "firestore_client": mock_firestore_client_instance,
        "app_instance": mock_app_instance
    }

@pytest.fixture(scope="function")
def db_mock(mock_firebase_admin_session):
    """
    Provides the application's Firestore client mock.
    """
    firestore_mock_instance = mock_firebase_admin_session["firestore_client"]
    firestore_mock_instance.reset_mock(return_value=True, side_effect=True)
    firebase_admin._apps.clear()
    return firestore_mock_instance

@pytest.fixture(scope="function")
def client(db_mock): 
    """
    Provides a TestClient instance.
    """
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture(autouse=True, scope="function")
def mock_auth_dependencies(mocker):
    """
    Mocks authentication-related dependencies using absolute paths.
    """
    default_mock_user = {"uid": "test-user-123", "email": "test.user@example.com", "name": "Test User"}
    
    mocker.patch("backend.dependencies.auth.get_firebase_user", return_value=default_mock_user)
    mocker.patch("backend.routers.roles.verify_sysadmin_role", return_value=default_mock_user)