# Software Requirements Specification (SRS)
## Project Fiji

**Version:** 1.0
**Date:** {{YYYY-MM-DD}} (Auto-fill with current date)

## Table of Contents
1. [Introduction](#1-introduction)
    1.1 [Purpose](#11-purpose)
    1.2 [Scope](#12-scope)
    1.3 [Definitions, Acronyms, and Abbreviations](#13-definitions-acronyms-and-abbreviations)
    1.4 [References](#14-references)
    1.5 [Guiding Principles](#15-guiding-principles)
2. [Overall Description](#2-overall-description)
    2.1 [Product Perspective](#21-product-perspective)
    2.2 [Product Functions](#22-product-functions)
    2.3 [User Characteristics](#23-user-characteristics)
    2.4 [Constraints](#24-constraints)
    2.5 [Assumptions and Dependencies](#25-assumptions-and-dependencies)
3. [System Features (Functional Requirements)](#3-system-features-functional-requirements)
    3.1 [Volunteer Management](#31-volunteer-management)
    3.2 [Permissions and Role-Based Access Control (RBAC)](#32-permissions-and-role-based-access-control-rbac)
    3.3 [Event Management](#33-event-management)
    3.4 [Working Group Management](#34-working-group-management)
    3.5 [Availability Tracking](#35-availability-tracking)
    3.6 [Donation Tracking](#36-donation-tracking)
    3.7 [Reporting and Analytics](#37-reporting-and-analytics)
    3.8 [Notifications and Communications](#38-notifications-and-communications)
    3.9 [User Interface (Dashboard)](#39-user-interface-dashboard)
4. [External Interface Requirements](#4-external-interface-requirements)
    4.1 [User Interfaces](#41-user-interfaces)
    4.2 [Software Interfaces](#42-software-interfaces)
    4.3 [Hardware Interfaces](#43-hardware-interfaces)
    4.4 [Communications Interfaces](#44-communications-interfaces)
5. [Non-Functional Requirements](#5-non-functional-requirements)
    5.1 [Performance Requirements](#51-performance-requirements)
    5.2 [Security Requirements](#52-security-requirements)
    5.3 [Scalability Requirements](#53-scalability-requirements)
    5.4 [Reliability and Availability](#54-reliability-and-availability)
    5.5 [Maintainability](#55-maintainability)
    5.6 [Usability](#56-usability)
    5.7 [Accessibility](#57-accessibility)
6. [Data Management](#6-data-management)
    6.1 [Data Model (Firestore)](#61-data-model-firestore)
    6.2 [Data Backup and Recovery](#62-data-backup-and-recovery)
    6.3 [Data Migration](#63-data-migration)
7. [Deployment and Operations](#7-deployment-and-operations)
    7.1 [Infrastructure](#71-infrastructure)
    7.2 [CI/CD Pipeline](#72-cicd-pipeline)
    7.3 [Environments](#73-environments)
    7.4 [Configuration Management](#74-configuration-management)
8. [Authentication and Authorization](#8-authentication-and-authorization)
    8.1 [Authentication](#81-authentication)
    8.2 [Authorization](#82-authorization)
9. [Logging and Monitoring](#9-logging-and-monitoring)
    9.1 [Logging](#91-logging)
    9.2 [Monitoring](#92-monitoring)

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) document describes the technical requirements for Project Fiji. Fiji is a web application designed to manage and track volunteer activities within the TWC2 organization. This document serves as the primary technical guide for developers, outlining the system's architecture, functionalities, non-functional requirements, and operational aspects.

### 1.2 Scope
The scope of this document covers all technical specifications for the design, development, and deployment of Project Fiji. This includes backend services, frontend application, database design, authentication mechanisms, CI/CD pipeline, and non-functional requirements. Functionalities not explicitly mentioned in the referenced Functional Specification Document or this SRS are considered out of scope.

### 1.3 Definitions, Acronyms, and Abbreviations
*   **SRS:** Software Requirements Specification
*   **TWC2:** The organization for which Fiji is being developed.
*   **RBAC:** Role-Based Access Control
*   **API:** Application Programming Interface
*   **CI/CD:** Continuous Integration/Continuous Deployment
*   **GCP:** Google Cloud Platform
*   **UI:** User Interface
*   **UX:** User Experience
*   **CRUD:** Create, Read, Update, Delete
*   **PITR:** Point-in-Time Recovery
*   **FSD:** Functional Specification Document

### 1.4 References
*   Project Fiji Functional Specification Document (`.Q/functional-specifications.md`)
*   Discussions regarding technical implementation choices.

### 1.5 Guiding Principles
*   **Adherence to Specifications:** The system will strictly implement functionalities as defined in the FSD and this SRS.
*   **Avoid Unnecessary Complexity:** Solutions will favor simplicity and effectiveness to meet requirements without adding unrequested features or undue complexity.
*   **Leverage Managed Services:** Utilize Google Cloud Platform's managed services where appropriate to reduce operational overhead and enhance scalability and reliability.

## 2. Overall Description

### 2.1 Product Perspective
Project Fiji is a web-based volunteer management system. It will consist of a Next.js frontend application and a Python FastAPI backend API, both deployed as separate services on Google Cloud Run. Data will be stored in Google Firestore, and user authentication will be handled by Firebase Authentication.

### 2.2 Product Functions
A summary of key product functions (detailed in Section 3):
*   Secure user registration (invite-only) and profile management.
*   Role-based access control for differentiated user capabilities.
*   Event creation, management, and volunteer assignment (manual and self-signup).
*   Working group creation, management, and member assignment.
*   Volunteer availability tracking.
*   Donation tracking (excluding online payment processing).
*   Reporting and analytics on volunteer hours, event participation, and donations.
*   Automated notifications and communications (e.g., event reminders).
*   Personalized user dashboards.

### 2.3 User Characteristics
Users will range from system administrators (`sysadmin`) managing the entire platform to organizational staff managing events and volunteers, and individual volunteers interacting with their profiles, events, and assignments. Users are expected to have basic web literacy.

### 2.4 Constraints
*   **Technology Stack:**
    *   Backend: Python 3.10+, FastAPI
    *   Frontend: Next.js (React), Bulma CSS
    *   Database: Google Firestore (NoSQL)
    *   Authentication: Firebase Authentication
    *   Deployment: Google Cloud Run for backend and frontend services
    *   CI/CD: Google Cloud Build
*   **Infrastructure:** Google Cloud Platform.
*   **Development Structure:** Separate Git repositories for frontend and backend.
*   **Environment:** Initially, a single production environment. Staging or development environments may be considered later.
*   **Functionality:** Limited to features specified in the FSD and this SRS.

### 2.5 Assumptions and Dependencies
*   Google Cloud Platform services (Cloud Run, Firestore, Firebase Auth, Cloud Build, Artifact Registry) are available and correctly configured.
*   The TWC2 organization will provide necessary input for role definitions and initial `sysadmin` user setup.
*   UI/UX wireframes and detailed style guides for the frontend will be provided as development progresses.
*   Internet connectivity is available for users to access the web application.

## 3. System Features (Functional Requirements)

Details for each feature are derived from the FSD, with technical implementation notes added.

### 3.1 Volunteer Management
*   **FR3.1.1 User Registration:**
    *   Invite-only: New users can only register via an invitation link.
    *   Invitations (`registrationInvitations` collection) will contain a unique token and associated email.
    *   Registration workflow will validate the token, collect necessary user details, and create a user account in Firebase Authentication and a corresponding user profile document in Firestore (`users` collection).
*   **FR3.1.2 User Profile Management:**
    *   Users can view and edit their profiles based on permissions.
    *   Profile data (as per Firestore `users` collection schema in Section 6.1) includes personal info, skills, availability, etc.
    *   History (training, performance, assignments, donations) will be derived from related collections, not stored redundantly in the user profile document itself, unless for frequently accessed summary data if performance dictates.

### 3.2 Permissions and Role-Based Access Control (RBAC)
*   **FR3.2.1 Role Definition:**
    *   A `roles` collection in Firestore will store role definitions, including `roleName` and a `privileges` map.
    *   The `privileges` map will associate resources (e.g., "events", "users") with permitted actions (e.g., "create", "view", "edit", "delete", "assign", "revoke").
*   **FR3.2.2 `sysadmin` Role:**
    *   A top-level `sysadmin` role will have unrestricted access to all system features and data. This role can manage other roles and assign privileges.
*   **FR3.2.3 Custom Roles:**
    *   `sysadmin` can create, modify, and delete custom roles.
*   **FR3.2.4 User Role Assignment:**
    *   Users will have an `assignedRoleIds` array in their Firestore document, linking to roles in the `roles` collection.
    *   A user can have multiple roles; their effective permissions are the union of all privileges from their assigned roles.
*   **FR3.2.5 Privilege Enforcement:**
    *   The FastAPI backend will enforce RBAC for all API requests (see Section 8.2).

### 3.3 Event Management
*   **FR3.3.1 Event Creation:**
    *   Authorized users can create events with details like type, name, purpose, date/time, location, description, and required volunteer count.
    *   Event data stored in the `events` collection (see Section 6.1).
*   **FR3.3.2 Event Participation:**
    *   Volunteers can self-signup for events if enabled.
    *   Authorized users can manually assign volunteers to events.
    *   Assignments stored in the `assignments` collection, linking users to events.
    *   Attendance tracking and performance notes will be part of the assignment record.
*   **FR3.3.3 Event Reporting:**
    *   Functionality to view event history, attendance, and feedback (if collected).

### 3.4 Working Group Management
*   **FR3.4.1 Group Creation:** Authorized users can create and manage working groups. Data stored in `workingGroups` collection.
*   **FR3.4.2 Group Assignments:** Authorized users can assign volunteers to working groups. Assignments stored in the `assignments` collection.
*   **FR3.4.3 Group History:** Track working group history and participation.

### 3.5 Availability Tracking
*   **FR3.5.1 Volunteer Availability:** Volunteers can set general and specific date/time availability in their user profile.
*   **FR3.5.2 Conflict Detection:** The system should provide a way to identify potential conflicts between a volunteer's availability and event assignments (implementation detail: likely a frontend or backend check when assigning or viewing schedules).

### 3.6 Donation Tracking
*   **FR3.6.1 Donation Recording:** Authorized users can record monetary, in-kind, and contributed hours donations. Data stored in `donations` collection.
*   **FR3.6.2 Online Payments:** Online payment processing is out of scope.
*   **FR3.6.3 Donation History:** Users can view donation history relevant to their role.

### 3.7 Reporting and Analytics
*   **FR3.7.1 Volunteer Hours:** Track and report individual volunteer hours.
*   **FR3.7.2 Event Participation:** Statistics on attendance, completion rates, etc.
*   **FR3.7.3 Donation Summaries:** Reports on total donations and trends.
*   **FR3.7.4 Flexible Formats:** Reports should be exportable (e.g., CSV). The backend will provide data; frontend will handle presentation.

### 3.8 Notifications and Communications
*   **FR3.8.1 Event Reminders:** Automated notifications for upcoming events, assignment confirmations, schedule changes.
*   **FR3.8.2 Email Delivery:** Emails will be sent via Firebase services (e.g., Firebase Admin SDK from the backend for transactional emails).
*   **FR3.8.3 Bulk Email Screening:** Functionality to screen volunteers for bulk email notifications (criteria to be defined).

### 3.9 User Interface (Dashboard)
*   **FR3.9.1 Personalized Dashboard:** Users will see a dashboard tailored to their role(s), showing relevant information like upcoming events, assignments, and notifications.
*   **FR3.9.2 Visualizations:** Visual representation of volunteer hours and contributions.
*   **FR3.9.3 UI Details:** Specific UI mockups and style guides will be provided later.

## 4. External Interface Requirements

### 4.1 User Interfaces
*   The primary user interface will be a web application built with Next.js and styled with Bulma CSS.
*   The UI must be responsive and work effectively on common desktop and mobile web browsers.
*   Detailed UI specifications (wireframes, mockups) are TBD.

### 4.2 Software Interfaces
*   **FastAPI Backend API:** The frontend will communicate with the backend via a RESTful API.
*   **Firebase Authentication:** For user sign-up, sign-in, and ID token generation/verification.
*   **Google Firestore:** As the primary data store, accessed by the FastAPI backend.
*   **Google Cloud Build:** For CI/CD.
*   **Google Artifact Registry:** For storing Docker images.
*   **Firebase Services (for email):** The backend will integrate with Firebase to send emails.

### 4.3 Hardware Interfaces
*   Not applicable. Fiji is a web-based application.

### 4.4 Communications Interfaces
*   All communication between the client (browser) and frontend (Cloud Run), and between frontend and backend (Cloud Run services) will be over HTTPS.
*   Communication between backend and Firestore/Firebase services will use Google Cloud's secure internal networking and SDKs.

## 5. Non-Functional Requirements

### 5.1 Performance Requirements
*   **Response Times (Desirable Targets):**
    *   Loading user dashboard: < 3 seconds.
    *   Registering for an event: < 2 seconds.
    *   Generating typical reports: < 5-10 seconds. Complex reports may take longer.
*   **Concurrency:** The system should support approximately 50-100 concurrent users without significant performance degradation. These are desirable targets, not critical pass/fail criteria at launch.

### 5.2 Security Requirements
*   **Authentication:** Handled by Firebase Authentication (see Section 8.1).
*   **Authorization:** RBAC enforced by the FastAPI backend (see Section 8.2).
*   **Data Encryption:**
    *   In Transit: HTTPS for all external communication.
    *   At Rest: Handled by Google Firestore's default encryption.
*   **Data Privacy:** Adherence to general responsible data handling practices. No specific regulatory compliance (e.g., GDPR) explicitly mandated at this stage beyond this.
*   **Input Validation:** All user inputs must be validated on both frontend and backend to prevent common web vulnerabilities (e.g., XSS, injection).
*   **Dependency Management:** Regularly update dependencies to patch known vulnerabilities.

### 5.3 Scalability Requirements
*   The system should be designed to support up to approximately 5,000 total users and 5-10 events per month.
*   Google Cloud Run and Firestore are expected to provide necessary scalability for this load.
*   Firestore data models and queries should be designed for efficiency at scale.

### 5.4 Reliability and Availability
*   The system will leverage the inherent reliability of Google Cloud Run and Firestore.
*   Target high availability, minimizing downtime. Specific SLOs are not defined at this stage.
*   Graceful error handling should be implemented to prevent crashes and provide informative messages to users.

### 5.5 Maintainability
*   **Code Quality:** Code should be well-documented, follow consistent coding standards (e.g., PEP 8 for Python, Prettier for Next.js), and be organized logically.
*   **Modularity:** Backend and frontend will be separate services in separate repositories.
*   **Testability:** Unit and integration tests should be written for critical components.
*   **Configuration:** Environment variables will be used for configuration (see Section 7.4).
*   **Logging:** Standardized logging practices (see Section 9.1).

### 5.6 Usability
*   The UI should be intuitive and easy to use for the target user characteristics.
*   Feedback mechanisms (e.g., loading indicators, success/error messages) should be provided for user actions.
*   Detailed usability requirements will be guided by UI mockups/prototypes when available.

### 5.7 Accessibility
*   No specific web accessibility standards (e.g., WCAG) are mandated at this time. However, general accessibility best practices should be considered during UI development to ensure broad usability.

## 6. Data Management

### 6.1 Data Model (Firestore)
The following Firestore collections and key fields are proposed:

*   **`users`**
    *   `uid` (String, Document ID, matches Firebase Auth UID)
    *   `email` (String)
    *   `firstName` (String)
    *   `lastName` (String)
    *   `phoneNumber` (String, Optional)
    *   `skills` (Array of Strings)
    *   `qualifications` (Array of Strings)
    *   `availability` (Object: `{ general: String, specificDates: Array }`)
    *   `preferences` (String)
    *   `trainingHistory` (Array of Objects: `{ name: String, dateCompleted: Timestamp, notes: String }`)
    *   `assignedRoleIds` (Array of Strings, references `roles` collection)
    *   `status` (String: "invited", "active", "inactive")
    *   `createdAt` (Timestamp)
    *   `updatedAt` (Timestamp)

*   **`events`**
    *   `eventName` (String)
    *   `eventType` (String)
    *   `purpose` (String)
    *   `description` (String)
    *   `dateTime` (Timestamp)
    *   `durationMinutes` (Number, Optional)
    *   `location` (String)
    *   `volunteersRequired` (Number)
    *   `status` (String: "draft", "open_for_signup", "ongoing", "completed", "cancelled")
    *   `createdByUserId` (String, references `users.uid`)
    *   `createdAt` (Timestamp)
    *   `updatedAt` (Timestamp)

*   **`workingGroups`**
    *   `groupName` (String)
    *   `description` (String)
    *   `status` (String: "active", "archived")
    *   `createdByUserId` (String, references `users.uid`)
    *   `createdAt` (Timestamp)
    *   `updatedAt` (Timestamp)

*   **`assignments`** (Links users to events or working groups)
    *   `userId` (String, references `users.uid`)
    *   `assignableId` (String, references `events` or `workingGroups` document ID)
    *   `assignableType` (String: "event", "workingGroup")
    *   `status` (String: e.g., "confirmed", "attended", "active")
    *   `assignedByUserId` (String, references `users.uid` or "self_signup")
    *   `assignmentDate` (Timestamp)
    *   `performanceNotes` (String, Optional, for events)
    *   `hoursContributed` (Number, Optional)

*   **`donations`**
    *   `userId` (String, Optional, references `users.uid`)
    *   `donorName` (String, Optional)
    *   `donationType` (String: "monetary", "in-kind", "hours_manual_entry")
    *   `amount` (Number, Optional, for monetary)
    *   `description` (String)
    *   `quantityHours` (Number, Optional, for hours_manual_entry)
    *   `donationDate` (Timestamp)
    *   `recordedByUserId` (String, references `users.uid`)
    *   `createdAt` (Timestamp)

*   **`roles`**
    *   `roleName` (String, Unique)
    *   `description` (String)
    *   `privileges` (Map: `{ resource: [actions] }`, e.g., `{"events": ["create", "view"]}`)
    *   `isSystemRole` (Boolean, e.g., true for `sysadmin`)

*   **`registrationInvitations`**
    *   `email` (String)
    *   `token` (String, Unique, Secure)
    *   `status` (String: "pending", "accepted", "expired")
    *   `invitedByUserId` (String, references `users.uid`)
    *   `rolesToAssignOnRegistration` (Array of Strings, Optional, references `roles`)
    *   `createdAt` (Timestamp)
    *   `expiresAt` (Timestamp)

### 6.2 Data Backup and Recovery
*   Firestore's Point-in-Time Recovery (PITR) feature will be enabled and relied upon for data backup and recovery.
*   No additional custom backup procedures are required at this stage.

### 6.3 Data Migration
*   Procedures for schema or data migrations are not defined at this stage and will be addressed if and when the need arises.

## 7. Deployment and Operations

### 7.1 Infrastructure
*   **Compute:** Google Cloud Run for both frontend (Next.js) and backend (FastAPI) services.
*   **Database:** Google Firestore.
*   **Authentication:** Firebase Authentication.
*   **Container Registry:** Google Artifact Registry for Docker images.

### 7.2 CI/CD Pipeline
*   **Platform:** Google Cloud Build.
*   **Repositories:** Separate Git repositories for frontend and backend.
*   **Trigger:** CI/CD pipeline will be triggered on every push to the `main` branch of each repository.
*   **Backend `cloudbuild.yaml` Steps (Conceptual):**
    1.  Checkout code.
    2.  Install dependencies.
    3.  Run linters (e.g., Flake8) and static analysis (e.g., MyPy).
    4.  Run unit/integration tests (e.g., Pytest).
    5.  Build Docker container.
    6.  Push Docker container to Google Artifact Registry.
    7.  Deploy new revision to Google Cloud Run (backend service).
*   **Frontend `cloudbuild.yaml` Steps (Conceptual):**
    1.  Checkout code.
    2.  Install dependencies (e.g., `yarn install`).
    3.  Run linters (e.g., ESLint) and type checks (e.g., TypeScript compiler).
    4.  Run unit/integration tests (e.g., Jest, React Testing Library).
    5.  Build Next.js application (`yarn build`).
    6.  Build Docker container (serving the Next.js app).
    7.  Push Docker container to Google Artifact Registry.
    8.  Deploy new revision to Google Cloud Run (frontend service), including setting `NEXT_PUBLIC_BACKEND_URL` environment variable.

### 7.3 Environments
*   Initially, a single production environment will be used.
*   The introduction of development or staging environments can be considered in the future if needed.

### 7.4 Configuration Management
*   **Backend (Python/FastAPI):**
    *   Local development: `python-dotenv` to load variables from a `.env` file.
    *   Cloud Run: Environment variables set directly in the service configuration (e.g., database connection details, API keys for Firebase Admin SDK).
*   **Frontend (Next.js):**
    *   Local development: `.env.local` (or similar `.env.*` files) for environment variables.
    *   Cloud Run: Environment variables set in the service configuration (e.g., `NEXT_PUBLIC_BACKEND_URL`).
*   Sensitive information (API keys, secrets) must not be hardcoded into the source code and should be managed via environment variables, potentially integrated with Google Secret Manager if complexity warrants.

## 8. Authentication and Authorization

### 8.1 Authentication
*   **Provider:** Firebase Authentication will be used for user identity management (sign-up, sign-in, password reset, etc.).
*   **Token-based:** The frontend will receive a Firebase ID token upon successful login. This token will be sent in the `Authorization` header (as a Bearer token) with every API request to the backend.
*   **Backend Verification:** The FastAPI backend will use the `firebase-admin` SDK to verify the Firebase ID token on incoming requests to authenticate the user.

### 8.2 Authorization
*   **RBAC Implementation:** The FastAPI backend will implement Role-Based Access Control.
*   **Process:**
    1.  After authenticating a user (verifying Firebase ID token), the backend will retrieve the user's Firebase UID.
    2.  Using the UID, it will fetch the user's document from the `users` collection in Firestore to get their `assignedRoleIds`.
    3.  For each `roleId`, it will fetch the corresponding role document from the `roles` collection to get its `privileges` map.
    4.  Privileges from all assigned roles will be consolidated (union of permissions).
    5.  If the user has the `sysadmin` role, all access is granted.
    6.  API endpoints will be protected by dependencies that check if the authenticated user's consolidated privileges include the required resource and action for the requested operation.
    7.  Access is granted or denied (HTTP 403 Forbidden) based on this check.
*   **Caching:** Role definitions or consolidated user privileges may be cached in the backend for short periods to improve performance, with appropriate cache invalidation strategies.

## 9. Logging and Monitoring

### 9.1 Logging
*   **Backend (Python/FastAPI):** Standard Python `logging` module will be used. Logs will be written to `stdout`/`stderr`.
*   **Frontend (Next.js):** Standard browser `console` logging (`console.log`, `console.error`, etc.) will be used during development. For production, critical frontend errors could be sent to the backend or a dedicated logging service if needed, but primary reliance is on backend logging.
*   **Aggregation:** Google Cloud Logging will automatically collect logs from Cloud Run services (capturing `stdout`/`stderr`).
*   **Log Levels:** Standard log levels (DEBUG, INFO, WARNING, ERROR, CRITICAL) should be used appropriately.
*   **Format:** Logs should be structured or easily parsable, including timestamps, log level, and relevant contextual information (e.g., request ID, user ID if applicable).

### 9.2 Monitoring
*   **Platform:** Google Cloud Monitoring will be used.
*   **Standard Metrics:** Rely on standard metrics provided by Cloud Run (request count, latency, error rates, CPU/memory utilization) and Firestore (read/write operations, latency).
*   **Custom Metrics:** No specific custom application metrics are defined for implementation at this stage.
*   **Alerting:** Alerts can be configured in Google Cloud Monitoring based on thresholds for key metrics (e.g., high error rates, sustained high latency) to notify administrators.
*   **Error Tracking:** Initially, rely on Cloud Logging/Monitoring for error tracking. Integration with a dedicated error tracking service (e.g., Sentry) can be considered later if needed.
