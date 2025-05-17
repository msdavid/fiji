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
    *   Backend API endpoints for managing working group members. (Verified existing)
    *   Frontend UI for users to update their availability. (Verified existing)
    *   `assignments` collection updated/utilized for working group memberships. (Verified backend logic)
    *   Display user's working group memberships on profile page. (Implemented)
*   **Main Task Areas & Outcomes:**
    *   **Backend (FastAPI & Firestore):**
        *   API endpoints for assigning/revoking working group members in `backend/routers/working_groups.py` were confirmed to be complete and functional.
        *   User profile API in `backend/routers/users.py` and `User` model in `backend/models/user.py` were confirmed to already support detailed availability data.
        *   Created a new router `backend/routers/assignments.py` with a `GET /assignments` endpoint. This endpoint allows fetching assignments (e.g., for the current user, for a specific entity) and enriches the response with the name of the assignable entity.
        *   Updated `backend/models/assignment.py` by adding `assignableName: Optional[str]` to `AssignmentResponse`.
        *   Included the new assignments router in `backend/main.py`.
    *   **Frontend (Next.js & Tailwind UI):**
        *   The User Profile page (`frontend/src/app/dashboard/profile/page.tsx`) was confirmed to have a comprehensive UI for managing availability (general rules and specific date slots).
        *   The User Profile page was enhanced to fetch and display the current user's active working group memberships under a "My Working Groups" section.
*   **Files Modified/Created in Sprint 6:**
    *   `backend/models/assignment.py`
    *   `backend/routers/assignments.py` (new file)
    *   `backend/main.py`
    *   `frontend/src/app/dashboard/profile/page.tsx`
    *   `.Q/projectlog.md`
*   **Status:** Sprint completed.

## Sprint 7: Donation Tracking & Basic Reporting APIs
*   **Goal:** Implement backend CRUD operations for donation tracking. Develop backend API endpoints to provide data for basic reports (e.g., volunteer hours, event participation).
*   **Key Deliverables:**
    *   Backend API endpoints for donation CRUD. (Verified existing)
    *   Backend API endpoints to supply data for reports. (Implemented for volunteer hours & event participation)
*   **Main Task Areas & Outcomes:**
    *   **Backend (FastAPI & Firestore):**
        *   Donation Pydantic models (`backend/models/donation.py`) and CRUD API endpoints (`backend/routers/donations.py`) were verified as complete and functional.
        *   Created `backend/models/report.py` with Pydantic models for `VolunteerHoursSummaryReport` and `EventParticipationSummaryReport`.
        *   Created a new router `backend/routers/reports.py` with two initial endpoints:
            *   `GET /reports/volunteer-hours/summary`: Aggregates and returns total volunteer hours contributed, with a per-user breakdown. Secured by `reports:view_volunteer_hours` permission.
            *   `GET /reports/event-participation/summary`: Aggregates and returns event participation statistics, including participant counts and hours per event, and overall unique volunteer counts. Secured by `reports:view_event_participation` permission.
        *   Included the new reports router in `backend/main.py`.
    *   **Frontend (Next.js & Tailwind UI):**
        *   Reporting UI deferred to a later sprint or to be handled by data export, as per the sprint plan. No frontend tasks undertaken in this sprint for reports.
*   **Files Modified/Created in Sprint 7:**
    *   `backend/models/report.py` (new file)
    *   `backend/routers/reports.py` (new file)
    *   `backend/main.py` (updated to include reports router)
    *   `.Q/projectlog.md`
*   **Status:** Sprint completed.