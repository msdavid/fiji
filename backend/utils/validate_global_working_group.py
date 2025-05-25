#!/usr/bin/env python3
"""
Validation script to check if the global working group is properly set up.
Verifies that the 'Organization Wide' working group exists and all users are assigned.

Usage:
    python utils/validate_global_working_group.py
"""

import asyncio
import os
import sys
from datetime import datetime

# Add the backend directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

WORKING_GROUPS_COLLECTION = "workingGroups"
USERS_COLLECTION = "users"
ASSIGNMENTS_COLLECTION = "assignments"
GLOBAL_WG_ID = "organization-wide"
GLOBAL_WG_NAME = "Organization Wide"

async def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    if firebase_admin._apps:
        return firestore.AsyncClient()
    
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        raise ValueError("GOOGLE_CLOUD_PROJECT environment variable not set")
    
    try:
        # Try Application Default Credentials first
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {'projectId': project_id})
        print(f"✅ Firebase initialized for project: {project_id}")
    except Exception:
        # Fallback to service account key
        gac_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if gac_path:
            cred = credentials.Certificate(gac_path)
            firebase_admin.initialize_app(cred, {'projectId': project_id})
            print(f"✅ Firebase initialized for project: {project_id}")
        else:
            raise ValueError("Failed to initialize Firebase - no valid credentials found")
    
    return firestore.AsyncClient(project=project_id)

async def validate_global_working_group(db: firestore.AsyncClient):
    """Validate that the global working group exists and is properly configured"""
    print(f"🔍 Checking global working group '{GLOBAL_WG_NAME}'...")
    
    # Check if the global working group exists
    wg_ref = db.collection(WORKING_GROUPS_COLLECTION).document(GLOBAL_WG_ID)
    wg_doc = await wg_ref.get()
    
    if not wg_doc.exists:
        print(f"❌ Global working group '{GLOBAL_WG_ID}' not found!")
        print("   Run setup script: python setup_global_working_group.py")
        return False
    
    wg_data = wg_doc.to_dict()
    print(f"✅ Global working group exists:")
    print(f"   ID: {GLOBAL_WG_ID}")
    print(f"   Name: {wg_data.get('groupName')}")
    print(f"   Status: {wg_data.get('status')}")
    print(f"   Is Global: {wg_data.get('isGlobal', False)}")
    print(f"   Description: {wg_data.get('description', 'N/A')[:50]}...")
    
    return True

async def validate_user_assignments(db: firestore.AsyncClient):
    """Validate that all users are assigned to the global working group"""
    print(f"\n🔍 Checking user assignments...")
    
    # Get all users
    users_query = db.collection(USERS_COLLECTION)
    users_docs = users_query.stream()
    
    total_users = 0
    users_list = []
    
    async for user_doc in users_docs:
        total_users += 1
        user_data = user_doc.to_dict()
        users_list.append({
            "id": user_doc.id,
            "firstName": user_data.get("firstName"),
            "lastName": user_data.get("lastName"),
            "email": user_data.get("email"),
            "status": user_data.get("status")
        })
    
    print(f"✅ Found {total_users} total users")
    
    if total_users == 0:
        print("ℹ️  No users found in the system")
        return True
    
    # Check assignments for each user
    assigned_users = 0
    unassigned_users = []
    
    for user in users_list:
        user_id = user["id"]
        
        # Check if user is assigned to global working group
        assignment_query = db.collection(ASSIGNMENTS_COLLECTION)\
            .where("userId", "==", user_id)\
            .where("assignableId", "==", GLOBAL_WG_ID)\
            .where("assignableType", "==", "workingGroup")\
            .limit(1)
        
        assignments = assignment_query.stream()
        is_assigned = False
        assignment_status = None
        
        async for assignment_doc in assignments:
            is_assigned = True
            assignment_data = assignment_doc.to_dict()
            assignment_status = assignment_data.get("status")
            break
        
        if is_assigned:
            assigned_users += 1
            status_indicator = "✅" if assignment_status == "active" else f"⚠️ ({assignment_status})"
            user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or user.get('email', user_id)
            print(f"   {status_indicator} {user_name}")
        else:
            unassigned_users.append(user)
    
    print(f"\n📊 Assignment Summary:")
    print(f"   Total Users: {total_users}")
    print(f"   Assigned: {assigned_users}")
    print(f"   Unassigned: {len(unassigned_users)}")
    
    if unassigned_users:
        print(f"\n❌ Unassigned users:")
        for user in unassigned_users[:5]:  # Show first 5 unassigned users
            user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or user.get('email', user['id'])
            print(f"   - {user_name} ({user['id']})")
        
        if len(unassigned_users) > 5:
            print(f"   ... and {len(unassigned_users) - 5} more")
        
        print("\n💡 To fix unassigned users, run: python setup_global_working_group.py")
        return False
    
    print(f"✅ All users are properly assigned to the global working group!")
    return True

async def validate_events_integration(db: firestore.AsyncClient):
    """Check if there are any events using the global working group"""
    print(f"\n🔍 Checking events integration...")
    
    # Query events that include the global working group
    events_query = db.collection("events")\
        .where("workingGroupIds", "array_contains", GLOBAL_WG_ID)\
        .limit(5)
    
    events_docs = events_query.stream()
    
    global_events = []
    async for event_doc in events_docs:
        event_data = event_doc.to_dict()
        global_events.append({
            "id": event_doc.id,
            "name": event_data.get("name", "Unnamed Event"),
            "startDate": event_data.get("startDate"),
            "status": event_data.get("status")
        })
    
    if global_events:
        print(f"✅ Found {len(global_events)} global events:")
        for event in global_events:
            print(f"   - {event['name']} (Status: {event.get('status', 'N/A')})")
    else:
        print(f"ℹ️  No global events found yet")
        print("   Users with event creation permissions can create events")
        print("   for the 'Organization Wide' working group")
    
    return True

async def main():
    """Main validation function"""
    print("🚀 Validating Global Working Group Setup")
    print("=" * 50)
    
    try:
        # Initialize Firebase
        db = await initialize_firebase()
        
        # Run validation checks
        wg_valid = await validate_global_working_group(db)
        
        if wg_valid:
            assignments_valid = await validate_user_assignments(db)
            await validate_events_integration(db)
            
            print("\n" + "=" * 50)
            if assignments_valid:
                print("✅ Global Working Group Setup is Valid!")
                print("\n🎯 System is ready for global events:")
                print("   1. All users can see global events")
                print("   2. Users with permissions can create global events")
                print("   3. New users will be automatically assigned")
            else:
                print("⚠️  Global Working Group Setup has Issues!")
                print("   Please run the setup script to fix assignment issues.")
        else:
            print("\n" + "=" * 50)
            print("❌ Global Working Group Setup is Invalid!")
            print("   Please run the setup script to create the global working group.")
        
    except Exception as e:
        print(f"❌ Validation Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    finally:
        # Close the database connection
        if 'db' in locals():
            try:
                await db.close()
            except:
                pass

if __name__ == "__main__":
    asyncio.run(main())