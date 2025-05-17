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
*   Added `Event` model, router, and basic frontend views.
*   Secured event endpoints with RBAC.

## Sprint 4: Event Participation - Signup & Assignment
*   Enabled users to sign up for events from the frontend.
*   Allowed authorized users to assign/unassign volunteers to events via backend APIs.
*   Created `assignments` collection in Firestore.
*   Key files created/modified: `backend/models/assignment.py`, relevant backend router updates for assignments, frontend UI changes for event signup.
*   Updated `Event` model to include `participant_count`.
*   Added `Assignment` model and related logic for event sign-ups and admin assignments.
*   Frontend updated to allow users to sign up/withdraw from events.
*   Backend endpoints for assignment management created and secured.

## Sprint 5: Working Group Management - Core CRUD
*   Implemented core CRUD operations for working groups in the backend.
*   Developed basic frontend admin pages for managing working groups.
*   Key files created: `backend/models/working_group.py`, `backend/routers/working_groups.py`, `frontend/src/app/dashboard/admin/working-groups/page.tsx` and related dynamic route pages.
*   Defined `WorkingGroup` Pydantic model.
*   Implemented CRUD API endpoints for working groups in `backend/routers/working_groups.py`, secured by RBAC.
*   Developed frontend pages for listing, creating, viewing, and editing working groups under `/dashboard/admin/working-groups`.
*   Added tests for working group CRUD operations in `backend/tests/test_working_groups.py`.
*   Updated `DashboardNav.tsx` to include a link to "Working Groups" under "Admin" for users with `manage_working_groups` privilege.

## Sprint 6: Working Group Participation & Availability
*   **Goal:** Enable authorized users to assign/unassign members to working groups via backend APIs. Allow users to specify their availability on their profile.
*   **Key Deliverables:**
    *   Backend API endpoints for managing working group members.
    *   Frontend UI for users to update their availability.
    *   `assignments` collection updated/utilized for working group memberships.
*   **Main Task Areas:**
    *   **Backend (FastAPI & Firestore):**
        *   Implement API endpoints for assigning/revoking working group members.
        *   Update user profile API to handle availability data.
    *   **Frontend (Next.js & Tailwind UI):**
        *   Enhance User Profile page to include availability management.
        *   Display user's working group memberships.
*   **Current Status:** Sprint started.
