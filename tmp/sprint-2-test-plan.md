Okay, Mauro, let's test the Sprint 2 features. I'll guide you step-by-step. Please perform these actions in your browser.

**Prerequisites:**
*   You have the frontend URL for your deployed application.
*   You have login credentials for a `sysadmin` user.
*   You have login credentials for at least one regular (non-admin) user (created via an invitation).
*   The `sysadmin` role should have the necessary permissions (as defined in `initialize_firestore.py`).

---

**Phase 1: User Profile Management (as a Regular User)**

1.  **Login as Regular User:**
    *   Open your browser and navigate to the frontend application.
    *   Log in using the credentials of a **regular (non-admin) user**.

2.  **Test Case 1.1: View Own Profile**
    *   After logging in, you should be on the dashboard.
    *   Click on the "My Profile" link in the navigation bar.
    *   **Verify:**
        *   The page displays your First Name, Last Name, Email.
        *   It should also show your assigned roles (might be empty or show default roles if any were assigned on registration), and status (e.g., "active").
        *   The Phone Number field is present (it might be empty).

3.  **Test Case 1.2: Edit Own Profile**
    *   On the "My Profile" page:
        *   Change your **First Name** to something new (e.g., "FirstNameUpdated").
        *   Change your **Last Name** to something new (e.g., "LastNameUpdated").
        *   Enter or update your **Phone Number** (e.g., "1234567890").
    *   Click the "Save Changes" button.
    *   **Verify:**
        *   A success message (e.g., "Profile updated successfully!") appears briefly.
        *   The displayed First Name, Last Name, and Phone Number on the page update to the new values.
    *   Refresh the browser page.
    *   **Verify:** The updated information (First Name, Last Name, Phone Number) persists and is displayed correctly.
    *   Try to click "Save Changes" again without making any new changes.
    *   **Verify:** You should see a message like "No changes to save" or the button might appear to do nothing significant if no data changed.
    *   If you set a phone number, try editing your profile again, clear the Phone Number field, and click "Save Changes".
    *   **Verify:** The Phone Number is removed from your profile display.

---

**Phase 2: User List and Role Assignment (as `sysadmin` User)**

1.  **Logout and Login as `sysadmin`:**
    *   Log out from the regular user account.
    *   Log in to the frontend application using the `sysadmin` user credentials.

2.  **Test Case 2.1: Access User Management Page**
    *   After logging in as `sysadmin`, look for a "User Management" link in the navigation bar.
    *   Click on the "User Management" link.
    *   **Verify:**
        *   You are taken to the User Management page.
        *   A list/table of users is displayed, showing columns like Name, Email, Status, and Roles.
        *   You should see the `sysadmin` user and the regular user(s) you have in the system.

3.  **Test Case 2.2: Manage and Assign Roles to a User**
    *   In the user list, locate the **regular user** you used in Phase 1.
    *   Click the "Manage Roles" button/link for that regular user.
    *   **Verify:** A modal window titled "Manage Roles for [user's email]" opens.
    *   Inside the modal:
        *   **Verify:** You see a list of available roles with checkboxes. At a minimum, "sysadmin" should be listed. If you have created other roles (e.g., "editor", "viewer") via API or scripts, they should also appear.
        *   **Verify:** The checkboxes should reflect the user's currently assigned roles.
    *   **Action:**
        *   If other roles besides "sysadmin" are available (e.g., "editor"), check the box for one of these new roles.
        *   If only "sysadmin" is available, you can test by checking it (this will grant the user sysadmin privileges).
        *   If the user already had some roles, try unchecking one and checking another.
    *   Click the "Save Roles" button in the modal.
    *   **Verify:**
        *   The modal closes.
        *   The "Roles" column for that user in the main list updates to show the newly assigned roles.
    *   Refresh the "User Management" page.
    *   **Verify:** The role changes for the user persist in the list.

4.  **Test Case 2.3: Verify Role Assignment Effect (Optional but Recommended)**
    *   If you assigned a role with specific, testable permissions (and the frontend/backend uses these permissions for conditional access beyond just `sysadmin`), you could log in as that regular user again and see if their access has changed.
    *   *For now, visual confirmation of the role name in the list is the primary check for this UI test.*

---

**Phase 3: Permission Enforcement**

1.  **Test Case 3.1: Regular User Attempting to Access Admin Page**
    *   Log out from the `sysadmin` account.
    *   Log in again as the **regular user**.
    *   **Verify (Navbar):** The "User Management" link should **not** be visible in the navigation bar for the regular user.
    *   **Action (Direct Navigation):** Manually type the URL for the admin user management page into your browser's address bar (e.g., `your-frontend-url/dashboard/admin/users`) and press Enter.
    *   **Verify (Page Access):**
        *   You should be denied access to this page.
        *   You should see an error message like "You do not have permission to view this page," "Access Denied," or be redirected (e.g., back to the main dashboard or login page).
        *   The list of users should definitely not be displayed.

---

This covers the UI-testable aspects of Sprint 2. Please go through these steps and let me know how it goes or if you encounter any issues.

If you're interested and have API testing tools (like Postman, Insomnia, or `curl`), we can then proceed to test the backend API endpoints for Role Definition Management (creating/updating/deleting the roles themselves), as Sprint 2 did not include UI for this.