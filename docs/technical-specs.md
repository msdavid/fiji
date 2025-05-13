# Software Requirements Specification: Project Fiji

## 1. Introduction

### 1.1 Purpose
This document defines the Software Requirements Specification (SRS) for Project Fiji. Project Fiji is a web-based platform designed to manage volunteers, events, working groups, and donations for an organization. It aims to streamline administrative tasks, facilitate communication, and improve overall operational efficiency.

### 1.2 Scope
The scope of Project Fiji includes:
*   User registration and authentication.
*   Role-based access control (RBAC) for managing permissions.
*   Management of user profiles and availability.
*   Comprehensive event management, including creation (with organizer assignment, start and end times), volunteer sign-ups, and assignments.
*   Working group creation and member management.
*   Tracking of donations.
*   Basic reporting capabilities.
*   Email notifications for key system events.
*   User search functionality for administrative tasks.

The system will consist of a backend API, a frontend web application, and will utilize Google Cloud services for database, authentication, and deployment.

### 1.3 Definitions, Acronyms, and Abbreviations
*   **SRS:** Software Requirements Specification
*   **RBAC:** Role-Based Access Control
*   **API:** Application Programming Interface
*   **UI:** User Interface
*   **CRUD:** Create, Read, Update, Delete
*   **Sysadmin:** System Administrator role with the highest level of privileges.
*   **SSR:** Server-Side Rendering

## 2. Overall Description

### 2.1 Product Perspective
Project Fiji is a self-contained system providing a dedicated platform for volunteer and organizational management. It will integrate with Firebase Authentication for user identity management and Google Firestore as its primary database.

### 2.2 Product Features
The major features of Project Fiji are:
*   User Account Management (Registration, Login, Profile, Search)
*   Role and Permission Management
*   Event Lifecycle Management (including assigning an organizer, defining start and end times)
*   Volunteer Participation and Assignment Tracking
*   Working Group Coordination
*   Donation Recording
*   System Reporting
*   Automated Notifications

### 2.3 User Classes and Characteristics
*   **General Users/Volunteers:** Can register (via invitation), log in, manage their profile and availability, view and sign up for events, view their assignments and working groups.
*   **Administrators (e.g., Sysadmin, Event Managers, Group Coordinators):** Users with elevated privileges, varying by assigned roles.
    *   **System Administrator (Sysadmin):** Manages roles, users (including search), registration invitations, system settings, and has oversight of all data.
    *   **Event Managers (or users with event management privileges):** Can create, update (including organizer, start/end times), delete events, and manage volunteer assignments to events.
    *   **Working Group Coordinators (or users with group management privileges):** Can create, update, delete working groups, and manage member assignments.
    *   **Donation Managers (or users with donation privileges):** Can record, update, and delete donations.

### 2.4 Operating Environment
*   The backend will be a Dockerized FastAPI application running on Google Cloud Run.
*   The frontend will be a Dockerized Next.js application (utilizing the App Router for **Server-Side Rendering - SSR**) running on Google Cloud Run.
*   The system will use Google Firestore as its database.
*   User authentication will be handled by Firebase Authentication.
*   The system is designed to be accessed via modern web browsers.

### 2.5 Design and Implementation Constraints
*   **Technology Stack:**
    *   Backend: Python, FastAPI
    *   Frontend: Next.js (with App Router for **SSR**), Tailwind UI
    *   Database: Google Firestore
    *   Authentication: Firebase Authentication
*   Deployment: Google Cloud Run.
*   CI/CD: Google Cloud Build.
*   Repository Structure: monorepo (one repository, separate directories under the fiji repo) for backend and frontend.

## 3. System Features (Functional Requirements)

This section details the functional requirements of Project Fiji, grouped by major feature area.

### 3.1 User Management and Authentication
*   **3.1.1 User Registration:**
    *   Users shall register for the system using an email-based invitation token.
    *   The registration process shall require the user to provide their first name, last name, and set a password.
    *   Upon successful registration via Firebase Authentication, a corresponding user profile shall be created in the system's database, linking to the Firebase UID.
    *   Roles specified in the invitation shall be assigned to the user upon registration.
*   **3.1.2 User Login:**
    *   Registered users shall be able to log in using their email and password via Firebase Authentication.
    *   Upon successful login, the system shall grant access based on the user's assigned roles and privileges.
*   **3.1.3 User Profile Management:**
    *   Authenticated users shall be able to view their own profile information.
    *   Authenticated users shall be able to update their profile information, including first name, last name, phone number, skills, qualifications, availability, and preferences.
*   **3.1.4 Administrative User Management:**
    *   Users with `users:create` privilege (typically Sysadmin) shall be able to create new user accounts directly.
    *   Users with `users:view` privilege shall be able to list and view profiles of other users.
    *   Users with `users:edit` privilege shall be able to update profiles of other users.
    *   Users with `users:delete` privilege shall be able to delete user accounts.
*   **3.1.5 Firebase Authentication Integration:**
    *   The system shall use Firebase Admin SDK on the backend to verify Firebase ID tokens for authenticating API requests.
    *   The frontend shall use Firebase SDK for user sign-up and sign-in operations.
*   **3.1.6 User Search:**
    *   The system shall provide an API endpoint (e.g., `GET /users/search?q={query}`) for searching users by name or email.
    *   This functionality is primarily intended for administrative interfaces, such as selecting an organizer for an event.
    *   The search should be case-insensitive and support partial matches. The backend implementation will determine the exact matching strategy (e.g., starts-with, contains).

### 3.2 Role-Based Access Control (RBAC)
*   **3.2.1 Role Definition:**
    *   The system shall support a configurable set of user roles.
    *   Each role shall have a name, description, and a defined set of privileges.
    *   A `sysadmin` role with all privileges shall exist as a system role.
*   **3.2.2 Role Management (Sysadmin):**
    *   Users with `sysadmin` role (or specific `roles` privileges like `roles:create`, `roles:view`, `roles:edit`, `roles:delete`) shall be able to perform CRUD operations on roles. System roles like `sysadmin` may have restrictions on modification or deletion.
*   **3.2.3 Privilege System:**
    *   Privileges shall be defined for various resources (e.g., `events`, `users`, `roles`) and actions (e.g., `create`, `view`, `edit`, `delete`).
    *   The backend shall consolidate privileges from all roles assigned to a user. The `sysadmin` role implies all privileges.
*   **3.2.4 Access Control Enforcement:**
    *   Backend API endpoints shall be protected, requiring specific privileges for access.
    *   Frontend UI elements (e.g., buttons, menu items) shall be conditionally rendered or disabled based on the authenticated user's privileges.

### 3.3 Registration Invitations
*   **3.3.1 Invitation Creation:**
    *   Users with `registrationInvitations:create` privilege (typically Sysadmin) shall be able to create registration invitations.
    *   An invitation shall specify the invitee's email and the role(s) to be assigned upon successful registration.
    *   The system shall generate a unique token for each invitation.
*   **3.3.2 Invitation Management:**
    *   Users with `registrationInvitations:view` privilege shall be able to view existing invitations.
    *   Users with `registrationInvitations:delete` privilege shall be able to delete pending invitations.
    *   Invitations shall have a status (e.g., pending, accepted, expired) and an expiration time.

### 3.4 Event Management
*   **3.4.1 Event Creation:**
    *   Authorized users (with `events:create` privilege) shall be able to create new events.
    *   Event creation shall include details such as event name, type, purpose, description, start date/time, end date/time, **venue**, number of volunteers required, and an optional designated **organizer**.
    *   The organizer is selected from existing users via a search interface provided in the frontend.
    *   The `organizerUserId` (UID of the selected organizer) will be stored with the event.
*   **3.4.2 Event Viewing:**
    *   Authorized users (with `events:view` privilege, or public if configured) shall be able to list all events and view details of specific events.
    *   Event listings may support filtering and pagination. API responses for event details will include creator and organizer names if available.
*   **3.4.3 Event Updates:**
    *   Authorized users (with `events:edit` privilege) shall be able to update the details of existing events, including changing or clearing the designated organizer, and modifying start/end times.
*   **3.4.4 Event Deletion:**
    *   Authorized users (with `events:delete` privilege) shall be able to delete events.

### 3.5 Event Participation and Assignments
*   **3.5.1 User Event Sign-up:**
    *   Authenticated users shall be able to sign up for available events.
    *   The system shall track event sign-ups, creating an assignment record.
*   **3.5.2 User Event Withdrawal:**
    *   Users who have signed up for an event shall be able to withdraw their participation.
*   **3.5.3 Administrative Volunteer Assignment:**
    *   Authorized users (with `eventAssignments:assign` privilege) shall be able to manually assign volunteers to events.
*   **3.5.4 Assignment Revocation:**
    *   Authorized users (with `eventAssignments:revoke` privilege) shall be able to revoke a volunteer's assignment from an event.
*   **3.5.5 Assignment Tracking:**
    *   The system shall track the status of assignments (e.g., pending_signup, confirmed, attended, no_show).
    *   The system may track hours contributed and performance notes for assignments.
*   **3.5.6 Viewing Assignments:**
    *   Users shall be able to view events they are assigned to.
    *   Authorized users shall be able to view all assignments for a specific event.

### 3.6 Working Group Management
*   **3.6.1 Working Group Creation:**
    *   Authorized users (with `workingGroups:create` privilege) shall be able to create new working groups.
    *   Working groups shall have a name, description, and status.
*   **3.6.2 Working Group Viewing:**
    *   Authorized users (with `workingGroups:view` privilege) shall be able to list working groups and view their details.
*   **3.6.3 Working Group Updates:**
    *   Authorized users (with `workingGroups:edit` privilege) shall be able to update existing working groups.
*   **3.6.4 Working Group Deletion:**
    *   Authorized users (with `workingGroups:delete` privilege) shall be able to delete working groups.
*   **3.6.5 Member Assignment:**
    *   Authorized users (with `workingGroupAssignments:assign` privilege) shall be able to assign users to working groups.
*   **3.6.6 Member Revocation:**
    *   Authorized users (with `workingGroupAssignments:revoke` privilege) shall be able to remove users from working groups.
*   **3.6.7 Viewing Memberships:**
    *   Users shall be able to view the working groups they are members of.
    *   Authorized users shall be able to view the list of members for a specific working group.

### 3.7 Availability Management
*   **3.7.1 User Availability Specification:**
    *   Users shall be able to specify their general availability (e.g., text description).
    *   Users shall be able to specify their availability for specific dates or date ranges.
    *   This information shall be updatable via their user profile.

### 3.8 Donation Tracking
*   **3.8.1 Donation Recording:**
    *   Authorized users (with `donations:create` privilege) shall be able to record new donations.
    *   Donation records shall include details such as donor information (user or external name), donation type, amount (for monetary), description (for in-kind), quantity/hours (for time), donation date, and who recorded it.
*   **3.8.2 Donation Viewing:**
    *   Authorized users (with `donations:view` privilege) shall be able to list donations and view details of specific donations.
*   **3.8.3 Donation Updates:**
    *   Authorized users (with `donations:edit` privilege) shall be able to update existing donation records.
*   **3.8.4 Donation Deletion:**
    *   Authorized users (with `donations:delete` privilege) shall be able to delete donation records.
*   **3.8.5 User-Specific Donation Viewing:**
    *   Authorized users shall be able to list donations made by a specific registered user.

### 3.9 Reporting
*   **3.9.1 Volunteer Hours Report:**
    *   The system shall provide data for generating reports on volunteer hours, aggregated or by individual.
    *   This requires `reports:generate` privilege.
*   **3.9.2 Event Participation Report:**
    *   The system shall provide data for generating reports on event attendance and completion status.
    *   This requires `reports:generate` privilege.
*   **3.9.3 Donation Summaries Report:**
    *   The system shall provide data for generating reports on donation totals and trends.
    *   This requires `reports:generate` privilege.
*   **3.9.4 Report Presentation:**
    *   The frontend shall provide a section for authorized users to view these reports, typically in tabular format.
    *   The system may offer an option to export report data (e.g., as CSV).

### 3.10 Notifications
*   **3.10.1 Email Notification Capability:**
    *   The backend system shall be capable of sending emails for key events.
*   **3.10.2 Notification Triggers:**
    *   The system shall send email notifications for:
        *   Registration invitations.
        *   Event assignment confirmation.
        *   Event reminders (e.g., 24 hours before event start).
        *   Schedule change alerts.
*   **3.10.3 In-App Notifications:**
    *   The frontend may display in-app notifications or alerts for important updates (e.g., new assignments, upcoming events) on the user's dashboard.

### 3.11 User Dashboard
*   **3.11.1 Personalized Information:**
    *   Authenticated users shall have a dashboard displaying personalized information relevant to their role and activities.
*   **3.11.2 Key Information Display:**
    *   The dashboard shall provide quick access to upcoming events, current assignments, and recent notifications.
    *   It may display basic statistics related to the user's contributions (e.g., volunteer hours).

## 4. External Interface Requirements

### 4.1 User Interfaces
*   The system shall provide a responsive web-based user interface accessible via modern web browsers.
*   The UI shall be developed using Next.js (with App Router for **SSR**) and styled with Tailwind UI.
*   The UI shall be intuitive and facilitate easy navigation and interaction for all user classes.
*   Key UI components include:
    *   Login and Registration pages.
    *   User Dashboard.
    *   User Profile page.
    *   Event Listing, Detail, and Creation/Edit pages (including organizer search/selection, start and end time inputs).
    *   Working Group management pages (for admins).
    *   Role management pages (for Sysadmin).
    *   Invitation management pages (for Sysadmin).
    *   Donation tracking pages (for admins).
    *   Reporting views (for admins).

### 4.2 Software Interfaces
*   **Firebase Authentication:** Used for user identity management (sign-up, sign-in, token verification).
*   **Google Firestore:** Used as the primary NoSQL database for storing application data.
*   **Backend API:** The frontend application will communicate with the backend via a RESTful API. The backend API will enforce business logic and data access rules. Key endpoints include:
    *   CRUD operations for users, roles, events, invitations, etc.
    *   `GET /users/search?q={query}` for searching users.
    *   Endpoints for event sign-up and withdrawal.

### 4.3 Hardware Interfaces
*   No specific custom hardware interfaces are defined. The system relies on standard web client hardware (desktops, laptops, tablets, smartphones) and Google Cloud infrastructure.

### 4.4 Communications Interfaces
*   Communication between the client (browser) and the frontend server, and between the frontend server and the backend API server, will be over HTTPS.

## 5. Non-Functional Requirements

### 5.1 Performance Requirements
*   The system should provide responsive feedback to user interactions, with typical page loads and API responses completing within a few seconds under normal load.
*   The system should maintain acceptable performance under an expected number of concurrent users.

### 5.2 Security Requirements
*   User authentication shall be mandatory for accessing any non-public part of the system.
*   Passwords shall be managed securely by Firebase Authentication.
*   All data transmission between client and server, and between services, shall be encrypted using HTTPS.
*   The system shall implement Role-Based Access Control to ensure users can only access data and functionalities appropriate to their permissions.
*   Backend API endpoints must be protected and validate authorization for all requests.
*   Input validation shall be performed on both client and server sides to prevent common vulnerabilities.
*   Dependencies should be kept up-to-date to mitigate known vulnerabilities.
*   Sensitive configuration data (e.g., API keys) for backend services should be managed securely, for example, using Google Secret Manager.
*   Google Cloud services (e.g., Firestore, Firebase Admin SDK) shall be accessed using Application Default Credentials (ADC) where available, ensuring secure, keyless authentication from Google Cloud environments like Cloud Run.

### 5.3 Usability Requirements
*   The user interface shall be intuitive and easy to learn for users with basic computer literacy.
*   Navigation shall be consistent and predictable.
*   Error messages shall be clear and provide guidance to the user.

### 5.4 Reliability Requirements
*   The system should be highly available, leveraging the reliability of Google Cloud Run and Firestore.
*   Data integrity must be maintained through proper validation and transaction management where applicable.

### 5.5 Maintainability Requirements
*   The codebase shall be well-documented with inline comments and clear commit messages.
*   A monorepo structure will be used, with separate directories for frontend and backend under the main fiji repository, to facilitate cohesive development and maintenance.
*   Automated CI/CD pipelines (including linting and testing) shall be used to ensure code quality and streamline deployments.
*   Configuration should be managed through environment variables.
*   The monorepo should include a `README.md` with setup instructions for local development and an overview of the project, with specific READMEs in backend and frontend directories as needed.

## 6. Data Model

The system will utilize Google Firestore for data persistence. Key collections and their primary fields are outlined below. Timestamps like `createdAt`, `updatedAt` are generally assumed for most records.

### 6.1 `users` Collection
*   `uid` (String): Firebase Authentication User ID (Primary Key).
*   `email` (String): User's email address.
*   `firstName` (String): User's first name.
*   `lastName` (String): User's last name.
*   `assignedRoleIds` (Array of Strings): List of IDs of roles assigned to the user.
*   `status` (String): User account status (e.g., "active", "invited", "disabled").
*   `phoneNumber` (String, Optional).
*   `skills` (String, Optional, multi-line text for free-form skills entry).
*   `qualifications` (String, Optional, multi-line text for free-form qualifications entry).
*   `availability` (Map, Optional):
    *   `general` (String, Optional): Text description of general availability.
    *   `specificDates` (Array of Maps/Strings, Optional): Specific dates/times of availability.
*   `preferences` (String, Optional, multi-line text for free-form preferences entry).
*   `createdAt` (Timestamp).
*   `updatedAt` (Timestamp).

### 6.2 `roles` Collection
*   `roleId` (String): Unique ID for the role (auto-generated or specific name).
*   `roleName` (String): Display name of the role.
*   `description` (String): Description of the role.
*   `privileges` (Map): Map of resource names to arrays of allowed actions (e.g., `{"events": ["view", "create"], "users": ["view"]}`).
*   `isSystemRole` (Boolean): Indicates if the role is a system-defined role.
*   `createdAt` (Timestamp).
*   `updatedAt` (Timestamp).

### 6.3 `registrationInvitations` Collection
*   `invitationId` (String): Unique ID for the invitation.
*   `email` (String): Email address of the invitee.
*   `token` (String): Unique, secure token for registration.
*   `status` (String): Status of the invitation (e.g., "pending", "accepted", "expired").
*   `invitedByUserId` (String): UID of the user who created the invitation.
*   `rolesToAssignOnRegistration` (Array of Strings): List of role IDs to assign upon successful registration.
*   `createdAt` (Timestamp).
*   `expiresAt` (Timestamp).

### 6.4 `events` Collection
*   `eventId` (String): Unique ID for the event.
*   `eventName` (String): Name of the event.
*   `eventType` (String, Optional): Type or category of the event.
*   `purpose` (String, Optional): Purpose or goal of the event.
*   `description` (String, Optional): Detailed description of the event.
*   `dateTime` (Timestamp or String): Start date and time of the event.
*   `endTime` (Timestamp or String): End date and time of the event.
*   `venue` (String or Map, Optional): Venue or physical address of the event (formerly `location`).
*   `volunteersRequired` (Number, Optional): Number of volunteers needed.
*   `status` (String): Status of the event (e.g., "planned", "open_for_signup", "completed").
*   `createdByUserId` (String): UID of the user who created the event.
*   `organizerUserId` (String, Optional): UID of the user designated as the event organizer. References `users.uid`.
*   `createdAt` (Timestamp).
*   `updatedAt` (Timestamp).

### 6.5 `assignments` Collection
*   `assignmentId` (String): Unique ID for the assignment.
*   `userId` (String): UID of the assigned user.
*   `assignableId` (String): ID of the entity the user is assigned to (e.g., `eventId`, `workingGroupId`).
*   `assignableType` (String): Type of entity ("event", "workingGroup").
*   `status` (String): Status of the assignment (e.g., "pending_signup", "confirmed", "attended", "no_show", "member").
*   `assignedByUserId` (String, Optional): UID of the user who made the assignment.
*   `assignmentDate` (Timestamp): Date of assignment or signup.
*   `performanceNotes` (String, Optional): Notes on performance.
*   `hoursContributed` (Number, Optional): Hours contributed.
*   `createdAt` (Timestamp).
*   `updatedAt` (Timestamp).

### 6.6 `workingGroups` Collection
*   `groupId` (String): Unique ID for the working group.
*   `groupName` (String): Name of the working group.
*   `description` (String): Description of the working group.
*   `status` (String): Status of the group (e.g., "active", "inactive").
*   `createdByUserId` (String): UID of the user who created the group.
*   `createdAt` (Timestamp).
*   `updatedAt` (Timestamp).

### 6.7 `donations` Collection
*   `donationId` (String): Unique ID for the donation.
*   `userId` (String, Optional): UID of the registered user who made the donation.
*   `donorName` (String, Optional): Name of the donor if not a registered user.
*   `donationType` (String): Type of donation.
*   `amount` (Number, Optional): Monetary value.
*   `description` (String): Description of the donation.
*   `quantityHours` (Number, Optional): Quantity of items or hours of service.
*   `donationDate` (Timestamp): Date the donation was made.
*   `recordedByUserId` (String): UID of the user who recorded the donation.
*   `createdAt` (Timestamp).
*   `updatedAt` (Timestamp).

## 7. Deployment and Operations

### 7.1 Deployment Environment
*   The backend and frontend applications will be deployed as separate services on Google Cloud Run.
*   Docker containers will be used for packaging the applications.

### 7.2 CI/CD
*   Continuous Integration and Continuous Deployment (CI/CD) will be managed using Google Cloud Build.
*   A `cloudbuild.yaml` configuration file will be maintained in the monorepo, potentially with triggers or configurations for backend and frontend specific build steps.
*   CI/CD pipelines will include steps for:
    *   Linting.
    *   Automated testing.
    *   Building Docker images.
    *   Pushing images to Google Artifact Registry.
    *   Automated deployment to Google Cloud Run services.
*   Environment variables for Cloud Run services will be configured securely.

---