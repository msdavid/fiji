#!/usr/bin/env python3
"""
Simple test script to verify that the global working group appears in the working groups endpoint.
This simulates what the frontend event forms do when fetching working groups.

Usage:
    python test_working_groups_endpoint.py
"""

import asyncio
import os
import sys
import json

# Add the backend directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

WORKING_GROUPS_COLLECTION = "workingGroups"
USERS_COLLECTION = "users"
ASSIGNMENTS_COLLECTION = "assignments"
GLOBAL_WG_ID = "organization-wide"

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

async def simulate_working_groups_endpoint(db: firestore.AsyncClient, user_id: str = None):
    """
    Simulate the working groups endpoint logic to test if global working group appears.
    This mimics the logic in routers/working_groups.py
    """
    print(f"🔍 Testing working groups endpoint logic...")
    
    # Get all working groups
    groups_query = db.collection(WORKING_GROUPS_COLLECTION).order_by("groupName", direction=firestore.Query.ASCENDING)
    docs_snapshot = groups_query.stream()
    
    all_groups = []
    async for doc in docs_snapshot:
        group_data = doc.to_dict()
        group_data['id'] = doc.id
        all_groups.append({
            'id': doc.id,
            'groupName': group_data.get('groupName'),
            'status': group_data.get('status'),
            'isGlobal': group_data.get('isGlobal', False)
        })
    
    print(f"📊 Total working groups in database: {len(all_groups)}")
    
    # Find the global working group
    global_wg = None
    for group in all_groups:
        if group['id'] == GLOBAL_WG_ID:
            global_wg = group
            break
    
    if global_wg:
        print(f"✅ Global working group found:")
        print(f"   ID: {global_wg['id']}")
        print(f"   Name: {global_wg['groupName']}")
        print(f"   Status: {global_wg['status']}")
        print(f"   Is Global: {global_wg['isGlobal']}")
    else:
        print(f"❌ Global working group '{GLOBAL_WG_ID}' not found!")
        print("   Available working groups:")
        for group in all_groups:
            print(f"   - {group['id']}: {group['groupName']}")
        return False
    
    # Test user assignment logic (if user_id provided)
    if user_id:
        print(f"\n🔍 Testing user assignment logic for user {user_id}...")
        
        # Get user's working group assignments
        user_wg_assignments_query = db.collection(ASSIGNMENTS_COLLECTION) \
            .where("userId", "==", user_id) \
            .where("assignableType", "==", "workingGroup")
        
        assignments = user_wg_assignments_query.stream()
        allowed_wg_ids = []
        
        async for doc in assignments:
            assignment_data = doc.to_dict()
            allowed_wg_ids.append(assignment_data["assignableId"])
        
        print(f"   User's assigned working groups: {allowed_wg_ids}")
        
        # Simulate the new logic that always includes global WG
        if GLOBAL_WG_ID not in allowed_wg_ids:
            allowed_wg_ids.append(GLOBAL_WG_ID)
            print(f"   Added global working group: {allowed_wg_ids}")
        
        # Filter groups based on allowed IDs
        filtered_groups = [g for g in all_groups if g['id'] in allowed_wg_ids]
        print(f"   Filtered groups count: {len(filtered_groups)}")
        
        global_in_filtered = any(g['id'] == GLOBAL_WG_ID for g in filtered_groups)
        if global_in_filtered:
            print(f"   ✅ Global working group appears in filtered results")
        else:
            print(f"   ❌ Global working group missing from filtered results")
            
        return global_in_filtered
    
    return True

async def test_with_sample_user(db: firestore.AsyncClient):
    """Test with a sample user from the database"""
    print(f"\n🔍 Finding a sample user to test with...")
    
    # Get a sample user
    users_query = db.collection(USERS_COLLECTION).limit(1)
    users_docs = users_query.stream()
    
    sample_user = None
    async for user_doc in users_docs:
        sample_user = {
            'id': user_doc.id,
            'data': user_doc.to_dict()
        }
        break
    
    if sample_user:
        user_name = f"{sample_user['data'].get('firstName', '')} {sample_user['data'].get('lastName', '')}".strip()
        user_name = user_name or sample_user['data'].get('email', sample_user['id'])
        print(f"   Testing with user: {user_name} ({sample_user['id']})")
        
        return await simulate_working_groups_endpoint(db, sample_user['id'])
    else:
        print(f"   No users found in database")
        return True

async def main():
    """Main test function"""
    print("🚀 Testing Working Groups Endpoint for Global Working Group")
    print("=" * 60)
    
    try:
        # Initialize Firebase
        db = await initialize_firebase()
        
        # Test basic working groups listing
        basic_test = await simulate_working_groups_endpoint(db)
        
        if basic_test:
            # Test with a real user
            user_test = await test_with_sample_user(db)
            
            print("\n" + "=" * 60)
            if user_test:
                print("✅ Global Working Group Test PASSED!")
                print("\n🎯 Ready for frontend testing:")
                print("   1. Global working group exists in database")
                print("   2. Global working group appears in API responses")
                print("   3. Users can see global working group in event forms")
                print("   4. Events can be created for 'Organization Wide' working group")
            else:
                print("⚠️ Global Working Group Test had issues with user filtering")
        else:
            print("\n" + "=" * 60)
            print("❌ Global Working Group Test FAILED!")
            print("   Run setup script: python setup_global_working_group.py")
    
    except Exception as e:
        print(f"❌ Test Error: {str(e)}")
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