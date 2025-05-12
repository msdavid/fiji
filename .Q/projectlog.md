# Project Log - Fiji

## Session: <YYYY-MM-DD HH:MM:SS>
**Goal:** Resolve `ModuleNotFoundError` when running `pytest` in the `backend` directory.
**Actions:** (Details omitted for brevity - see previous logs)
**Next Steps:** User to re-run `pytest` in the `backend` directory to confirm the fix.

## Session: <YYYY-MM-DD HH:MM:SS>
**Goal:** Address Pydantic V2 deprecation warnings and commit changes.
**Actions:** (Details omitted for brevity - see previous logs)
**Next Steps:** User to re-run `pytest` to verify warnings are resolved.

## Session: 2024-07-29 10:00:00
**Goal:** Execute `create-invitation.py` script and log the outcome.
**Actions:** (Details omitted for brevity - see previous logs)
**Next Steps:** Continue with project tasks.

## Session: 2024-07-29 10:05:00
**Goal:** Make `backend/utils/create-invitation.py` directly executable from the shell.
**Actions:** (Details omitted for brevity - see previous logs)
**Next Steps:** User to make the script executable (`chmod +x`) and test running it directly.

## Session: 2024-07-29 11:00:00 - 2024-07-29 15:00:00 (Approx)
**Goal:** Debug and complete user registration flow, enhance token validation, update documentation, address Firestore query warnings, and refine utility scripts.
**Actions & Files Modified:** (Details in previous log entry)
**Next Steps:** Project is in a stable state regarding core user onboarding.

## Session: 2024-07-30 14:00:00 (Approx) - Sprint 2
**Goal:** Complete Sprint 2: User Profile Management & RBAC Implementation.
**Actions & Files Modified:** (Details in previous log entry)
**Next Steps:** Await user confirmation for Sprint 3 or other tasks.

## Session: 2024-07-30 16:00:00 (Approx) - Sprint 3 (Backend)
**Goal:** Complete Sprint 3: Event Management (Backend).
**Actions & Files Modified:** (Details in previous log entry)
**Next Steps:** Await user confirmation for Sprint 4 (Event Management - Frontend) or other tasks.

## Session: 2024-07-30 18:00:00 (Approx) - Debug Backend Imports
**Goal:** Resolve `ModuleNotFoundError: No module named 'backend'` when running the backend application.
**Issue:** Imports in router and dependency files were using an incorrect prefix (e.g., `from backend.dependencies...`) when the application is run from within the `backend` directory.
**Resolution:** Changed imports to be direct from the `backend` directory's subfolders (e.g., `from dependencies...`).
**Files Modified:**
*   `backend/routers/roles.py`
*   `backend/routers/users.py`
*   `backend/routers/events.py`
*   `backend/dependencies/rbac.py`
*   `backend/routers/invitations.py`
*   `.Q/projectlog.md` (this update)
**Next Steps:** User to restart backend server and proceed with manual testing of Sprint 2 features.

## Session: 2024-07-31 (Approx) - User Profile Page Debugging & Refinement
**Goal:** Debug and refine the user profile page (`frontend/src/app/dashboard/profile/page.tsx`) and related backend components (`backend/models/user.py`, `backend/routers/users.py`) to ensure profile data can be fetched and updated correctly.
**Key Actions & Outcomes:** (Details in previous log entry)
*   **Current Status:** Profile updates for `firstName`, `lastName`, `phoneNumber` are working. `skills`, `qualifications`, and `preferences` are now accepted by the backend model and are being sent by the frontend.

## Session: 2024-07-31 (Continued) - Refactor Skills/Qualifications to Textareas & UI Enhancements
**Goal:** Change `skills` and `qualifications` fields from comma-separated list inputs to free-text textareas, update documentation, and improve UI/UX of the profile page.
**Key Actions & Outcomes:** (Details in previous log entry)
*   **Current Status:** Skills and qualifications are now handled as free-text (multi-line) strings on both frontend and backend. Data fetching and saving for these fields is functional. Profile page UI has been enhanced.
**Next Steps:** Awaiting further instructions or tasks.

## Session: 2024-08-01 (Approx) - Debug Admin UI, Font Warnings & Complete Sprint 2 Testing
**Goal:** Debug "User Management" link visibility for `sysadmin`, resolve font preloading warnings, and confirm Sprint 2 test completion.
**Key Actions & Outcomes:** (Details in previous log entry)
*   **AuthContext & User Profile for Admin Link:**
    *   Updated `frontend/src/context/AuthContext.tsx` to fetch user profile data from `/users/me` after login and store it in `userProfile` state.
    *   Modified `UserProfile` interface and `isAdmin` check.
*   **Admin Page Imports & Authorization:**
    *   Corrected imports and authorization logic in admin pages.
*   **Navigation Enhancement:**
    *   Added "← Back to Dashboard" link to admin users page.
*   **Font Preload Warning Resolution:**
    *   Addressed font warnings.
*   **Code Cleanup:**
    *   Removed temporary `console.log` statements.
*   **Sprint 2 Testing Completion:**
    *   User Mauro confirmed successful completion of all tests for Sprint 2.
**Files Modified:** (List from previous log)
*   `.Q/projectlog.md` (this update)
**Next Steps:** Awaiting user instructions for Sprint 3 (Event Management - Backend & Frontend) or other tasks.

## Session: 2024-08-02 (Admin Profile View Feature)
**Goal:** Add feature for `sysadmin` to view user profiles from the admin user list.
**Actions:** (Details in previous log entry)
**Next Steps:** Awaiting further instructions.

## Session: 2024-08-02 (Sprint 3 Completion Reverted)
**Goal:** Revert incorrect documentation update for Sprint 3 completion.
**Actions:**
*   User Mauro noted that Sprint 3 testing was not yet complete.
*   Reverted commit `6f013fa` which had updated `docs/project-progress.md` and `.Q/projectlog.md` marking Sprint 3 as complete.
**Files Modified:**
*   `docs/project-progress.md` (Reverted)
*   `.Q/projectlog.md` (Reverted, then this update added)
**Next Steps:** User to proceed with Sprint 3 Event Management testing.

## Session: 2024-08-02 (Create Role Utility Script)
**Goal:** Create and refine a utility script `backend/utils/create-role.py` for adding new roles to Firestore.
**Actions:**
*   Created initial version of `backend/utils/create-role.py` with argument parsing for `roleName`, `description`, and `privileges`.
*   Made the script executable (`chmod +x`).
*   Added shebang `#!/usr/bin/env python3` to the script.
*   Updated the script to use `python-dotenv` to load `GOOGLE_CLOUD_PROJECT` from `backend/.env`.
*   Added a check to prevent re-initializing Firebase Admin SDK if already initialized.
*   Diagnosed and fixed a `NameError: name 'firebase_admin' is not defined` by adding `import firebase_admin` to the script.
*   Committed all changes related to the script.
**Files Modified/Created:**
*   `backend/utils/create-role.py`
*   `.Q/projectlog.md` (this update)
**Next Steps:** User to test the `create-role.py` script.