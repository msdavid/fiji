# Backend Utilities

This directory contains administrative utilities and scripts for managing the Fiji platform.

## Scripts

### `link_orphan_donations.py`

Links existing donations to user accounts by matching email addresses. Useful for:
- Legacy donations created before user linking was implemented  
- Bulk cleanup of orphaned donation records
- One-time migrations when user accounts are created for existing donors

**Usage:**
```bash
# Preview changes without making them
python link_orphan_donations.py --dry-run

# Link all orphan donations
python link_orphan_donations.py

# Link donations for a specific email
python link_orphan_donations.py --email=user@example.com

# Preview changes for specific email
python link_orphan_donations.py --dry-run --email=user@example.com
```

**Requirements:**
- Firebase Admin SDK configured
- Appropriate database permissions
- Run from the backend directory

**Safety Features:**
- Dry-run mode for previewing changes
- Detailed logging of all operations
- Error handling for individual donation updates
- Summary report of matched/unmatched donations

### `create_global_working_group.py`

Creates the global "Organization Wide" working group and assigns all existing users to it. This enables:
- Global events that all users can see and participate in
- Organization-wide announcements and activities
- Automatic assignment of new users to the global working group

**Usage:**
```bash
# Create global working group and assign all users
python utils/create_global_working_group.py

# Or use the simplified script
python setup_global_working_group.py
```

**What it does:**
- Creates "Organization Wide" working group with fixed ID `organization-wide`
- Assigns all existing users to this working group as active members
- Sets up automatic assignment for new users during registration
- Provides guidance for using the global working group

**Safety Features:**
- Checks for existing global working group before creating
- Skips users already assigned to avoid duplicates  
- Detailed logging of all operations
- Non-destructive - only adds new assignments

---

## Development Notes

When adding new utilities:
1. Include detailed docstrings and help text
2. Implement dry-run mode for destructive operations
3. Provide clear error messages and logging
4. Test with small datasets first
5. Update this README with usage instructions