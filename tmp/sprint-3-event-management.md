Okay, Mauro. Here are detailed step-by-step instructions for manually testing the Event Management features (Sprint 3) via your browser.

**A. Prerequisites**

1.  **User Accounts:**
    *   **`SysAdminUser`**: A user with the `sysadmin` role (which should have privileges like `events:create`, `events:edit`, `events:delete`, `events:manage_assignments`).
    *   **`RegularUser`**: A user *without* `sysadmin` or specific event management privileges, who can act as a volunteer.
2.  **Applications Running:** Ensure both frontend and backend applications are running and accessible.
3.  **Key URLs (Assumed - adjust if different):**
    *   Login: `/login`
    *   Dashboard: `/dashboard`
    *   Event Listing: `/dashboard/events`
    *   Create New Event: `/dashboard/events/new`
    *   Event Detail: `/dashboard/events/[eventId]` (e.g., `/dashboard/events/some-event-id`)
    *   Edit Event: `/dashboard/events/[eventId]/edit`

---

**B. Testing as `SysAdminUser` (or User with Event Management Privileges)**

1.  **Login as `SysAdminUser`:**
    *   Navigate to `/login` and log in with `SysAdminUser` credentials.
    *   **Expected Outcome:** Successful login, redirected to `/dashboard`.

2.  **Navigate to Event Management Area:**
    *   From the `/dashboard` (or via a navigation menu), find a link to "Events" or "Event Management". Click it.
    *   **Expected Outcome:** You are taken to the Event Listing page (e.g., `/dashboard/events`). Initially, this list might be empty.

3.  **Create a New Event:**
    *   On the Event Listing page, find and click a "Create Event", "New Event", or "+" button.
    *   **Expected Outcome:** You are taken to the Event Creation form (e.g., `/dashboard/events/new`).
    *   Fill in the event details:
        *   **Event Name:** `Test Event Alpha`
        *   **Event Type:** `Workshop`
        *   **Purpose:** `To test event creation functionality.`
        *   **Description:** `Detailed description for Test Event Alpha.`
        *   **Date & Time:** Select a future date and time.
        *   **Duration (Minutes):** `120`
        *   **Location:** `Online via Zoom`
        *   **Volunteers Required:** `5`
        *   **Status:** Select `Open for Signup` (or similar status that allows volunteers to register).
    *   Click the "Create Event" or "Save" button.
    *   **Expected Outcome:**
        *   A success message appears (e.g., "Event created successfully!").
        *   You are redirected to the Event Listing page or the Event Detail page for the newly created event.
        *   `Test Event Alpha` appears in the list of events with correct summary details (name, date, status).

4.  **View Event Details:**
    *   From the Event Listing page, click on `Test Event Alpha`.
    *   **Expected Outcome:** You are taken to the Event Detail page for `Test Event Alpha`. All the information you entered (name, type, purpose, description, date/time, duration, location, volunteers required, status) should be displayed correctly.

5.  **Edit an Existing Event:**
    *   On the Event Detail page for `Test Event Alpha` (or from a list action), find and click an "Edit Event" button.
    *   **Expected Outcome:** You are taken to the Event Edit form, pre-filled with `Test Event Alpha`'s details.
    *   Modify some fields:
        *   **Event Name:** `Test Event Alpha - Updated`
        *   **Location:** `Community Hall Room 101`
        *   **Status:** Change to `Draft` (or another status if `Open for Signup` was already tested for creation).
    *   Click the "Save Changes" or "Update Event" button.
    *   **Expected Outcome:**
        *   A success message appears.
        *   You are redirected to the Event Detail page or Event Listing page.
        *   The event's details (name, location, status) are updated as per your changes. If on the listing page, the updated name and status should be visible.

6.  **Create a Second Event (for testing signup and deletion):**
    *   Repeat step B.3 to create another event:
        *   **Event Name:** `Test Event Beta (Signup Test)`
        *   **Status:** `Open for Signup`
        *   Other fields can be similar to `Test Event Alpha`.
    *   **Expected Outcome:** `Test Event Beta (Signup Test)` is created and appears in the event list.

7.  **(If Applicable) Admin View/Manage Event Assignments:**
    *   *This depends on whether Sprint 3 included UI for admins to see who signed up for an event or to manually assign users.*
    *   On the Event Detail page for `Test Event Beta (Signup Test)`, look for a section or tab related to "Assignments", "Attendees", or "Volunteers".
    *   **Expected Outcome (if feature exists):** Initially, this list should be empty.
    *   If there's a way to manually assign a user:
        *   Try assigning `RegularUser` to `Test Event Beta (Signup Test)`.
        *   **Expected Outcome:** `RegularUser` appears in the assignment list for this event.

8.  **Logout `SysAdminUser`.**

---

**C. Testing as `RegularUser`**

1.  **Login as `RegularUser`:**
    *   Navigate to `/login` and log in with `RegularUser` credentials.
    *   **Expected Outcome:** Successful login, redirected to `/dashboard`.

2.  **Navigate to Event Listing:**
    *   From the `/dashboard` or navigation menu, go to the Event Listing page.
    *   **Expected Outcome:**
        *   You see `Test Event Alpha - Updated` (Status: `Draft` or as set by admin).
        *   You see `Test Event Beta (Signup Test)` (Status: `Open for Signup`).
        *   There should be **no** "Create Event" or "Edit Event" buttons visible for `RegularUser`.

3.  **View Event Details:**
    *   Click on `Test Event Alpha - Updated`.
    *   **Expected Outcome:** The Event Detail page loads. All details are visible.
    *   Look for a "Sign Up" button.
    *   **Expected Outcome (for `Test Event Alpha - Updated` with status `Draft`):** The "Sign Up" button should either be *absent*, *disabled*, or if present and clicked, it should result in an error/message indicating signup is not possible for this event status.

4.  **Self-Signup for an Open Event:**
    *   Navigate back to the Event Listing page.
    *   Click on `Test Event Beta (Signup Test)` (Status: `Open for Signup`).
    *   **Expected Outcome:** The Event Detail page loads.
    *   Find and click the "Sign Up" or "Register for Event" button.
    *   **Expected Outcome:**
        *   A success message appears (e.g., "Successfully signed up for the event!").
        *   The UI updates to indicate you are signed up (e.g., button changes to "Withdraw Signup" or "Cancel Registration", or a status message "You are signed up").

5.  **Attempt to Sign Up Again:**
    *   On the Event Detail page for `Test Event Beta (Signup Test)` (where you are now signed up).
    *   **Expected Outcome:** The "Sign Up" button should not be available or should be disabled. If it was replaced by a "Withdraw" button, this test is implicitly covered.

6.  **Withdraw from Event:**
    *   On the Event Detail page for `Test Event Beta (Signup Test)`.
    *   Find and click the "Withdraw Signup" or "Cancel Registration" button.
    *   **Expected Outcome:**
        *   A success message appears (e.g., "Successfully withdrawn from the event.").
        *   The UI updates to indicate you are no longer signed up (e.g., button changes back to "Sign Up", status message updates).

7.  **Attempt to Access Admin Event Actions (Permission Check):**
    *   Manually try to navigate to the Event Creation URL (e.g., `/dashboard/events/new`).
    *   **Expected Outcome:** Access denied. You should be redirected or see an "Unauthorized" message.
    *   Manually try to navigate to an Event Edit URL (e.g., `/dashboard/events/[ID_of_Test_Event_Beta]/edit`).
    *   **Expected Outcome:** Access denied.

8.  **Logout `RegularUser`.**

---

**D. Testing as `SysAdminUser` (Cleanup and Final Checks)**

1.  **Login as `SysAdminUser`:**
    *   Navigate to `/login` and log in with `SysAdminUser` credentials.

2.  **(If Applicable) Verify `RegularUser`'s Signup/Withdrawal in Admin View:**
    *   Navigate to the Event Detail page for `Test Event Beta (Signup Test)`.
    *   If an "Assignments" or "Attendees" section exists for admins (from step B.7):
        *   **Expected Outcome:** If `RegularUser` signed up and didn't withdraw, they should be listed. If they withdrew, they should not be listed (or shown as withdrawn). This confirms the backend assignment record was updated.

3.  **Delete an Event:**
    *   Navigate to the Event Listing page.
    *   Find `Test Event Alpha - Updated`.
    *   Look for a "Delete" button/icon associated with this event (either on the list or on its detail page). Click it.
    *   A confirmation prompt might appear (e.g., "Are you sure you want to delete this event?"). Confirm.
    *   **Expected Outcome:**
        *   A success message appears (e.g., "Event deleted successfully!").
        *   `Test Event Alpha - Updated` is removed from the Event Listing page.
    *   Repeat for `Test Event Beta (Signup Test)`.
    *   **Expected Outcome:** Both test events are now deleted.

4.  **Logout `SysAdminUser`.**

---

These steps cover the main functionalities for Event Management as per Sprint 3's goals. Pay attention to UI feedback, error messages, and data persistence after actions. Let me know if any part is unclear or if your application's paths/UI elements differ significantly!