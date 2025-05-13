# Project Fiji - Progress Log

## Sprint 0: Project Setup & Core Backend Foundations
**Status:** Completed
**Summary:** Established monorepo, basic FastAPI backend with Docker, initial CI/CD for backend. Core data models for users and roles implemented. Firebase Auth setup, user invitation/creation logic, and backend testing framework initiated. `sysadmin` role and basic role management endpoints are functional.

## Sprint 1: Core Frontend Setup & User Authentication Flow
**Status:** Completed
**Summary:** Frontend Next.js application (SSR with App Router) established in monorepo. Dockerfile and CI/CD for frontend created. Login and Registration pages (using invitation token) implemented with Tailwind UI. Basic authenticated dashboard placeholder created. Frontend successfully authenticates with Firebase and communicates with backend for registration.

## Sprint 2: User Profile Management & RBAC Implementation
**Status:** Completed
**Summary:** Backend and frontend for user profile viewing and editing (self and admin) implemented. Backend RBAC dependency created and applied to protect API endpoints. Frontend UI elements dynamically shown/hidden based on user permissions. `sysadmin` can assign roles to users. Skills/qualifications fields updated to use multi-line text input.

## Sprint 3: Event Management (Backend & Frontend)
**Status:** Completed
**Summary:** Backend API endpoints for CRUD operations on events implemented, including `endTime` logic. Firestore `events` collection schema updated. Frontend UI for event listing, creation, editing, and viewing details developed. Functionality for users to view events and for authorized users to manage them (including organizer assignment with user search, and event deletion) is in place. Creator and organizer names are displayed. UX for event end time defaulting based on start time implemented.

## Sprint 4: Event Participation & Working Group Management (Initial)
**Status:** Completed
**Summary:**
*   **Backend:**
    *   `assignments` collection schema finalized and Pydantic models created.
    *   API endpoints for event participation implemented:
        *   Volunteer self-signup (`POST /events/{event_id}/signup`) and withdrawal (`DELETE /events/{event_id}/signup`).
        *   Admin management of event assignments: list (`GET /events/{event_id}/assignments`), create (`POST /events/{event_id}/assignments`), update (`PUT /events/{event_id}/assignments/{assignment_id}`), and delete (`DELETE /events/{event_id}/assignments/{assignment_id}`).
    *   `workingGroups` collection schema defined and Pydantic models created.
    *   API endpoints for Working Group CRUD implemented (`POST, GET, PUT, DELETE /working-groups`). Deleting a group also deletes its assignments.
    *   API endpoints for assigning/removing users to/from working groups implemented (`POST, GET, DELETE /working-groups/{group_id}/assignments`).
    *   RBAC protection applied to all new endpoints (e.g., `events:manage_assignments`, `working_groups:create`, `working_groups:manage_assignments`).
    *   Backend tests written for all new functionalities.
*   **Frontend:**
    *   Event detail page enhanced to allow users to sign up for or withdraw from events.
    *   Event detail page now includes a section for authorized users to manage event rosters (list assigned volunteers, assign new volunteers by ID, remove assigned volunteers).
    *   New pages created for working group management:
        *   List working groups (`/dashboard/admin/working-groups`).
        *   Create new working group (`/dashboard/admin/working-groups/new`).
        *   Working group detail page (`/dashboard/admin/working-groups/[groupId]`) displaying group information and allowing authorized users to manage members (list, assign by ID, remove).
*   **Documentation:** SRS and technical specifications updated to reflect new features and API endpoints.

---
*(Upcoming Sprints: Sprint 5: User Availability & Donation Tracking, Sprint 6: Basic Reporting & Initial Notifications, etc.)*