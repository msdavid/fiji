import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import datetime
import os # Added
from dotenv import load_dotenv # Added

# Load environment variables from .env file in the current directory (backend/)
load_dotenv() # Added

# --- Configuration ---
# Project ID will be loaded from GOOGLE_CLOUD_PROJECT environment variable
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT") # Modified
ROLES_COLLECTION = "roles"
SYSADMIN_DOC_ID = "sysadmin" # Using a fixed, known ID for the sysadmin role document

def initialize_firestore_sysadmin():
    """
    Initializes Firestore and creates the 'sysadmin' role document
    in the 'roles' collection if it doesn't exist or updates it.
    """
    if not PROJECT_ID:
        print("Error: GOOGLE_CLOUD_PROJECT environment variable not set.")
        print("Please ensure it's defined in your backend/.env file.")
        return

    try:
        if not firebase_admin._apps:
            # ADC will be used. The project_id in initialize_app is used by ADC
            # as a hint if it cannot determine the project ID from the environment.
            # However, if GOOGLE_APPLICATION_CREDENTIALS is set, or running in a GCP env,
            # that usually takes precedence for ADC.
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {
                'projectId': PROJECT_ID,
            })
            print(f"Firebase Admin SDK initialized for project: {PROJECT_ID}")
        else:
            # If already initialized, we assume it's for the correct project.
            # Checking the project ID of an existing default app is not straightforward.
            print(f"Firebase Admin SDK already initialized. Assuming project: {firebase_admin.get_app().project_id if firebase_admin.get_app() else 'Unknown'}")


        db = firestore.client()
        print(f"Successfully connected to Firestore for project: {PROJECT_ID}")

        sysadmin_role_data = {
            "roleName": "sysadmin",
            "description": "System administrator with full access privileges.",
            "isSystemRole": True, # Custom flag to indicate a system-defined role
            "permissions": { # Changed from 'privileges' to 'permissions' for consistency if used elsewhere
                "roles": ["create", "view", "edit", "delete"],
                "users": ["create", "view", "edit", "delete"],
                "invitations": ["create", "view", "delete"] # Changed from registrationInvitations for brevity
                # Add other resource privileges for sysadmin as needed in the future
            },
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP
        }

        sysadmin_doc_ref = db.collection(ROLES_COLLECTION).document(SYSADMIN_DOC_ID)
        sysadmin_doc_ref.set(sysadmin_role_data)

        print(f"Successfully created/updated '{SYSADMIN_DOC_ID}' document in '{ROLES_COLLECTION}' collection.")
        print("Firestore initialization for sysadmin role complete.")

    except Exception as e:
        print(f"An error occurred during Firestore initialization: {e}")
        print("Please ensure:")
        print(f"1. Your GOOGLE_CLOUD_PROJECT is set correctly in backend/.env (current value: {PROJECT_ID}).")
        print("2. You are authenticated to this GCP project (e.g., `gcloud auth application-default login`).")
        print("3. The Firestore API is enabled for the project.")
        print("4. The account used by ADC has permissions to write to Firestore.")
        print("5. The `firebase-admin` and `python-dotenv` packages are installed in your Python environment.")

if __name__ == "__main__":
    print("Starting Firestore sysadmin role initialization...")
    initialize_firestore_sysadmin()