import os
import firebase_admin
from firebase_admin import credentials
from fastapi import FastAPI, HTTPException, Depends
from dotenv import load_dotenv

from dependencies.auth import get_firebase_user 
from routers import roles as roles_router
from routers import invitations as invitations_router
from routers import users as users_router # Import the users router

# Load environment variables from .env file
load_dotenv()

# --- Firebase Admin SDK Initialization ---
try:
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        raise ValueError("GOOGLE_CLOUD_PROJECT environment variable not set.")

    cred = credentials.ApplicationDefault()
    
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred, {
            'projectId': project_id,
        })
    print(f"Firebase Admin SDK initialized successfully for project: {project_id}")

except ValueError as e:
    print(f"Error initializing Firebase Admin SDK: {e}")
except Exception as e:
    print(f"An unexpected error occurred during Firebase Admin SDK initialization: {e}")


# --- FastAPI Application ---
app = FastAPI(
    title="Fiji Backend API",
    description="API for managing volunteers, events, and organizational data for Project Fiji.",
    version="0.1.0"
)

# Include routers
app.include_router(roles_router.router)
app.include_router(invitations_router.router)
app.include_router(users_router.router) # Add the users router


@app.get("/")
async def root():
    """
    Root endpoint for the backend.
    """
    return {"message": "Welcome to the Fiji Backend!"}

@app.get("/health")
async def health_check():
    """
    Health check endpoint.
    """
    firebase_app_initialized = bool(firebase_admin._apps)
    
    if firebase_app_initialized:
        return {
            "status": "ok",
            "message": "Backend is running and Firebase Admin SDK is initialized.",
            "project_id": firebase_admin.get_app().project_id if firebase_admin._apps else None
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

@app.get("/users/me", tags=["Users"]) # This existing example route is fine
async def read_users_me(current_user: dict = Depends(get_firebase_user)):
    """
    Example protected endpoint that returns the current authenticated user's Firebase claims.
    """
    return {"user_info": current_user}


# To run this application locally (from the backend directory):
# 1. Ensure GOOGLE_CLOUD_PROJECT is set in your .env file (e.g., GOOGLE_CLOUD_PROJECT="fijian")
# 2. Run: uvicorn main:app --reload --port 8000