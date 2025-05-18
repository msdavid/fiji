# Project Fiji - Project Log

## Session 1 (YYYY-MM-DD)
- Initialized project.
- Created .Q/projectlog.md

## Sprint 0: Project Setup & Core Backend Foundations
*   Established monorepo, basic FastAPI app, Dockerization, initial CI/CD for backend.
*   Core data models for users and roles created.
*   Firebase Authentication setup and initial user invitation/creation logic implemented.
*   Testing framework for backend established.
*   Key files created: `backend/main.py`, `backend/Dockerfile`, `cloudbuild.yaml`, `backend/models/user.py`, `backend/models/role.py`, `backend/routers/users.py`, `backend/routers/roles.py`, `backend/dependencies/auth.py`, `backend/tests/test_main.py`.

## Sprint 1: Core Frontend Setup & User Authentication Flow
*   Established frontend project structure, basic Next.js app, Dockerization, and initial CI/CD for frontend.
*   Implemented Firebase SDK, login, registration, and basic dashboard layout.
*   Connected frontend authentication to backend.
*   Key files created: `frontend/src/app/login/page.tsx`, `frontend/src/app/register/page.tsx`, `frontend/src/app/dashboard/page.tsx`, `frontend/src/context/AuthContext.tsx`, `frontend/Dockerfile`.

## Sprint 2: User Profile Management & RBAC Implementation
*   Implemented user profile viewing/editing on frontend.
*   Enhanced backend RBAC with `require_privilege` dependency.
*   Secured backend endpoints using RBAC.
*   Key files modified/created: `backend/dependencies/rbac.py`, `backend/routers/users.py` (profile endpoints), `frontend/src/app/dashboard/profile/page.tsx`.

## Sprint 3: Event Management - Core CRUD & Basic Listing
*   Implemented core CRUD for events in backend.
*   Developed basic frontend pages for listing events and viewing event details.
*   Key files created: `backend/models/event.py`, `backend/routers/events.py`, `frontend/src/app/dashboard/events/page.tsx`, `frontend/src/app/dashboard/events/[eventId]/page.tsx`.

## Sprint 4: Event Participation - Signup & Assignment
*   Enabled users to sign up for events from the frontend.
*   Allowed authorized users to assign/unassign volunteers to events via backend APIs.
*   Created `assignments` collection in Firestore.
*   Key files created/modified: `backend/models/assignment.py`, backend router updates for assignments, frontend UI changes for event signup.

## Sprint 5: Working Group Management - Core CRUD
*   Implemented core CRUD operations for working groups in the backend.
*   Developed basic frontend admin pages for managing working groups.
*   Key files created: `backend/models/working_group.py`, `backend/routers/working_groups.py`, `frontend/src/app/dashboard/admin/working-groups/page.tsx` and related dynamic route pages.

## Sprint 6: Working Group Participation & Availability
*   Implemented backend APIs for managing working group members and user availability.
*   Enhanced frontend user profile to manage availability and display working group memberships.
*   Key files: `backend/models/assignment.py`, `backend/routers/assignments.py`, `backend/main.py`, `frontend/src/app/dashboard/profile/page.tsx`.

## Sprint 7: Donation Tracking & Basic Reporting APIs
*   Implemented backend CRUD for donations and initial API endpoints for volunteer hours and event participation reports.
*   Key files: `backend/models/donation.py`, `backend/routers/donations.py`, `backend/models/report.py`, `backend/routers/reports.py`, `backend/main.py`.

## Sprint 8: Dashboard Enhancements & CI/CD Finalization
*   **Goal:** Refine the user dashboard with personalized information. Finalize CI/CD pipelines.
*   **Current Focus: Dashboard Enhancements & Auth Refinements**
    *   **Backend Updates & Fixes:**
        *   Added `assignableStartDate` to `AssignmentResponse` model (`backend/models/assignment.py`).
        *   Updated `/assignments` router to populate `assignableStartDate` for events.
        *   Corrected RBAC method calls in `assignments.py` from `has_privilege` to `has_permission`.
        *   Corrected `FieldPath` imports in `events.py` and `reports.py`.
        *   Enhanced `delete_event` endpoint in `events.py` to also delete associated assignments.
        *   Created `backend/utils/cleanup_orphan_assignments.py` script.
        *   Updated `backend/README.md` for the cleanup script.
        *   Updated `UserResponse` model (`backend/models/user.py`) to include `privileges: Dict[str, List[str]]` and `isSysadmin: bool`.
        *   Updated user router endpoints (`/users/me`, `/users/{user_id}`) in `backend/routers/users.py` to populate these new fields in `UserResponse`.
        *   Updated `/reports/volunteer-hours/summary` endpoint in `backend/routers/reports.py` to accept an optional `userId` filter.
    *   **Frontend Dashboard & Auth (`frontend/src/app/dashboard/page.tsx`, `frontend/src/context/AuthContext.tsx`, `frontend/src/components/dashboard/DashboardNav.tsx`):**
        *   Enhanced `DashboardPage` with personalized greeting, roles, upcoming events (with date filtering using `assignableStartDate`), active working groups, a "Quick Links" section, and a "My Contributions" card displaying total volunteer hours.
        *   Updated `DashboardNav` with new conditional links (Reports, Invitations, Roles), improved active link styling using `usePathname`, and basic mobile navigation structure.
        *   Corrected query parameter `userId` to `user_id` in `/assignments` API calls from `DashboardPage` to fix authorization error for normal users.
        *   Updated `AuthContext`'s `UserProfile` interface to include `privileges` and `isSysadmin`.
        *   Enhanced `hasPrivilege` function in `AuthContext` to use the detailed `userProfile.privileges` map and `isSysadmin` flag for accurate, granular permission checking.
*   **Files Modified/Created in Sprint 8 (so far):**
    *   `backend/models/assignment.py`
    *   `backend/models/user.py`
    *   `backend/routers/assignments.py`
    *   `backend/routers/events.py`
    *   `backend/routers/reports.py`
    *   `backend/routers/users.py`
    *   `backend/utils/cleanup_orphan_assignments.py` (new file)
    *   `backend/README.md`
    *   `frontend/src/app/dashboard/page.tsx`
    *   `frontend/src/components/dashboard/DashboardNav.tsx`
    *   `frontend/src/context/AuthContext.tsx`
    *   `.Q/projectlog.md`
*   **Next Steps for Dashboard Enhancements:**
    *   Consider adding more stats or refining Quick Links based on the now more accurate `hasPrivilege`.
*   **Next Steps for CI/CD Finalization:**
    *   Update `cloudbuild.yaml`.
*   **Status:** In progress. Dashboard enhancements significantly advanced. Auth system's privilege checking improved.