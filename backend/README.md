# Fiji Backend

This directory contains the Python FastAPI backend for Project Fiji.

## Project Structure

- `main.py`: The main FastAPI application entry point, including app setup, lifespan events, and root/health endpoints.
- `routers/`: Contains API route definitions, logically grouped by resource (e.g., `users.py`, `roles.py`).
- `models/`: Pydantic models for data validation, serialization, and schema definition.
- `dependencies/`: Shared dependencies for FastAPI routes, such as authentication (`auth.py`) and database access (`database.py`).
- `tests/`: Pytest unit and integration tests for the backend.
  - `conftest.py`: Pytest fixtures and configuration for tests.
  - `test_*.py`: Test files for different modules and endpoints.
- `utils/`: Utility scripts for various administrative or maintenance tasks.
- `Dockerfile`: For building the backend Docker image.
- `pyproject.toml`: Project metadata and dependencies, managed by `uv`.
- `uv.lock`: Lockfile for reproducible dependency installation.
- `.env.example`: Example environment variables (copy to `.env` and fill in).

## Setup and Running Locally

1.  **Prerequisites:**
    *   Python (version specified in `pyproject.toml`, e.g., >=3.13)
    *   `uv` (Python package manager, `pip install uv`)
    *   Google Cloud SDK (`gcloud`) configured for your project (for Application Default Credentials if running locally against a cloud Firestore instance).

2.  **Clone the repository** (if not already done). This backend is part of the `fiji` monorepo.

3.  **Navigate to the backend directory to set up the environment:**
    ```bash
    cd path/to/fiji/backend
    ```

4.  **Create and activate a virtual environment using `uv`:**
    ```bash
    uv venv
    source .venv/bin/activate  # On Linux/macOS
    # .venv\\Scripts\\activate    # On Windows
    ```
    *(Leave this virtual environment active for running the server).*

5.  **Install dependencies (while in `backend/` directory with venv active):**
    ```bash
    uv sync --dev 
    ```
    *(Using `--dev` installs testing dependencies as well; for production, `uv sync` is sufficient).*

6.  **Set up environment variables (in `backend/.env`):**
    *   Ensure `backend/.env` exists (copy from `backend/.env.example` if needed).
    *   Edit `backend/.env` and provide your `GOOGLE_CLOUD_PROJECT` ID.

7.  **Run the FastAPI application from the project root (`path/to/fiji`):**
    *   First, navigate to your project's root directory (the parent of `backend/`):
        ```bash
        cd path/to/fiji 
        ```
    *   Then, run Uvicorn using `uv run`, specifying the manifest path for the backend project. This ensures Python can find the `backend` package for absolute imports (e.g., `from backend.main import app`).
        ```bash
        uv run --manifest-path backend/pyproject.toml uvicorn backend.main:app --reload --port 8000
        ```
    *   Alternatively, if the `backend/.venv` is active and you are in the project root (`path/to/fiji`), you can often run Uvicorn directly using the Python from the venv:
        ```bash
        # Ensure backend/.venv is active
        # cd path/to/fiji
        python -m uvicorn backend.main:app --reload --port 8000
        ```

    The API will be available at `http://127.0.0.1:8000`.
    The OpenAPI documentation (Swagger UI) will be at `http://127.0.0.1:8000/docs`.

## Testing

This backend uses `pytest` for unit and integration testing. Tests are located in the `backend/tests/` directory.

### Prerequisites for Testing

- Ensure development dependencies are installed (done via `uv sync --dev` during setup).

### Running Tests

1.  **Navigate to the `backend` directory:**
    ```bash
    cd path/to/fiji/backend
    ```

2.  **Ensure your virtual environment (`backend/.venv`) is active:**
    ```bash
    source .venv/bin/activate
    ```

3.  **Run `pytest` using `uv run`:**
    This command ensures `pytest` is executed within the context of the project's environment and that `PYTHONPATH` is correctly set up for absolute imports starting with `backend.`.
    ```bash
    uv run pytest
    ```
    This will discover and run tests from the `backend/tests/` directory.

### Test Structure

- `tests/conftest.py`: Contains shared fixtures, including mocks for Firebase Admin SDK, Firestore client, and authentication dependencies. This allows tests to run without actual external service calls.
- `tests/test_*.py`: Individual test files for different modules or features (e.g., `test_main.py` for basic app endpoints, `test_roles.py` for role management APIs).

Tests use FastAPI's `TestClient` to make HTTP requests to the application endpoints and assert responses. Firestore interactions are mocked using `unittest.mock.MagicMock` (via `pytest-mock`).

## Utility Scripts

The `backend/utils/` directory contains scripts for various administrative, setup, or maintenance tasks.

### `initialize_firestore.py`
- **Purpose:** Sets up initial Firestore collections and essential documents (e.g., the `sysadmin` role, default application settings if any).
- **Usage:** Typically run once during initial project setup or when new core data structures are introduced.
  ```bash
  python backend/utils/initialize_firestore.py
  ```
  Ensure environment variables (`GOOGLE_CLOUD_PROJECT`, and potentially `GOOGLE_APPLICATION_CREDENTIALS` for local execution) are set.

### `create-role.py`
- **Purpose:** A command-line script to create new roles with specified privileges in Firestore.
- **Usage:**
  ```bash
  python backend/utils/create-role.py <roleName> --description "Role description" --privileges '{"resource": ["action1", "action2"]}'
  ```
  Example:
  ```bash
  python backend/utils/create-role.py event_manager --description "Manages events" --privileges '{"events": ["create", "edit", "view", "delete", "manage_assignments"], "users": ["view"]}'
  ```

### `create-invitation.py`
- **Purpose:** Generates a new registration invitation token and stores it in Firestore.
- **Usage:**
  ```bash
  python backend/utils/create-invitation.py <user_email_to_invite> --role <role_id_to_assign> [--expires-in-hours <hours>]
  ```
  Example:
  ```bash
  python backend/utils/create-invitation.py new.volunteer@example.com --role volunteer_basic
  ```
  The script will output the invitation token.

### `create-admin-user.py` (Example)
- **Purpose:** An example script to directly create a user in Firebase Authentication and Firestore, assigning them the `sysadmin` role. Useful for initial superuser setup.
- **Usage:**
  ```bash
  python backend/utils/create-admin-user.py <admin_email> <admin_password> [--firstName <FirstName>] [--lastName <LastName>]
  ```
  **Caution:** Use strong, unique passwords. This script directly handles credentials.

### `cleanup_orphan_assignments.py`
- **Purpose:** Identifies and optionally deletes orphaned assignment records from the `assignments` collection. An assignment is considered orphaned if its referenced `assignableId` (for an event or working group) no longer exists in the respective `events` or `workingGroups` collection. This helps maintain data integrity.
- **Usage:**
    - **Dry Run (Recommended First):** Lists potential orphans without deleting.
      ```bash
      python backend/utils/cleanup_orphan_assignments.py
      # or
      python backend/utils/cleanup_orphan_assignments.py --dry-run
      ```
    - **Execute Deletion:** After reviewing the dry run, use this to delete the identified orphans. You will be prompted for confirmation.
      ```bash
      python backend/utils/cleanup_orphan_assignments.py --execute
      ```
- **Prerequisites:** Ensure environment variables (`GOOGLE_CLOUD_PROJECT`, and `GOOGLE_APPLICATION_CREDENTIALS` if needed for local execution) are correctly set up for Firestore access.

## Linting and Formatting

(To be defined - e.g., Ruff, Black)

## Deployment

(Refer to the root `cloudbuild.yaml` and GCP Cloud Run documentation for deployment details.)