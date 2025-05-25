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

---

## Development Notes

When adding new utilities:
1. Include detailed docstrings and help text
2. Implement dry-run mode for destructive operations
3. Provide clear error messages and logging
4. Test with small datasets first
5. Update this README with usage instructions