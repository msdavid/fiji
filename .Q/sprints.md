# Project Fiji - LLM-Assisted Sprint Plan & SRS

## Introduction

This document outlines the Software Requirements Specification (SRS) for Project Fiji, structured as a series of development sprints. You, as a Large Language Model (LLM), will use this document to guide and execute the development process.

**Operational Directives:**
1.  **Sprint Focus:** Process one sprint at a time. Your primary focus for each sprint is its stated **Goal** and **Key Deliverables**.
2.  **Task Execution:** For tasks within each sprint (Backend, Frontend, Infrastructure), you are to:
    *   Generate boilerplate code for API endpoints, data models, or UI components as required.
    *   Write Dockerfile instructions or `cloudbuild.yaml` steps based on specifications.
    *   Suggest implementations for specific logic according to the requirements.
    *   Assist in debugging code snippets when provided.
3.  **Project Logging:** You will maintain a detailed project log in `.Q/projectlog.md`. This log must track:
    *   Completed tasks.
    *   Pending items.
    *   Identified issues and their status.
    *   Key decisions made during development.
    *   Relevant outputs (e.g., code snippets, configuration files, command outputs) with sufficient context to ensure work can be resumed effectively in new sessions.
    You will refer to this log for ongoing progress updates and contextual understanding.
4.  **Sprint Progression:** Upon completion and verification of all tasks for a given sprint, you will prepare to proceed to the next sprint.
5.  **External Reference:** You have access to the original `docs/technical-specs.md` (referred to as "Main SRS"). Consult this document for detailed definitions (e.g., full data models, comprehensive RBAC logic) if further clarification is needed beyond the summaries provided herein.

**Guiding Principles (Reiteration):**
*   **Adherence to Specifications:** Strictly implement functionalities as defined.
*   **Avoid Unnecessary Complexity:** Favor simple, effective solutions.
*   **Iterative Development:** Build and verify sprint by sprint.

---

## Core Technology Stack (Reference)
*   **Backend:** Python (with **`uv`** for project and package management), FastAPI
*   **Frontend:** Next.js (with App Router for **Server-Side Rendering - SSR**), Tailwind UI
*   **Database:** Google Firestore
*   **Authentication:** Firebase Authentication
*   **Deployment:** Google Cloud Run (separate services for frontend and backend)
*   **CI/CD:** Google Cloud Build (single `cloudbuild.yaml` in monorepo, with triggers/steps for backend and frontend)
*   **Repository Structure:** Monorepo (one repository, separate directories `backend` and `frontend` under the `fiji` repo).
*   **GCP Service Authentication:** Application Default Credentials (ADC) for backend services authenticating to Google Cloud services (e.g., Firestore, Firebase Admin SDK) within Google Cloud environments.

---

## Sprint 0: Project Setup & Core Backend Foundations

**Goal:** Establish the monorepo project structure, basic FastAPI application in the `backend` directory, Dockerization, initial CI/CD setup for the backend, and core data models for users and roles. Implement Firebase Authentication setup, initial user invitation/creation logic, and a foundational testing framework for the backend.

**Key Deliverables:**
*   Functional `fiji` monorepo with a `backend` directory containing a basic FastAPI application.
*   Dockerfile for the backend (`backend/Dockerfile`) using `uv`.
*   Initial `cloudbuild.yaml` in the monorepo root (configured for backend build, push to Artifact Registry, manual Cloud Run deploy initially).
*   Firestore `users` and `roles` collections created (manually or via script).
*   Firebase Authentication enabled in the Firebase project.
*   Endpoints for `sysadmin` to manage roles.
*   Endpoints for handling registration invitations.
*   Initial `pytest` testing framework for the backend, with tests for core endpoints (e.g., health, roles).

**Backend Requirements (FastAPI & Firestore - in `backend` directory):**
1.  **Task:** Initialize `fiji` Git monorepo. Create `backend` directory.
2.  **Task:** Set up a basic FastAPI application structure within `backend/`.
    *   Include `backend/main.py`.
    *   Manage dependencies using `uv` (e.g., `uv add fastapi uvicorn firebase-admin python-dotenv pydantic[email]` in `backend/` which will update `backend/pyproject.toml`). Add test dependencies like `pytest pytest-mock httpx` using `uv add --dev ...`.
3.  **Task:** Create `users` collection schema in Firestore (as per Main SRS Section 6.1).
    *   Key fields: `uid`, `email`, `firstName`, `lastName`, `assignedRoleIds`, `status`, `createdAt`, `updatedAt`.
4.  **Task:** Create `roles` collection and the `sysadmin` role document in Firestore.
    *   This is accomplished by running the `backend/utils/initialize_firestore.py` script.
5.  **Task:** Implement Firebase Admin SDK initialization in FastAPI (`backend/`). This initialization should rely on Application Default Credentials (ADC).
6.  **Task:** Create `registrationInvitations` collection schema in Firestore (as per Main SRS Section 6.1).
    *   Key fields: `email`, `token`, `status`, `invitedByUserId`, `rolesToAssignOnRegistration`, `createdAt`, `expiresAt`.
7.  **Task:** Implement API endpoint for `sysadmin` to create registration invitations (`POST /invitations`).
    *   Protected: Requires `sysadmin` role.
8.  **Task:** Implement API endpoint to verify invitation token and register user (`POST /register`).
    *   Logic: Called *after* frontend Firebase Auth user creation. Backend receives Firebase UID, validates invitation, creates Firestore user, assigns roles, updates invitation.
9.  **Task:** Implement Role Management API endpoints (CRUD for `roles` collection - `sysadmin` only).
    *   `POST /roles`, `GET /roles`, `GET /roles/{role_id}`, `PUT /roles/{role_id}`, `DELETE /roles/{role_id}`.
    *   Protected: Requires `sysadmin` role.
10. **Task:** Implement basic authentication dependency (`get_firebase_user`) to verify Firebase ID tokens.
11. **Task:** Set up `pytest` for unit and integration testing of API endpoints.
    *   Create `backend/tests/` directory structure.
    *   Implement `backend/tests/conftest.py` with necessary fixtures, including mocks for Firebase and authentication.
    *   Write initial tests for core endpoints (e.g., `/`, `/health`, `/roles/`).

**Infrastructure/DevOps (Cloud Build, Docker - Backend):**
1.  **Task:** Create `backend/Dockerfile`.
    *   Use Python base image. Install `uv`.
    *   Copy dependency files (`backend/pyproject.toml` and `backend/uv.lock`).
    *   Install dependencies using `uv sync --system --no-dev` (to exclude dev dependencies like pytest in production image).
    *   Copy application code from `backend/`.
    *   Set `CMD` to run Uvicorn.
2.  **Task:** Create initial `cloudbuild.yaml` in the monorepo root.
    *   Configure build triggers for changes in the `backend/` directory.
    *   Step to build Docker image using `backend/Dockerfile`.
    *   Step to push image to Google Artifact Registry.
3.  **Task:** Manually enable Firebase Authentication and Firestore in the Google Cloud Project.
    *   Ensure appropriate IAM permissions for ADC.

---

## Sprint 1: Core Frontend Setup & User Authentication Flow

**Goal:** Establish the frontend project structure in the `frontend` directory of the monorepo, basic Next.js application (using App Router for **SSR**), Dockerization, initial CI/CD for frontend. Implement Firebase SDK, login, registration (using invitation token), and basic dashboard layout with Tailwind UI. Connect frontend auth to backend.

**Key Deliverables:**
*   `frontend` directory in the `fiji` monorepo with a basic Next.js application (using App Router for SSR).
*   Dockerfile for the frontend (`frontend/Dockerfile`).
*   Updated `cloudbuild.yaml` in monorepo root for frontend CI/CD.
*   Login and Registration pages styled with Tailwind UI.
*   Basic authenticated user dashboard placeholder styled with Tailwind UI.
*   Frontend successfully authenticates with Firebase and communicates with backend for registration.

**Frontend Requirements (Next.js with App Router for SSR & Tailwind UI - in `frontend` directory):**
1.  **Task:** Create `frontend` directory in the `fiji` monorepo. (Completed - Re-initialized)
2.  **Task:** Set up a basic Next.js application within `frontend/` using the App Router for SSR. (Completed - Re-initialized with `--app` flag)
    *   Install `firebase` SDK. (Completed)
    *   `tailwindcss`, `postcss`, `autoprefixer` installed via `create-next-app --tailwind`. (Completed)
    *   Tailwind CSS initialized (`tailwind.config.ts`, `postcss.config.js` created) and `globals.css` configured by `create-next-app`. (Completed)
    *   Configure Firebase SDK for frontend.
3.  **Task:** Create Login page (`/login`).
    *   UI: Email and password fields, login button, styled with Tailwind UI.
    *   Logic: Authenticate using Firebase Auth (`signInWithEmailAndPassword`). On success, store ID token and redirect to dashboard.
4.  **Task:** Create Registration page (`/register?token=[invitation_token]`).
    *   UI: Fields for first name, last name, password, confirm password, styled with Tailwind UI.
    *   Logic:
        *   Extract `invitation_token` from URL.
        *   User enters details. Frontend creates user in Firebase Auth (`createUserWithEmailAndPassword`) using the email associated with the token.
        *   On successful Firebase Auth user creation, get Firebase ID token.
        *   Call backend `POST /register` endpoint with ID token in header, and user details.
        *   Redirect to login or dashboard on success.
5.  **Task:** Create a basic authenticated Dashboard page (`/dashboard`).
    *   Protected route: Redirect to `/login` if not authenticated.
    *   Display basic user information, styled with Tailwind UI.
6.  **Task:** Implement context/state management for Firebase user and ID token.
7.  **Task:** Set up environment variable `NEXT_PUBLIC_BACKEND_URL` for backend API communication.
8.  **Task:** Implement utility for making authenticated API calls to the backend.

**Infrastructure/DevOps (Cloud Build, Docker - Frontend):**
1.  **Task:** Create `frontend/Dockerfile`.
    *   Use Node.js base image.
    *   Copy `package.json`, `package-lock.json` (or `yarn.lock`) from `frontend/`.
    *   Install dependencies.
    *   Copy application code from `frontend/`.
    *   Build Next.js app.
    *   Set `CMD` to run Next.js server.
2.  **Task:** Update `cloudbuild.yaml` in monorepo root.
    *   Configure build triggers for changes in the `frontend/` directory.
    *   Step to build Docker image using `frontend/Dockerfile`.
    *   Step to push image to Google Artifact Registry.

---

## Sprint 2: User Profile Management & RBAC Implementation

**(Frontend uses Next.js with App Router for SSR, Tailwind UI)**
**Goal:** Implement backend and frontend for user profile viewing and editing. Implement backend RBAC logic and frontend adjustments based on user roles and permissions.

**Key Deliverables:**
*   Backend API endpoints for users to manage their own profiles and for `sysadmin` to manage any user profile.
*   Frontend UI for profile viewing and editing, styled with Tailwind UI.
*   Backend RBAC dependency that checks user roles/permissions against required privileges for API endpoints.
*   Frontend UI elements dynamically shown/hidden based on user permissions.
*   `sysadmin` ability to assign roles to users.

**Backend Requirements (FastAPI & Firestore - in `backend` directory):**
1.  **Task:** Implement API endpoints for User Profile Management:
    *   `GET /users/me` (Get current authenticated user's profile).
    *   `PUT /users/me` (Update current authenticated user's profile).
    *   `GET /users/{user_id}` (Admin: Get any user's profile).
    *   `PUT /users/{user_id}` (Admin: Update any user's profile, including `assignedRoleIds`).
    *   `GET /users` (Admin: List all users).
2.  **Task:** Implement RBAC Dependency:
    *   Create a FastAPI dependency that:
        *   Retrieves authenticated user's Firebase UID.
        *   Fetches user's `assignedRoleIds` from Firestore.
        *   Fetches corresponding role documents and consolidates privileges.
        *   Checks if the user has the required permission(s) for the endpoint.
        *   Raises HTTP 403 if permission is denied.
3.  **Task:** Protect all relevant API endpoints using the RBAC dependency.
4.  **Task:** Ensure `sysadmin` can assign/unassign roles to users via the `PUT /users/{user_id}` endpoint.

**Frontend Requirements (Next.js with App Router for SSR & Tailwind UI - in `frontend` directory):**
1.  **Task:** Create User Profile page (`/dashboard/profile`):
    *   Display user's own profile information.
    *   Allow editing of their profile information (e.g., name, phone, skills, qualifications), styled with Tailwind UI.
2.  **Task:** Create Admin User Management page (`/dashboard/admin/users`):
    *   List all users.
    *   Allow `sysadmin` to view/edit any user's profile (including assigning roles).
    *   Link to a detail/edit page for each user (`/dashboard/admin/profile/[userId]`).
3.  **Task:** Dynamically render UI elements (e.g., navigation links, buttons) based on fetched user permissions/roles.
    *   For example, "Admin" section in navigation only visible to users with `sysadmin` role or specific admin privileges.
4.  **Task:** Ensure forms for profile editing are styled with Tailwind UI.

---

## Sprint 3: Event Management (Backend & Frontend)

**(Frontend uses Next.js with App Router for SSR, Tailwind UI)**

**Goal:** Implement backend and frontend functionalities for creating, viewing, updating, and deleting events, including assigning organizers. (Note: Project log indicates this sprint is complete).

**Key Deliverables:**
*   Backend API endpoints for CRUD operations on events.
*   Firestore `events` collection schema implemented.
*   Frontend UI for event listing, creation, editing (including deletion), and viewing details.
*   Functionality for users to view events and for authorized users to manage them.
*   Event organizer assignment (user search) and display of creator/organizer names.
*   UX enhancement for event end time defaulting based on start time.

**Backend Requirements (FastAPI & Firestore - in `backend` directory):**
1.  **Task:** Define and implement `events` collection schema in Firestore (as per Main SRS Section 6.1, including `eventName`, `eventType`, `purpose`, `description`, `dateTime`, `endTime`, `venue`, `volunteersRequired`, `status`, `createdByUserId`, `organizerUserId`, `createdAt`, `updatedAt`).
2.  **Task:** Implement API endpoints for event CRUD:
    *   `POST /events` (Create event)
    *   `GET /events` (List all events)
    *   `GET /events/{event_id}` (Get specific event)
    *   `PUT /events/{event_id}` (Update event)
    *   `DELETE /events/{event_id}` (Delete event)
3.  **Task:** Implement logic for assigning `organizerUserId` during event creation/update, potentially using user search.
4.  **Task:** Ensure RBAC is applied to all event management endpoints (e.g., `events:create`, `events:edit`, `events:delete` privileges).
5.  **Task:** Backend logic to support `endTime` defaulting if only `dateTime` is provided or changed.

**Frontend Requirements (Next.js with App Router for SSR & Tailwind UI - in `frontend` directory):**
1.  **Task:** Create pages for event management:
    *   Event listing page (`/dashboard/events`).
    *   New event creation page (`/dashboard/events/new`).
    *   Event detail view page (`/dashboard/events/[eventId]`).
    *   Event editing page (`/dashboard/events/[eventId]/edit`), including a "Delete Event" button/functionality.
2.  **Task:** Implement UI components for event forms (creation/editing) and event display (cards or list items), styled with Tailwind UI.
3.  **Task:** Integrate frontend with backend API endpoints for all event CRUD operations.
4.  **Task:** Implement user search functionality (e.g., a modal or dropdown) for selecting an event organizer from existing users.
5.  **Task:** Display event creator and organizer names on event views.
6.  **Task:** Implement frontend logic for the UX feature where "End Date & Time" defaults to 60 minutes after "Start Date & Time" if the start time is changed, allowing manual override.

---

## Sprint 4: Event Participation & Working Group Management (Initial)

**(Frontend uses Next.js with App Router for SSR, Tailwind UI)**

**Goal:** Implement backend and frontend for managing volunteer participation in events (self-signup, manual assignment) and initial CRUD for Working Groups.

**Key Deliverables:**
*   `assignments` collection in Firestore for tracking event/group participation.
*   Backend API endpoints for event signup, withdrawal, and admin assignment/removal of volunteers.
*   Frontend UI for volunteers to join/leave events and for admins to manage event rosters.
*   Backend API endpoints for basic CRUD operations on working groups.
*   Frontend UI for listing and creating basic working groups.

**Backend Requirements (FastAPI & Firestore - in `backend` directory):**
1.  **Task:** Define and implement `assignments` collection schema in Firestore (as per Main SRS Section 6.1), linking `userId` to `assignableId` (event or working group ID) with `assignableType`.
2.  **Task:** Implement API endpoints for event participation:
    *   `POST /events/{event_id}/signup` (Volunteer self-signup).
    *   `DELETE /events/{event_id}/signup` (Volunteer withdraws).
    *   `POST /events/{event_id}/assign` (Authorized user assigns a volunteer).
    *   `DELETE /events/{event_id}/assign/{user_id}` (Authorized user removes a volunteer).
3.  **Task:** Define and implement `workingGroups` collection schema in Firestore (as per Main SRS Section 6.1).
4.  **Task:** Implement basic API endpoints for Working Group CRUD:
    *   `POST /working-groups`
    *   `GET /working-groups`
    *   `GET /working-groups/{group_id}`
    *   `PUT /working-groups/{group_id}`
    *   `DELETE /working-groups/{group_id}`
5.  **Task:** Implement API endpoints for assigning users to working groups (linking via `assignments` collection).
6.  **Task:** Ensure RBAC for all new endpoints.

**Frontend Requirements (Next.js with App Router for SSR & Tailwind UI - in `frontend` directory):**
1.  **Task:** On the event detail page (`/dashboard/events/[eventId]`):
    *   Display "Sign Up" / "Withdraw" buttons for eligible volunteers.
    *   Display list of currently signed-up/assigned volunteers.
    *   For authorized users, provide UI to search and assign volunteers to the event, and to remove assigned volunteers.
2.  **Task:** Create pages for basic Working Group management:
    *   List working groups (`/dashboard/admin/working-groups` or similar).
    *   Create new working group page.
    *   (Optional this sprint) Edit/View working group detail page.
3.  **Task:** UI for assigning users to working groups.

---

## Sprint 5: User Availability & Donation Tracking

**(Frontend uses Next.js with App Router for SSR, Tailwind UI)**

**Goal:** Implement backend and frontend for volunteers to manage their availability and for authorized users to record and track donations.

**Key Deliverables:**
*   Functionality in user profiles for volunteers to set and update their general and specific availability.
*   `donations` collection in Firestore.
*   Backend API endpoints for CRUD operations on donations.
*   Frontend UI for recording new donations and viewing a list of donations.

**Backend Requirements (FastAPI & Firestore - in `backend` directory):**
1.  **Task:** Enhance `users` Pydantic model and Firestore documents to include `availability` field (e.g., `{ general: String, specificDates: Array }` as per Main SRS Section 6.1).
2.  **Task:** Update user profile API endpoints (`PUT /users/me`, `PUT /users/{user_id}`) to allow modification of availability.
3.  **Task:** Define and implement `donations` collection schema in Firestore (as per Main SRS Section 6.1).
4.  **Task:** Implement API endpoints for Donation CRUD:
    *   `POST /donations`
    *   `GET /donations`
    *   `GET /donations/{donation_id}`
    *   `PUT /donations/{donation_id}`
    *   `DELETE /donations/{donation_id}`
5.  **Task:** Ensure RBAC for donation management.

**Frontend Requirements (Next.js with App Router for SSR & Tailwind UI - in `frontend` directory):**
1.  **Task:** On the user profile page (`/dashboard/profile` and admin view `admin/profile/[userId]`):
    *   Add UI elements (e.g., text areas, date pickers) for users to input/edit their general availability and specific available/unavailable dates.
    *   Ensure changes are saved via the backend API.
2.  **Task:** Create pages for donation tracking:
    *   Form to record a new donation (`/dashboard/donations/new` or similar).
    *   Page to list existing donations (`/dashboard/donations`).
3.  **Task:** Style all new forms and views with Tailwind UI.

---

## Sprint 6: Basic Reporting & Initial Notifications

**(Frontend uses Next.js with App Router for SSR, Tailwind UI)**

**Goal:** Implement initial backend and frontend capabilities for basic reporting (e.g., volunteer hours, event participation) and establish the backend foundation for sending automated notifications.

**Key Deliverables:**
*   Backend API endpoints to provide aggregated data for basic reports.
*   Frontend UI to display these basic reports.
*   Backend logic for sending email notifications for key actions (e.g., event assignment confirmation, event reminders) using Firebase Admin SDK.

**Backend Requirements (FastAPI & Firestore - in `backend` directory):**
1.  **Task:** Develop API endpoints to aggregate and return data for reports:
    *   Total volunteer hours per user (derived from `assignments` collection).
    *   Event participation statistics (e.g., number of volunteers per event, attendance if tracked).
    *   (Optional) Basic donation summaries.
2.  **Task:** Implement email sending functionality using Firebase Admin SDK.
3.  **Task:** Integrate email sending into relevant existing flows:
    *   Send confirmation email upon event assignment/signup.
    *   (Future/Stretch) Logic for scheduled event reminders (may require a separate trigger mechanism like Cloud Scheduler, or be a manual admin action initially).
4.  **Task:** Ensure sensitive data is handled appropriately in reports and RBAC is applied to reporting endpoints.

**Frontend Requirements (Next.js with App Router for SSR & Tailwind UI - in `frontend` directory):**
1.  **Task:** Create new pages/sections in the dashboard for reports:
    *   A page to display a summary of volunteer hours (e.g., for the logged-in user or an overview for admins).
    *   A page to display basic event participation reports.
2.  **Task:** Present report data clearly using tables or simple charts, styled with Tailwind UI.
3.  **Task:** (No direct frontend for *sending* notifications, but UI should reflect actions that trigger them, e.g., a successful event signup message).

---

## Sprint 7: Advanced Reporting, Availability Conflict & UI Refinements

**(Frontend uses Next.js with App Router for SSR, Tailwind UI)**

**Goal:** Enhance reporting capabilities, introduce basic availability conflict detection, and perform general UI/UX refinements across the application.

**Key Deliverables:**
*   More detailed reports, potentially with filtering/sorting and CSV export functionality.
*   Basic UI/logic to indicate potential conflicts between a volunteer's availability and event assignments.
*   Overall improvements to application usability and visual polish.

**Backend Requirements (FastAPI & Firestore - in `backend` directory):**
1.  **Task:** Enhance reporting API endpoints:
    *   Add filtering options (e.g., by date range, event type).
    *   Implement CSV export functionality for selected reports.
2.  **Task:** Develop API endpoint(s) to help detect availability conflicts:
    *   E.g., `GET /users/{user_id}/availability-check?dateRangeStart={date}&dateRangeEnd={date}` which returns events the user is assigned to vs. their stated unavailability.
3.  **Task:** Review and optimize existing queries for performance, especially for reporting.

**Frontend Requirements (Next.js with App Router for SSR & Tailwind UI - in `frontend` directory):**
1.  **Task:** Improve reporting views:
    *   Add UI controls for filtering and sorting report data.
    *   Implement a "Download CSV" button for relevant reports.
2.  **Task:** Integrate availability conflict information:
    *   When assigning a volunteer to an event, or on a volunteer's schedule view, display a warning if there's a known conflict with their stated unavailability.
3.  **Task:** Conduct a general review of the application for UI/UX consistency and areas for improvement. Implement refinements (e.g., better feedback messages, clearer navigation, improved form layouts) using Tailwind UI.

---

## Sprint 8: Dashboard Enhancements & CI/CD Finalization

**Goal:** Refine the user dashboard with Tailwind UI, finalize CI/CD pipelines in the monorepo `cloudbuild.yaml` for both frontend and backend including tests and linting, and ensure environment configurations are robust.

**Key Deliverables:**
*   Enhanced user dashboard with personalized information, styled with Tailwind UI.
*   Complete `cloudbuild.yaml` in the monorepo root, including linting, testing, and automated deployment to Cloud Run for both backend and frontend.
*   All necessary environment variables configured for Cloud Run services.

**Frontend Requirements (Next.js with App Router for SSR & Tailwind UI):**
1.  **Task:** Enhance User Dashboard (`/dashboard`):
    *   Display personalized information based on user role(s).
    *   Quick access to upcoming events, current assignments, and recent notifications.
    *   Basic visual representation of volunteer hours/contributions.
    *   Ensure styling is consistent with Tailwind UI.

**Infrastructure/DevOps (Cloud Build, Docker - Monorepo):**
1.  **Task:** Finalize `cloudbuild.yaml` in the monorepo root.
    *   **Backend Steps:**
        *   Add steps for linting and running `pytest` tests (using `uv run pytest`) before build, triggered by changes in `backend/`.
        *   Ensure automated deployment to Cloud Run (backend service) is configured correctly.
    *   **Frontend Steps:**
        *   Add steps for linting and running tests before build, triggered by changes in `frontend/`.
        *   Ensure automated deployment to Cloud Run (frontend service) is configured correctly.
2.  **Task:** Verify environment variable setup for both Cloud Run services.
    *   Consider using Google Secret Manager for sensitive backend environment variables.

---

## Sprint 9: Testing, Review, Refinements & Documentation

**(Mention `uv` in README setup instructions for backend, Next.js with App Router for SSR and Tailwind UI for frontend)**

**Goal:** Conduct thorough testing, code reviews, performance checks, and finalize documentation for the monorepo project.

**Key Deliverables:**
*   Well-tested application.
*   Codebase reviewed and refined.
*   Basic user documentation/help text if necessary.
*   Comprehensive `README.md` in the monorepo root, and specific READMEs in `backend/` and `frontend/` directories.

**All Components (Backend, Frontend, Infrastructure - Monorepo context):**
1.  **Task:** Conduct thorough End-to-End (E2E) testing of all user flows.
2.  **Task:** Perform code reviews for major components in both `backend/` and `frontend/`.
3.  **Task:** Check performance against desirable targets (Main SRS Section 5.1).
4.  **Task:** Review and improve inline code documentation and comments in both `backend/` and `frontend/`.
5.  **Task:** Create a main `README.md` for the `fiji` monorepo with an overview, setup instructions for local development (mentioning `uv` for backend setup, and standard Node.js/npm/yarn for frontend with Next.js App Router for SSR), and how to run both services.
6.  **Task:** (Optional) Write basic user guide snippets for key functionalities.
7.  **Task:** Final check of security best practices.

---

This sprint plan provides your structured approach for developing Project Fiji. You are expected to adapt and adjust tasks within sprints as development progresses and new insights are gained, always aligning with the project goals.