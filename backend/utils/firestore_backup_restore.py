import argparse
import json
import datetime
import os
import re

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
                print(f"Firebase Admin SDK initialized using service account key: {service_account_key_path}")
            elif os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
                firebase_admin.initialize_app()
                print("Firebase Admin SDK initialized using GOOGLE_APPLICATION_CREDENTIALS environment variable.")
            else:
                firebase_admin.initialize_app()
                print("Firebase Admin SDK initialized using Application Default Credentials.")
        else:
            print("Firebase Admin SDK already initialized.")
        
        db = firestore.client()
        return db
    except Exception as e:
        print(f"Error initializing Firestore: {e}")
        print("Please ensure you have set up Google Application Credentials correctly.")
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
# This is a simplified regex. For full ISO 8601, it can be more complex.
# Handles YYYY-MM-DDTHH:MM:SS[.ffffff][Z or +HH:MM or -HH:MM]
ISO_DATETIME_REGEX = re.compile(
    r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?([Zz]|([+-]\d{2}:\d{2}))$'
)

# Fields that are known to be datetime objects and should be converted if they are strings
KNOWN_DATETIME_FIELDS = {"dateTime", "endTime", "createdAt", "updatedAt", "assignmentDate", "event_instance_start_date_time", "event_instance_end_date_time"}


def convert_known_datetime_fields(data):
    """Recursively searches for known datetime fields and converts ISO strings to datetime objects."""
    if isinstance(data, dict):
        for key, value in data.items():
            if key in KNOWN_DATETIME_FIELDS and isinstance(value, str):
                if ISO_DATETIME_REGEX.match(value):
                    try:
                        # Ensure timezone info is handled correctly for fromisoformat
                        # If it ends with Z, replace with +00:00 for wider compatibility with fromisoformat
                        if value.endswith('Z') or value.endswith('z'):
                            value_for_parse = value[:-1] + "+00:00"
                        else:
                            value_for_parse = value
                        
                        dt_obj = datetime.datetime.fromisoformat(value_for_parse)
                        # Ensure it's timezone-aware (UTC if no offset was present but Z was, or keep original offset)
                        if dt_obj.tzinfo is None:
                             # This case should ideally not happen if fromisoformat gets a proper ISO string with offset or Z
                             # If it does, assume UTC. This might need adjustment based on source data.
                            dt_obj = dt_obj.replace(tzinfo=datetime.timezone.utc)
                        data[key] = dt_obj
                    except ValueError:
                        print(f"Warning: Could not parse string '{value}' for field '{key}' as datetime. Leaving as string.")
            elif isinstance(value, (dict, list)):
                convert_known_datetime_fields(value) # Recurse for nested structures
    elif isinstance(data, list):
        for item in data:
            convert_known_datetime_fields(item) # Recurse for items in lists
    return data


def download_collection(db, collection_name: str, output_file: str):
    """Downloads all documents from a collection to a JSON file."""
    if not db:
        print("Firestore client not initialized. Aborting download.")
        return

    print(f"Starting download of collection '{collection_name}' to '{output_file}'...")
    docs = db.collection(collection_name).stream()
    data = {}
    count = 0
    for doc in docs:
        doc_data = doc.to_dict()
        # DocumentReference fields are handled by json_serial if direct conversion is needed
        # For download, we want to preserve the native types as much as possible before serialization
        data[doc.id] = doc_data 
        count += 1
        if count % 100 == 0:
            print(f"Downloaded {count} documents...")

    try:
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2, default=json_serial)
        print(f"Successfully downloaded {count} documents from '{collection_name}' to '{output_file}'.")
    except IOError as e:
        print(f"Error writing to file {output_file}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred during JSON serialization or file writing: {e}")


def upload_collection(db, collection_name: str, input_file: str, merge: bool = False):
    """Uploads data from a JSON file to a collection.
    
    Args:
        db: Firestore client.
        collection_name: Name of the collection to upload to.
        input_file: Path to the JSON file containing data.
        merge: If True, merges data with existing documents. If False (default), overwrites.
    """
    if not db:
        print("Firestore client not initialized. Aborting upload.")
        return

    print(f"Starting upload from '{input_file}' to collection '{collection_name}' (merge={merge})...")
    
    try:
        with open(input_file, 'r') as f:
            data_from_json = json.load(f)
    except FileNotFoundError:
        print(f"Error: Input file '{input_file}' not found.")
        return
    except json.JSONDecodeError as e:
        print(f"Error: Could not decode JSON from '{input_file}'. Invalid JSON format: {e}")
        return
    except Exception as e:
        print(f"An unexpected error occurred while reading the file: {e}")
        return

    if not isinstance(data_from_json, dict):
        print("Error: JSON file must contain a single dictionary where keys are document IDs.")
        return

    batch = db.batch()
    count = 0
    operations = 0

    for doc_id, doc_data_json in data_from_json.items():
        if not isinstance(doc_data_json, dict):
            print(f"Warning: Skipping document '{doc_id}' due to invalid data format (expected a dictionary).")
            continue
        
        if not doc_id:
            print(f"Warning: Skipping document with empty ID. Data: {doc_data_json}")
            continue

        doc_ref = db.collection(collection_name).document(doc_id)
        
        # Convert known datetime string fields back to datetime objects
        doc_data_converted = convert_known_datetime_fields(doc_data_json.copy()) # Operate on a copy

        batch.set(doc_ref, doc_data_converted, merge=merge)
        count += 1
        operations += 1

        if operations >= 499: 
            print(f"Committing batch of {operations} operations ({count} documents processed so far)...")
            batch.commit()
            batch = db.batch() 
            operations = 0
            print("Batch committed.")

    if operations > 0:
        print(f"Committing final batch of {operations} operations...")
        batch.commit()
        print("Final batch committed.")

    print(f"Successfully uploaded {count} documents from '{input_file}' to '{collection_name}'.")


def main():
    parser = argparse.ArgumentParser(description="Firestore Collection Backup/Restore Tool")
    parser.add_argument("action", choices=["download", "upload"], help="Action to perform: download or upload.")
    parser.add_argument("collection", help="Name of the Firestore collection.")
    parser.add_argument("file", help="Path to the JSON file (for output if downloading, for input if uploading).")
    parser.add_argument("--keyfile", help="Path to your Google Cloud service account key JSON file (optional).", default=None)
    parser.add_argument("--merge", action="store_true", help="For upload action: Merge data with existing documents instead of overwriting. Default is False (overwrite).")

    args = parser.parse_args()
    key_path_to_use = args.keyfile
    
    db = initialize_firestore(service_account_key_path=key_path_to_use)
    if not db:
        return

    if args.action == "download":
        download_collection(db, args.collection, args.file)
    elif args.action == "upload":
        upload_collection(db, args.collection, args.file, merge=args.merge)

if __name__ == "__main__":
    main()