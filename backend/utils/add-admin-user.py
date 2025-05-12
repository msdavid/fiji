import argparse
import firebase_admin
from firebase_admin import credentials, auth, firestore
import secrets
import os
import sys

# --- Configuration ---
DEFAULT_PROJECT_ID = "fijian"
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", DEFAULT_PROJECT_ID)
USERS_COLLECTION = "users"
SYSADMIN_ROLE_ID = "sysadmin" # Must match role ID in Firestore 'roles' collection

def generate_password(length=14):
    """Generates a cryptographically secure URL-safe string."""
    return secrets.token_urlsafe(length)

def initialize_firebase_admin():
    """Initializes the Firebase Admin SDK if not already initialized."""
    if not firebase_admin._apps:
        try:
            print(f"Initializing Firebase Admin SDK for project: {PROJECT_ID}...")
            # Use Application Default Credentials
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {
                'projectId': PROJECT_ID,
            })
            print(f"Firebase Admin SDK initialized successfully for project: {PROJECT_ID}.")
        except Exception as e:
            print(f"Error initializing Firebase Admin SDK for project {PROJECT_ID}: {e}", file=sys.stderr)
            print("Please ensure you have authenticated via `gcloud auth application-default login` "
                  "and the GOOGLE_CLOUD_PROJECT environment variable is set correctly if not 'fijian'.", file=sys.stderr)
            sys.exit(1)

def create_admin_user(email, first_name, last_name):
    """
    Creates a new user in Firebase Authentication and a corresponding user
    document in Firestore with the sysadmin role.
    """
    initialize_firebase_admin()
    db = firestore.client()
    password = generate_password()
    created_auth_user_uid = None  # To keep track for potential cleanup

    try:
        # 1. Create Firebase Authentication user
        print(f"\nAttempting to create Firebase Authentication user for: {email}...")
        auth_user_payload = {
            "email": email,
            "email_verified": True,  # Consider if verification flow is needed later
            "password": password,
            "display_name": f"{first_name} {last_name}",
            "disabled": False
        }
        firebase_user = auth.create_user(**auth_user_payload)
        created_auth_user_uid = firebase_user.uid
        print(f"Successfully created Firebase Auth user with UID: {created_auth_user_uid}")
        print("----------------------------------------------------------------------")
        print(f"IMPORTANT: Temporary password for {email} (UID: {created_auth_user_uid}):")
        print(f"PASSWORD: {password}")
        print("Advise user to change it upon first login.")
        print("----------------------------------------------------------------------")

        # 2. Create Firestore user document
        print(f"\nAttempting to create Firestore user document for UID: {created_auth_user_uid}...")
        user_doc_ref = db.collection(USERS_COLLECTION).document(created_auth_user_uid)
        user_data = {
            "email": email.lower(),  # Store email in lowercase for consistency
            "firstName": first_name,
            "lastName": last_name,
            "displayName": f"{first_name} {last_name}",
            "assignedRoleIds": [SYSADMIN_ROLE_ID],
            "status": "active",  # Default status
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
            # "authUid": created_auth_user_uid # Redundant, document ID is UID
        }
        user_doc_ref.set(user_data)
        print(f"Successfully created Firestore user document for {email} (UID: {created_auth_user_uid}) with role '{SYSADMIN_ROLE_ID}'.")
        print("\nSysadmin user creation process complete.")

    except auth.EmailAlreadyExistsError:
        print(f"\nError: Firebase Auth user with email '{email}' already exists.", file=sys.stderr)
        # Optionally, you could try to fetch the existing user and update their Firestore doc if that's desired.
    except Exception as e:
        print(f"\nAn unexpected error occurred: {e}", file=sys.stderr)
        # Attempt to clean up Firebase Auth user if Firestore creation failed
        if created_auth_user_uid:
            print(f"Attempting to delete partially created Firebase Auth user {created_auth_user_uid} due to subsequent error...", file=sys.stderr)
            try:
                auth.delete_user(created_auth_user_uid)
                print(f"Successfully deleted Firebase Auth user {created_auth_user_uid}.", file=sys.stderr)
            except Exception as cleanup_error:
                print(f"Failed to delete Firebase Auth user {created_auth_user_uid}: {cleanup_error}", file=sys.stderr)
                print("Manual cleanup of Firebase Auth user may be required.", file=sys.stderr)
    finally:
        print("-" * 70)


def main():
    parser = argparse.ArgumentParser(
        description="Create a new system administrator user in Firebase and Firestore."
    )
    parser.add_argument("email", type=str, help="Email address for the new sysadmin user.")
    parser.add_argument("firstName", type=str, help="First name of the sysadmin user.")
    parser.add_argument("lastName", type=str, help="Last name of the sysadmin user.")
    args = parser.parse_args()

    print("=" * 70)
    print("Starting Sysadmin User Creation Script")
    print("-" * 70)
    print(f"Target Project ID: {PROJECT_ID}")
    if PROJECT_ID == DEFAULT_PROJECT_ID and "GOOGLE_CLOUD_PROJECT" not in os.environ:
        print(f"Note: Using default PROJECT_ID '{DEFAULT_PROJECT_ID}'. "
              "Set GOOGLE_CLOUD_PROJECT environment variable to override if necessary.")
    
    create_admin_user(args.email, args.firstName, args.lastName)

if __name__ == "__main__":
    main()