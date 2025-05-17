## Project Log - Fiji Platform

### Session: <YYYY-MM-DD HH:MM> (Auto-filled by Q)

**Developer:** Mauro
**Agent:** Q

**Sprint Objective:** Implement Event Icon Selection Feature (Phase 1 - UI and Basic Navigation)

**Key Activities:**

1.  **Analyzed Profile Page Layout:**
    *   Inspected `frontend/src/app/dashboard/profile/page.tsx` to understand the styling of the circular profile picture display. This served as a reference for the new event icon display.
    *   Key styles noted: `w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-2`, and two-column layout using `md:flex md:space-x-6`.

2.  **Updated Event Data Structures (Frontend):**
    *   Added an `icon: string` field to the `EventFormData` interface in both:
        *   `frontend/src/app/dashboard/events/new/page.tsx`
        *   `frontend/src/app/dashboard/events/[eventId]/edit/page.tsx`
    *   Set a default icon value (e.g., "event") in `initialFormData` (create page) and initial state (edit page).
    *   Modified `fetchEventData` in the edit page to retrieve and set the `icon` field, defaulting if not present.
    *   Updated `handleSubmit` functions in both create and edit pages to include the `icon` field in the payload sent to the backend.

3.  **Refactored Event Form Layouts:**
    *   Modified `frontend/src/app/dashboard/events/new/page.tsx` and `frontend/src/app/dashboard/events/[eventId]/edit/page.tsx`.
    *   Introduced a two-column layout (`md:flex md:space-x-6 items-start`) at the top of the forms:
        *   **Left Column:** A circular, clickable `div` to display the event icon. Styled with `w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center ... cursor-pointer`.
        *   Contains a `<span>` with class `material-icons` to render the icon. Font size set to `4rem`.
        *   Displays `formData.icon` or a fallback like 'add_photo_alternate'.
        *   **Right Column:** Contains the "Event Name" input field.
    *   The remaining form fields follow below this new two-column section, retaining their existing grid layout.

4.  **Added Material Icons Stylesheet:**
    *   Updated `frontend/src/app/layout.tsx` to include the Google Material Icons stylesheet link in the `<head>`:
        `<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />`

5.  **Created Placeholder Icon Selection Page:**
    *   Created `frontend/src/app/dashboard/events/select-icon/page.tsx`.
    *   This page currently includes:
        *   A title "Select Event Icon".
        *   A "Back to Event Form" button using `router.back()`.
        *   Placeholder text indicating where the icon gallery will be.
        *   A link to the Google Material Icons website for manual selection in the interim.

6.  **Implemented Icon Click Navigation and State Persistence:**
    *   **Create Event Page (`.../new/page.tsx`):**
        *   `handleIconClick`: Stores current `formData` in `localStorage` (key: `eventFormDraft`) and navigates to `/dashboard/events/select-icon?returnTo=/dashboard/events/new`.
        *   `useEffect`:
            *   On mount/return, checks for `selectedIcon` query parameter.
            *   If `selectedIcon` exists, retrieves `eventFormDraft` from `localStorage`, updates `formData` with the new icon and draft data, removes the draft from `localStorage`, and cleans the URL.
            *   If no `selectedIcon` but `eventFormDraft` exists, rehydrates form (optional: clear draft).
    *   **Edit Event Page (`.../[eventId]/edit/page.tsx`):**
        *   `handleIconClick`: Stores current `formData` in `localStorage` (key: `eventFormDraft-${eventId}`) and navigates to `/dashboard/events/select-icon?returnTo=/dashboard/events/${eventId}/edit`.
        *   `useEffect` & `fetchEventData`:
            *   Logic adjusted to handle rehydration from `localStorage` and `selectedIcon` query parameter, similar to the create page, ensuring fetched event data is merged correctly with any draft or newly selected icon.
            *   `router.replace` used to clean URL after processing `selectedIcon`.

**Next Steps (Planned for Future Sessions):**

*   Fully implement the icon gallery on `/dashboard/events/select-icon/page.tsx`.
*   Implement robust state management or query parameter passing for the selected icon from the selection page back to the event forms.
*   Update backend: Add `icon` field to the event model, update API endpoints (`POST /events`, `PUT /events/{eventId}`, `GET /events/{eventId}`) to handle the new field.
*   Display the selected event icon in other relevant places (e.g., event list, event detail page).

**Notes:**

*   The current implementation uses `localStorage` for draft persistence during icon selection. This is a temporary solution and might be refined with a more robust state management approach if needed.
*   Backend changes are critical for the `icon` field to be saved and displayed permanently.
*   The `eslint-disable-next-line react-hooks/exhaustive-deps` comment was added in `useEffect` hooks where `router.replace` might cause re-triggers if `router` itself was in the dependency array without careful memoization of its instance.