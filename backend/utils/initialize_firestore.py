import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import datetime
import os
from dotenv import load_dotenv

# Load environment variables from .env file in the current directory (backend/)
load_dotenv()

# --- Configuration ---
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
ROLES_COLLECTION = "roles"
SYSADMIN_DOC_ID = "sysadmin" # Using a fixed, known ID for the sysadmin role document

def initialize_firestore_sysadmin():
    """
    Initializes Firestore and creates/updates the 'sysadmin' role document
    in the 'roles' collection.
    """
    if not PROJECT_ID:
        print("Error: GOOGLE_CLOUD_PROJECT environment variable not set.")
        print("Please ensure it's defined in your backend/.env file or system environment.")
        return

    try:
        if not firebase_admin._apps:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {
                'projectId': PROJECT_ID,
            })
            print(f"Firebase Admin SDK initialized for project: {PROJECT_ID}")
        else:
            current_app_project_id = firebase_admin.get_app().project_id if firebase_admin.get_app() else "Unknown"
            print(f"Firebase Admin SDK already initialized. Assuming project: {current_app_project_id}")

        db = firestore.client() # Using synchronous client for a script
        print(f"Successfully connected to Firestore for project: {PROJECT_ID}")

        sysadmin_privileges = {
            "roles": ["create", "view", "edit", "delete"],
            "users": ["create", "view", "edit", "delete", "list", "assign_roles"], # Added list, assign_roles
            "invitations": ["create", "view", "delete"],
            "events": ["create", "view", "edit", "delete", "manage_assignments"],
            "working_groups": ["create", "view", "edit", "delete", "manage_assignments"],
            "donations": ["create", "view", "edit", "delete", "list"] # Added donations privileges
            # Add other resource privileges for sysadmin as needed
        }

        sysadmin_role_data = {
            "roleName": SYSADMIN_DOC_ID, # Ensure roleName matches document ID
            "description": "System administrator with full access privileges.",
            "isSystemRole": True,
            "privileges": sysadmin_privileges, # Changed from 'permissions'
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP
        }

        sysadmin_doc_ref = db.collection(ROLES_COLLECTION).document(SYSADMIN_DOC_ID)
        # Using set with merge=True to update existing fields or create if not exists
        sysadmin_doc_ref.set(sysadmin_role_data, merge=True) 

        print(f"Successfully created/updated '{SYSADMIN_DOC_ID}' document in '{ROLES_COLLECTION}' collection with defined privileges.")
        print("Firestore initialization for sysadmin role complete.")

    except Exception as e:
        print(f"An error occurred during Firestore initialization: {e}")
        print("Please ensure:")
        print(f"1. Your GOOGLE_CLOUD_PROJECT is set correctly (current value from env: {PROJECT_ID}).")
        print("2. You are authenticated to this GCP project (e.g., `gcloud auth application-default login`).")
        print("3. The Firestore API is enabled for the project.")
        print("4. The account used by ADC has permissions to write to Firestore.")
        print("5. The `firebase-admin` and `python-dotenv` packages are installed.")

if __name__ == "__main__":
    print("Starting Firestore sysadmin role initialization...")
    initialize_firestore_sysadmin()