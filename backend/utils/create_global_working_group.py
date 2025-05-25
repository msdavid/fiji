#!/usr/bin/env python3
"""
Script to create the global "Organization Wide" working group and assign all existing users to it.
This working group allows creating global events that all users can see and participate in.

Usage:
    python utils/create_global_working_group.py
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
GLOBAL_WG_NAME = "Organization Wide"
GLOBAL_WG_ID = "organization-wide"  # Fixed ID for easy reference

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
        print(f"✅ Firebase initialized with ADC for project: {project_id}")
    except Exception:
        # Fallback to service account key
        gac_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if gac_path:
            cred = credentials.Certificate(gac_path)
            firebase_admin.initialize_app(cred, {'projectId': project_id})
            print(f"✅ Firebase initialized with service account for project: {project_id}")
        else:
            raise ValueError("Failed to initialize Firebase - no valid credentials found")
    
    return firestore.AsyncClient(project=project_id)

async def create_global_working_group(db: firestore.AsyncClient):
    """Create the global working group if it doesn't exist"""
    print(f"🔍 Checking if '{GLOBAL_WG_NAME}' working group exists...")
    
    # Check if the global working group already exists
    wg_ref = db.collection(WORKING_GROUPS_COLLECTION).document(GLOBAL_WG_ID)
    wg_doc = await wg_ref.get()
    
    if wg_doc.exists:
        print(f"✅ '{GLOBAL_WG_NAME}' working group already exists")
        return GLOBAL_WG_ID
    
    # Create the global working group
    global_wg_data = {
        "groupName": GLOBAL_WG_NAME,
        "description": "Default organization-wide working group. All users are automatically members of this group to enable global events and announcements.",
        "status": "active",
        "createdByUserId": "system",  # System-created
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
        "isGlobal": True  # Special flag to identify this as the global working group
    }
    
    await wg_ref.set(global_wg_data)
    print(f"✅ Created '{GLOBAL_WG_NAME}' working group with ID: {GLOBAL_WG_ID}")
    
    return GLOBAL_WG_ID

async def get_all_users(db: firestore.AsyncClient):
    """Get all active users from the database"""
    print("🔍 Fetching all users...")
    
    users_query = db.collection(USERS_COLLECTION)
    users_docs = users_query.stream()
    
    users = []
    async for user_doc in users_docs:
        user_data = user_doc.to_dict()
        users.append({
            "id": user_doc.id,
            "firstName": user_data.get("firstName"),
            "lastName": user_data.get("lastName"),
            "email": user_data.get("email")
        })
    
    print(f"✅ Found {len(users)} users")
    return users

async def assign_users_to_global_wg(db: firestore.AsyncClient, global_wg_id: str, users: list):
    """Assign all users to the global working group if not already assigned"""
    print(f"🔄 Assigning users to '{GLOBAL_WG_NAME}' working group...")
    
    assigned_count = 0
    skipped_count = 0
    
    for user in users:
        user_id = user["id"]
        
        # Check if user is already assigned to the global working group
        existing_assignment_query = db.collection(ASSIGNMENTS_COLLECTION)\
            .where("userId", "==", user_id)\
            .where("assignableId", "==", global_wg_id)\
            .where("assignableType", "==", "workingGroup")
        
        existing_assignments = existing_assignment_query.stream()
        assignment_exists = False
        
        async for assignment_doc in existing_assignments:
            assignment_exists = True
            break
        
        if assignment_exists:
            skipped_count += 1
            continue
        
        # Create assignment
        assignment_data = {
            "userId": user_id,
            "assignableId": global_wg_id,
            "assignableType": "workingGroup",
            "status": "active",  # Auto-active for global WG
            "role": "member",
            "notes": "Automatically assigned to organization-wide working group",
            "assignedByUserId": "system",
            "assignmentDate": firestore.SERVER_TIMESTAMP,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP
        }
        
        assignment_ref = db.collection(ASSIGNMENTS_COLLECTION).document()
        await assignment_ref.set(assignment_data)
        
        assigned_count += 1
        user_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or user.get('email', user_id)
        print(f"  ✅ Assigned {user_name} to global working group")
    
    print(f"✅ Assignment complete: {assigned_count} new assignments, {skipped_count} already assigned")

async def update_auth_permissions(db: firestore.AsyncClient):
    """Update the auth system to automatically assign new users to the global working group"""
    print("💡 Note: You may want to update the user registration/auth system to automatically")
    print("   assign new users to the global working group going forward.")
    print("   This can be done in the user creation endpoints or auth callbacks.")

async def main():
    """Main function to create global working group and assign users"""
    print("🚀 Starting Global Working Group Setup")
    print("=" * 50)
    
    try:
        # Initialize Firebase
        db = await initialize_firebase()
        
        # Create the global working group
        global_wg_id = await create_global_working_group(db)
        
        # Get all users
        users = await get_all_users(db)
        
        if users:
            # Assign all users to the global working group
            await assign_users_to_global_wg(db, global_wg_id, users)
        else:
            print("ℹ️  No users found to assign")
        
        # Provide guidance for future users
        await update_auth_permissions(db)
        
        print("\n" + "=" * 50)
        print("✅ Global Working Group Setup Complete!")
        print(f"   Working Group ID: {global_wg_id}")
        print(f"   Working Group Name: {GLOBAL_WG_NAME}")
        print("\n🎯 Next Steps:")
        print("   1. Users can now create events for the 'Organization Wide' working group")
        print("   2. All users will see these global events")
        print("   3. Consider updating user registration to auto-assign new users")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
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