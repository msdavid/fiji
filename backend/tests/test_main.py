from fastapi.testclient import TestClient
from fastapi import status

# The 'client' fixture is defined in conftest.py and is auto-used or injected.
# The 'db_mock' fixture is also in conftest.py.

def test_read_root(client: TestClient):
    """
    Test the root endpoint (/).
    """
    response = client.get("/")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"message": "Welcome to the Fiji Backend!"}

def test_health_check_success(client: TestClient, db_mock):
    """
    Test the health check endpoint (/health) for a successful scenario.
    Assumes Firebase Admin SDK and Firestore client are initialized successfully by mocks.
    """
    # The client fixture already triggers the app lifespan, which initializes Firebase (mocked).
    # db_mock is included to ensure it's active and main.db is the mock.
    
    response = client.get("/health")
    assert response.status_code == status.HTTP_200_OK
    
    expected_project_id = "test-fiji-project-id" # As set in conftest.py
    expected_response = {
        "status": "ok",
        "message": "Backend is running, Firebase Admin SDK and Firestore client are initialized.",
        "project_id": expected_project_id
    }
    assert response.json() == expected_response

    # Verify that firestore.client() was called during app startup (lifespan)
    # The actual db_mock is what firebase_admin.firestore.client is patched to return.
    # So, we check if the factory (firebase_admin.firestore.client) was called.
    # Note: This specific check might be tricky depending on how db_mock is structured.
    # The db_mock in conftest.py is the *instance* returned by the mocked firestore.client.
    # To check if firestore.client itself was called, we'd need to access the mock object
    # that *replaced* firestore.client. This is usually done by patching it directly in the test
    # or having conftest.py return that specific mock.
    # For now, the functional check of the endpoint response is the primary goal.
    # If main.db is correctly assigned our db_mock, the health check logic should pass.

# Example of how you might test a failure case for /health if mocks were adjusted:
# def test_health_check_firebase_init_failure(client: TestClient, mocker):
#     """
#     Test the health check endpoint (/health) when Firebase Admin SDK fails to initialize.
#     This requires overriding or adjusting the mocks from conftest.py for this specific test.
#     """
#     # This is more advanced and requires careful mock setup.
#     # For example, make firebase_admin.initialize_app raise an exception,
#     # or make firebase_admin._apps empty.
#     
#     # For instance, if firebase_admin._apps was empty and db was None:
#     mocker.patch("firebase_admin._apps", new_callable=dict) # Empty apps
#     mocker.patch("main.db", None) # Simulate db not being initialized
#
#     # Re-initialize client if app state needs to be fresh based on new mocks
#     # This is tricky with TestClient's context manager if app is already "up".
#     # A new TestClient instance might be needed here if the app object itself caches state.
#
#     response = client.get("/health")
#     assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
#     assert response.json()["detail"]["status"] == "error"
#     assert "Firebase Admin SDK failed to initialize" in response.json()["detail"]["message"]
