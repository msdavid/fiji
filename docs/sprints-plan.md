# Project Fiji - Development Sprint Plan

This document outlines the planned development sprints for Project Fiji. It provides a high-level overview of the goals, key deliverables, and main areas of work for each sprint.

**Core Technology Stack Reference:**
*   **Backend:** Python, FastAPI (using `uv` for package management)
*   **Frontend:** Next.js, Tailwind UI
*   **Database:** Google Firestore
*   **Authentication:** Firebase Authentication
*   **Deployment:** Google Cloud Run (separate services for frontend and backend)
*   **CI/CD:** Google Cloud Build (single `cloudbuild.yaml` in monorepo)
*   **Repository Structure:** Monorepo (`fiji/backend` and `fiji/frontend`)
*   **GCP Service Authentication:** Application Default Credentials (ADC)

---

## Sprint 0: Project Setup & Core Backend Foundations (Completed)

*   **Goal:** Establish the monorepo project structure, basic FastAPI application in the `backend` directory, Dockerization, initial CI/CD setup for the backend, and core data models for users and roles. Implement Firebase Authentication setup and initial user invitation/creation logic. Establish a testing framework for the backend.
*   **Key Deliverables:**
    *   Functional `fiji` monorepo with a `backend` directory containing a basic FastAPI application.
    *   Dockerfile for the backend (`backend/Dockerfile`).
    *   Initial `cloudbuild.yaml` in the monorepo root (for backend CI).
    *   Firestore `users` and `roles` collections created (with `sysadmin` role).
    *   Firebase Authentication enabled in the Firebase project.
    *   API endpoints for `sysadmin` to manage roles.
    *   API endpoints for handling registration invitations and user registration.
    *   Initial `pytest` testing framework for the backend, with tests for core endpoints (e.g., health, roles).
*   **Main Task Areas:**
    *   **Backend (FastAPI & Firestore):**
        *   Initialize project and FastAPI app structure.
        *   Define Firestore schemas for `users`, `roles`, `registrationInvitations`.
        *   Implement Firebase Admin SDK initialization.
        *   Develop API endpoints for:
            *   Role management (CRUD).
            *   Registration invitation creation.
            *   User registration via invitation.
        *   Implement basic authentication dependency for Firebase ID tokens.
        *   Set up `pytest` for unit and integration testing of API endpoints, including mocking dependencies.
    *   **Infrastructure/DevOps (Backend):**
        *   Create `backend/Dockerfile` using `uv`.
        *   Create initial `cloudbuild.yaml` for backend builds and pushes to Artifact Registry.
        *   Ensure Firebase Authentication and Firestore are enabled in GCP.

---

## Sprint 1: Core Frontend Setup & User Authentication Flow

*   **Goal:** Establish the frontend project structure in the `frontend` directory, basic Next.js application, Dockerization, and initial CI/CD for the frontend. Implement Firebase SDK, login, registration (using invitation token), and a basic dashboard layout with Tailwind UI. Connect frontend authentication to the backend.
*   **Key Deliverables:**
    *   `frontend` directory with a basic Next.js application.
    *   Dockerfile for the frontend (`frontend/Dockerfile`).
    *   Updated `cloudbuild.yaml` for frontend CI/CD.
    *   Login and Registration pages styled with Tailwind UI.
    *   Basic authenticated user dashboard placeholder styled with Tailwind UI.
    *   Frontend successfully authenticates with Firebase and communicates with the backend for registration.
*   **Main Task Areas:**
    *   **Frontend (Next.js & Tailwind UI):**
        *   Initialize Next.js application and configure Tailwind CSS.
        *   Integrate Firebase SDK for frontend authentication.
        *   Develop Login page with Firebase email/password authentication.
        *   Develop Registration page to handle invitation tokens, Firebase user creation, and backend registration call.
        *   Create a basic authenticated Dashboard page.
        *   Implement state management for Firebase user/token.
        *   Set up environment variables for backend API communication.
        *   Create utility for making authenticated API calls.
    *   **Infrastructure/DevOps (Frontend):**
        *   Create `frontend/Dockerfile`.
        *   Update `cloudbuild.yaml` for frontend builds and pushes to Artifact Registry.

---

## Sprint 2: User Profile Management & RBAC Implementation

*   **Goal:** Implement user profile viewing and editing on the frontend. Enhance backend RBAC by creating a dependency that checks user privileges against Firestore roles. Secure backend endpoints using this RBAC dependency.
*   **Key Deliverables:**
    *   User Profile page on the frontend allowing users to view/edit their information.
    *   Backend RBAC dependency (`require_privilege`) implemented.
    *   Core backend API endpoints (roles, invitations, user management) secured with the RBAC dependency.
*   **Main Task Areas:**
    *   **Backend (FastAPI & Firestore):**
        *   Develop `get_user_privileges` utility.
        *   Create `require_privilege` dependency for RBAC.
        *   Implement API endpoints for user profile management (GET, PUT own profile).
        *   Secure existing and new endpoints using `require_privilege`.
    *   **Frontend (Next.js & Tailwind UI):**
        *   Develop User Profile page (view and edit).
        *   Integrate with backend API for profile data.

---

## Sprint 3: Event Management - Core CRUD & Basic Listing

*   **Goal:** Implement core CRUD (Create, Read, Update, Delete) operations for events in the backend. Develop basic frontend pages for listing events and viewing event details.
*   **Key Deliverables:**
    *   Backend API endpoints for event CRUD.
    *   Frontend page for listing events.
    *   Frontend page for viewing event details.
*   **Main Task Areas:**
    *   **Backend (FastAPI & Firestore):**
        *   Define Pydantic models for events.
        *   Implement CRUD API endpoints for events, secured by RBAC.
    *   **Frontend (Next.js & Tailwind UI):**
        *   Develop Event Listing page.
        *   Develop Event Detail page.
        *   (Event creation/edit UI deferred to a later sprint).

---

## Sprint 4: Event Participation - Signup & Assignment

*   **Goal:** Enable users to sign up for events from the frontend. Allow authorized users (e.g., event managers) to assign/unassign volunteers to events via backend APIs (frontend admin UI for this deferred).
*   **Key Deliverables:**
    *   Frontend functionality for users to sign up for/withdraw from events.
    *   Backend API endpoints for event sign-up, withdrawal, and administrative assignment/unassignment.
    *   `assignments` collection in Firestore to track participation.
*   **Main Task Areas:**
    *   **Backend (FastAPI & Firestore):**
        *   Define Pydantic models for assignments.
        *   Implement API endpoints for:
            *   User event sign-up/withdrawal.
            *   Admin assignment/revocation of volunteers.
        *   Secure endpoints with RBAC.
    *   **Frontend (Next.js & Tailwind UI):**
        *   Add sign-up/withdraw buttons to Event Detail/Listing pages.
        *   Display user's current event assignments (e.g., on dashboard or profile).

---

## Sprint 5: Working Group Management - Core CRUD

*   **Goal:** Implement core CRUD operations for working groups in the backend. Develop basic frontend admin pages for managing working groups (listing, creating, editing - if time permits, otherwise focus on backend).
*   **Key Deliverables:**
    *   Backend API endpoints for working group CRUD.
    *   (Potentially) Basic frontend admin UI for working group management.
*   **Main Task Areas:**
    *   **Backend (FastAPI & Firestore):**
        *   Define Pydantic models for working groups.
        *   Implement CRUD API endpoints for working groups, secured by RBAC.
    *   **Frontend (Next.js & Tailwind UI):**
        *   (If time allows) Develop basic admin pages for working group management.

---

## Sprint 6: Working Group Participation & Availability

*   **Goal:** Enable authorized users to assign/unassign members to working groups via backend APIs. Allow users to specify their availability on their profile.
*   **Key Deliverables:**
    *   Backend API endpoints for managing working group members.
    *   Frontend UI for users to update their availability.
    *   `assignments` collection updated to handle working group memberships.
*   **Main Task Areas:**
    *   **Backend (FastAPI & Firestore):**
        *   Implement API endpoints for assigning/revoking working group members.
        *   Update user profile API to handle availability data.
    *   **Frontend (Next.js & Tailwind UI):**
        *   Enhance User Profile page to include availability management.
        *   Display user's working group memberships.

---

## Sprint 7: Donation Tracking & Basic Reporting APIs

*   **Goal:** Implement backend CRUD operations for donation tracking. Develop backend API endpoints to provide data for basic reports (e.g., volunteer hours, event participation).
*   **Key Deliverables:**
    *   Backend API endpoints for donation CRUD.
    *   Backend API endpoints to supply data for reports.
*   **Main Task Areas:**
    *   **Backend (FastAPI & Firestore):**
        *   Define Pydantic models for donations.
        *   Implement CRUD API endpoints for donations, secured by RBAC.
        *   Develop API endpoints to aggregate and return data for reports.
    *   **Frontend (Next.js & Tailwind UI):**
        *   (Reporting UI deferred to a later sprint or handled by data export).

---

## Sprint 8: Dashboard Enhancements & CI/CD Finalization

*   **Goal:** Refine the user dashboard with personalized information. Finalize CI/CD pipelines in `cloudbuild.yaml` for both frontend and backend, including linting, testing, and automated deployment.
*   **Key Deliverables:**
    *   Enhanced user dashboard on the frontend.
    *   Complete `cloudbuild.yaml` with automated CI/CD for both services.
    *   Environment variables configured for Cloud Run.
*   **Main Task Areas:**
    *   **Frontend (Next.js & Tailwind UI):**
        *   Enhance User Dashboard with dynamic content based on role and activity.
    *   **Infrastructure/DevOps (Monorepo):**
        *   Finalize `cloudbuild.yaml`:
            *   Add linting and testing steps for backend (using `uv` and `pytest`).
            *   Add linting and testing steps for frontend.
            *   Automate deployment to Cloud Run for both services.
        *   Verify environment variable setup, potentially using Google Secret Manager.

---

## Sprint 9: Testing, Review, Refinements & Documentation

*   **Goal:** Conduct thorough testing (E2E), code reviews, performance checks, and finalize all project documentation.
*   **Key Deliverables:**
    *   Well-tested application.
    *   Reviewed and refined codebase.
    *   Comprehensive `README.md` files (root, backend, frontend).
    *   (Optional) Basic user guide snippets.
*   **Main Task Areas:**
    *   **All Components (Backend, Frontend, Infrastructure):**
        *   Perform E2E testing of all user flows.
        *   Conduct code reviews.
        *   Check performance against targets.
        *   Improve inline code documentation.
        *   Create/update `README.md` files with setup, development, and operational instructions.
        *   Final security best practices check.

---