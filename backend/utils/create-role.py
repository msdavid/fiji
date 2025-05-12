#!/usr/bin/env python3
import argparse
import json
import os
import sys
from google.cloud import firestore
from firebase_admin import credentials, initialize_app
from dotenv import load_dotenv # Import dotenv

# Ensure the script can find modules in the 'backend' directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load environment variables from .env file located in the parent directory (backend/.env)
dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(dotenv_path=dotenv_path)
# print(f"Attempting to load .env from: {dotenv_path}") # Optional: for debugging .env loading

# --- Firestore Initialization ---
def initialize_firestore_client():
    """Initializes and returns a Firestore client."""
    try:
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
        if not project_id:
            raise ValueError("GOOGLE_CLOUD_PROJECT environment variable not set (checked .env and environment).")

        # Attempt to initialize with Application Default Credentials (ADC)
        # This is preferred for Cloud Run, Cloud Build, etc.
        try:
            # Check if Firebase Admin SDK is already initialized to prevent re-initialization error
            if not firebase_admin._apps:
                cred = credentials.ApplicationDefault()
                initialize_app(cred, {'projectId': project_id})
                print(f"Firebase Admin SDK initialized successfully for project: {project_id} using ADC.")
            else:
                print(f"Firebase Admin SDK already initialized for project: {firebase_admin.get_app().project_id}.")

        except Exception as e_adc:
            print(f"Failed to initialize Firebase with ADC: {e_adc}. Checking for service account key...")
            # Fallback for local development if GOOGLE_APPLICATION_CREDENTIALS is set
            if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
                if not firebase_admin._apps:
                    initialize_app(options={'projectId': project_id})
                    print(f"Firebase Admin SDK initialized successfully for project: {project_id} using GOOGLE_APPLICATION_CREDENTIALS.")
                else:
                    print(f"Firebase Admin SDK already initialized for project: {firebase_admin.get_app().project_id}.")
            else:
                raise ValueError(f"Firebase ADC failed and GOOGLE_APPLICATION_CREDENTIALS not set. Error: {e_adc}")

        db = firestore.Client(project=project_id)
        print("Firestore client initialized successfully.")
        return db
    except ValueError as ve:
        print(f"Configuration error: {ve}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error initializing Firestore: {e}", file=sys.stderr)
        sys.exit(1)

# --- Main Script Logic ---
def create_role(db: firestore.Client, role_name: str, description: str = None, privileges_json: str = None):
    """
    Creates a new role in Firestore.
    """
    roles_collection = db.collection("roles")
    role_doc_ref = roles_collection.document(role_name)

    if role_doc_ref.get().exists:
        print(f"Error: Role with name '{role_name}' already exists.", file=sys.stderr)
        return

    try:
        privileges = {}
        if privileges_json:
            privileges = json.loads(privileges_json)
            if not isinstance(privileges, dict):
                raise ValueError("Privileges JSON must be a valid JSON object (dictionary).")
            for resource, actions in privileges.items():
                if not isinstance(actions, list) or not all(isinstance(action, str) for action in actions):
                    raise ValueError(f"Actions for resource '{resource}' must be a list of strings.")
        
        # Validate roleName constraints (simplified from model, as Pydantic isn't used here directly)
        if '/' in role_name or role_name == "." or role_name == "..":
            raise ValueError("Role name cannot contain slashes ('/'), or be '.' or '..'")
        if not (3 <= len(role_name) <= 50):
             raise ValueError("Role name must be between 3 and 50 characters long.")
        if not role_name.replace('-', '').replace('_', '').isalnum(): # Basic check for allowed chars
            raise ValueError("Role name can only contain alphanumeric characters, underscores, and hyphens.")


        role_data = {
            "roleName": role_name,
            "description": description,
            "privileges": privileges,
            "isSystemRole": False,  # Roles created by this script are not system roles
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }

        role_doc_ref.set(role_data)
        print(f"Successfully created role: '{role_name}'")
        print(f"  Description: {description or 'N/A'}")
        print(f"  Privileges: {json.dumps(privileges, indent=2)}")

    except json.JSONDecodeError:
        print("Error: Invalid JSON string for privileges.", file=sys.stderr)
    except ValueError as ve:
        print(f"Error: {ve}", file=sys.stderr)
    except Exception as e:
        print(f"An unexpected error occurred while creating role '{role_name}': {e}", file=sys.stderr)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a new role in Firestore.")
    parser.add_argument("roleName", type=str, help="The unique name for the role (e.g., 'event_manager'). This will be its ID.")
    parser.add_argument("--description", type=str, help="A brief description of the role (optional).")
    parser.add_argument(
        "--privileges", 
        type=str, 
        help="""Privileges for the role as a JSON string. Example: '{"events": ["create", "view"], "users": ["view"]}'"""
    )

    args = parser.parse_args()
    
    # The GOOGLE_CLOUD_PROJECT is now loaded by load_dotenv() at the top if present in .env
    # print(f"Attempting to use project ID: {os.getenv('GOOGLE_CLOUD_PROJECT')}") # Optional: for debugging

    db_client = initialize_firestore_client()
    create_role(db_client, args.roleName, args.description, args.privileges)