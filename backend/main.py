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
from routers import events as events_router
from routers import working_groups as working_groups_router # Import the new working_groups router

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

        # Use firestore.AsyncClient for async operations
        app_instance.state.db = firestore.AsyncClient()
        print("Async Firestore client initialized and stored in app.state.db.")

    except ValueError as e:
        print(f"Error initializing Firebase Admin SDK (ValueError): {e}")
        app_instance.state.db = None # Ensure db is None if init fails
    except Exception as e:
        print(f"An unexpected error occurred during Firebase Admin SDK initialization: {e}")
        app_instance.state.db = None # Ensure db is None if init fails

    yield
    # Shutdown
    print("FastAPI application shutting down...")
    if app_instance.state.db:
        await app_instance.state.db.close() # Close async client
        print("Async Firestore client closed.")


# --- FastAPI Application ---
app = FastAPI(
    title="Fiji Backend API",
    description="API for managing volunteers, events, and organizational data for Project Fiji.",
    version="0.1.0",
    lifespan=lifespan
)

# --- CORS Middleware Configuration ---
# Allow all origins for development, or specify your frontend URL for production
origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3002") # Default for Next.js dev
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
app.include_router(events_router.router)
app.include_router(working_groups_router.router) # Add the working_groups router


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
        except Exception: 
            project_id_val = "Error retrieving project_id"


    if firebase_app_initialized and firestore_client_initialized:
        return {
            "status": "ok",
            "message": "Backend is running, Firebase Admin SDK and Async Firestore client are initialized.",
            "project_id": project_id_val
        }
    elif firebase_app_initialized: 
        return {
            "status": "partial_error",
            "message": "Backend is running, Firebase Admin SDK initialized, but Async Firestore client (app.state.db) failed to initialize.",
            "project_id": project_id_val,
            "db_state": str(getattr(request.app.state, 'db', 'Not set'))
        }
    else: 
        return {
            "status": "error",
            "message": "Backend is running, but Firebase Admin SDK failed to initialize.",
            "project_id": None,
            "db_state": str(getattr(request.app.state, 'db', 'Not set'))
        }
