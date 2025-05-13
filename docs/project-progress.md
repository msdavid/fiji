# Project Fiji - Progress Overview

This document provides a summary of completed sprints and overall project progress.
For detailed task tracking and technical logs, refer to `.Q/projectlog.md`.

---

## Completed Sprints

### Sprint 0: Project Setup & Core Backend Foundations
*   **Status:** Completed
*   **Completion Date:** 2024-08-26
*   **Goal:** Establish the monorepo project structure, basic FastAPI application in the `backend` directory, Dockerization, initial CI/CD setup for the backend, core data models for users and roles, Firebase Authentication setup, initial user invitation/creation logic, and a robust testing framework.

*   **Key Achievements:**
    *   **Monorepo and Backend Initialization:** The project's monorepo structure was established, and the backend FastAPI application was initialized using `uv` for package management.
    *   **Firebase Integration:** Firebase Admin SDK was integrated into the backend, configured to use Application Default Credentials (ADC) for secure communication with Google Cloud services.
    *   **Core Data Models & Firestore Setup:**
        *   Pydantic models for `Role`, `Invitation`, and `User` were defined to ensure data consistency.
        *   The `roles` collection in Firestore was initialized with a `sysadmin` role using a dedicated utility script (`backend/utils/initialize_firestore.py`).
        *   The `users` and `registrationInvitations` collections are prepared for automatic creation by Firestore.
    *   **Essential API Endpoints Implemented:**
        *   A robust authentication dependency (`get_firebase_user`) was created to verify Firebase ID tokens for securing API endpoints.
        *   CRUD (Create, Read, Update, Delete) API endpoints for managing `roles` were developed, with initial protection for sysadmin-only access.
        *   An API endpoint for `sysadmin` users to create registration invitations was implemented.
        *   An API endpoint to allow users to register using an invitation token (after frontend Firebase Authentication) was created, which also handles user profile creation in Firestore and role assignment.
    *   **Containerization & CI/CD Foundation:**
        *   A `Dockerfile` for the backend service was created, ensuring a reproducible build environment using `uv`.
        *   An initial `cloudbuild.yaml` was configured in the monorepo root, enabling automated builds of the backend Docker image and pushing it to Google Artifact Registry.
        *   **Enhanced CI/CD Pipeline:** The `cloudbuild.yaml` was updated to include a dedicated step for running backend tests (`uv run pytest`) prior to Docker image builds. The `Dockerfile` was also updated for correct build context and `PYTHONPATH` to support testing and refactored import structures.
    *   **Backend Testing Framework & Code Quality:**
        *   Pytest framework established for comprehensive backend testing.
        *   Initial unit and integration tests developed for core API endpoints (e.g., main application, roles), with mocks implemented for Firebase Admin SDK and Firestore to ensure isolated and reliable testing.
        *   Backend Python import structures were refactored to use absolute paths, resolving potential circular dependencies and improving code maintainability. Database client initialization was moved to FastAPI's `lifespan` events for better resource management and testability.
    *   **Documentation:**
        *   A `backend/README.md` was created and subsequently enhanced with detailed setup, testing, and local run instructions.
        *   All relevant SRS documents (`docs/technical-specs.md`, `.Q/srs.md`) were updated to reflect architectural decisions, backend refinements, and testing setup.
    *   **GCP Prerequisites:** User confirmed completion of manual GCP setup, including enabling Firebase services and configuring IAM permissions for ADC.

*   **Outcome:** Sprint 0 successfully established a solid foundation for the backend services. This includes core APIs, database interaction, authentication mechanisms, a robust testing framework with initial test coverage, and an enhanced CI/CD pipeline incorporating automated testing. The project is well-positioned to proceed with frontend development and further backend feature enhancements in subsequent sprints.

---

### Sprint 1: Core Frontend Setup & User Authentication Flow
*   **Status:** Completed
*   **Completion Date:** 2024-07-29 (based on last relevant project log entry)
*   **Goal:** Establish the frontend project structure in the `frontend` directory of the monorepo, basic Next.js application (using App Router for SSR), Dockerization, initial CI/CD for frontend. Implement Firebase SDK, login, registration (using invitation token), and basic dashboard layout with Tailwind UI. Connect frontend auth to backend.

*   **Key Achievements:**
    *   **Frontend Monorepo Setup:** The `frontend` directory was created within the `fiji` monorepo. A Next.js application was initialized using the App Router for Server-Side Rendering (SSR) and configured with Tailwind UI for styling.
    *   **Firebase Frontend Integration:** The Firebase SDK was integrated into the Next.js application (`frontend/src/lib/firebaseConfig.ts`), configured using environment variables (`NEXT_PUBLIC_FIREBASE_...`) for client-side Firebase services.
    *   **User Registration Flow:**
        *   A `/register` page was developed, styled with Tailwind UI. It extracts the invitation token from the URL.
        *   Client-side validation of the invitation token was implemented by calling a new backend endpoint (`GET /invitations/validate`) before displaying the registration form.
        *   The registration form collects user details (first name, last name, password).
        *   Upon submission, it creates a user in Firebase Authentication (`createUserWithEmailAndPassword`).
        *   Successfully integrates with the backend `POST /register` endpoint, sending the Firebase ID token to create the user's profile in Firestore and associate roles.
    *   **User Login Flow:** A `/login` page was implemented, styled with Tailwind UI, enabling users to sign in with email and password using Firebase Authentication (`signInWithEmailAndPassword`). Session management and redirection to a protected route upon successful login were confirmed.
    *   **Basic Authenticated Dashboard:** A placeholder `/dashboard` page was created as a protected route, accessible only to authenticated users.
    *   **Backend Enhancements for Frontend:**
        *   CORS (Cross-Origin Resource Sharing) middleware was added to the FastAPI backend to allow requests from the frontend application.
        *   A public backend endpoint (`GET /invitations/validate`) was created to allow the frontend to check the status of an invitation token without requiring user authentication.
    *   **Containerization & CI/CD (Frontend):** As per the sprint plan, a `frontend/Dockerfile` was created for building the Next.js application, and the main `cloudbuild.yaml` was updated to include build and push steps for the frontend Docker image to Google Artifact Registry.
    *   **Documentation:** The top-level `README.md` was significantly updated with a comprehensive guide on setting up GCP, Firebase, backend, and frontend environments from scratch, including initial data setup and secrets management.
    *   **Successful End-to-End Testing:** The complete user onboarding flow (invitation, registration, login, access to protected routes, session persistence, logout, and handling of invalid/used tokens) was manually tested and confirmed to be working.

*   **Outcome:** Sprint 1 successfully established the core frontend application and user authentication lifecycle. Key user-facing features like registration and login are functional, integrated with Firebase Authentication and the backend services. The frontend is containerized and has an initial CI/CD setup. This provides a strong foundation for building out further frontend features and user interactions.

---

### Sprint 2: User Profile Management & RBAC Implementation
*   **Status:** Completed
*   **Completion Date:** 2024-08-01 (based on project log entry confirming test completion)
*   **Goal:** Implement user profile management (view/edit) on the frontend, and Role-Based Access Control (RBAC) features, including UI for sysadmin to manage user roles.
*   **Key Achievements:**
    *   **User Profile Management (Frontend & Backend):**
        *   Developed a `/dashboard/profile` page allowing authenticated users to view and update their profile information (first name, last name, phone number, skills, qualifications, preferences).
        *   Backend `User` model (`backend/models/user.py`) and `/users/me` (GET) and `/users/me` (PUT) endpoints (`backend/routers/users.py`) were enhanced to support these new profile fields.
        *   `skills` and `qualifications` fields were refactored from comma-separated lists to free-text textareas on the frontend, with corresponding backend model updates.
    *   **Role-Based Access Control (RBAC) & Admin UI:**
        *   Implemented logic in `AuthContext` (`frontend/src/context/AuthContext.tsx`) to fetch and store the current user's profile, including their `assignedRoleIds`, from the backend (`/users/me`).
        *   Conditional rendering of a "User Management" link on the dashboard (`frontend/src/app/dashboard/page.tsx`) for users with the `sysadmin` role ID.
        *   Developed an admin page (`frontend/src/app/dashboard/admin/users/page.tsx`) for user management, accessible only to `sysadmin` users. This page includes a `RoleManagementModal` component.
        *   Corrected import and authorization logic in admin-related frontend components to use `useAuth()` hook and `userProfile.assignedRoleIds`.
        *   Added a "← Back to Dashboard" link on the admin users page for better navigation.
    *   **Backend Import Resolution:** Resolved `ModuleNotFoundError` issues in the backend by changing imports to be direct from the `backend` directory's subfolders (e.g., `from dependencies...` instead of `from backend.dependencies...`).
    *   **UI/UX Enhancements & Bug Fixes:**
        *   Resolved font preloading warnings related to `GeistSans` by updating `globals.css` and `tailwind.config.ts` and clearing Next.js cache.
        *   Removed temporary `console.log` statements from frontend code.
    *   **Testing:** Confirmed successful completion of all tests for Sprint 2 features.

*   **Outcome:** Sprint 2 successfully delivered user profile management capabilities and foundational RBAC features, including an admin interface for user role management. The frontend now dynamically adapts based on user roles, and key UI/UX issues have been addressed. The backend was also stabilized with import fixes.

---

### Sprint 3: Event Management (Core Features)
*   **Status:** Completed
*   **Completion Date:** {{YYYY-MM-DD}} (Current Date)
*   **Goal:** Implement core event management features, including backend logic and frontend UI for event creation, viewing, updating, and deletion. Enable volunteer self-signup/withdrawal from events.
*   **Key Achievements:**
    *   **Backend Event Management:**
        *   Defined `Event` model (`backend/models/event.py`) with fields for event name, type, purpose, description, start/end times (`dateTime`, `endTime`), venue, volunteers required, status, creator, and organizer.
        *   Implemented CRUD API endpoints in `backend/routers/events.py` for events, including `POST /events`, `GET /events`, `GET /events/{event_id}`, `PUT /events/{event_id}`, and `DELETE /events/{event_id}`.
        *   Added backend logic for user search (`GET /users/search`) to support organizer selection.
        *   Implemented backend endpoints for event self-signup (`POST /events/{event_id}/signup`) and withdrawal (`DELETE /events/{event_id}/signup`).
    *   **Frontend Event Management UI (Next.js with Tailwind UI):**
        *   Developed pages for event listing (`/dashboard/events`), event detail view (`/dashboard/events/[eventId]`), event creation (`/dashboard/events/new`), and event editing (`/dashboard/events/[eventId]/edit`).
        *   Implemented forms for creating and editing events, including fields for all event properties.
        *   Integrated organizer selection with a debounced search calling the backend user search API.
        *   Implemented UI for event self-signup and withdrawal on the event detail page for regular users.
        *   Added event deletion functionality with a confirmation dialog, accessible via a "Delete Event" button on the event edit page for authorized users.
    *   **UX Enhancements:**
        *   Default end time calculation (60 minutes after start time) in event forms.
        *   Display of creator and organizer names on event detail and listing pages.
        *   Changed "Location" label to "Venue".
    *   **Documentation:** Updated `.Q/srs.md` and `docs/technical-specs.md` to reflect event management features, including the `endTime` refactor and deletion functionality.
    *   **Testing:** Successfully completed manual testing of event creation, viewing, updating (including organizer and timing changes), deletion, and volunteer self-signup/withdrawal flows as per the Sprint 3 test plan (`tmp/sprint-3-event-management.md`).

*   **Outcome:** Sprint 3 delivered a comprehensive set of core event management features. Users can now create, view, update, and delete events. Volunteers can sign up for and withdraw from events. The backend provides robust APIs, and the frontend offers a user-friendly interface for these operations.
*   **Next Steps:** Proceed to Sprint 4 for advanced event assignment management and other features.

---
*(Space for future sprint summaries)*