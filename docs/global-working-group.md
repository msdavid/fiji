# Global Working Group Feature

## Overview

The "Organization Wide" working group is a special system-wide working group that enables global events and announcements visible to all users in the organization.

## Key Features

### 🌍 Universal Membership
- **All users are automatically members** of the "Organization Wide" working group
- **New users are automatically assigned** during registration
- **System-maintained membership** - users cannot leave this group

### 📅 Global Events
- Events created for the "Organization Wide" working group are **visible to all users**
- Perfect for:
  - Organization-wide meetings
  - Company events and announcements
  - All-hands gatherings
  - Public volunteer opportunities

### 🔧 System Integration
- **Fixed ID**: `organization-wide` for consistent referencing
- **Automatic assignment** during user registration
- **Enhanced event filtering** to always show global events

## Setup Instructions

### 1. Create the Global Working Group

Run the setup script to create the global working group and assign existing users:

```bash
# From the backend directory
python setup_global_working_group.py
```

This script will:
- ✅ Create the "Organization Wide" working group
- ✅ Assign all existing users to the group
- ✅ Set up automatic assignment for new users

### 2. Verify Setup

After running the script, you should see:
- New working group in `/dashboard/admin/working-groups`
- All users assigned with "active" status
- New users automatically assigned during registration

## Usage Guide

### Creating Global Events

1. **Navigate to Events**: Go to `/dashboard/events/new`
2. **Select Working Group**: Choose "Organization Wide" from the dropdown
3. **Create Event**: Fill in event details as normal
4. **Visibility**: Event will be automatically visible to all users

### Managing Global Events

- **Admin Access**: Users with `events:create` permission can create global events
- **User Access**: All users can view and sign up for global events
- **Working Group Management**: Global working group membership is system-managed

### Event Visibility Rules

| User Type | Can See Global Events | Can Create Global Events |
|-----------|----------------------|--------------------------|
| Regular User | ✅ Yes | ❌ No (unless has events:create permission) |
| Event Manager | ✅ Yes | ✅ Yes |
| Admin | ✅ Yes | ✅ Yes |

## Technical Details

### Database Structure

```javascript
// Working Group Document (organization-wide)
{
  "groupName": "Organization Wide",
  "description": "Default organization-wide working group...",
  "status": "active",
  "isGlobal": true,
  "createdByUserId": "system",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}

// Assignment Document (auto-created for each user)
{
  "userId": "user123",
  "assignableId": "organization-wide",
  "assignableType": "workingGroup",
  "status": "active",
  "role": "member",
  "notes": "Automatically assigned to organization-wide working group",
  "assignedByUserId": "system"
}
```

### API Endpoints

| Endpoint | Purpose | Access |
|----------|---------|--------|
| `GET /events` | Lists events (includes global events for all users) | All authenticated users |
| `GET /events?working_group_id=organization-wide` | Filter to only global events | All authenticated users |
| `POST /events` | Create event (can specify global working group) | Users with events:create permission |

### Event Filtering Logic

The system automatically includes global events for all authenticated users by:

1. **Auto-including global WG**: Adding `organization-wide` to user's working group filter
2. **Fallback protection**: Ensuring users always see global events even if no other assignments
3. **Admin override**: Allowing admins to see all events regardless of working group membership

## Troubleshooting

### Users Not Seeing Global Events

**Check:**
1. Is the global working group created? (`organization-wide` ID should exist)
2. Are users assigned to the global working group? Check assignments collection
3. Are events properly assigned to the global working group? Check event's `workingGroupIds`

**Fix:**
```bash
# Re-run the setup script to fix assignments
python setup_global_working_group.py
```

### New Users Not Auto-Assigned

**Check:**
1. Is the auto-assignment code active in `routers/auth.py`?
2. Does the global working group exist when new users register?

**Fix:**
- Ensure global working group is created before user registration
- Check logs for assignment errors during registration

### Global Events Not Visible

**Check:**
1. Event's `workingGroupIds` includes `organization-wide`
2. User authentication and session tokens are valid
3. Event filtering logic includes global working group

## Best Practices

### 🎯 Event Creation
- **Use descriptive titles** for global events since they're visible to everyone
- **Include clear descriptions** explaining relevance to all users  
- **Set appropriate date/time** considering organization timezone
- **Enable notifications** for important organization-wide events

### 👥 User Management
- **Don't manually remove** users from the global working group
- **Monitor assignments** to ensure all users remain assigned
- **Use global events sparingly** to avoid notification fatigue

### 🔧 System Maintenance
- **Regular verification** that all users are assigned to global working group
- **Monitor event creation** patterns for global working group usage
- **Backup and restore** procedures should preserve global working group structure

## Migration Notes

If implementing this feature on an existing system:

1. **Backup database** before running setup scripts
2. **Test on staging** environment first
3. **Notify users** about new global event visibility
4. **Monitor performance** impact of expanded event filtering
5. **Verify permissions** for event creation remain appropriate

## Related Documentation

- [Working Groups Management](./working-groups.md)
- [Events System](./events.md)
- [User Permissions](./permissions.md)
- [Backend Utilities](../backend/utils/README.md)