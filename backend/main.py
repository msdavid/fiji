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
from routers import donations as donations_router
from routers import assignments as assignments_router
from routers import reports as reports_router 
from routers.auth import router as auth_router
from routers import two_factor as two_factor_router
from routers import organization as organization_router
from routers import uploads as uploads_router 

load_dotenv()

@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    app_instance.state.db = None  
    print("FastAPI application starting up...")
    try:
        project_id_env = os.getenv("GOOGLE_CLOUD_PROJECT")
        print(f"Attempting to use GOOGLE_CLOUD_PROJECT from env: {project_id_env}")
        if not project_id_env:
            raise ValueError("GOOGLE_CLOUD_PROJECT environment variable not set.")

        if not firebase_admin._apps:
            try:
                print("Attempting Firebase Admin SDK initialization with Application Default Credentials...")
                cred = credentials.ApplicationDefault()
                firebase_admin.initialize_app(cred, {
                    'projectId': project_id_env,
                    'storageBucket': f'{project_id_env}.firebasestorage.app'
                })
                effective_project_id = firebase_admin.get_app().project_id
                print(f"Firebase Admin SDK initialized successfully for project: {effective_project_id} using Application Default Credentials.")
            except Exception as e_adc:
                print(f"Failed to initialize Firebase with ADC: {e_adc}. Attempting service account key from GOOGLE_APPLICATION_CREDENTIALS env var.")
                gac_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
                if gac_path:
                    print(f"Using GOOGLE_APPLICATION_CREDENTIALS path: {gac_path}")
                    # When using GOOGLE_APPLICATION_CREDENTIALS, projectId in options is often not needed if the key file has it.
                    # However, explicitly providing it can avoid ambiguity.
                    cred_from_file = credentials.Certificate(gac_path)
                    firebase_admin.initialize_app(cred_from_file, {
                        'projectId': project_id_env,
                        'storageBucket': f'{project_id_env}.firebasestorage.app'
                    })
                    effective_project_id = firebase_admin.get_app().project_id
                    print(f"Firebase Admin SDK initialized successfully for project: {effective_project_id} using GOOGLE_APPLICATION_CREDENTIALS.")
                else:
                    print("GOOGLE_APPLICATION_CREDENTIALS environment variable not set.")
                    raise ValueError(f"Firebase ADC failed and GOOGLE_APPLICATION_CREDENTIALS not set. ADC Error: {e_adc}")
        else:
            effective_project_id = firebase_admin.get_app().project_id if firebase_admin.get_app() else "Unknown (already initialized)"
            print(f"Firebase Admin SDK already initialized. Effective project: {effective_project_id}")

        # Ensure the client uses the determined project ID
        # If firebase_admin is initialized, AsyncClient() should pick up the project context.
        # If project_id_env was different from effective_project_id, it might indicate an issue.
        # Forcing the client with the effective_project_id from the initialized app:
        if effective_project_id and effective_project_id != "Unknown (already initialized)":
            app_instance.state.db = firestore.AsyncClient(project=effective_project_id)
            print(f"Async Firestore client initialized for project {effective_project_id} and stored in app.state.db.")
        else: # Fallback if effective_project_id couldn't be determined but we have project_id_env
            app_instance.state.db = firestore.AsyncClient(project=project_id_env)
            print(f"Async Firestore client initialized (fallback) for project {project_id_env} and stored in app.state.db.")


    except ValueError as e:
        print(f"Error during Firebase/Firestore initialization (ValueError): {e}")
    except Exception as e:
        import traceback
        print(f"An unexpected error occurred during Firebase/Firestore initialization: {e}")
        traceback.print_exc()


    yield 

    print("FastAPI application shutting down...")
    if hasattr(app_instance.state, 'db') and app_instance.state.db is not None:
        print(f"Attempting to close Firestore client of type: {type(app_instance.state.db)}")
        try:
            await app_instance.state.db.close() 
            print("Async Firestore client closed successfully.")
        except AttributeError as ae:
            print(f"Error closing Firestore client: 'close' attribute missing. Type was {type(app_instance.state.db)}. Error: {ae}")
        except TypeError as te:
            print(f"Error closing Firestore client: TypeError. Error: {te}")
        except Exception as e:
            print(f"An unexpected error occurred while closing Firestore client: {e}")
    else:
        print("Firestore client (app.state.db) was None or not properly initialized, skipping close.")


app = FastAPI(
    title="Fiji Backend API",
    description="API for managing volunteers, events, and organizational data for Project Fiji.",
    version="0.1.0",
    lifespan=lifespan
)

origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3001")
origins = [origin.strip() for origin in origins_env.split(',')]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router) 
app.include_router(two_factor_router.router)
app.include_router(roles_router.router)
app.include_router(invitations_admin_router)
app.include_router(invitations_public_router)
app.include_router(users_router.router)
app.include_router(events_router.router)
app.include_router(working_groups_router.router)
app.include_router(donations_router.router)
app.include_router(assignments_router.router)
app.include_router(reports_router.router)
app.include_router(organization_router.router)
app.include_router(uploads_router.router) 


@app.get("/")
async def root():
    return {"message": "Welcome to the Fiji Backend!"}

@app.get("/health")
async def health_check(request: Request):
    firebase_app_initialized = bool(firebase_admin._apps)
    firestore_client_initialized = hasattr(request.app.state, 'db') and request.app.state.db is not None
    
    effective_project_id_sdk = "N/A"
    if firebase_app_initialized:
        try:
            current_app = firebase_admin.get_app()
            effective_project_id_sdk = current_app.project_id if current_app else "Error: Firebase app not found"
        except Exception as e:
            effective_project_id_sdk = f"Error retrieving project_id from SDK: {e}"

    db_client_project_id = "N/A"
    if firestore_client_initialized:
        try:
            # For google.cloud.firestore_v1.client.Client or AsyncClient, project is an attribute
            db_client_project_id = request.app.state.db.project
        except AttributeError:
            db_client_project_id = "Error: .project attribute not found on db client"
        except Exception as e:
            db_client_project_id = f"Error retrieving project_id from db client: {e}"


    status_info = {
        "env_google_cloud_project": os.getenv("GOOGLE_CLOUD_PROJECT"),
        "firebase_sdk_initialized": firebase_app_initialized,
        "effective_project_id_from_sdk": effective_project_id_sdk,
        "firestore_client_initialized": firestore_client_initialized,
        "firestore_client_project_id": db_client_project_id,
        "db_state_type": str(type(getattr(request.app.state, 'db', None))),
    }

    if firebase_app_initialized and firestore_client_initialized and effective_project_id_sdk == db_client_project_id and effective_project_id_sdk != "N/A":
        return {
            "status": "ok",
            "message": "Backend is running, Firebase Admin SDK and Async Firestore client are initialized and aligned.",
            **status_info
        }
    else:
        return {
            "status": "error",
            "message": "Initialization issue. Check details.",
            **status_info
        }