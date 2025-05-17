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
from routers import working_groups as working_groups_router

# Load environment variables from .env file
load_dotenv()

@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    app_instance.state.db = None  # Initialize db state to None
    print("FastAPI application starting up...")
    try:
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
        if not project_id:
            raise ValueError("GOOGLE_CLOUD_PROJECT environment variable not set.")

        if not firebase_admin._apps:
            try:
                cred = credentials.ApplicationDefault()
                firebase_admin.initialize_app(cred, {
                    'projectId': project_id,
                })
                print(f"Firebase Admin SDK initialized successfully for project: {project_id} using Application Default Credentials.")
            except Exception as e_adc:
                print(f"Failed to initialize Firebase with ADC: {e_adc}. Attempting service account key from env.")
                if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
                    firebase_admin.initialize_app(options={'projectId': project_id})
                    print(f"Firebase Admin SDK initialized successfully for project: {project_id} using GOOGLE_APPLICATION_CREDENTIALS.")
                else:
                    raise ValueError(f"Firebase ADC failed and GOOGLE_APPLICATION_CREDENTIALS not set. Error: {e_adc}")
        else:
            # Ensure mypy knows project_id will be a string here if firebase_admin._apps is not empty
            current_app_project_id = firebase_admin.get_app().project_id if firebase_admin.get_app() else "Unknown"
            print(f"Firebase Admin SDK already initialized for project: {current_app_project_id}")

        app_instance.state.db = firestore.AsyncClient()
        print("Async Firestore client initialized and stored in app.state.db.")

    except ValueError as e:
        print(f"Error during Firebase/Firestore initialization (ValueError): {e}")
        # app_instance.state.db remains None due to initialization at the start
    except Exception as e:
        print(f"An unexpected error occurred during Firebase/Firestore initialization: {e}")
        # app_instance.state.db remains None

    yield # Application runs

    # Shutdown
    print("FastAPI application shutting down...")
    if app_instance.state.db is not None:
        print(f"Attempting to close Firestore client of type: {type(app_instance.state.db)}")
        try:
            await app_instance.state.db.close() # Close async client
            print("Async Firestore client closed successfully.")
        except AttributeError as ae:
            print(f"Error closing Firestore client: 'close' attribute missing. Type was {type(app_instance.state.db)}. Error: {ae}")
        except TypeError as te:
            # This might catch the specific error if `await db.close()` is effectively `await None`
            print(f"Error closing Firestore client: TypeError (possibly awaiting a non-async close method that returned None, or db object is None). Error: {te}")
            print(f"Current app_instance.state.db value: {app_instance.state.db}")
        except Exception as e:
            print(f"An unexpected error occurred while closing Firestore client: {e}")
    else:
        print("Firestore client (app.state.db) was None or not initialized, skipping close.")


# --- FastAPI Application ---
app = FastAPI(
    title="Fiji Backend API",
    description="API for managing volunteers, events, and organizational data for Project Fiji.",
    version="0.1.0",
    lifespan=lifespan
)

# --- CORS Middleware Configuration ---
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
app.include_router(events_router.router)
app.include_router(working_groups_router.router)


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
            current_app = firebase_admin.get_app()
            project_id_val = current_app.project_id if current_app else "Error: Firebase app not found"
        except Exception as e:
            project_id_val = f"Error retrieving project_id: {e}"

    status_info = {
        "firebase_sdk_initialized": firebase_app_initialized,
        "firestore_client_initialized": firestore_client_initialized,
        "project_id": project_id_val,
        "db_state_type": str(type(getattr(request.app.state, 'db', None))),
        "db_state_value_repr": repr(getattr(request.app.state, 'db', None))
    }

    if firebase_app_initialized and firestore_client_initialized:
        return {
            "status": "ok",
            "message": "Backend is running, Firebase Admin SDK and Async Firestore client are initialized.",
            **status_info
        }
    elif firebase_app_initialized:
        return {
            "status": "partial_error",
            "message": "Backend is running, Firebase Admin SDK initialized, but Async Firestore client (app.state.db) may not have initialized correctly.",
            **status_info
        }
    else:
        return {
            "status": "error",
            "message": "Backend is running, but Firebase Admin SDK failed to initialize.",
            **status_info
        }