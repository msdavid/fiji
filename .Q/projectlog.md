## Project Log - Fiji Platform

### Session: <YYYY-MM-DD HH:MM> (Auto-filled by Q)

**Developer:** Mauro
**Agent:** Q

**Sprint Objective:** Implement Event Icon Selection Feature (Phase 1 - UI and Basic Navigation) & Refinements

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

3.  **Refactored Event Form Layouts & Styling:**
    *   Modified `frontend/src/app/dashboard/events/new/page.tsx` and `frontend/src/app/dashboard/events/[eventId]/edit/page.tsx`.
    *   Introduced a two-column layout (`md:flex md:space-x-6 items-start`) at the top of the forms, wrapped in a card styled like the profile page (`bg-white dark:bg-gray-800 shadow-xl rounded-xl p-6 sm:p-8` on a `max-w-3xl` container).
    *   **Left Column:** A circular, clickable `div` to display the event icon. Styled with `w-32 h-32 sm:w-40 sm:h-40 rounded-full ... flex items-center justify-center ... cursor-pointer`.
        *   Contains a `<span>` with class `material-icons` to render the icon. Font size increased from `4rem` to `5rem`.
        *   Displays `formData.icon` or a fallback like 'add_photo_alternate'.
        *   Sub-text "Click icon to change" centered horizontally under the icon.
    *   **Vertical Separator:** Added `div` with `border-l` between icon and form content columns.
    *   **Right Column:** Contains the "Event Name" input field and other top-level fields, with consistent spacing.
    *   The remaining form fields follow below this initial two-column section.

4.  **Added Material Icons Stylesheet:**
    *   Updated `frontend/src/app/layout.tsx` to include the Google Material Icons stylesheet link in the `<head>`:
        `<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />`

5.  **Created Icon Selection Page & Functionality:**
    *   Created `frontend/src/app/dashboard/events/select-icon/page.tsx`.
    *   **Icon List:** Created `frontend/src/lib/materialIcons.ts` with a vastly expanded list of Material Icons (over 600 unique icons), categorized and flattened into `commonEventIcons`.
    *   **Display:** The selection page displays icons from `commonEventIcons` in a responsive grid.
    *   **Search:** Added a search input field to filter the displayed icons by name (case-insensitive).
    *   **Navigation:**
        *   Clicking an icon navigates back to the `returnTo` URL (passed as a query param) with the `selectedIcon` name appended.
        *   A "Back to Event Form" button allows navigation back without selection.

6.  **Implemented Icon Click Navigation and State Persistence (Event Forms):**
    *   **Create Event Page (`.../new/page.tsx`):**
        *   `handleIconClick`: Stores current `formData` in `localStorage` (key: `eventFormDraft`) and navigates to `/dashboard/events/select-icon?returnTo=/dashboard/events/new`.
        *   `useEffect`: On return, retrieves `selectedIcon` from query params and draft data from `localStorage`, updates `formData`, removes draft, and cleans URL.
    *   **Edit Event Page (`.../[eventId]/edit/page.tsx`):**
        *   `handleIconClick`: Stores current `formData` in `localStorage` (key: `eventFormDraft-${eventId}`) and navigates to `/dashboard/events/select-icon?returnTo=/dashboard/events/${eventId}/edit`.
        *   `useEffect` & `fetchEventData`: Logic adjusted for rehydration from `localStorage` and `selectedIcon` query param, merging with fetched data.

7.  **Refactored Events Listing Page (`frontend/src/app/dashboard/events/page.tsx`):**
    *   **Card Matrix Layout:** Changed from a list view to a responsive grid of cards (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`).
    *   **Card Styling:** Each event is displayed as a card with `bg-white dark:bg-gray-900 shadow-lg rounded-lg`. The entire card is a `Link` to the event detail page.
    *   **Three-Section Card Layout:**
        *   **Left Section:** Displays a circular placeholder (calendar icon) with a vertical divider (`border-r`).
        *   **Right Section (Top):** Contains event details (name, type, venue, date, status, description). Event name uses `truncate`.
        *   **Right Section (Bottom):** Shows creation metadata (creator, creation date) and the 'Edit' button, separated by a horizontal divider (`border-t`).
    *   **Interactivity:** Event title changes color on hover. 'Edit' button uses `e.stopPropagation()`.
    *   **Consistency:** Page title (`h1`) and 'No events found' message styling updated to match other admin pages.
    *   **TODOs:** Added comments for future privilege-based access control and dynamic event icons.

8.  **Fixed Duplicate Navbar on Event Detail Page (`frontend/src/app/dashboard/events/[eventId]/page.tsx`):**
    *   Removed the redundant `<nav>` element from the page.
    *   Relocated the "Back to Events" link to the top of the `main` content area, above the event title.
    *   Removed an unnecessary outer `div` with `min-h-screen` and background styling, deferring to the parent layout.

9.  **Enabled Backend Event Icon Storage:**
    *   Updated Pydantic models in `backend/models/event.py`:
        *   Added `icon: Optional[str] = Field(None, max_length=50, description="Name of the Material Icon for the event.")` to `EventBase`.
        *   Added `icon: Optional[str] = Field(None, max_length=50)` to `EventUpdate`.
    *   Verified that `backend/routers/events.py` does not require direct modification for the `icon` field, as `model_dump()` in create/update endpoints will automatically include it due to Pydantic model updates. The `icon` field will now be saved to and retrieved from Firestore.

10. **Displayed Dynamic Icons on Event Listing Page (`frontend/src/app/dashboard/events/page.tsx`):**
    *   Updated the `Event` interface to include `icon?: string;`.
    *   Modified the event card's left section to render a Material Icon using `<span class="material-icons">...</span>`.
    *   Displays `event.icon` if available, otherwise defaults to 'event'.
    *   Added `group-hover` styling to change icon color on card hover.

11. **Improved Error Message Display on Event Edit Form (`frontend/src/app/dashboard/events/[eventId]/edit/page.tsx`):**
    *   Modified the `handleSubmit` function to better parse backend error responses.
    *   If `errorData.detail` from the backend is an array (typical for FastAPI validation errors), the message from the first error object (or a concatenation) is extracted and displayed.
    *   If `errorData.detail` is a string, it's used directly.
    *   If `errorData.detail` is another non-string type, it's stringified.
    *   This prevents the display of `[object Object]` when validation errors occur, showing a more user-friendly message.

12. **Fixed "Extra Inputs Not Permitted" Error on Event Edit (`frontend/src/app/dashboard/events/[eventId]/edit/page.tsx`):**
    *   Modified the `handleSubmit` function to explicitly pick only fields allowed by the backend `EventUpdate` model for the update payload.
    *   Ensured correct mapping of frontend `formData.location` to backend `venue` in the payload.
    *   Updated `fetchEventData` to map backend `venue` to frontend `location` when populating the form.
    *   Expanded the `EventFormData` interface to include fields fetched for display but not sent on update, for clarity.

**Next Steps (Planned for Future Sessions):**

*   Refine state management for icon selection if `localStorage` proves insufficient (e.g., using a shared context or Zustand/Redux if complexity grows).

**Notes:**

*   The `eslint-disable-next-line react-hooks/exhaustive-deps` comment was used in `useEffect` hooks where router methods might cause re-triggers if `router` itself was in the dependency array without careful memoization.

---
### Session: 2024-07-25 10:00

**Developer:** Mauro
**Agent:** Q

**Sprint Objective:** Resolve Frontend Console Errors & Code Refinements

**Key Activities:**

1.  **Resolved Nested Anchor Tag Error (`frontend/src/app/dashboard/events/page.tsx`):**
    *   Identified that a `Link` component (rendering an `<a>` tag) for individual event cards was wrapping another `Link` component used for an "Edit" button, causing an HTML validation error ("<a> cannot be a descendant of <a>") and Next.js hydration issues.
    *   Modified `frontend/src/app/dashboard/events/page.tsx`:
        *   The inner "Edit" `Link` component was replaced with a `<button>` element.
        *   The `useRouter` hook (already imported and initialized) was used to handle navigation programmatically via `router.push()` within the button's `onClick` handler.
        *   The `e.stopPropagation()` call within the `onClick` handler was preserved to prevent the click event from bubbling up to the outer `Link` component of the event card.
    *   This change ensures valid HTML structure and resolves the console error.

---