# Project Fiji - Progress Overview

This document provides a summary of completed sprints and overall project progress.
For detailed task tracking and technical logs, refer to `.Q/projectlog.md`.

---

## Completed Sprints

### Sprint 0: Project Setup & Core Backend Foundations
*   **Status:** Completed
*   **Completion Date:** 2024-07-30
*   **Goal:** Establish the monorepo project structure, basic FastAPI application in the `backend` directory, Dockerization, initial CI/CD setup for the backend, and core data models for users and roles. Implement Firebase Authentication setup and initial user invitation/creation logic.

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
    *   **Documentation:**
        *   A `backend/README.md` was created, providing setup instructions and details about the backend service.
        *   All relevant SRS documents (`docs/technical-specs.md`, `.Q/Software-Requirements-Specifications.md`, `.Q/PROJECT_FIJI_LLM_SPRINT_PLAN_SRS.md`) were updated to reflect current architectural decisions, including ADC usage and the Firestore initialization script.
    *   **GCP Prerequisites:** User confirmed completion of manual GCP setup, including enabling Firebase services and configuring IAM permissions for ADC.

*   **Outcome:** Sprint 0 successfully established a solid foundation for the backend services, including core APIs, database interaction, authentication mechanisms, and initial CI/CD infrastructure. The project is well-positioned to proceed with frontend development and further backend feature enhancements in subsequent sprints.

---
*(Space for future sprint summaries)*