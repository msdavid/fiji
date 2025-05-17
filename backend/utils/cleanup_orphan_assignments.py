#!/usr/bin/env python3
import argparse
import os
import sys
from google.cloud import firestore
import firebase_admin
from firebase_admin import credentials, initialize_app
from dotenv import load_dotenv

# Ensure the script can find modules in the 'backend' directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load environment variables from .env file located in the parent directory (backend/.env)
dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(dotenv_path=dotenv_path)

ASSIGNMENTS_COLLECTION = "assignments"
EVENTS_COLLECTION = "events"
WORKING_GROUPS_COLLECTION = "workingGroups"

def initialize_firestore_client():
    """Initializes and returns a Firestore client."""
    try:
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
        if not project_id:
            raise ValueError("GOOGLE_CLOUD_PROJECT environment variable not set.")

        if not firebase_admin._apps:
            try:
                cred = credentials.ApplicationDefault()
                initialize_app(cred, {'projectId': project_id})
                print(f"Firebase Admin SDK initialized for project: {project_id} using ADC.")
            except Exception as e_adc:
                print(f"Failed to initialize Firebase with ADC: {e_adc}. Checking for service account key...")
                if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
                    initialize_app(options={'projectId': project_id})
                    print(f"Firebase Admin SDK initialized for project: {project_id} using GOOGLE_APPLICATION_CREDENTIALS.")
                else:
                    raise ValueError(f"Firebase ADC failed and GOOGLE_APPLICATION_CREDENTIALS not set. Error: {e_adc}")
        else:
            print(f"Firebase Admin SDK already initialized for project: {firebase_admin.get_app().project_id}.")

        db = firestore.Client(project=project_id) # Using synchronous client for a script
        print("Firestore client initialized successfully.")
        return db
    except ValueError as ve:
        print(f"Configuration error: {ve}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error initializing Firestore: {e}", file=sys.stderr)
        sys.exit(1)

def cleanup_orphan_assignments(db: firestore.Client, dry_run: bool = True):
    """
    Finds and optionally deletes orphaned assignments.
    An assignment is orphaned if its referenced assignableId (event or working group) does not exist.
    """
    print(f"Starting orphan assignment cleanup. DRY RUN: {dry_run}")
    
    orphaned_count = 0
    deleted_count = 0
    
    assignments_ref = db.collection(ASSIGNMENTS_COLLECTION)
    assignments_stream = assignments_ref.stream() # Using stream for potentially large collections

    orphans_to_delete_refs = []

    for assignment_doc in assignments_stream:
        assignment_data = assignment_doc.to_dict()
        assignment_id = assignment_doc.id
        assignable_id = assignment_data.get("assignableId")
        assignable_type = assignment_data.get("assignableType")

        if not assignable_id or not assignable_type:
            print(f"  [SKIPPING] Assignment {assignment_id} is missing assignableId or assignableType.")
            continue

        parent_collection_name = None
        if assignable_type == "event":
            parent_collection_name = EVENTS_COLLECTION
        elif assignable_type == "workingGroup":
            parent_collection_name = WORKING_GROUPS_COLLECTION
        else:
            print(f"  [SKIPPING] Assignment {assignment_id} has unknown assignableType: {assignable_type}.")
            continue
            
        parent_doc_ref = db.collection(parent_collection_name).document(assignable_id)
        parent_doc = parent_doc_ref.get()

        if not parent_doc.exists:
            orphaned_count += 1
            print(f"  [ORPHAN FOUND] Assignment ID: {assignment_id}")
            print(f"    Type: {assignable_type}, Referenced ID: {assignable_id} (Not found in {parent_collection_name})")
            print(f"    User ID: {assignment_data.get('userId', 'N/A')}")
            if not dry_run:
                orphans_to_delete_refs.append(assignment_doc.reference)
        else:
            # Optional: print found relations for verbosity
            # print(f"  [OK] Assignment {assignment_id} for {assignable_type} {assignable_id} is valid.")
            pass


    if not dry_run and orphans_to_delete_refs:
        print(f"\nFound {len(orphans_to_delete_refs)} orphaned assignments to delete.")
        confirm = input("Proceed with deletion? (yes/no): ")
        if confirm.lower() == 'yes':
            # Firestore batch writes are limited (e.g., 500 operations).
            # For large numbers of deletions, this should be chunked.
            MAX_BATCH_SIZE = 400 # Keep it under 500 to be safe
            for i in range(0, len(orphans_to_delete_refs), MAX_BATCH_SIZE):
                batch = db.batch()
                chunk = orphans_to_delete_refs[i:i + MAX_BATCH_SIZE]
                print(f"  Processing batch {i // MAX_BATCH_SIZE + 1} of {len(chunk)} deletions...")
                for ref_to_delete in chunk:
                    batch.delete(ref_to_delete)
                batch.commit()
                deleted_count += len(chunk)
            print(f"Successfully deleted {deleted_count} orphaned assignments.")
        else:
            print("Deletion cancelled by user.")
    elif dry_run:
        print(f"\nDry run complete. Found {orphaned_count} potential orphaned assignments.")
        if orphaned_count > 0:
            print("Run with --execute to delete them.")
    else: # Not dry_run but no orphans found
        print("\nNo orphaned assignments found to delete.")

    print(f"\nSummary: Found {orphaned_count} orphaned assignments. Deleted: {deleted_count if not dry_run else 0}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cleanup orphaned assignments in Firestore.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List orphaned assignments without deleting them. (Default behavior)"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually delete the orphaned assignments found. Requires confirmation."
    )

    args = parser.parse_args()

    if args.execute and args.dry_run:
        print("Error: Cannot use --execute and --dry-run simultaneously.", file=sys.stderr)
        sys.exit(1)
    
    perform_dry_run = True
    if args.execute:
        perform_dry_run = False

    db_client = initialize_firestore_client()
    cleanup_orphan_assignments(db_client, dry_run=perform_dry_run)
