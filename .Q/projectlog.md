# Project Log - Fiji Platform

## Session DATE_TIME_PLACEHOLDER

**Goal:** Relocate the "Delete Working Group" button to the end of the card on the View Working Group (Detail) page.

**Activities:**

1.  **Reviewed `[groupId]/page.tsx`:** Analyzed the JSX structure.
2.  **Modified `[groupId]/page.tsx`:**
    *   Moved the "Actions" section (renamed to "Danger Zone") containing the "Delete Working Group" button to be the last element within the main content card (`div.bg-white.dark:bg-gray-900`).
    *   This places it after the "Manage Members" section.
    *   The "Danger Zone" section includes a title (`h3.text-xl.font-semibold`) and a small descriptive paragraph below the button.
    *   The `deleteError` display was also moved to appear just before the "Danger Zone" section if an error occurs during deletion.
    *   Removed the conditional top margin/border logic from the "Manage Members" section as the "Danger Zone" will always follow it if `canDelete` is true, or nothing will follow if `canDelete` is false and `canManageAssignments` is true. The "Manage Members" section will always have a top border if it's not the first section in the card after the main details.

**Files Modified:**

*   `frontend/src/app/dashboard/admin/working-groups/[groupId]/page.tsx`

**Next Steps:**

*   Commit the changes.

---
(Previous log entries remain below)

## Session DATE_TIME_PLACEHOLDER

**Goal:** Add a "Delete Working Group" button and functionality to the View Working Group (Detail) page.

**Activities:**

1.  **Permission Check:**
    *   Added `canDelete` state variable based on user profile privileges (`working_groups`, `delete` or `sysadmin`).

2.  **State Variables:**
    *   Added `isDeleting` (boolean) to track deletion progress.
    *   Added `deleteError` (string | null) to store errors from the delete operation.

3.  **`handleDeleteWorkingGroup` Function:**
    *   Created an asynchronous function to handle the deletion logic.
    *   Includes a confirmation dialog (`confirm(...)`) before proceeding.
    *   Sets `isDeleting` to `true` and clears `deleteError`.
    *   Makes a `DELETE` request to `/working-groups/{groupId}` with the Firebase auth token.
    *   On success (204 or 200), navigates to `/dashboard/admin/working-groups`.
    *   On failure, sets `deleteError` with the error message from the backend.
    *   Resets `isDeleting` to `false` in a `finally` block.

4.  **UI Integration:**
    *   Added a "Delete Working Group" button within the main info card, below the `DetailItem` components and before the "Manage Members" section.
    *   The button is conditionally rendered based on the `canDelete` permission.
    *   Styled the button as a destructive action button: `py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md shadow-sm inline-flex items-center disabled:opacity-50`, with a `delete_forever` icon.
    *   The button's text changes to "Deleting..." and is disabled when `isDeleting` is true.
    *   Added a section to display `deleteError` messages if they occur, styled as a red alert box.
    *   Adjusted the top margin/border for the "Manage Members" section to ensure proper spacing whether the delete button section is present or not.

**Files Modified:**

*   `frontend/src/app/dashboard/admin/working-groups/[groupId]/page.tsx`

---
(Previous log entries truncated for brevity)