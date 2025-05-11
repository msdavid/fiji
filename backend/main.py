import os
import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import FastAPI, HTTPException, Depends, Request
from dotenv import load_dotenv
from contextlib import asynccontextmanager

# Use absolute imports from 'backend'
from backend.dependencies.auth import get_firebase_user
from backend.routers import roles as roles_router
from backend.routers import invitations as invitations_router
from backend.routers import users as users_router

# Load environment variables from .env file
load_dotenv() # This should ideally be called before other modules if they depend on .env

# --- Firebase Admin SDK Initialization (within lifespan) ---

@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    print("FastAPI application starting up...")
    try:
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
        if not project_id:
            raise ValueError("GOOGLE_CLOUD_PROJECT environment variable not set.")

        if not firebase_admin._apps:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {
                'projectId': project_id,
            })
            print(f"Firebase Admin SDK initialized successfully for project: {project_id}")
        else:
            project_id = firebase_admin.get_app().project_id
            print(f"Firebase Admin SDK already initialized for project: {project_id}")

        app_instance.state.db = firestore.client()
        print("Firestore client initialized and stored in app.state.db.")

    except ValueError as e:
        print(f"Error initializing Firebase Admin SDK (ValueError): {e}")
        app_instance.state.db = None
    except Exception as e:
        print(f"An unexpected error occurred during Firebase Admin SDK initialization: {e}")
        app_instance.state.db = None

    yield
    # Shutdown
    print("FastAPI application shutting down...")
    if hasattr(app_instance.state, 'db') and app_instance.state.db is not None:
        print("Firestore client available at shutdown.")
    app_instance.state.db = None


# --- FastAPI Application ---
app = FastAPI(
    title="Fiji Backend API",
    description="API for managing volunteers, events, and organizational data for Project Fiji.",
    version="0.1.0",
    lifespan=lifespan
)

# Include routers
app.include_router(roles_router.router)
app.include_router(invitations_router.router)
app.include_router(users_router.router)


@app.get("/")
async def root():
    return {"message": "Welcome to the Fiji Backend!"}

@app.get("/health")
async def health_check(request: Request):
    firebase_app_initialized = bool(firebase_admin._apps)
    firestore_client_initialized = hasattr(request.app.state, 'db') and request.app.state.db is not None

    if firebase_app_initialized and firestore_client_initialized:
        return {
            "status": "ok",
            "message": "Backend is running, Firebase Admin SDK and Firestore client are initialized.",
            "project_id": firebase_admin.get_app().project_id
        }
    elif firebase_app_initialized:
        return {
            "status": "partial_error",
            "message": "Backend is running, Firebase Admin SDK initialized, but Firestore client (app.state.db) failed to initialize.",
            "project_id": firebase_admin.get_app().project_id
        }
    else:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "error",
                "message": "Backend is running, but Firebase Admin SDK failed to initialize.",
                "project_id": None
            }
        )

@app.get("/users/me", tags=["Users"])
async def read_users_me(current_user: dict = Depends(get_firebase_user)):
    return {"user_info": current_user}

# To run this application locally (from the backend directory, if backend's parent is in PYTHONPATH):
# Option 1: `python -m uvicorn backend.main:app --reload --port 8000` (run from project root /home/mauro/projects/fiji)
# Option 2: `uvicorn main:app --reload --port 8000` (run from backend/, if PYTHONPATH is set up by uv or manually)