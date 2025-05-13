# Project Fiji: Functional Specifications

## 1. Introduction

### 1.1. Purpose
Project Fiji is a web application designed to manage and track volunteer activities within the TWC2 organization. It provides comprehensive tools for volunteer registration, profile management, event and activity coordination, working group assignments, and reporting.

### 1.2. Scope
This document outlines the functional requirements of Project Fiji. It serves as a primary communication tool between stakeholders and the development team. Technical specifications will be detailed in a separate document.

## 2. System Overview
Fiji will be a web-based application enabling TWC2 to effectively manage its volunteer workforce. The system will facilitate tracking volunteer participation, monitoring contributions, and coordinating events.

## 3. Permissions and Roles
The system implements a robust Role-Based Access Control (RBAC) mechanism. As a system administrator, you have granular control over user access. You can define **arbitrary roles** tailored to the specific operational needs of your organization, going beyond predefined templates. For each role you create—whether it's "Content Moderator," "Financial Analyst," or "Regional Event Coordinator"—you can precisely assign permissions. These permissions dictate which **actions** (e.g., `create`, `read`, `update`, `delete`, `list`, `approve`, `publish`) a user with that role can perform on specific **resources** within Fiji (e.g., `events`, `user_profiles`, `working_groups`, `financial_reports`, `system_settings`). This allows you to implement the principle of least privilege effectively, ensuring users only have the access necessary for their responsibilities. This dynamic and customizable approach is significantly more flexible and secure than traditional systems with fixed, unchangeable roles, as it allows you to adapt the access control model precisely to your organization's structure and evolving requirements, simplifying user management and reducing the risk of unauthorized access.

### 3.1. Roles
Roles define a set of permissions and privileges within the system.
- The `sysadmin` role is the highest-level role with unrestricted access.
- Roles can be created and deleted by users with the `sysadmin` role.
- Users can be assigned multiple roles; their effective permissions will be a union of all permissions granted by their assigned roles.

### 3.2. Privileges
Privileges define specific actions a user can perform on system entities or features. Each privilege is associated with one or more actions (e.g., create, view, edit, delete).

#### 3.2.1. `sysadmin` Exclusive Privileges
The `sysadmin` role possesses all privileges, including but not limited to:
- Managing site configurations and the database.
- Modifying all aspects of the system without restriction.
- Creating, modifying, and deleting user accounts of all permission levels.
- Creating and modifying roles and assigning privileges to them.

#### 3.2.2. General Privileges
The following privileges can be assigned to roles, with specific actions (e.g., create, view, edit, delete) configurable for each role:

- **User Management (`users`):**
    - Actions: create, view, edit, delete.
- **Registration Invitations (`registration_invitations`):**
    - Actions: create, view, edit, delete.
- **Working Group Management (`working_groups`):**
    - Actions: create, view, edit, delete.
- **Working Group Assignments (`working_group_assignments`):**
    - Actions: assign, revoke.
- **Event Management (`events`):**
    - Actions: create, view, edit, delete.
- **Event Assignments (`event_assignments`):**
    - Actions: assign, revoke.
- **Reporting (`generate_reports`):**
    - Actions: generate reports.
- **User History Management (`user_history`):**
    - Actions: view, edit.
- **User Hours Management (`user_hrs`):**
    - Actions: view, edit.

*Example: A role might be configured with `view` access to `events` but `create, view, edit, delete` access for `registration_invitations`.*

## 4. Core Functionalities

### 4.1. Volunteer Management
- **Invitation-Only Registration:** New users can only register via an invitation link.
- **Secure Registration Workflow:** Includes email verification and secure credential setup.

### 4.2. User Profile Management
User profiles will store comprehensive volunteer information:
- **Personal Information:** Name, email, phone number.
- **Skills and Qualifications:** Relevant skills, certifications, and expertise.
- **Availability and Preferences:** General availability and specific preferences for volunteering.
- **Training History:** Record of completed training sessions.
- **Performance History:** Feedback and performance notes from activities.
- **Assignments History:** Log of all past and current event/activity assignments.
- **Donations History:** Record of monetary and in-kind donations.
- **Current Assignments:** Overview of active assignments.

### 4.3. Volunteer Assignments
- **Manual Assignment:** Authorized users (based on role privileges) can manually assign volunteers to events and activities.
- **Self-Sign-up:** Volunteers can self-enroll for available events and activities.
- **Assignment Tracking:** System maintains a history of all assignments.

### 4.4. Event Management

#### 4.4.1. Event Creation and Details
Authorized users can create and manage events with the following details:
- **Event Type:** Categorization of the event (e.g., workshop, outreach, fundraising).
- **Event Name:** Clear and descriptive title.
- **Event Purpose:** Objective or goal of the event.
- **Logistics:** Date, time, location, and detailed description.
- **Volunteer Requirements:** Number of volunteers needed.

#### 4.4.2. Event Participation
- **Self-Sign-up:** Volunteers can register for events they are interested in.
- **Attendance Tracking:** System records volunteer attendance for events.
- **Performance Tracking:** Ability to record notes on volunteer performance during events.

#### 4.4.3. Event Communication
- **Reminders and Notifications:** Automated alerts for upcoming events.
- **Feedback and Evaluation:** Mechanisms for collecting feedback post-event.

#### 4.4.4. Event Reporting
- **Event History:** Access to records of past events.
- **Participation Reports:** Data on attendance and volunteer involvement.

### 4.5. Working Group Management
- **Creation and Management:** Tools for creating and defining working groups.
- **Assignments:** Assigning volunteers to specific working groups.
- **History and Reporting:** Tracking activities and contributions within working groups.

### 4.6. Availability Tracking
- **General Availability:** Volunteers can specify their general availability (e.g., weekdays, weekends).
- **Specific Availability:** Option to indicate availability for specific dates and times.
- **Conflict Detection:** System flags potential conflicts with existing assignments.

### 4.7. Donation Tracking
- **Monetary Donations:** Recording financial contributions.
- **In-Kind Contributions:** Tracking non-monetary donations (e.g., goods, services).
- **Hours Contributed:** (Covered under Volunteer Hours reporting).
- **Donation History and Reporting:** Comprehensive records and summaries of donations.

## 5. Reporting and Analytics

### 5.1. Volunteer Hours
- **Individual Tracking:** System logs hours contributed by each volunteer.
- **Self-View:** Volunteers can view their own accumulated hours.
- **Exportable Reports:** Ability to export hour logs and summaries.

### 5.2. Event Participation
- **Attendance Statistics:** Data on event attendance rates.
- **Event Completion Rates:** Tracking the successful completion of events.
- **Volunteer Participation Frequency:** Analysis of how often volunteers participate.

### 5.3. Donation Summaries
- **Total Donations by Type:** Aggregated data on monetary and in-kind donations.
- **Donation Trends:** Analysis of donation patterns over time.
- **Individual Contribution Reports:** Summaries of donations made by individual donors/volunteers.

### 5.4. Flexible Reporting Formats
The system should support the generation of reports in various formats suitable for analysis and presentation.

## 6. Notifications and Communications

### 6.1. Event-Related Notifications
- **Automated Reminders:** For upcoming events and assigned tasks.
- **Assignment Confirmations:** Notifications upon successful assignment to an event or activity.
- **Schedule Change Alerts:** Informing volunteers of any modifications to event schedules.

### 6.2. Bulk Communication
- **Targeted Email Notifications:** Ability to screen and select volunteers for bulk email communications (e.g., newsletters, general announcements).

## 7. User Interface

### 7.1. Dashboard
- **Personalized View:** Each user will have a dashboard tailored to their role(s), displaying relevant information.
- **Quick Access:** Links to upcoming events, current assignments, and important notifications.
- **Visual Summaries:** Graphical representation of volunteer hours and contributions where applicable.