# Project Log - Fiji

## Session (2024-07-24 10:00) <!-- Replace with actual date and time -->
- **Q Agent:** Q
- **User:** Mauro
- **Objective:** Complete backend tasks for Sprint 4 (Working Group and Assignment Management), address runtime errors, and refactor Pydantic models.

### Activity:
- **Sprint 4 Review & Backend Implementation:**
    - Reviewed `.Q/sprints.md` and `docs/technical-specs.md` for Sprint 4 requirements.
    - **Assignments Model (`backend/models/assignment.py`):**
        - Confirmed Pydantic model for `assignments` collection was previously created.
        - Refined model: added `assignmentDate` to `AssignmentBase`, updated `AssignmentResponse` structure, changed `orm_mode` to `from_attributes`.
    - **Event Participation API Endpoints (`backend/routers/events.py`):**
        - Confirmed that API endpoints for event signup, withdrawal, and admin management of assignments were already implemented.
    - **Working Group Model (`backend/models/working_group.py`):**
        - Created Pydantic model for `workingGroups` collection.
        - Refined model: added `creatorFirstName`, `creatorLastName` to `WorkingGroupResponse`, changed `orm_mode` to `from_attributes`.
    - **Working Group CRUD API Endpoints (`backend/routers/working_groups.py`):**
        - Implemented `POST`, `GET /`, `GET /{group_id}`, `PUT /{group_id}`, `DELETE /{group_id}`.
        - Ensured creator details are populated in responses.
        - Implemented batch deletion of associated assignments when a working group is deleted.
    - **Working Group Assignment API Endpoints (`backend/routers/working_groups.py`):**
        - Implemented `POST /{group_id}/assignments` to assign users (using new `WorkingGroupAssignmentCreate` model).
        - Implemented `GET /{group_id}/assignments` to list members (using new `UserAssignmentResponse` model with user details).
        - Implemented `DELETE /{group_id}/assignments/{assignment_id}` to remove assignments.
    - **RBAC:** Ensured all new working group and assignment endpoints are protected with appropriate `require_permission` checks.
    - **Main Application (`backend/main.py`):**
        - Confirmed `working_groups_router` was already included.

- **Frontend Review (Sprint 4):**
    - Reviewed `frontend/src/app/dashboard/admin/working-groups/[groupId]/page.tsx`.
    - Confirmed UI for managing working group members (assign/remove) is implemented and calls the correct backend endpoints.

- **Error Resolution & Refactoring:**
    - **`NameError` in `working_groups.py`:**
        - Identified missing `from pydantic import BaseModel, Field` import.
        - Added the import to resolve the error.
    - **Pydantic `orm_mode` Warning:**
        - Updated Pydantic models in:
            - `backend/models/assignment.py`
            - `backend/models/user.py` (also added `ConfigDict(extra='forbid')` to `UserUpdate`)
            - `backend/models/working_group.py`
        - Changed `orm_mode = True` to `from_attributes = True` or `model_config = ConfigDict(from_attributes=True)` to align with Pydantic v2 and suppress warnings.
        - Confirmed `event.py`, `invitation.py`, `role.py` already used Pydantic v2 style.
    - **`TypeError` in `main.py` Lifespan Shutdown:**
        - Enhanced `lifespan` manager in `backend/main.py` for more robust Firestore client handling:
            - Initialized `app.state.db` to `None`.
            - Added detailed logging for startup and shutdown phases.
            - Implemented specific `try-except` blocks around `db.close()` to catch and log errors.
        - Improved `/health` check endpoint to provide more detailed debug information about `app.state.db`.

- **Commits:**
    - `feat(backend): Implement Sprint 4 WG & Assignment Management`
    - `fix(backend): Add missing Pydantic import in working_groups router`
    - `refactor(backend): Update Pydantic models to use from_attributes`
    - `fix(backend): Enhance lifespan manager and health check logging`

### Sprint 4 Status:
- All backend tasks for Sprint 4 are now considered complete.
- Frontend tasks for Sprint 4 were previously addressed and reviewed.
- Sprint 4 is complete.

---
## Session (YYYY-MM-DD HH:MM) <!-- Newest entry: Refactor UI and Fix Errors -->
- **Q Agent:** Mauro
- **Objective:** Implement user search for assignments, fix UI errors (double navbars, object rendering), and address backend validation/data issues.
### Activity:
- **User Search Implementation (Admin Assign):**
    - **Backend:** Added `GET /users/search` endpoint to `backend/routers/users.py` for searching users by name/email. Added `UserSearchResponseItem` to `backend/models/user.py`.
    - **Frontend:** Created reusable `UserSearchInput.tsx` component.
    - Integrated `UserSearchInput` into Event Detail page (`frontend/src/app/dashboard/events/[eventId]/page.tsx`) for assigning volunteers.
    - Integrated `UserSearchInput` into Working Group Detail page (`frontend/src/app/dashboard/admin/working-groups/[groupId]/page.tsx`) for assigning members.
- **Error Fix - User Profile `preferences` Rendering:**
    - **Backend:** Added `_sanitize_user_data_fields` to `backend/routers/users.py` to handle cases where `skills`, `qualifications`, `preferences` might be stored incorrectly as strings in Firestore, ensuring they are passed as the correct types (list/dict) to Pydantic models. This is a workaround for existing bad data.
    - **Frontend (`/dashboard/profile`):** Updated `UserDataFromBackend` interface for `preferences` to be `Record<string, any> | string`. Modified rendering logic to display object key-value pairs if `preferences` is an object, instead of direct rendering. Improved `handleSubmit` to parse preferences string to JSON object before sending to backend.
    - **Frontend (`/dashboard/admin/profile/[userId]`):** Updated `UserProfileData` interface for `preferences`. Modified rendering to display object key-value pairs directly, instead of passing object to generic `ProfileField`.
- **Error Fix - Firestore Index for User List:**
    - Addressed "query requires an index" error for `/dashboard/admin/users` by guiding manual creation of a composite index (`lastName` ASC, `firstName` ASC) in Firestore.
- **Error Fix - `assignedRoleIds` Undefined on User List Page:**
    - **Backend:** Added `assignedRoleIds` field to `UserListResponse` model in `backend/models/user.py`. Ensured `list_users` endpoint populates this field.
- **Admin Users Table - Delete Link & Placeholder Page:**
    - Added "Delete" link to actions column in `frontend/src/app/dashboard/admin/users/page.tsx`.
    - Created placeholder delete confirmation page `frontend/src/app/dashboard/admin/users/[userId]/delete/page.tsx`.
- **UI Fix - Double Navbars:**
    - Removed redundant `<nav>` element from `frontend/src/app/dashboard/admin/working-groups/[groupId]/page.tsx` to resolve double navbar issue. The main dashboard layout provides the primary navigation. Back link repositioned.

---
## Session (YYYY-MM-DD HH:MM) <!-- Previous entry: Review Event Detail Page for Participation Features -->
- **Q Agent:** Mauro
- **Objective:** Review the event detail page (`frontend/src/app/dashboard/events/[eventId]/page.tsx`) for event participation features as part of Sprint 4.
### Activity:
- **Reviewed `frontend/src/app/dashboard/events/[eventId]/page.tsx`:**
  - Confirmed the page fetches and displays detailed event information.
  - **Volunteer Signup/Withdrawal:**
    - Displays "Sign Up" button for events open for signup if the user isn't already signed up.
    - Displays "Withdraw Signup" button if the user is signed up.
    - Correctly calls backend endpoints (`POST` and `DELETE` on `/events/{eventId}/signup`).
    - Uses `event.isCurrentUserSignedUp` and `event.currentUserAssignmentStatus` from backend.
  - **Admin Volunteer Management (requires `events:manage_assignments` privilege):**
    - Displays a list of currently assigned volunteers.
    - Provides a form to assign a new volunteer by User ID (calls `POST /events/{eventId}/assignments`).
    - Provides "Remove" buttons for each assigned volunteer (calls `DELETE /events/{eventId}/assignments/{assignmentId}`).
  - Includes permission checks for editing the event and managing assignments.
  - The page appears to fulfill the frontend requirements for event participation in Sprint 4.
  - Noted that the `Assignment` interface is duplicated across files; recommend refactoring to a shared types file later.

---
## Session (YYYY-MM-DD HH:MM) <!-- Previous entry: Review Working Group Frontend Pages -->
- **Q Agent:** Mauro
- **Objective:** Review existing frontend pages for Working Group management (list, new, detail) as part of Sprint 4.
### Activity:
- **Reviewed `frontend/src/app/dashboard/admin/working-groups/page.tsx`:**
  - Confirmed it lists working groups fetched from the backend.
  - Includes permission checks for viewing and creating groups.
  - Links to the "new working group" page.
  - Modified the page to make each working group card a clickable link to its detail page: `/dashboard/admin/working-groups/[groupId]`.
- **Reviewed `frontend/src/app/dashboard/admin/working-groups/new/page.tsx`:**
  - Confirmed it provides a form for creating new working groups.
  - Includes fields for name, description, and status.
  - Performs permission checks for creation.
  - Submits data to the backend and redirects on success.
- **Reviewed `frontend/src/app/dashboard/admin/working-groups/[groupId]/page.tsx`:**
  - Confirmed it displays details for a specific working group.
  - Fetches and displays a list of assigned members (users).
  - Provides UI for admins (with `working_groups:manage_assignments` privilege) to:
    - Assign users to the group by entering a User ID.
    - Remove users from the group.
  - Includes permission checks for viewing the group and managing assignments.
  - Editing the working group's own details (name, description) is not yet implemented (optional for Sprint 4).

---
## Session (YYYY-MM-DD HH:MM) <!-- Previous entry: Create Placeholder Admin User Edit Page -->
- **Q Agent:** Mauro
- **Objective:** Create a placeholder page for editing user details by an admin to resolve 404 errors.
### Activity:
- Created `frontend/src/app/dashboard/admin/users/[userId]/edit/page.tsx`.
  - This page fetches the user's data based on `userId` from the URL.
  - It displays a title like "Edit User: [User Name]" and a message indicating it's a placeholder.
  - Includes basic loading, error handling, and a "Back to User List" link.
  - This resolves the 404 error when clicking the "Edit" link on the admin users table. Full form functionality is a future task.

---
## Session (YYYY-MM-DD HH:MM) <!-- Previous entry: Add Edit Link to Admin Users Table -->
- **Q Agent:** Mauro
- **Objective:** Add an "Edit" link to the actions column in the admin users table.
### Activity:
- Modified `frontend/src/app/dashboard/admin/users/page.tsx`:
  - Added a new `<Link>` component in the actions column for each user.
  - This link is styled with `text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200` and points to `/dashboard/admin/users/[userId]/edit`.

---
## Session (YYYY-MM-DD HH:MM) <!-- Previous entry: Add Profile Picture Field & Display -->
- **Q Agent:** Mauro
- **Objective:** Add a profile picture URL field to user models and display it on profile pages.
### Activity:
- **Backend Model Update (`backend/models/user.py`):**
  - Added an optional `profilePictureUrl: Optional[str]` field to `UserBase`, `UserResponse`, and `UserUpdate` Pydantic models.
- **Frontend - Admin User Profile Page (`frontend/src/app/dashboard/admin/profile/[userId]/page.tsx`):**
  - Updated the `UserProfileData` interface to include `profilePictureUrl`.
  - Modified the "Basic Information" card to display an `<img>` tag for the profile picture if a URL exists, or a placeholder if not.
- **Frontend - User's Own Profile Page (`frontend/src/app/dashboard/profile/page.tsx`):**
  - Updated `UserDataFromBackend` and `EditableUserProfile` interfaces to include `profilePictureUrl`.
  - Added an `<img>` element to display the profile picture in both view and edit modes (display-only in edit mode for now).
  - Updated `formData` state to include `profilePictureUrl`.
- **Frontend - AuthContext (`frontend/src/context/AuthContext.tsx`):**
  - Added `profilePictureUrl?: string | null` to the `UserProfile` interface.

---
## Session (YYYY-MM-DD HH:MM) <!-- Previous entry: Admin User Profile Card Layout -->
- **Q Agent:** Mauro
- **Objective:** Enhance the visual appeal of the admin user profile page (`/dashboard/admin/profile/[userId]`) with a card-based layout.
### Activity:
- Modified `frontend/src/app/dashboard/admin/profile/[userId]/page.tsx`:
  - Reorganized user profile information into three distinct cards: "Basic Information", "Professional Details", and "Account & System Information".
  - Applied consistent styling (`bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 mb-6`) to each card for a cohesive look.
  - Added titles to each card for clarity.
  - Adjusted the `ProfileField` component to remove bottom margin from the last field within a card (`last:mb-0`).
  - Increased `max-w-3xl` for the main container to better accommodate the card layout.
  - Conditionally rendered the "Professional Details" card only if relevant fields (skills, qualifications, preferences) have data.
  - Improved display of assigned roles to show "No roles assigned" if the array is empty.

---
## Session (YYYY-MM-DD HH:MM) <!-- Previous entry: Add User Search -->
- **Q Agent:** Mauro
- **Objective:** Add a search box to the admin users page for filtering.
### Activity:
- Modified `frontend/src/app/dashboard/admin/users/page.tsx`:
  - Added a `searchTerm` state variable.
  - Implemented an `<input type="text">` field for users to enter search queries.
  - Added logic to filter the `users` array based on `searchTerm`. The search is case-insensitive and checks against the user's first name, last name, and email.
  - Updated conditional rendering to display messages for "No users found" (initial state) and "No users found matching [searchTerm]" (after filtering).

---
## Session (YYYY-MM-DD HH:MM) <!-- Previous entry: Table Aesthetic Enhancement -->
- **Q Agent:** Mauro
- **Objective:** Enhance the visual aesthetics and hierarchy of the users table in the admin dashboard.
### Activity:
- Modified `frontend/src/app/dashboard/admin/users/page.tsx` with the following Tailwind CSS class changes:
  - **Table Card (`div` wrapping table):**
    - Light mode: `bg-gray-50` -> `bg-white`.
    - Dark mode: Kept `dark:bg-gray-700`.
  - **Table Header (`thead`):**
    - Light mode: Kept `bg-gray-50`.
    - Dark mode: `dark:bg-gray-700` -> `dark:bg-gray-600`.
  - **Table Dividers (`table` and `tbody` elements):**
    - Light mode: Kept `divide-gray-200`.
    - Dark mode: `dark:divide-gray-700` -> `dark:divide-gray-500`.
  - **Table Body (`tbody`):**
    - Background kept at `bg-white dark:bg-gray-700`.
  - These changes aim to improve visual separation and overall aesthetics in both light and dark modes.

---
## Session (YYYY-MM-DD HH:MM) <!-- Previous entry: Table Styling Refinement -->
- **Q Agent:** Mauro
- **Objective:** Improve visual contrast of the users table in the admin dashboard.
### Activity:
- Modified `frontend/src/app/dashboard/admin/users/page.tsx`.
  - Initial change: Changed the background class of the `div` wrapping the table from `bg-white dark:bg-gray-800` to `bg-gray-50 dark:bg-gray-700` to enhance visual separation of the table card.
  - Refinement: Changed the `tbody` element's dark mode background class from `dark:bg-gray-800` to `dark:bg-gray-700`. This ensures the table content area itself is also visually distinct from the page background (`dark:bg-gray-800`) in dark mode, matching the table card's new dark background.

---
## Session (YYYY-MM-DD HH:MM) <!-- Previous entry: Root Path Redirect -->
- **Q Agent:** Mauro
- **Objective:** Modify frontend root path to redirect to login page.
### Activity:
- Modified `frontend/src/app/page.tsx` to implement a redirect from `/` to `/login`.
  - Replaced existing content with `next/navigation`'s `redirect` function.


