import argparse
import json
import datetime
import os
import re
import sys # Added for stdin/stdout

import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

# --- Configuration ---
# SERVICE_ACCOUNT_KEY_PATH = None 

def initialize_firestore(service_account_key_path: str = None):
    """Initializes Firestore client."""
    try:
        if firebase_admin._DEFAULT_APP_NAME not in firebase_admin._apps:
            if service_account_key_path:
                if not os.path.exists(service_account_key_path):
                    raise FileNotFoundError(f"Service account key not found at: {service_account_key_path}")
                cred = credentials.Certificate(service_account_key_path)
                firebase_admin.initialize_app(cred)
                print(f"Firebase Admin SDK initialized using service account key: {service_account_key_path}", file=sys.stderr)
            elif os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
                firebase_admin.initialize_app()
                print("Firebase Admin SDK initialized using GOOGLE_APPLICATION_CREDENTIALS environment variable.", file=sys.stderr)
            else:
                firebase_admin.initialize_app()
                print("Firebase Admin SDK initialized using Application Default Credentials.", file=sys.stderr)
        else:
            print("Firebase Admin SDK already initialized.", file=sys.stderr)
        
        db = firestore.client()
        return db
    except Exception as e:
        print(f"Error initializing Firestore: {e}", file=sys.stderr)
        print("Please ensure you have set up Google Application Credentials correctly.", file=sys.stderr)
        return None

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code."""
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    if isinstance(obj, firestore.firestore.GeoPoint):
        return {"latitude": obj.latitude, "longitude": obj.longitude}
    if isinstance(obj, firestore.firestore.DocumentReference):
        return obj.path 
    raise TypeError(f"Type {type(obj)} not serializable")

# Regex to identify ISO 8601 date strings.
ISO_DATETIME_REGEX = re.compile(
    r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?([Zz]|([+-]\d{2}:\d{2}))$'
)

KNOWN_DATETIME_FIELDS = {"dateTime", "endTime", "createdAt", "updatedAt", "assignmentDate", "event_instance_start_date_time", "event_instance_end_date_time"}


def convert_known_datetime_fields(data):
    """Recursively searches for known datetime fields and converts ISO strings to datetime objects."""
    if isinstance(data, dict):
        for key, value in data.items():
            if key in KNOWN_DATETIME_FIELDS and isinstance(value, str):
                if ISO_DATETIME_REGEX.match(value):
                    try:
                        if value.endswith('Z') or value.endswith('z'):
                            value_for_parse = value[:-1] + "+00:00"
                        else:
                            value_for_parse = value
                        
                        dt_obj = datetime.datetime.fromisoformat(value_for_parse)
                        if dt_obj.tzinfo is None:
                            dt_obj = dt_obj.replace(tzinfo=datetime.timezone.utc)
                        data[key] = dt_obj
                    except ValueError:
                        print(f"Warning: Could not parse string '{value}' for field '{key}' as datetime. Leaving as string.", file=sys.stderr)
            elif isinstance(value, (dict, list)):
                convert_known_datetime_fields(value) 
    elif isinstance(data, list):
        for item in data:
            convert_known_datetime_fields(item) 
    return data


def download_collection(db, collection_name: str, output_target: str):
    """Downloads all documents from a collection to a JSON file or stdout."""
    if not db:
        print("Firestore client not initialized. Aborting download.", file=sys.stderr)
        return

    if output_target == '-':
        print(f"Starting download of collection '{collection_name}' to stdout...", file=sys.stderr)
    else:
        print(f"Starting download of collection '{collection_name}' to '{output_target}'...", file=sys.stderr)
    
    docs = db.collection(collection_name).stream()
    data = {}
    count = 0
    for doc in docs:
        doc_data = doc.to_dict()
        data[doc.id] = doc_data 
        count += 1
        if count % 100 == 0:
            print(f"Downloaded {count} documents...", file=sys.stderr)

    try:
        if output_target == '-':
            json.dump(data, sys.stdout, indent=2, default=json_serial)
            sys.stdout.flush() # Ensure data is written
            print(f"\nSuccessfully downloaded {count} documents from '{collection_name}' to stdout.", file=sys.stderr)
        else:
            with open(output_target, 'w') as f:
                json.dump(data, f, indent=2, default=json_serial)
            print(f"Successfully downloaded {count} documents from '{collection_name}' to '{output_target}'.", file=sys.stderr)
    except IOError as e:
        print(f"Error writing to output: {e}", file=sys.stderr)
    except Exception as e:
        print(f"An unexpected error occurred during JSON serialization or writing: {e}", file=sys.stderr)


def upload_collection(db, collection_name: str, input_source: str, merge: bool = False):
    """Uploads data from a JSON file or stdin to a collection.
    
    Args:
        db: Firestore client.
        collection_name: Name of the collection to upload to.
        input_source: Path to the JSON file or '-' for stdin.
        merge: If True, merges data with existing documents. If False (default), overwrites.
    """
    if not db:
        print("Firestore client not initialized. Aborting upload.", file=sys.stderr)
        return

    if input_source == '-':
        print(f"Starting upload from stdin to collection '{collection_name}' (merge={merge})...", file=sys.stderr)
    else:
        print(f"Starting upload from '{input_source}' to collection '{collection_name}' (merge={merge})...", file=sys.stderr)
    
    data_from_json = None
    try:
        if input_source == '-':
            json_string = sys.stdin.read()
            if not json_string:
                print("Error: No data received from stdin.", file=sys.stderr)
                return
            data_from_json = json.loads(json_string)
        else:
            with open(input_source, 'r') as f:
                data_from_json = json.load(f)
    except FileNotFoundError:
        print(f"Error: Input file '{input_source}' not found.", file=sys.stderr)
        return
    except json.JSONDecodeError as e:
        input_name = "stdin" if input_source == '-' else f"'{input_source}'"
        print(f"Error: Could not decode JSON from {input_name}. Invalid JSON format: {e}", file=sys.stderr)
        return
    except Exception as e:
        print(f"An unexpected error occurred while reading the input: {e}", file=sys.stderr)
        return

    if not isinstance(data_from_json, dict):
        print("Error: JSON input must contain a single dictionary where keys are document IDs.", file=sys.stderr)
        return

    batch = db.batch()
    count = 0
    operations = 0

    for doc_id, doc_data_json in data_from_json.items():
        if not isinstance(doc_data_json, dict):
            print(f"Warning: Skipping document '{doc_id}' due to invalid data format (expected a dictionary).", file=sys.stderr)
            continue
        
        if not doc_id: # Firestore document IDs cannot be empty
            print(f"Warning: Skipping document with empty ID. Data: {doc_data_json}", file=sys.stderr)
            continue

        doc_ref = db.collection(collection_name).document(doc_id)
        
        doc_data_converted = convert_known_datetime_fields(doc_data_json.copy())

        batch.set(doc_ref, doc_data_converted, merge=merge)
        count += 1
        operations += 1

        if operations >= 499: 
            print(f"Committing batch of {operations} operations ({count} documents processed so far)...", file=sys.stderr)
            batch.commit()
            batch = db.batch() 
            operations = 0
            print("Batch committed.", file=sys.stderr)

    if operations > 0:
        print(f"Committing final batch of {operations} operations...", file=sys.stderr)
        batch.commit()
        print("Final batch committed.", file=sys.stderr)

    input_name_display = "stdin" if input_source == '-' else f"'{input_source}'"
    print(f"Successfully uploaded {count} documents from {input_name_display} to '{collection_name}'.", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Firestore Collection Backup/Restore Tool")
    parser.add_argument("action", choices=["download", "upload"], help="Action to perform: download or upload.")
    parser.add_argument("collection", help="Name of the Firestore collection.")
    parser.add_argument("file", help="Path to the JSON file. Use '-' for stdout if downloading, or for stdin if uploading.")
    parser.add_argument("--keyfile", help="Path to your Google Cloud service account key JSON file (optional).", default=None)
    parser.add_argument("--merge", action="store_true", help="For upload action: Merge data with existing documents instead of overwriting. Default is False (overwrite).")

    args = parser.parse_args()
    key_path_to_use = args.keyfile
    
    # Redirect print statements in initialize_firestore to stderr if not already
    # This is now handled by adding file=sys.stderr to print calls in initialize_firestore
    
    db = initialize_firestore(service_account_key_path=key_path_to_use)
    if not db:
        sys.exit(1) # Exit if DB initialization fails

    if args.action == "download":
        download_collection(db, args.collection, args.file)
    elif args.action == "upload":
        upload_collection(db, args.collection, args.file, merge=args.merge)

if __name__ == "__main__":
    main()