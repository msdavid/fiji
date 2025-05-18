# Software Requirements Specification (SRS)
## Project Fiji

**Version:** 1.5 
**Date:** {{YYYY-MM-DD}} <!-- Updated when committed -->

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
        3.1.1 [User Registration](#fr311-user-registration)
        3.1.2 [User Profile Management](#fr312-user-profile-management)
        3.1.3 [User Search](#fr313-user-search)
    3.2 [Permissions and Role-Based Access Control (RBAC)](#32-permissions-and-role-based-access-control-rbac)
    3.3 [Event Management](#33-event-management)
        3.3.1 [Event Creation](#fr331-event-creation)
        3.3.2 [Event Participation](#fr332-event-participation)
        3.3.3 [Event Reporting](#fr333-event-reporting)
        3.3.4 [Event Deletion](#fr334-event-deletion)
        3.3.5 [Recurrent Event Management](#fr335-recurrent-event-management)
    3.4 [Working Group Management](#34-working-group-management)
        3.4.1 [Working Group CRUD](#fr341-working-group-crud)
        3.4.2 [Working Group Member Assignment](#fr342-working-group-member-assignment)
    3.5 [Availability Tracking](#35-availability-tracking)
    3.6 [Donation Tracking](#36-donation-tracking)
    3.7 [Reporting and Analytics](#37-reporting-and-analytics)
        3.7.1 [Volunteer Hours](#fr371-volunteer-hours)
        3.7.2 [Event Participation](#fr372-event-participation)
        3.7.3 [Donation Summaries](#fr373-donation-summaries)
        3.7.4 [Flexible Formats](#fr374-flexible-formats)
        3.7.5 [Admin Summary Statistics](#fr375-admin-summary-statistics)
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
*   **ADC:** Application Default Credentials

### 1.4 References
*   Project Fiji Functional Specification Document (`docs/functional-specs.md`)
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
*   Secure user registration (invite-only) and profile management, including user search capabilities for administrative tasks.
*   Role-based access control for differentiated user capabilities.
*   Event creation (including assigning an organizer, defining start and end times, and recurrence rules), management (update, delete), and volunteer assignment (self-signup, admin assignment/withdrawal).
*   Working group creation, management (CRUD), and member assignment.
*   Volunteer availability tracking.
*   Donation tracking (excluding online payment processing).
*   Reporting and analytics on volunteer hours, event participation, donations, and system-level summaries for administrators.
*   Automated notifications and communications (e.g., event reminders, in-app notifications).
*   Personalized user dashboards with role-specific information and administrative overviews.

### 2.3 User Characteristics
Users will range from system administrators (`sysadmin`) managing the entire platform to organizational staff managing events and volunteers, and individual volunteers interacting with their profiles, events, and assignments. Users are expected to have basic web literacy.

### 2.4 Constraints
*   **Technology Stack:**
    *   Backend: Python 3.10+, FastAPI
    *   Frontend: Next.js (React), Tailwind UI 
    *   Database: Google Firestore (NoSQL)
    *   Authentication: Firebase Authentication
    *   Deployment: Google Cloud Run for backend and frontend services
    *   CI/CD: Google Cloud Build
*   **Infrastructure:** Google Cloud Platform.
*   **Development Structure:** Monorepo.
*   **Environment:** Initially, a single production environment. Staging or development environments may be considered later.
*   **Functionality:** Limited to features specified in the FSD and this SRS.

### 2.5 Assumptions and Dependencies
*   Google Cloud Platform services (Cloud Run, Firestore, Firebase Auth, Cloud Build, Artifact Registry) are available and correctly configured.
*   The TWC2 organization will provide necessary input for role definitions and initial `sysadmin` user setup.
*   UI/UX wireframes and detailed style guides for the frontend will be provided as development progresses.
*   Internet connectivity is available for users to access the web application.
*   Application Default Credentials (ADC) will be utilized for authenticating backend services to Google Cloud Platform services (e.g., Firestore, Firebase Admin SDK) when running in Google Cloud environments like Cloud Run.

## 3. System Features (Functional Requirements)

Details for each feature are derived from the FSD, with technical implementation notes added.

### 3.1 Volunteer Management
#### FR3.1.1 User Registration
*   Invite-only: New users can only register via an invitation link.
*   Invitations (`registrationInvitations` collection) will contain a unique token and associated email.
*   Registration workflow will validate the token, collect necessary user details, and create a user account in Firebase Authentication and a corresponding user profile document in Firestore (`users` collection).
#### FR3.1.2 User Profile Management
*   Users can view and edit their profiles based on permissions.
*   Profile data (as per Firestore `users` collection schema in Section 6.1) includes personal info, skills, availability, etc.
*   History (training, performance, assignments, donations) will be derived from related collections, not stored redundantly in the user profile document itself, unless for frequently accessed summary data if performance dictates.
#### FR3.1.3 User Search
*   The system shall provide an API endpoint (e.g., `GET /users/search?q={query}`) for searching users by name or email.
*   This functionality is primarily intended for administrative interfaces, such as selecting an organizer for an event or assigning users.
*   The search should be case-insensitive and support partial matches where feasible with Firestore.

### 3.2 Permissions and Role-Based Access Control (RBAC)
*   **FR3.2.1 Role Definition:**
    *   A `roles` collection in Firestore will store role definitions, including `roleName` and a `privileges` map.
    *   The `privileges` map will associate resources (e.g., "events", "users", "working_groups", "admin") with permitted actions (e.g., "create", "view", "edit", "delete", "assign", "revoke", "manage_assignments", "view_summary").
*   **FR3.2.2 `sysadmin` Role:**
    *   A top-level `sysadmin` role will have unrestricted access to all system features and data. This role can manage other roles and assign privileges.
    *   The initial creation of the `sysadmin` role document in the Firestore `roles` collection is facilitated by the `backend/utils/initialize_firestore.py` script. This script ensures the `sysadmin` role is set up with its defined privileges, including access to administrative summaries (e.g., `admin:view_summary`).
*   **FR3.2.3 Custom Roles:**
    *   `sysadmin` can create, modify, and delete custom roles.
*   **FR3.2.4 User Role Assignment:**
    *   Users will have an `assignedRoleIds` array in their Firestore document, linking to roles in the `roles` collection.
    *   A user can have multiple roles; their effective permissions are the union of all privileges from their assigned roles.
*   **FR3.2.5 Privilege Enforcement:**
    *   The FastAPI backend will enforce RBAC for all API requests (see Section 8.2). Access to administrative endpoints like `/admin/summary` will require the `sysadmin` role or a specific privilege (e.g., `admin:view_summary`).

### 3.3 Event Management
*   **FR3.3.1 Event Creation:**
    *   Authorized users (with `events:create` privilege) can create events.
    *   Event details include type, name, purpose, logistics (date, time, location, description), and volunteer requirements.
    *   For recurrent events, users can define a recurrence rule (frequency, interval, days of week/month, end condition) during creation. The system will treat this event as a "template" and generate individual event "instances".
*   **FR3.3.2 Event Participation:**
    *   **Self-Signup/Withdrawal:** Volunteers can sign up for individual event instances marked "open_for_signup" (`POST /events/{event_id}/signup`) and withdraw their signup (`DELETE /events/{event_id}/signup`). No specific privilege is required for these actions beyond being an authenticated user. This applies to both standalone events and instances of recurring events.
    *   **Admin Assignment/Removal:** Authorized users (with `events:manage_assignments` privilege) can manually assign volunteers to individual event instances (`POST /events/{event_id}/assignments`) and remove them (`DELETE /events/{event_id}/assignments/{assignment_id}`). They can also list all assignments for an event instance (`GET /events/{event_id}/assignments`).
    *   Assignments are stored in the `assignments` collection, linking users to event instances.
    *   Attendance tracking and performance notes will be part of the assignment record (editable via `PUT /events/{event_id}/assignments/{assignment_id}` by users with `events:manage_assignments`).
*   **FR3.3.3 Event Reporting:**
    *   Functionality to view event history, attendance, and feedback (if collected). This includes reporting on individual instances and summaries for recurring series.
*   **FR3.3.4 Event Deletion:**
    *   Authorized users (with `events:delete` privilege) can delete events.
    *   For a standalone event or a single instance of a recurring event, this removes the specific event document.
    *   For a recurring event template, deletion will prompt an option to also delete all future, non-exception instances.
*   **FR3.3.5 Recurrent Event Management:**
    *   **Instance Generation:** The backend will generate individual event instances based on the `recurrenceRule` of a template event, up to a configurable future horizon (e.g., 12 months from the current date). A scheduled job or triggered function may handle ongoing generation.
    *   **Template Modification:** When a recurring event template is modified (e.g., its description or recurrence rule changes), the system will provide an option to propagate these changes to all future, non-exception instances.
    *   **Instance Modification (Exceptions):** An individual instance of a recurring event can be modified independently (e.g., its time or location). Such an instance becomes an "exception" (`isException: true`) and will no longer be automatically updated by changes to its parent template for the modified fields.
    *   **Display:** API responses will differentiate between template events and instances, and link instances back to their template.

### 3.4 Working Group Management
*   **FR3.4.1 Working Group CRUD:**
    *   Authorized users can create (`POST /working-groups`, requires `working_groups:create`), view (`GET /working-groups`, `GET /working-groups/{group_id}`, requires `working_groups:view`), update (`PUT /working-groups/{group_id}`, requires `working_groups:edit`), and delete (`DELETE /working-groups/{group_id}`, requires `working_groups:delete`) working groups.
    *   Data stored in `workingGroups` collection (see Section 6.1).
    *   Deleting a working group will also delete all associated assignments.
*   **FR3.4.2 Working Group Member Assignment:**
    *   Authorized users (with `working_groups:manage_assignments` privilege) can assign users to working groups (`POST /working-groups/{group_id}/assignments`), list members (`GET /working-groups/{group_id}/assignments`), and remove members from working groups (`DELETE /working-groups/{group_id}/assignments/{assignment_id}`).
    *   Assignments are stored in the `assignments` collection, linking users to working groups.
*   **FR3.4.3 Group History:** (Future consideration) Track working group history and participation details beyond basic assignment.

### 3.5 Availability Tracking
*   **FR3.5.1 Volunteer Availability:** Volunteers can set general and specific date/time availability in their user profile.
*   **FR3.5.2 Conflict Detection:** The system should provide a way to identify potential conflicts between a volunteer's availability and event assignments.

### 3.6 Donation Tracking
*   **FR3.6.1 Donation Recording:** Authorized users can record monetary, in-kind, and contributed hours donations. Data stored in `donations` collection.
*   **FR3.6.2 Online Payments:** Online payment processing is out of scope.
*   **FR3.6.3 Donation History:** Users can view donation history relevant to their role.

### 3.7 Reporting and Analytics
*   **FR3.7.1 Volunteer Hours:** Track and report individual volunteer hours.
*   **FR3.7.2 Event Participation:** Statistics on attendance, completion rates, etc.
*   **FR3.7.3 Donation Summaries:** Reports on total donations and trends.
*   **FR3.7.4 Flexible Formats:** Reports should be exportable (e.g., CSV).
*   **FR3.7.5 Admin Summary Statistics:** Provide key system-wide statistics for administrators (e.g., total users, active events).

### 3.8 Notifications and Communications
*   **FR3.8.1 Event Reminders:** Automated notifications for upcoming events, assignment confirmations, schedule changes.
*   **FR3.8.2 Email Delivery:** Emails will be sent via Firebase services.
*   **FR3.8.3 Bulk Email Screening:** Functionality to screen volunteers for bulk email notifications.
*   **FR3.8.4 In-App Notifications:** The system will store and display in-app notifications for users (e.g., on their dashboard).

### 3.9 User Interface (Dashboard)
*   **FR3.9.1 Personalized Dashboard:** Users will see a dashboard tailored to their role(s), including quick access to upcoming events, current assignments, and recent notifications.
*   **FR3.9.2 Visualizations:** Visual representation of volunteer hours and contributions.
*   **FR3.9.3 Admin Overview:** System administrators will see an overview of key system metrics (e.g., total users, active events) on their dashboard.
*   **FR3.9.4 UI Details:** Specific UI mockups and style guides will be provided later.

## 4. External Interface Requirements

### 4.1 User Interfaces
*   The primary user interface will be a web application built with Next.js and styled with Tailwind UI.
*   The UI must be responsive.
*   **Event Detail Page:** Will show event information, signup/withdraw buttons for volunteers, and roster management tools for authorized users. For recurring events, it will clearly indicate if it's a template or an instance, and provide navigation to other instances or the template.
*   **Working Group Pages:** Will include a list page, a creation page, and a detail page with member management for authorized users.
*   **Dashboard Page:** Will display personalized information, including notifications, contribution summaries, and role-specific overviews like an admin summary.
*   Other UI notes as per existing SRS.

### 4.2 Software Interfaces
*   **FastAPI Backend API:**
    *   CRUD endpoints for core entities (users, roles, events).
        *   `POST /events` and `PUT /events/{event_id}`: Request body will accept an optional `recurrenceRule` object. If provided, the event is treated as a template. The response will indicate if an event is a template or an instance.
    *   `GET /users/search?q={query}`.
    *   User Profile Management:
        *   `GET /users/me`
        *   `PUT /users/me`
        *   `GET /users/{user_id}`
        *   `PUT /users/{user_id}`
        *   `GET /users`
    *   User Notifications:
        *   `GET /users/me/notifications?limit={int}&sort={field:direction}`: Retrieves notifications for the authenticated user. Parameters: `limit` (integer, e.g., 5), `sort` (string, e.g., `createdAt:desc`). Requires: Authenticated user.
    *   Event Participation (applies to individual event instances):
        *   `POST /events/{event_id}/signup`
        *   `DELETE /events/{event_id}/signup`
        *   `GET /events/{event_id}/assignments`
        *   `POST /events/{event_id}/assignments`
        *   `PUT /events/{event_id}/assignments/{assignment_id}`
        *   `DELETE /events/{event_id}/assignments/{assignment_id}`
    *   Working Groups CRUD:
        *   `POST /working-groups`
        *   `GET /working-groups`
        *   `GET /working-groups/{group_id}`
        *   `PUT /working-groups/{group_id}`
        *   `DELETE /working-groups/{group_id}`
    *   Working Group Assignments:
        *   `POST /working-groups/{group_id}/assignments`
        *   `GET /working-groups/{group_id}/assignments`
        *   `DELETE /working-groups/{group_id}/assignments/{assignment_id}`
    *   Administrative Endpoints:
        *   `GET /admin/summary`: Retrieves summary statistics for administrators (e.g., total users, active events). Requires: `sysadmin` role or `admin:view_summary` privilege.
            *   Response example: `{ "totalUsers": 150, "activeEvents": 25 }`
*   Other interfaces (Firebase Auth, Firestore, Cloud Build, Artifact Registry, Firebase Services for email) as per existing SRS.

### 4.3 Hardware Interfaces
*   Not applicable.

### 4.4 Communications Interfaces
*   HTTPS for all external communication. Secure internal networking for GCP services.

## 5. Non-Functional Requirements
(Sections 5.1 to 5.7 remain largely unchanged from v1.3, unless specific performance or security aspects related to new features need highlighting. For now, assume they are covered by existing statements.)

## 6. Data Management

### 6.1 Data Model (Firestore)
*   **`users`** (Schema as previously defined)
*   **`events`** (Schema as previously defined)
*   **`workingGroups`** (Schema as previously defined)
*   **`assignments`** (Schema as previously defined)
*   **`donations`** (Schema as previously defined)
*   **`roles`** (Schema as previously defined, privileges for `working_groups`, `events:manage_assignments`, and `admin:view_summary` will be added here or ensured for `sysadmin`)
*   **`registrationInvitations`** (Schema as previously defined)
*   **`notifications`**
    *   `id` (String, Document ID)
    *   `userId` (String, references `users.uid`)
    *   `message` (String)
    *   `link` (String, Optional, URL for navigation, e.g., `/dashboard/events/{eventId}`)
    *   `icon` (String, Optional, Material Icon name, e.g., "event_available", "assignment_turned_in")
    *   `read` (Boolean, default: `false`)
    *   `createdAt` (Timestamp, server-generated)
    *   `type` (String, Optional, e.g., "event_reminder", "assignment_update", "new_event_posted", "general_announcement") 

### 6.2 Data Backup and Recovery
*   Firestore PITR.

### 6.3 Data Migration
*   Existing notes remain. No new migration needs identified in this sprint.

## 7. Deployment and Operations
(Sections 7.1 to 7.4 remain largely unchanged from v1.3.)

## 8. Authentication and Authorization
(Sections 8.1 and 8.2 remain largely unchanged, but the RBAC section implicitly covers new privileges like `admin:view_summary`.)

## 9. Logging and Monitoring
(Sections 9.1 and 9.2 remain largely unchanged.)