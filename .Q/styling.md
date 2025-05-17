# Fiji Platform - Frontend Styling Guide

This document outlines the key styling principles and common patterns used in the Fiji platform frontend to ensure a consistent and visually appealing user interface. It primarily references Tailwind CSS classes.

## 1. Color Palette

*   **Primary (Indigo):**
    *   Text/Icons: `text-indigo-600 dark:text-indigo-400` (links, primary icons, interactive elements, active nav links)
    *   Hover Text/Icons: `hover:text-indigo-500 dark:hover:text-indigo-300` (general), `group-hover:text-indigo-600 dark:group-hover:text-indigo-400` (for icons within group-hover dropdown items), `group-hover:text-indigo-700 dark:group-hover:text-indigo-500` (for icons within group-hover cards)
    *   Backgrounds: `bg-indigo-600` (buttons), `bg-indigo-100 dark:bg-indigo-800` (light accents, icon backgrounds, avatar button, selected item backgrounds)
    *   Button Hover: `hover:bg-indigo-700` (primary buttons), `hover:bg-indigo-200 dark:hover:bg-indigo-700` (avatar button)
    *   Focus Ring: `focus:ring-indigo-500`
*   **Secondary/Accent (Yellow for Edit/Warning):**
    *   Text: `text-yellow-700 dark:text-yellow-400` (warning messages)
    *   Backgrounds: `bg-yellow-500` (buttons), `bg-yellow-100 dark:bg-yellow-700 dark:text-yellow-100` (warning message backgrounds)
    *   Button Hover: `hover:bg-yellow-600`
*   **Destructive (Red for Delete/Error):**
    *   Text: `text-red-600 dark:text-red-400` (error messages, destructive dropdown items, delete button text)
    *   Backgrounds: `bg-red-600` (buttons), `bg-red-50 dark:bg-red-900/30` (error message backgrounds, destructive dropdown item hover)
    *   Button Hover: `hover:bg-red-700`
    *   Light Accent Buttons: `bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-700 dark:hover:bg-red-600 dark:text-red-100` (e.g., remove assignment button)
    *   Dropdown Item Hover Text: `hover:text-red-700 dark:hover:text-red-300`
    *   Border: `border-red-300 dark:border-red-700` (Danger Zone section top border)
*   **Success (Green):**
    *   Text: `text-green-600 dark:text-green-400` (success messages, positive status indicators)
    *   Backgrounds: `bg-green-600` (buttons), `bg-green-50 dark:bg-green-900/30` or `bg-green-100 dark:bg-green-700 dark:text-green-100` (success message backgrounds)
    *   Button Hover: `hover:bg-green-700`
*   **Neutral Backgrounds:**
    *   Page: `bg-gray-100 dark:bg-gray-800` (overall page background for loading/error states if not within a card)
    *   Cards/Containers: `bg-white dark:bg-gray-900` (general cards, navbar, main content area for forms/details)
    *   Dropdown Menu: `bg-white dark:bg-gray-800`
    *   Subtle Sections/Items: `bg-gray-50 dark:bg-gray-800/50` or `dark:bg-gray-800` (e.g., for `DetailItem`, Purpose/Description sections in detail views, form section backgrounds if needed)
    *   Icon Backgrounds (Cards/Headers): `bg-indigo-100 dark:bg-indigo-800` (for primary entity icon in detail/edit views)
    *   Dropdown Item Hover: `hover:bg-gray-100 dark:hover:bg-gray-700`
*   **Neutral Text:**
    *   Headings: `text-gray-900 dark:text-white` (general page/card titles), `text-gray-800 dark:text-gray-200` (section titles within cards)
    *   Body/Primary: `text-gray-700 dark:text-gray-300` (general, nav links, form field values)
    *   Secondary/Muted: `text-gray-500 dark:text-gray-400` (labels, sub-text, card metadata, dropdown item icons, placeholder text)
    *   Card Description: `text-gray-600 dark:text-gray-300`
    *   Dropdown Item Text: `text-gray-700 dark:text-gray-200`
    *   Dropdown Item Hover Text: `hover:text-gray-900 dark:hover:text-white`
*   **Borders:**
    *   Standard: `border-gray-200 dark:border-gray-700` (dividers, dropdown menu ring, dropdown item separators, section separators in forms/details)
    *   Inputs: `border-gray-300 dark:border-gray-600`
    *   Focus/Hover Input: `focus:border-indigo-500`, `hover:border-gray-400 dark:hover:border-gray-500`

## 2. Typography

*   **Font:** Default Tailwind sans-serif stack (Inter, system-ui, etc.).
*   **Headings:**
    *   `H1 (Page Title)`: `text-3xl font-bold text-gray-900 dark:text-white mb-8` (for New/Edit pages)
    *   `H1 (Detail View Title)`: `text-3xl font-bold text-gray-900 dark:text-white` (within card header)
    *   `H2 (Section Title in Card)`: `text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4` or `text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6` (for main sections in detail/form views)
    *   `H3 (Sub-section Title)`: `text-lg font-medium text-gray-700 dark:text-gray-300 mb-3` (e.g., for "Assign New Member" within "Manage Members" section)
    *   Card Title (Listing): `text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400`
*   **Body Text:**
    *   General: `text-sm text-gray-700 dark:text-gray-300` (form field values, detail item values)
    *   Navbar Links: `text-sm font-medium`
*   **Labels/Sub-text:**
    *   Form Field Labels: `block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1`
    *   Detail Item Labels: `text-xs font-medium text-gray-500 dark:text-gray-400`
    *   Helper/Placeholder Text: `text-xs text-gray-500 dark:text-gray-400` or `text-sm`
*   **Line Clamping:** `line-clamp-2` or `line-clamp-3` for descriptions in cards.

## 3. Layout & Spacing

*   **Page Container (Detail/Form Pages):** `max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8` (for focused content like single item details or forms). Can be `max-w-4xl` for more complex detail views.
*   **Main Content Card (Detail/Form Pages):** `bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8`
*   **Section Spacing:**
    *   Form sections separated by `border-b border-gray-200 dark:border-gray-700 pb-6 mb-6` or `pt-6 border-t ... mt-6`.
    *   Space between elements in a section: `space-y-4` or `space-y-6`.
    *   Grid gap: `gap-4` or `gap-6`.
*   **"Back to List" Link:** `inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 mb-6`. Icon: `material-icons mr-1 text-lg` (e.g., `arrow_back_ios` or `arrow_back`).
*   **Alert/Message Banners (Success/Error):** `mb-6 p-4 text-sm rounded-lg shadow-md` with appropriate color classes (e.g., `text-green-700 bg-green-100 dark:bg-green-700 dark:text-green-100`).

## 4. Card Styling

*   **General Content/Form Card:** `bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8` (This is the primary container for detail and form pages).
*   **Item Cards (e.g., assigned volunteers list items):** `p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md shadow-sm flex justify-between items-center` or `p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md ...`
*   **Event Listing Cards (Reference):**
    *   Outer: `bg-white dark:bg-gray-900 shadow-lg rounded-lg overflow-hidden h-full flex flex-col group hover:shadow-xl transition-shadow duration-200 ease-in-out`
    *   Icon Section: `flex-shrink-0 p-3 sm:p-4 flex items-start justify-center border-r border-gray-200 dark:border-gray-700`
        *   Icon Background: `w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center`
    *   Details Section: `flex flex-col flex-grow p-4 sm:p-6 overflow-hidden`

## 5. Buttons

*   **Primary Action (Save/Create):** `py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 inline-flex items-center justify-center`. Icon: `material-icons mr-2 text-base` (e.g., `save`, `add_circle_outline`).
*   **Secondary Action (Cancel):** `py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center justify-center`. Icon: `material-icons mr-2 text-base` (e.g., `cancel`).
*   **Edit Action (Yellow):** `py-2 px-4 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-md shadow-sm inline-flex items-center`. Icon: `material-icons mr-2 text-base` (e.g., `edit`).
*   **Delete Action (Red):** `py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50 inline-flex items-center justify-center`. Icon: `material-icons mr-2 text-base` (e.g., `delete_forever`).
*   **Small Destructive Action (e.g., Remove Item):** `py-1.5 px-3 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-700 dark:hover:bg-red-600 dark:text-red-100 text-xs font-medium rounded-md shadow-sm disabled:opacity-50 inline-flex items-center`. Icon: `material-icons text-sm mr-1` (e.g., `person_remove`, `close`).
*   **Avatar Button (Navbar):** `flex items-center justify-center w-10 h-10 bg-indigo-100 dark:bg-indigo-800 rounded-full text-indigo-600 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-900 focus:ring-indigo-500 transition-colors duration-150 ease-in-out`
    *   Avatar Initial: `text-lg font-medium`
    *   Avatar Icon: `material-icons text-xl`

## 6. Icons (Material Icons)

*   **General Usage:** Material Icons are preferred. Use `<span className="material-icons">icon_name</span>`.
*   **Sizes:** `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-3xl`, `text-5xl` etc., as appropriate for context.
*   **Colors:** Typically `text-indigo-600 dark:text-indigo-400` for primary actions, `text-gray-500 dark:text-gray-400` for muted/decorative icons, or color-matched to button/status (e.g., `text-red-500` for delete icons).
*   **In Buttons:** `mr-2 text-base` or `mr-1 text-sm` depending on button size.
*   **Detail Item Icon:** `text-indigo-600 dark:text-indigo-400 mt-1 text-lg` or `text-xl`.
*   **Large Header Icon (Detail/Edit Views):** `text-3xl text-indigo-600 dark:text-indigo-300` within a `w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center` container.
*   **Icon Picker Icon (Event Forms):** `material-icons` with `fontSize: '5rem'` within a `w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-indigo-100 dark:bg-indigo-800 ... cursor-pointer`.
*   **Dropdown Menu Item Icons:** `material-icons text-lg mr-2 text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400` (for standard items) or `group-hover:text-red-700 dark:group-hover:text-red-300` (for destructive items).

## 7. Forms & Inputs

*   **General Input Styling:** `mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white`. (Note: `focus:ring-offset-1` can be useful if inputs are very close to other elements).
*   **Textarea:** Same as general input, add `rows={3}` or `rows={4}` as needed.
*   **Select:** Same as general input.
*   **Labels:** `block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1`. Required fields indicated by `<span className="text-red-500">*</span>` after the label text.
*   **Form Sections (Create/Edit Pages):**
    *   Use `div` containers for logical grouping of fields.
    *   Separate major sections with `border-b border-gray-200 dark:border-gray-700 pb-6 mb-6` or `pt-6 border-t ... mt-6`.
    *   Section titles: `h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4"`.
*   **Action Button Row:** `flex justify-end space-x-3 pt-8 mt-4 border-t border-gray-200 dark:border-gray-700`. For forms with a delete button, use `flex flex-col sm:flex-row justify-between items-center ... space-y-4 sm:space-y-0`.

## 8. Specific Component Patterns

*   **Navigation Bar (`DashboardNav.tsx`):**
    *   Container: `nav className="bg-white dark:bg-gray-900 shadow-sm"`
    *   Inner Container: `div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"`
    *   Layout: `div className="flex items-center justify-between h-16"`
    *   Brand Link: `Link className="flex-shrink-0 text-2xl font-bold text-indigo-600 dark:text-indigo-400"`
    *   Navigation Links Area: `div className="flex items-center space-x-1 sm:space-x-4"` (adjust spacing for responsiveness)
    *   Individual Nav Link:
        *   Default: `Link className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150 ease-in-out"`
        *   Active: `Link className="px-3 py-2 rounded-md text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30"` (or other distinct styling like a bottom border `border-b-2 border-indigo-500`)
    *   **Avatar Dropdown:**
        *   Button: (See "Avatar Button (Navbar)" under Section 5. Buttons)
        *   Dropdown Panel: `div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-xl bg-white dark:bg-gray-800 ring-1 ring-black dark:ring-gray-700 ring-opacity-5 focus:outline-none z-50"`
        *   Header Section (in dropdown): `div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700"`
            *   "Signed in as" text: `p className="text-xs text-gray-500 dark:text-gray-400"`
            *   User display name: `p className="text-sm font-medium text-gray-900 dark:text-white truncate"`
        *   Menu Item Section: `div className="py-1"`
        *   Standard Menu Item (Link): `Link className="group flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"`
            *   Icon: (See "Dropdown Menu Item Icons" under Section 6. Icons)
        *   Destructive Menu Item (Button - e.g., Logout): `button className="group flex items-center w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300"`
            *   Icon: (See "Dropdown Menu Item Icons" under Section 6. Icons - destructive variant)
    *   Mobile Menu Button (Hamburger): (If applicable) `button className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"` (typically part of `md:hidden` block). Icon: `menu` or `close`.

*   **Detail View Pages (e.g., Event Details, User Profile, Donation Details):**
    *   **Main Container:** `main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8"` (can be `max-w-3xl` for simpler views).
    *   **Back Link:** Positioned above the main card.
    *   **Main Card:** `div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg overflow-hidden"`
        *   **Card Padding:** `div className="p-6 sm:p-8"`
        *   **Header Section:**
            *   Layout: `flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-6 border-b border-gray-200 dark:border-gray-700`
            *   Icon & Title Group: `flex items-center space-x-4`
                *   Icon Container: `div className="flex-shrink-0 w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center"`
                *   Icon: `span className="material-icons text-3xl text-indigo-600 dark:text-indigo-300"` (e.g., `event`, `paid`, `person_outline`)
                *   Title Block: `div` containing `h1 className="text-3xl font-bold text-gray-900 dark:text-white"` and optional subtitle `p className="text-sm text-gray-500 dark:text-gray-400 mt-1"` (e.g., "Last updated: ...").
            *   Edit Button (if applicable): `Link` with yellow accent button style, `mt-4 sm:mt-0`.
        *   **Content Sections:**
            *   Section Title: `h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4"`
            *   Section Divider (if needed): `mt-8 pt-6 border-t border-gray-200 dark:border-gray-700` before the next section title.
            *   Detail Items Layout: `grid grid-cols-1 md:grid-cols-2 gap-4 mb-6` (or `mb-8`).
            *   **`DetailItem` Component:**
                *   Container: `div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"`
                *   Icon: `span className="material-icons text-indigo-600 dark:text-indigo-400 mt-1 text-lg"`
                *   Text Block: `div className="flex-1 min-w-0"`
                    *   Label: `p className="text-xs font-medium text-gray-500 dark:text-gray-400"`
                    *   Value: `p className="mt-1 text-sm text-gray-700 dark:text-gray-300 break-words"` or `pre` for preformatted.
            *   **Long Text Blocks (Purpose/Description/Notes):**
                *   Container: `div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"`
                *   Title: `h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2 inline-flex items-center"` with an icon.
                *   Content: `p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap"` or `pre`.

*   **Create/Edit Form Pages (e.g., New Event, Edit Donation):**
    *   **Main Container:** `main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8"`
    *   **Back Link:** Positioned above the page title.
    *   **Page Title:** `h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8"`
    *   **Alert Banners (Success/Error):** Positioned above the main form card.
    *   **Main Form Card:** `div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8"`
        *   **Form Tag:** `form onSubmit={...} className="space-y-6"`
        *   **Form Sections:**
            *   Container: `div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6"` (for all but last section). Last section might use `pt-6` without bottom border.
            *   Section Title (optional, if needed): `h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4"`
            *   Field Groups: `div className="space-y-4"` or `grid grid-cols-1 sm:grid-cols-2 gap-6`.
            *   Individual Field Container: `div`
                *   Label: `label htmlFor="..." className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"`
                *   Input: Styled as per Section 7.
        *   **Icon Picker Section (Event Forms):**
            *   Layout: `md:flex md:space-x-6 items-start`
            *   Icon Display: `div className="flex-shrink-0 mb-6 md:mb-0 md:w-1/4 flex flex-col items-center"`
                *   Clickable Icon Area: `div onClick={...} className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-indigo-100 dark:bg-indigo-800 ... cursor-pointer"`
                *   Icon: `span className="material-icons" style={{ fontSize: '5rem' }}`
                *   Helper Text: `p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center"`
            *   Vertical Divider (Desktop): `div className="hidden md:block border-l border-gray-300 dark:border-gray-600 mx-3 h-auto self-stretch"`
            *   Adjacent Fields: `div className="flex-grow space-y-6"`
        *   **Action Button Row:**
            *   Container: `div className="flex justify-end space-x-3 pt-8 mt-4 border-t border-gray-200 dark:border-gray-700"`
            *   For forms with delete: `div className="flex flex-col sm:flex-row justify-between items-center pt-8 mt-4 border-t ... space-y-4 sm:space-y-0"`
                *   Delete Button Group: `div` (on the left)
                *   Save/Cancel Button Group: `div className="flex space-x-3 w-full sm:w-auto justify-end"` (on the right)
        *   **Danger Zone (Edit Pages):**
            *   Container: `div className="mt-10 pt-6 border-t border-red-300 dark:border-red-700"`
            *   Title: `h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-3"`
            *   Warning Text: `p className="text-sm text-gray-600 dark:text-gray-400 mb-4"`
            *   Delete Button: Styled as per Section 5.

## General Principles

*   **Consistency:** Strive for visual and interactive consistency across similar components and page types.
*   **Responsiveness:** Ensure layouts adapt well to different screen sizes using Tailwind's responsive prefixes (sm, md, lg, xl).
*   **Accessibility:** Use semantic HTML, provide ARIA attributes where necessary, and ensure sufficient color contrast. (Further accessibility guidelines can be added).
*   **Dark Mode:** All styling should consider dark mode compatibility using `dark:` prefixes.

This guide should serve as a living document and be updated as new patterns emerge or existing ones are refined.