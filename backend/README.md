# Fiji Backend

This directory contains the Python FastAPI backend for Project Fiji.

## Prerequisites

*   Python 3.10+
*   `uv` (Python packaging tool) - Installation: `curl -LsSf https://astral.sh/uv/install.sh | sh`
*   Access to the Google Cloud Project `fijian` with Firestore and Firebase Authentication enabled.
*   `gcloud` CLI installed and configured, with Application Default Credentials (ADC) set up:
    ```bash
    gcloud auth application-default login
    ```

## Setup and Local Development

1.  **Navigate to the backend directory:**
    ```bash
    cd /path/to/project/fiji/backend
    ```

2.  **Create and activate a virtual environment (recommended):**
    ```bash
    uv venv
    source .venv/bin/activate 
    # or .venv\Scripts\activate on Windows
    ```

3.  **Install dependencies:**
    ```bash
    uv pip sync pyproject.toml 
    # or uv sync if you only want to sync with uv.lock
    ```
    Ensure `firebase-admin` is listed in `pyproject.toml` or add it using `uv add firebase-admin`.

4.  **Initial Firestore Setup (Sysadmin Role):**
    The project includes a utility script to initialize the `sysadmin` role in Firestore. This script should be run once to set up the necessary roles.
    *   **Script location:** `backend/utils/initialize_firestore.py`
    *   **Purpose:** Creates the `roles` collection (if it doesn't exist) and adds the `sysadmin` document with predefined privileges. It uses Application Default Credentials (ADC) and is configured for project `fijian`.
    *   **To run the script:**
        ```bash
        python utils/initialize_firestore.py
        ```
        Ensure you are authenticated via `gcloud auth application-default login` and your environment has `firebase-admin` installed.

5.  **Environment Variables:**
    Create a `.env` file in the `backend` directory for local development. It might include variables like:
    ```env
    # .env
    GOOGLE_CLOUD_PROJECT="fijian" 
    # Add other environment variables as needed by the application
    ```
    The application will load these using `python-dotenv`. For Firebase Admin SDK initialization, the script and application primarily rely on ADC and the `GOOGLE_CLOUD_PROJECT` environment variable if ADC doesn't automatically pick up the project.

6.  **Run the FastAPI application:**
    ```bash
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
    ```
    The application will be available at `http://localhost:8000`.

## Project Structure

*   `main.py`: Main FastAPI application file.
*   `pyproject.toml`: Project metadata and dependencies managed by `uv`.
*   `uv.lock`: Lockfile for dependencies.
*   `utils/`: Directory for utility scripts.
    *   `initialize_firestore.py`: Script for initial Firestore setup.
*   `routers/`: (Proposed) Directory for API route modules.
*   `models/`: (Proposed) Directory for Pydantic models and data structures.
*   `services/`: (Proposed) Directory for business logic.
*   `dependencies/`: (Proposed) Directory for FastAPI dependencies (e.g., authentication).

## Dependencies

Key dependencies are managed in `pyproject.toml` via `uv`.
*   `fastapi`: Web framework.
*   `uvicorn`: ASGI server.
*   `firebase-admin`: For backend Firebase integration (Auth verification, Firestore access).
*   `python-dotenv`: For loading environment variables from `.env` files.

## Deployment

The backend is designed to be containerized using Docker and deployed on Google Cloud Run. Refer to the root `cloudbuild.yaml` and `backend/Dockerfile` for details.