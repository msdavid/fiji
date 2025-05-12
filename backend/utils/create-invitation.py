#!/usr/bin/env python3
import argparse
import datetime
import secrets
import os
import sys

# Add backend directory to sys.path to ensure local modules can be found if needed,
# though this script primarily uses firebase_admin directly.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter

# --- Configuration ---
SYSADMIN_ROLE_NAME = "sysadmin"
INVITATION_EXPIRY_DAYS = 7

# --- Firebase Initialization ---
try:
    # Attempt to initialize with ADC.
    # This works in GCP environments (like Cloud Run, Cloud Functions)
    # or locally if `gcloud auth application-default login` has been run
    # or if GOOGLE_APPLICATION_CREDENTIALS environment variable is set.
    # The project ID is typically inferred from the ADC environment.
    firebase_admin.initialize_app()
    # print("Initialized Firebase Admin SDK.", file=sys.stderr) # Optional: for verbose output
except ValueError as e: # Catches "already initialized"
    if "already initialized" not in str(e).lower():
        print(f"Firebase Admin SDK initialization error: {e}", file=sys.stderr)
        sys.exit(1)
    # else:
        # print("Firebase Admin SDK already initialized.", file=sys.stderr) # Optional
except Exception as e:
    print(f"Unexpected error initializing Firebase Admin SDK: {e}", file=sys.stderr)
    print("Ensure Application Default Credentials (ADC) are configured.", file=sys.stderr)
    sys.exit(1)

db = firestore.client()

def find_sysadmin_user_id():
    """
    Finds the UID of a user with the 'sysadmin' role.
    Returns the first one found, or None if not found or error occurs.
    """
    try:
        roles_ref = db.collection("roles")
        sysadmin_role_query = roles_ref.where(filter=FieldFilter("roleName", "==", SYSADMIN_ROLE_NAME)).limit(1).stream()
        
        sysadmin_role_doc = None
        for role_doc in sysadmin_role_query: # Iterate to get the document
            sysadmin_role_doc = role_doc
            break # We only need one

        if not sysadmin_role_doc:
            print(f"Error: Role '{SYSADMIN_ROLE_NAME}' not found in Firestore 'roles' collection.", file=sys.stderr)
            return None
        
        sysadmin_role_id = sysadmin_role_doc.id

        users_ref = db.collection("users")
        sysadmin_user_query = users_ref.where(filter=FieldFilter("assignedRoleIds", "array_contains", sysadmin_role_id)).limit(1).stream()
        
        sysadmin_user_doc = None
        for user_doc in sysadmin_user_query: # Iterate to get the document
            sysadmin_user_doc = user_doc
            break # We only need one

        if sysadmin_user_doc:
            return sysadmin_user_doc.id
        else:
            print(f"Error: No user found with the '{SYSADMIN_ROLE_NAME}' role (role ID: {sysadmin_role_id}).", file=sys.stderr)
            print(f"Please ensure a user exists in the 'users' collection and has the role ID '{sysadmin_role_id}' in their 'assignedRoleIds' array.", file=sys.stderr)
            return None
    except Exception as e:
        print(f"Error querying Firestore to find sysadmin user: {e}", file=sys.stderr)
        return None

def create_invitation(email: str, invited_by_user_id: str, roles_to_assign: list):
    """
    Creates a registration invitation in Firestore.
    Returns the generated token or None if creation fails.
    """
    token = secrets.token_urlsafe(32)
    now = datetime.datetime.now(datetime.timezone.utc)
    expires_at = now + datetime.timedelta(days=INVITATION_EXPIRY_DAYS)

    try:
        invitation_ref = db.collection("registrationInvitations").document() # Auto-generate ID
        invitation_ref.set({
            "email": email,
            "token": token,
            "status": "pending",
            "invitedByUserId": invited_by_user_id,
            "rolesToAssignOnRegistration": roles_to_assign,
            "createdAt": now,
            "expiresAt": expires_at
        })
        return token
    except Exception as e:
        print(f"Error creating invitation document in Firestore: {e}", file=sys.stderr)
        return None

def main():
    parser = argparse.ArgumentParser(
        description="Create a registration invitation for Project Fiji. The invitation is issued by a 'sysadmin' user.",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("email", type=str, help="The email address of the user to invite.")
    parser.add_argument(
        "--roles", 
        type=str, 
        help="Optional: Comma-separated list of role IDs to assign to the user upon registration.\nExample: role_id_1,role_id_2", 
        default=""
    )

    args = parser.parse_args()

    sysadmin_uid = find_sysadmin_user_id()
    if not sysadmin_uid:
        print("Exiting. A sysadmin user must exist to issue invitations.", file=sys.stderr)
        sys.exit(1)

    roles_to_assign_on_reg = [role.strip() for role in args.roles.split(',') if role.strip()] if args.roles else []

    print(f"Attempting to create invitation for: {args.email}", file=sys.stderr)
    print(f"Invited by (sysadmin UID): {sysadmin_uid}", file=sys.stderr)
    if roles_to_assign_on_reg:
        print(f"Roles to assign on registration: {roles_to_assign_on_reg}", file=sys.stderr)
    else:
        print("Roles to assign on registration: None (default)", file=sys.stderr)


    invitation_token = create_invitation(args.email, sysadmin_uid, roles_to_assign_on_reg)

    if invitation_token:
        print(f"Invitation created successfully.", file=sys.stderr)
        print(f"{invitation_token}") # Print only the token to stdout for easy capture
    else:
        print("Failed to create invitation.", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()