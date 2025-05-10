import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import datetime

# --- Configuration ---
# Your Google Cloud Project ID
# This script assumes Application Default Credentials (ADC) are set up.
# If running locally and ADC isn't picking up the project,
# you might need to explicitly set GOOGLE_CLOUD_PROJECT environment variable
# or pass project_id to firebase_admin.initialize_app() if not using ADC.
PROJECT_ID = "fijian"
ROLES_COLLECTION = "roles"
SYSADMIN_DOC_ID = "sysadmin"

def initialize_firestore_sysadmin():
    """
    Initializes Firestore and creates the 'sysadmin' role document
    in the 'roles' collection if it doesn't exist or updates it.
    """
    try:
        # Initialize Firebase Admin SDK
        # ADC will be used automatically if the environment is set up correctly
        # (e.g., running in Cloud Shell, Cloud Run, or gcloud auth application-default login locally)
        # If firebase_admin is already initialized, this will not re-initialize.
        if not firebase_admin._apps:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {
                'projectId': PROJECT_ID,
            })
        else:
            # If already initialized, ensure it's for the correct project if possible,
            # though firebase_admin doesn't easily let you check the project_id of the default app.
            # For this script, we assume the existing default app is correctly configured.
            pass


        db = firestore.client()
        print(f"Successfully connected to Firestore for project: {PROJECT_ID}")

        sysadmin_role_data = {
            "roleName": "sysadmin",
            "description": "System administrator with full access privileges.",
            "isSystemRole": True,
            "privileges": {
                "roles": ["create", "view", "edit", "delete"],
                "users": ["create", "view", "edit", "delete"],
                "registrationInvitations": ["create", "view", "delete"]
                # Add other resource privileges for sysadmin as needed in the future
            },
            "createdAt": firestore.SERVER_TIMESTAMP, # Uses server-side timestamp
            "updatedAt": firestore.SERVER_TIMESTAMP  # Uses server-side timestamp
        }

        # Get a reference to the document
        sysadmin_doc_ref = db.collection(ROLES_COLLECTION).document(SYSADMIN_DOC_ID)

        # Set the document data (creates if not exists, overwrites if exists)
        sysadmin_doc_ref.set(sysadmin_role_data)

        print(f"Successfully created/updated '{SYSADMIN_DOC_ID}' document in '{ROLES_COLLECTION}' collection.")
        print("Firestore initialization for sysadmin role complete.")

        # The 'users' and 'registrationInvitations' collections will be created
        # automatically by Firestore when the application first writes a document to them.
        # No explicit creation is needed for empty collections via this script.

    except Exception as e:
        print(f"An error occurred during Firestore initialization: {e}")
        print("Please ensure:")
        print(f"1. You are authenticated to GCP project '{PROJECT_ID}' (e.g., `gcloud auth application-default login`).")
        print("2. The Firestore API is enabled for the project.")
        print("3. The account used by ADC has permissions to write to Firestore (e.g., 'Cloud Datastore User' or 'Firebase Admin SDK Administrator Service Agent').")
        print("4. The `firebase-admin` package is installed in your Python environment.")

if __name__ == "__main__":
    print("Starting Firestore sysadmin role initialization...")
    initialize_firestore_sysadmin()