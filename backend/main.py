import os
import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from contextlib import asynccontextmanager

# Use relative imports from the 'backend' directory as root
from dependencies.auth import get_firebase_user
from routers import roles as roles_router
from routers.invitations import admin_router as invitations_admin_router, public_router as invitations_public_router
from routers import users as users_router
from routers import events as events_router # Import the new events router

# Load environment variables from .env file
load_dotenv()

@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    print("FastAPI application starting up...")
    try:
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
        if not project_id:
            raise ValueError("GOOGLE_CLOUD_PROJECT environment variable not set.")

        if not firebase_admin._apps:
            # Use try-except for ADC credentials to handle environments where it might not be available
            try:
                cred = credentials.ApplicationDefault()
                firebase_admin.initialize_app(cred, {
                    'projectId': project_id,
                })
                print(f"Firebase Admin SDK initialized successfully for project: {project_id} using Application Default Credentials.")
            except Exception as e_adc:
                print(f"Failed to initialize Firebase with ADC: {e_adc}. Attempting service account key from env.")
                # Fallback to service account key if GOOGLE_APPLICATION_CREDENTIALS is set
                # This part is more for local dev if ADC isn't set up, GCP environments should use ADC.
                if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
                    # The firebase_admin.initialize_app() will automatically use this env var if cred is not passed
                    firebase_admin.initialize_app(options={'projectId': project_id})
                    print(f"Firebase Admin SDK initialized successfully for project: {project_id} using GOOGLE_APPLICATION_CREDENTIALS.")
                else:
                    raise ValueError(f"Firebase ADC failed and GOOGLE_APPLICATION_CREDENTIALS not set. Error: {e_adc}")
        else:
            project_id = firebase_admin.get_app().project_id
            print(f"Firebase Admin SDK already initialized for project: {project_id}")

        app_instance.state.db = firestore.client()
        print("Firestore client initialized and stored in app.state.db.")

    except ValueError as e:
        print(f"Error initializing Firebase Admin SDK (ValueError): {e}")
        app_instance.state.db = None # Ensure db is None if init fails
    except Exception as e:
        print(f"An unexpected error occurred during Firebase Admin SDK initialization: {e}")
        app_instance.state.db = None # Ensure db is None if init fails

    yield
    # Shutdown
    print("FastAPI application shutting down...")
    # No specific cleanup needed for Firestore client or Firebase Admin SDK typically


# --- FastAPI Application ---
app = FastAPI(
    title="Fiji Backend API",
    description="API for managing volunteers, events, and organizational data for Project Fiji.",
    version="0.1.0",
    lifespan=lifespan
)

# --- CORS Middleware Configuration ---
# Allow all origins for development, or specify your frontend URL for production
origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3002")
origins = [origin.strip() for origin in origins_env.split(',')]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(roles_router.router)
app.include_router(invitations_admin_router)
app.include_router(invitations_public_router)
app.include_router(users_router.router)
app.include_router(events_router.router) # Add the events router


@app.get("/")
async def root():
    return {"message": "Welcome to the Fiji Backend!"}

@app.get("/health")
async def health_check(request: Request):
    firebase_app_initialized = bool(firebase_admin._apps)
    firestore_client_initialized = hasattr(request.app.state, 'db') and request.app.state.db is not None
    project_id_val = None
    if firebase_app_initialized:
        try:
            project_id_val = firebase_admin.get_app().project_id
        except Exception: # Handle case where get_app might fail if not fully initialized
            project_id_val = "Error retrieving project_id"


    if firebase_app_initialized and firestore_client_initialized:
        return {
            "status": "ok",
            "message": "Backend is running, Firebase Admin SDK and Firestore client are initialized.",
            "project_id": project_id_val
        }
    elif firebase_app_initialized: # Firestore client failed
        return {
            "status": "partial_error",
            "message": "Backend is running, Firebase Admin SDK initialized, but Firestore client (app.state.db) failed to initialize.",
            "project_id": project_id_val,
            "db_state": str(getattr(request.app.state, 'db', 'Not set'))
        }
    else: # Firebase Admin SDK failed
        # Avoid raising HTTPException here to allow health check to always return JSON if possible
        return {
            "status": "error",
            "message": "Backend is running, but Firebase Admin SDK failed to initialize.",
            "project_id": None,
            "db_state": str(getattr(request.app.state, 'db', 'Not set'))
        }

# The /users/me endpoint is now in routers/users.py, this one can be removed if it's a duplicate.
# @app.get("/users/me", tags=["Users"]) # This seems to be a duplicate from Sprint 0/1.
# async def read_users_me(current_user: dict = Depends(get_firebase_user)):
#     return {"user_info": current_user}
# Removing the duplicate /users/me from main.py as it's defined in users_router.