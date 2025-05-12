Okay, Mauro. Here are detailed instructions for manually testing Sprint 2 (User Profile Management & RBAC Implementation) via your browser.

**A. Prerequisites**

1.  **User Accounts:** Ensure you have credentials for at least two distinct user accounts:
    *   **`SysAdminUser`**: A user who has been assigned the `sysadmin` role. The role ID for sysadmin is `sysadmin`.
    *   **`RegularUser`**: A user who does *not* have the `sysadmin` role. This user might have other, non-administrative roles or no specific roles beyond being a standard authenticated user.
2.  **Applications Running:** Confirm that both the frontend and backend applications are running and accessible from your browser.
3.  **Key URLs:** Be aware of the following application paths (adjust if your paths differ):
    *   Login: `/login`
    *   Dashboard: `/dashboard`
    *   User Profile: `/dashboard/profile`
    *   Admin User Management: `/dashboard/admin/users`

**B. Testing as a `RegularUser`**

1.  **Login:**
    *   Open your browser and navigate to the `/login` page.
    *   Enter the credentials for `RegularUser` and submit.
    *   **Expected Outcome:** Successful login. You are redirected to the `/dashboard` page.

2.  **Dashboard View:**
    *   On the `/dashboard` page, examine the available links and information.
    *   **Expected Outcome:** The dashboard displays general user information. Crucially, there should be *no* visible link or access to "User Management" or other administrative sections.

3.  **Access Own Profile:**
    *   Navigate to your profile page. This might be via a "Profile" link on the dashboard or by directly entering `/dashboard/profile` in the address bar.
    *   **Expected Outcome:** The profile page loads, displaying `RegularUser`'s current information: First Name, Last Name, Email, Phone Number, Skills, Qualifications, and Preferences. The Email field should be read-only.

4.  **Edit Own Profile:**
    *   On the `/dashboard/profile` page:
        *   Modify the `firstName`, `lastName`, and `phoneNumber` fields.
        *   Enter or update text in the `skills`, `qualifications`, and `preferences` fields (these should be multi-line text areas).
        *   Click the "Save" or "Update" button.
    *   **Expected Outcome:** A success message appears, indicating the profile was updated.
    *   To verify persistence:
        *   Refresh the `/dashboard/profile` page.
        *   Alternatively, navigate away from the profile page (e.g., to `/dashboard`) and then return to `/dashboard/profile`.
    *   **Expected Outcome:** All the changes you made in the previous step are still present and correctly displayed.

5.  **Attempt Access to Admin Area:**
    *   In the browser's address bar, manually type the URL for the admin user management page: `/dashboard/admin/users` and press Enter.
    *   **Expected Outcome:** Access is denied. You should either be redirected (e.g., back to `/dashboard` or to `/login`) or an "Unauthorized" / "Forbidden" error message/page should be displayed. The content of the admin user management page must not be visible.

6.  **Logout:**
    *   Find and click the "Logout" button or link.
    *   **Expected Outcome:** You are successfully logged out and redirected, typically to the `/login` page or the application's home page.

**C. Testing as a `SysAdminUser`**

1.  **Login:**
    *   Navigate to the `/login` page.
    *   Enter the credentials for `SysAdminUser` and submit.
    *   **Expected Outcome:** Successful login. You are redirected to the `/dashboard` page.

2.  **Dashboard View (Admin):**
    *   On the `/dashboard` page, examine available links.
    *   **Expected Outcome:** In addition to general user information, a "User Management" link (or similar, e.g., "Admin") should be visible and clickable, indicating your `sysadmin` privileges are recognized.

3.  **Access Own Profile:**
    *   Navigate to your (the `SysAdminUser`'s) profile page, likely via `/dashboard/profile`.
    *   **Expected Outcome:** Your profile page loads, displaying your current information.

4.  **Edit Own Profile:**
    *   Similar to step B.4, edit various fields on your own profile and save.
    *   Verify persistence by refreshing or navigating away and back.
    *   **Expected Outcome:** Changes are saved and persist correctly.

5.  **Access Admin User Management Page:**
    *   From the `/dashboard`, click the "User Management" link.
    *   Alternatively, navigate directly to `/dashboard/admin/users`.
    *   **Expected Outcome:** The admin user management page loads successfully. You should see UI elements for viewing and/or managing users and their roles.

6.  **View List of Users (on Admin Page):**
    *   Examine the `/dashboard/admin/users` page.
    *   **Expected Outcome:** A list of registered users is displayed, including (but not limited to) `SysAdminUser` and `RegularUser`.

7.  **View Specific User's Profile (from Admin Page - if feature exists):**
    *   If the admin page allows viewing other users' details (this is a common admin feature but confirm its Sprint 2 scope):
        *   Find `RegularUser` in the list.
        *   Click on `RegularUser` or an associated "View" / "Details" button.
    *   **Expected Outcome:** You can view the profile information of `RegularUser`. Check if you can also view `SysAdminUser`'s profile this way.

8.  **Manage User Roles (on Admin Page - using RoleManagementModal):**
    *   The project log indicates a `RoleManagementModal.tsx`. This suggests UI for role assignment.
    *   On the `/dashboard/admin/users` page, find `RegularUser`.
    *   Look for an option to "Manage Roles", "Edit Roles", or similar for `RegularUser`. This might open the modal.
    *   **Test Scenario 1: Assigning a role.** If test roles exist (other than `sysadmin`), try assigning one to `RegularUser`.
    *   **Test Scenario 2: Revoking a role.** If `RegularUser` has any roles, try revoking one.
    *   *Note: The ability to create/delete role *definitions* themselves is typically a separate admin function (covered in Sprint 0 backend). This test focuses on assigning/unassigning *existing* roles to users.*
    *   **Expected Outcome:** Any changes to `RegularUser`'s roles are saved. Verification might involve:
        *   Re-opening the role management modal for `RegularUser` to see if the changes persist.
        *   If a role grants/revokes specific permissions, logging in as `RegularUser` afterwards to see if their access changes accordingly (this might be more in-depth than Sprint 2 manual testing requires, but good to note).

9.  **Logout:**
    *   Log out of the application.
    *   **Expected Outcome:** Successful logout.

**D. Specific RBAC Checks (Focus on UI and Page Access)**

1.  **Regular User - No Admin UI Elements:**
    *   While logged in as `RegularUser`, meticulously check all pages you can access (`/dashboard`, `/dashboard/profile`).
    *   **Expected Outcome:** No buttons, links, or forms related to admin-level user management (listing users, changing other users' roles) should be visible or interactable.

2.  **SysAdmin User - Admin UI Elements Present:**
    *   While logged in as `SysAdminUser`, confirm the "User Management" link is present on the dashboard and leads to the correct admin page.
    *   **Expected Outcome:** Admin-specific UI is available and functional as tested in section C.

These steps should provide a comprehensive manual test of the User Profile Management and RBAC features implemented in Sprint 2. Let me know if you have any specific areas you'd like to focus on or if any features behave differently than assumed from the logs.