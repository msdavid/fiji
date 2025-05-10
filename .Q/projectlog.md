# Project Fiji - Development Log

**Overall Project Status:** In Progress
**Current Sprint:** Sprint 0: Project Setup & Core Backend Foundations
**Sprint 0 Status:** Pending

---

## Sprint 0: Project Setup & Core Backend Foundations

### Backend Requirements (FastAPI & Firestore)

*   **Task ID:** 0.B.1
    *   **Description:** Initialize `fiji-backend` Git repository.
    *   **Status:** Pending
    *   **Details/Outputs:**
        *   User to create a directory named `fiji-backend`.
        *   User to run `git init` inside the `fiji-backend` directory.
    *   **Next Steps:** Confirm completion by user.

*   **Task ID:** 0.B.2
    *   **Description:** Set up a basic FastAPI application structure (`main.py`, `pyproject.toml` with `uv`).
    *   **Status:** Pending
    *   **Details/Outputs:** (Will include paths to created `main.py` and `pyproject.toml`, and their content or key configurations).
    *   **Next Steps:** Await completion of 0.B.1. Then, Q to provide templates for `main.py` and `pyproject.toml`.

*   **Task ID:** 0.B.3
    *   **Description:** Create `users` collection schema in Firestore (manually or via script).
    *   **Status:** Pending
    *   **Details/Outputs:** (Will note method of creation and confirm key fields as per SRS).
    *   **Next Steps:** This task depends on Firebase project setup (0.I.3).

*   **Task ID:** 0.B.4
    *   **Description:** Create `roles` collection schema in Firestore (manually or via script) and add `sysadmin` role.
    *   **Status:** Pending
    *   **Details/Outputs:** (Will note method of creation and confirm `sysadmin` role details).
    *   **Next Steps:** This task depends on Firebase project setup (0.I.3).

*   **Task ID:** 0.B.5
    *   **Description:** Implement Firebase Admin SDK initialization in FastAPI.
    *   **Status:** Pending
    *   **Details/Outputs:** (Will include code snippet for initialization in `main.py` or a config file).
    *   **Next Steps:** Requires `main.py` (from 0.B.2) and Firebase project setup (0.I.3, specifically service account key).

*   **Task ID:** 0.B.6
    *   **Description:** Create `registrationInvitations` collection schema in Firestore (manually or via script).
    *   **Status:** Pending
    *   **Details/Outputs:** (Will note method of creation and confirm key fields).
    *   **Next Steps:** This task depends on Firebase project setup (0.I.3).

*   **Task ID:** 0.B.7
    *   **Description:** Implement API endpoint for `sysadmin` to create registration invitations (`POST /invitations`).
    *   **Status:** Pending
    *   **Details/Outputs:** (Will include path to file containing the endpoint logic and key code structures).
    *   **Next Steps:** Depends on 0.B.2, 0.B.5, and RBAC foundations (partially 0.B.10).

*   **Task ID:** 0.B.8
    *   **Description:** Implement API endpoint to verify invitation token and register user (`POST /register`).
    *   **Status:** Pending
    *   **Details/Outputs:** (Will include path to file containing the endpoint logic and key code structures).
    *   **Next Steps:** Depends on 0.B.2, 0.B.5, 0.B.3, 0.B.6.

*   **Task ID:** 0.B.9
    *   **Description:** Implement Role Management API endpoints (CRUD for `roles` collection - `sysadmin` only).
    *   **Status:** Pending
    *   **Details/Outputs:** (Will include path to file containing the endpoint logic and key code structures).
    *   **Next Steps:** Depends on 0.B.2, 0.B.4, 0.B.5, and RBAC foundations (partially 0.B.10).

*   **Task ID:** 0.B.10
    *   **Description:** Implement basic authentication dependency (`get_firebase_user`) to verify Firebase ID tokens.
    *   **Status:** Pending
    *   **Details/Outputs:** (Will include code snippet for the dependency).
    *   **Next Steps:** Depends on 0.B.2, 0.B.5.

### Infrastructure/DevOps (Cloud Build, Docker - Backend)

*   **Task ID:** 0.I.1
    *   **Description:** Create `backend/Dockerfile` using `uv`.
    *   **Status:** Pending
    *   **Details/Outputs:** (Will include the content of `backend/Dockerfile`).
    *   **Next Steps:** Depends on 0.B.2 (for dependency files like `requirements.txt` or `pyproject.toml`).

*   **Task ID:** 0.I.2
    *   **Description:** Create initial `backend/cloudbuild.yaml` (build & push image).
    *   **Status:** Pending
    *   **Details/Outputs:** (Will include the content of `backend/cloudbuild.yaml`).
    *   **Next Steps:** Depends on 0.I.1.

*   **Task ID:** 0.I.3
    *   **Description:** Manually enable Firebase Authentication and Firestore in the Google Cloud Project.
    *   **Status:** Pending
    *   **Details/Outputs:** (User to confirm completion and provide Firebase Project ID if needed for SDK setup).
    *   **Next Steps:** User to perform this action in their GCP console.

---

## Issues Log

*   (No issues logged yet)

---