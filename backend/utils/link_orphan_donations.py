#!/usr/bin/env python3
"""
Admin Utility: Link Orphan Donations to Users

This script helps administrators link existing donations to user accounts by matching
email addresses. This is useful for:
- Legacy donations created before user linking was implemented
- Donations that may never get auto-linked through normal user interaction
- Bulk cleanup of orphaned donation records

Usage:
    python link_orphan_donations.py [--dry-run] [--email=specific@email.com]

Options:
    --dry-run           Show what would be linked without making changes
    --email=EMAIL       Only process donations for a specific email address
    --help             Show this help message

Example:
    python link_orphan_donations.py --dry-run                    # Preview all changes
    python link_orphan_donations.py                             # Link all orphan donations
    python link_orphan_donations.py --email=user@example.com    # Link specific user's donations
"""

import sys
import argparse
import asyncio
from firebase_admin import firestore, credentials, initialize_app
import os

# Initialize Firebase Admin if not already initialized
try:
    initialize_app()
except ValueError:
    # App already initialized
    pass

DONATIONS_COLLECTION = "donations"
USERS_COLLECTION = "users"

async def get_orphan_donations(db, target_email=None):
    """Get donations that have donorEmail but no donorUserId"""
    
    if target_email:
        # Query specific email
        query = db.collection(DONATIONS_COLLECTION)\
            .where("donorEmail", "==", target_email)\
            .where("donorUserId", "==", None)
    else:
        # Query all orphan donations (has email but no user ID)
        query = db.collection(DONATIONS_COLLECTION)\
            .where("donorUserId", "==", None)
    
    orphan_donations = []
    async for doc in query.stream():
        donation_data = doc.to_dict()
        if donation_data.get("donorEmail"):  # Only include donations with email
            orphan_donations.append({
                "id": doc.id,
                "email": donation_data["donorEmail"],
                "amount": donation_data.get("amount"),
                "currency": donation_data.get("currency"), 
                "donationType": donation_data.get("donationType"),
                "donationDate": donation_data.get("donationDate"),
                "description": donation_data.get("description", "")[:50] + "..." if len(donation_data.get("description", "")) > 50 else donation_data.get("description", "")
            })
    
    return orphan_donations

async def get_user_email_mapping(db):
    """Build a mapping of email addresses to user IDs"""
    
    email_to_user_id = {}
    user_count = 0
    
    users_query = db.collection(USERS_COLLECTION)
    async for user_doc in users_query.stream():
        user_data = user_doc.to_dict()
        email = user_data.get("email")
        if email:
            email_to_user_id[email.lower()] = {
                "user_id": user_doc.id,
                "name": f"{user_data.get('firstName', '')} {user_data.get('lastName', '')}".strip() or email
            }
            user_count += 1
    
    print(f"📋 Found {user_count} users with email addresses")
    return email_to_user_id

async def link_donations(orphan_donations, email_to_user_id, db, dry_run=False):
    """Link orphan donations to users"""
    
    linked_count = 0
    unmatched_count = 0
    unmatched_emails = set()
    
    for donation in orphan_donations:
        donor_email = donation["email"].lower()
        
        if donor_email in email_to_user_id:
            user_info = email_to_user_id[donor_email]
            user_id = user_info["user_id"]
            user_name = user_info["name"]
            
            if dry_run:
                print(f"🔗 Would link: {donation['id']} → {user_name} ({donor_email})")
                print(f"   Donation: {donation['donationType']} - {donation['description']}")
                if donation.get('amount'):
                    print(f"   Amount: {donation['currency']} {donation['amount']}")
                print()
            else:
                try:
                    await db.collection(DONATIONS_COLLECTION).document(donation["id"]).update({
                        "donorUserId": user_id
                    })
                    print(f"✅ Linked donation {donation['id']} to {user_name} ({donor_email})")
                except Exception as e:
                    print(f"❌ Failed to link donation {donation['id']}: {e}")
                    continue
            
            linked_count += 1
        else:
            unmatched_count += 1
            unmatched_emails.add(donor_email)
    
    return linked_count, unmatched_count, unmatched_emails

async def main():
    parser = argparse.ArgumentParser(
        description="Link orphan donations to users by email address",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("--dry-run", action="store_true", 
                       help="Show what would be linked without making changes")
    parser.add_argument("--email", type=str, 
                       help="Only process donations for a specific email address")
    
    args = parser.parse_args()
    
    print("🔧 Admin Utility: Link Orphan Donations to Users")
    print("=" * 50)
    
    if args.dry_run:
        print("🔍 DRY RUN MODE - No changes will be made")
        print()
    
    try:
        db = firestore.AsyncClient()
        
        # Step 1: Get orphan donations
        print("📊 Scanning for orphan donations...")
        orphan_donations = await get_orphan_donations(db, args.email)
        
        if not orphan_donations:
            target_info = f" for {args.email}" if args.email else ""
            print(f"✨ No orphan donations found{target_info}")
            return
        
        print(f"🔍 Found {len(orphan_donations)} orphan donations")
        
        if args.email:
            print(f"🎯 Filtering for email: {args.email}")
        
        print()
        
        # Step 2: Build user email mapping
        print("👥 Building user email mapping...")
        email_to_user_id = await get_user_email_mapping(db)
        print()
        
        # Step 3: Link donations
        print("🔗 Linking donations to users...")
        print()
        
        linked_count, unmatched_count, unmatched_emails = await link_donations(
            orphan_donations, email_to_user_id, db, args.dry_run
        )
        
        # Step 4: Summary
        print("=" * 50)
        print("📈 SUMMARY")
        print("=" * 50)
        
        if args.dry_run:
            print(f"🔍 Would link: {linked_count} donations")
        else:
            print(f"✅ Successfully linked: {linked_count} donations")
        
        print(f"❌ Unmatched donations: {unmatched_count}")
        
        if unmatched_emails:
            print("\n📧 Emails without matching users:")
            for email in sorted(unmatched_emails):
                print(f"   • {email}")
            print("\n💡 Consider creating user accounts for these emails or")
            print("   check if they contain typos.")
        
        if args.dry_run and linked_count > 0:
            print(f"\n🚀 To apply these changes, run:")
            if args.email:
                print(f"   python {sys.argv[0]} --email={args.email}")
            else:
                print(f"   python {sys.argv[0]}")
        
    except Exception as e:
        print(f"💥 Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())