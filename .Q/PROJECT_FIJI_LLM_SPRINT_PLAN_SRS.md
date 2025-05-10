# Project Fiji - LLM-Assisted Sprint Plan & SRS

**Version:** 1.4 (Updated for Tailwind UI, monorepo structure, `uv`, project log tracking, and log detail)
**Date:** {{YYYY-MM-DD}} (Auto-fill with current date)

## Introduction

This document outlines the Software Requirements Specification (SRS) for Project Fiji, structured as a series of development sprints. It is designed to be used in collaboration with a Large Language Model (LLM) to assist in the development process.

**How to Use This Document with an LLM:**
1.  Address one sprint at a time.
2.  For each sprint, review the **Goal** and **Key Deliverables**.
3.  For tasks within a sprint (Backend, Frontend, Infrastructure), you can ask the LLM to:
    *   Generate boilerplate code for API endpoints, data models, or UI components.
    *   Write Dockerfile instructions or `cloudbuild.yaml` steps.
    *   Suggest implementations for specific logic based on the requirements.
    *   Help debug code snippets.
4.  The LLM will maintain a project log in `.Q/projectlog.md`. This log will track completed tasks, pending items, issues, key decisions, and relevant outputs with sufficient context to allow work to be resumed effectively in new sessions. Refer to this log for progress updates and context.
5.  After completing the tasks for a sprint and verifying them, proceed to the next sprint.
6.  This document assumes the LLM has access to the original `docs/technical-specs.md` (referred to as "Main SRS") for detailed definitions (e.g., full data models, comprehensive RBAC logic) if further clarification is needed beyond what's summarized here.

**Guiding Principles (Reiteration):**
*   **Adherence to Specifications:** Strictly implement functionalities as defined.
*   **Avoid Unnecessary Complexity:** Favor simple, effective solutions.
*   **Iterative Development:** Build and verify sprint by sprint.

---

## Core Technology Stack (Reference)
*   **Backend:** Python (with **`uv`** for project and package management), FastAPI
*   **Frontend:** Next.js, Tailwind UI
*   **Database:** Google Firestore
*   **Authentication:** Firebase Authentication
*   **Deployment:** Google Cloud Run (separate services for frontend and backend)
*   **CI/CD:** Google Cloud Build (single `cloudbuild.yaml` in monorepo, with triggers/steps for backend and frontend)
*   **Repository Structure:** Monorepo (one repository, separate directories `backend` and `frontend` under the `fiji` repo).

---

## Sprint 0: Project Setup & Core Backend Foundations

**Goal:** Establish the monorepo project structure, basic FastAPI application in the `backend` directory, Dockerization, initial CI/CD setup for the backend, and core data models for users and roles. Implement Firebase Authentication setup and initial user invitation/creation logic.

**Key Deliverables:**
*   Functional `fiji` monorepo with a `backend` directory containing a basic FastAPI application.
*   Dockerfile for the backend (`backend/Dockerfile`) using `uv`.
*   Initial `cloudbuild.yaml` in the monorepo root (configured for backend build, push to Artifact Registry, manual Cloud Run deploy initially).
*   Firestore `users` and `roles` collections created (manually or via script).
*   Firebase Authentication enabled in the Firebase project.
*   Endpoints for `sysadmin` to manage roles.
*   Endpoints for handling registration invitations.

**Backend Requirements (FastAPI & Firestore - in `backend` directory):**
1.  **Task:** Initialize `fiji` Git monorepo. Create `backend` directory.
2.  **Task:** Set up a basic FastAPI application structure within `backend/`.
    *   Include `backend/main.py`.
    *   Manage dependencies using `uv` (e.g., `uv add fastapi uvicorn firebase-admin python-dotenv` in `backend/` which will update `backend/pyproject.toml`, or `uv pip install ...` potentially with a `backend/requirements.txt` if preferred for Docker).
3.  **Task:** Create `users` collection schema in Firestore (as per Main SRS Section 6.1).
    *   Key fields: `uid`, `email`, `firstName`, `lastName`, `assignedRoleIds`, `status`, `createdAt`, `updatedAt`.
4.  **Task:** Create `roles` collection schema in Firestore (as per Main SRS Section 6.1).
    *   Key fields: `roleName`, `description`, `privileges` (map), `isSystemRole`.
    *   Manually add a `sysadmin` role document with `isSystemRole: true` and appropriate privileges (e.g., `{"roles": ["create", "view", "edit", "delete"], "users": ["create", "view", "edit", "delete"], "registrationInvitations": ["create", "view", "delete"]}`).
5.  **Task:** Implement Firebase Admin SDK initialization in FastAPI (`backend/`).
6.  **Task:** Create `registrationInvitations` collection schema in Firestore (as per Main SRS Section 6.1).
    *   Key fields: `email`, `token`, `status`, `invitedByUserId`, `rolesToAssignOnRegistration`, `createdAt`, `expiresAt`.
7.  **Task:** Implement API endpoint for `sysadmin` to create registration invitations (`POST /invitations`).
    *   Request: `{ "email": "invitee@example.com", "rolesToAssign": ["role_id_1"] }`
    *   Logic: Generate unique token, store invitation, (optionally send email - defer actual email sending to a later sprint).
    *   Protected: Requires `sysadmin` role.
8.  **Task:** Implement API endpoint to verify invitation token and register user (`POST /register`).
    *   Request: `{ "token": "unique_token", "firstName": "John", "lastName": "Doe", "password": "securepassword" }` (Password handled by Firebase Auth on frontend, backend receives user details after Firebase user creation).
    *   Logic:
        *   This endpoint is called *after* the frontend has created the user in Firebase Auth using the email from a validated invitation.
        *   Backend receives Firebase UID (from verified ID token), `firstName`, `lastName`.
        *   Validates the token from `registrationInvitations` (if a secondary check is desired or if token is passed).
        *   Creates user document in Firestore `users` collection, links `uid` to Firebase Auth UID.
        *   Assigns roles from `rolesToAssignOnRegistration` (from the invitation).
        *   Updates invitation status to "accepted".
9.  **Task:** Implement Role Management API endpoints (CRUD for `roles` collection - `sysadmin` only).
    *   `POST /roles`
    *   `GET /roles`, `GET /roles/{role_id}`
    *   `PUT /roles/{role_id}`
    *   `DELETE /roles/{role_id}`
    *   Protected: Requires `sysadmin` role.
10. **Task:** Implement basic authentication dependency (`get_firebase_user`) to verify Firebase ID tokens.

**Infrastructure/DevOps (Cloud Build, Docker - Backend):**
1.  **Task:** Create `backend/Dockerfile`.
    *   Use Python base image. Install `uv`.
    *   Copy dependency files (`backend/pyproject.toml` and `backend/uv.lock`, or `backend/requirements.txt`).
    *   Install dependencies using `uv pip install --system -r requirements.txt` or `uv sync --system`. (Use `--system` to install into the system Python environment in the Docker image).
    *   Copy application code from `backend/`.
    *   Set `CMD` to run Uvicorn.
    *   *Conceptual Dockerfile using `uv pip install` with `requirements.txt`:*
        ```dockerfile
        # In backend/Dockerfile
        FROM python:3.10-slim
        RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
            ln -s /root/.cargo/bin/uv /usr/local/bin/uv
        WORKDIR /app
        COPY requirements.txt . 
        RUN uv pip install --no-cache --system -r requirements.txt
        COPY . .
        CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
        ```
2.  **Task:** Create initial `cloudbuild.yaml` in the monorepo root.
    *   Configure build triggers for changes in the `backend/` directory.
    *   Step to build Docker image using `backend/Dockerfile`.
    *   Step to push image to Google Artifact Registry.
    *   (Deployment to Cloud Run step can be added and tested manually first, then automated).
3.  **Task:** Manually enable Firebase Authentication and Firestore in the Google Cloud Project.

---

## Sprint 1: Core Frontend Setup & User Authentication Flow

**(No changes related to `uv` in this sprint's description for frontend)**

**Goal:** Establish the frontend project structure in the `frontend` directory of the monorepo, basic Next.js application, Dockerization, initial CI/CD for frontend. Implement Firebase SDK, login, registration (using invitation token), and basic dashboard layout with Tailwind UI. Connect frontend auth to backend.

**Key Deliverables:**
*   `frontend` directory in the `fiji` monorepo with a basic Next.js application.
*   Dockerfile for the frontend (`frontend/Dockerfile`).
*   Updated `cloudbuild.yaml` in monorepo root for frontend CI/CD.
*   Login and Registration pages styled with Tailwind UI.
*   Basic authenticated user dashboard placeholder styled with Tailwind UI.
*   Frontend successfully authenticates with Firebase and communicates with backend for registration.

**Frontend Requirements (Next.js & Tailwind UI - in `frontend` directory):**
1.  **Task:** Create `frontend` directory in the `fiji` monorepo.
2.  **Task:** Set up a basic Next.js application within `frontend/`.
    *   Install `firebase` SDK, `tailwindcss`, `postcss`, `autoprefixer`.
    *   Initialize Tailwind CSS: `npx tailwindcss init -p`.
    *   Configure `tailwind.config.js` and `postcss.config.js`.
    *   Import Tailwind directives in `globals.css`.
    *   Configure Firebase SDK for frontend.
3.  **Task:** Create Login page (`/login`).
    *   UI: Email and password fields, login button, styled with Tailwind UI.
    *   Logic: Authenticate using Firebase Auth (`signInWithEmailAndPassword`). On success, store ID token and redirect to dashboard.
4.  **Task:** Create Registration page (`/register?token=[invitation_token]`).
    *   UI: Fields for first name, last name, password, confirm password, styled with Tailwind UI.
    *   Logic:
        *   Extract `invitation_token` from URL.
        *   (Optional: Frontend calls a backend endpoint to pre-validate token and get associated email).
        *   User enters details. Frontend creates user in Firebase Auth (`createUserWithEmailAndPassword`) using the email associated with the token.
        *   On successful Firebase Auth user creation, get Firebase ID token.
        *   Call backend `POST /register` endpoint with ID token in header, and user details (firstName, lastName, original invitation_token if needed by backend).
        *   Redirect to login or dashboard on success.
5.  **Task:** Create a basic authenticated Dashboard page (`/dashboard`).
    *   Protected route: Redirect to `/login` if not authenticated.
    *   Display basic user information (e.g., email from Firebase Auth), styled with Tailwind UI.
6.  **Task:** Implement context/state management for Firebase user and ID token.
7.  **Task:** Set up environment variable `NEXT_PUBLIC_BACKEND_URL` for backend API communication.
8.  **Task:** Implement utility for making authenticated API calls to the backend (attaching Bearer token).

**Infrastructure/DevOps (Cloud Build, Docker - Frontend):**
1.  **Task:** Create `frontend/Dockerfile`.
    *   Use Node.js base image.
    *   Copy `package.json`, `yarn.lock`/`package-lock.json` from `frontend/`.
    *   Install dependencies.
    *   Copy application code from `frontend/`.
    *   Build Next.js app (`yarn build` or `npm run build`).
    *   Set `CMD` to run Next.js server (`yarn start` or `npm start` or `node server.js` if using standalone output).
2.  **Task:** Update `cloudbuild.yaml` in monorepo root.
    *   Configure build triggers for changes in the `frontend/` directory.
    *   Step to build Docker image using `frontend/Dockerfile`.
    *   Step to push image to Google Artifact Registry.
    *   (Deployment to Cloud Run step can be added and tested manually first).

---

## Sprint 2: User Profile Management & RBAC Implementation

**(No changes related to `uv` in this sprint's description, frontend uses Tailwind UI)**
... (rest of the content remains the same as previous version for Sprints 2-7, ensuring frontend tasks mention Tailwind UI for styling) ...

---

## Sprint 8: Dashboard Enhancements & CI/CD Finalization

**Goal:** Refine the user dashboard with Tailwind UI, finalize CI/CD pipelines in the monorepo `cloudbuild.yaml` for both frontend and backend including tests and linting, and ensure environment configurations are robust.

**Key Deliverables:**
*   Enhanced user dashboard with personalized information, styled with Tailwind UI.
*   Complete `cloudbuild.yaml` in the monorepo root, including linting, testing, and automated deployment to Cloud Run for both backend and frontend.
*   All necessary environment variables configured for Cloud Run services.

**Frontend Requirements (Next.js & Tailwind UI):**
1.  **Task:** Enhance User Dashboard (`/dashboard`):
    *   Display personalized information based on user role(s).
    *   Quick access to upcoming events, current assignments, and recent notifications.
    *   Basic visual representation of volunteer hours/contributions (e.g., simple stats or charts if feasible).
    *   Ensure styling is consistent with Tailwind UI.

**Infrastructure/DevOps (Cloud Build, Docker - Monorepo):**
1.  **Task:** Finalize `cloudbuild.yaml` in the monorepo root.
    *   **Backend Steps:**
        *   Add steps for linting (e.g., Flake8) and running tests (e.g., Pytest) before build, triggered by changes in `backend/`. If these steps require installing dependencies, use `uv`.
            *   *Conceptual `cloudbuild.yaml` step for linting with `uv` (ensure paths are relative to monorepo root or use `dir`):*
                ```yaml
                - name: 'python:3.10-slim' # Or a custom image with uv pre-installed
                  entrypoint: 'bash'
                  args:
                    - '-c'
                    - |
                      curl -LsSf https://astral.sh/uv/install.sh | sh
                      export PATH="/root/.cargo/bin:$PATH" # Add uv to PATH
                      cd backend # Navigate to backend directory
                      uv pip install flake8 # Or from pyproject.toml if defined there
                      flake8 .
                ```
        *   Ensure automated deployment to Cloud Run (backend service) is configured correctly, including any necessary environment variables.
    *   **Frontend Steps:**
        *   Add steps for linting (e.g., ESLint) and running tests (e.g., Jest) before build, triggered by changes in `frontend/`.
        *   Ensure automated deployment to Cloud Run (frontend service) is configured correctly, including `NEXT_PUBLIC_BACKEND_URL` and other environment variables.
2.  **Task:** Verify environment variable setup for both Cloud Run services (backend API keys, frontend backend URL, etc.).
    *   Consider using Google Secret Manager for sensitive backend environment variables if not already.

---

## Sprint 9: Testing, Review, Refinements & Documentation

**(Mention `uv` in README setup instructions for backend, Tailwind UI for frontend)**

**Goal:** Conduct thorough testing, code reviews, performance checks, and finalize documentation for the monorepo project.

**Key Deliverables:**
*   Well-tested application.
*   Codebase reviewed and refined.
*   Basic user documentation/help text if necessary.
*   Comprehensive `README.md` in the monorepo root, and potentially specific READMEs in `backend/` and `frontend/` directories.

**All Components (Backend, Frontend, Infrastructure - Monorepo context):**
1.  **Task:** Conduct thorough End-to-End (E2E) testing of all user flows.
    *   Registration, login, profile management.
    *   Event creation, signup, assignment.
    *   Working group management.
    *   Donation tracking.
    *   Reporting.
    *   RBAC enforcement.
2.  **Task:** Perform code reviews for major components in both `backend/` and `frontend/`.
3.  **Task:** Check performance against desirable targets (Main SRS Section 5.1). Optimize critical paths if necessary.
4.  **Task:** Review and improve inline code documentation and comments in both `backend/` and `frontend/`.
5.  **Task:** Create a main `README.md` for the `fiji` monorepo with an overview, setup instructions for local development (mentioning `uv` for backend setup, and standard Node.js/npm/yarn for frontend), and how to run both services.
    *   Consider adding specific `README.md` files in `backend/` and `frontend/` for more detailed service-specific instructions.
6.  **Task:** (Optional) Write basic user guide snippets for key functionalities if deemed necessary for TWC2 users.
7.  **Task:** Final check of security best practices (input validation, dependency updates, etc.).

---

This sprint plan provides a structured approach to developing Project Fiji with LLM assistance. Remember to adapt and adjust tasks within sprints as development progresses and new insights are gained.