# Fiji Platform - Frontend Styling Guide

This document outlines the key styling principles and common patterns used in the Fiji platform frontend to ensure a consistent and visually appealing user interface. It primarily references Tailwind CSS classes.

## 1. Color Palette

*   **Primary (Indigo):**
    *   Text/Icons: `text-indigo-600 dark:text-indigo-400` (links, primary icons)
    *   Hover Text/Icons: `hover:text-indigo-500 dark:hover:text-indigo-300` (general), `group-hover:text-indigo-600 dark:group-hover:text-indigo-400` (for icons within group-hover dropdown items), `group-hover:text-indigo-700 dark:group-hover:text-indigo-500` (for icons within group-hover cards)
    *   Backgrounds: `bg-indigo-600` (buttons), `bg-indigo-100 dark:bg-indigo-800` (light accents, icon backgrounds, avatar button)
    *   Button Hover: `hover:bg-indigo-700` (primary buttons), `hover:bg-indigo-200 dark:hover:bg-indigo-700` (avatar button)
*   **Secondary/Accent (Yellow for Edit/Warning):**
    *   Backgrounds: `bg-yellow-500` (buttons)
    *   Button Hover: `hover:bg-yellow-600`
*   **Destructive (Red for Delete/Error):**
    *   Text: `text-red-600 dark:text-red-400` (error messages, destructive dropdown items)
    *   Backgrounds: `bg-red-600` (buttons), `bg-red-50 dark:bg-red-900/30` (error message backgrounds, destructive dropdown item hover)
    *   Button Hover: `hover:bg-red-700`
    *   Light Accent Buttons: `bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-700 dark:hover:bg-red-600 dark:text-red-100`
    *   Dropdown Item Hover Text: `hover:text-red-700 dark:hover:text-red-300`
*   **Success (Green):**
    *   Text: `text-green-600 dark:text-green-400`
    *   Backgrounds: `bg-green-600` (buttons), `bg-green-50 dark:bg-green-900/30` (success message backgrounds)
    *   Button Hover: `hover:bg-green-700`
*   **Neutral Backgrounds:**
    *   Page: `bg-gray-100 dark:bg-gray-800` (overall page background, if not white/darker gray)
    *   Cards/Containers: `bg-white dark:bg-gray-900` (general cards, navbar)
    *   Dropdown Menu: `bg-white dark:bg-gray-800`
    *   Subtle Sections/Items: `bg-gray-50 dark:bg-gray-800` or `dark:bg-gray-800/50` (e.g., for `DetailItem`, Purpose/Description sections)
    *   Icon Backgrounds (Cards): `bg-gray-100 dark:bg-gray-800`
    *   Dropdown Item Hover: `hover:bg-gray-100 dark:hover:bg-gray-700`
*   **Neutral Text:**
    *   Headings: `text-gray-900 dark:text-white` (general), `text-gray-800 dark:text-gray-200` (card titles)
    *   Body/Primary: `text-gray-700 dark:text-gray-300` (general, nav links)
    *   Secondary/Muted: `text-gray-500 dark:text-gray-400` (labels, sub-text, card metadata, dropdown item icons)
    *   Card Description: `text-gray-600 dark:text-gray-300`
    *   Dropdown Item Text: `text-gray-700 dark:text-gray-200`
    *   Dropdown Item Hover Text: `hover:text-gray-900 dark:hover:text-white`
*   **Borders:**
    *   Standard: `border-gray-200 dark:border-gray-700` (dividers, dropdown menu ring, dropdown item separators)
    *   Inputs: `border-gray-300 dark:border-gray-600`

## 2. Typography

*   **Font:** Default Tailwind sans-serif stack (Inter, system-ui, etc.).
*   **Headings:**
    *   `H1 (Page Title)`: `text-3xl font-bold` (e.g., `text-gray-900 dark:text-white`)
    *   `H2 (Section Title)`: `text-2xl font-semibold` (e.g., `text-gray-800 dark:text-gray-200`)
        *   Navbar Brand Link: `text-2xl font-bold text-indigo-600 dark:text-indigo-400`
    *   `H3 (Sub-section Title)`: `text-xl font-medium` or `font-semibold` (e.g., `text-gray-700 dark:text-gray-300`)
    *   Card Title: `text-lg sm:text-xl font-semibold` (e.g., `text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400`)
*   **Body Text:**
    *   General: `text-sm` or `text-base` (e.g., `text-gray-700 dark:text-gray-300`)
    *   Navbar Links: `text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400`
    *   Dropdown Menu Items: `text-sm`
*   **Labels/Sub-text:**
    *   General: `text-xs` or `text-sm font-medium` (e.g., `text-gray-500 dark:text-gray-400`)
    *   Dropdown Header Sub-text: `text-xs text-gray-500 dark:text-gray-400`
*   **Line Clamping:** `line-clamp-2` or `line-clamp-3` for descriptions in cards.

## 3. Layout & Spacing

*   **Page Container:**
    *   Default: `max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8` (adjust `max-w` as needed).
    *   Navbar Container: `max-w-6xl mx-auto px-4 sm:px-6 lg:px-8`
    *   Full-width content sections: `max-w-7xl mx-auto`.
*   **Card Padding:** `p-6 sm:p-8` (main content), `p-4 sm:p-6` (listing card content), `p-3 sm:p-4` (listing card icon sections).
*   **Margins:** Consistent bottom margins (`mb-6`, `mb-8`). Top padding (`pt-8`).
*   **Flexbox:** Used extensively (`flex items-center`, `justify-between`, `space-x-4` for nav items).
*   **Dividers:** `border-b border-gray-200 dark:border-gray-700` (sections, dropdown header), `border-t` (dropdown sections).
*   **Page-Level Control Sections (e.g., Search/Filter Bars):**
    *   May be enclosed in a styled card (`bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 md:p-6`) for visual grouping.
    *   Alternatively, controls can be placed directly on the page background (within the main page padding provided by `DashboardLayout`), typically using a grid (`grid grid-cols-1 md:grid-cols-2 gap-4`) and appropriate margins (`mb-6`) for spacing. The choice depends on the desired visual hierarchy and page complexity.

## 4. Card Styling
(Content as before, but note that "Search Bar Container" might be superseded by the more general note in Section 3)
*   **General Content/Form Card:** `bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8`
*   **Item Cards (e.g., assigned volunteers):** `bg-white dark:bg-gray-800 rounded-lg shadow-md p-4`
*   **Search Bar Container (Full-width context):** `mb-6 bg-white dark:bg-gray-900 rounded-lg shadow-md` (This is one option for control grouping, see also Section 3 "Page-Level Control Sections").
*   **Event Listing Cards:**
    *   Outer: `bg-white dark:bg-gray-900 shadow-lg rounded-lg overflow-hidden h-full flex flex-col group hover:shadow-xl transition-shadow duration-200 ease-in-out`
    *   Structure: Two-column flex layout (icon on left, details on right).
    *   Icon Section: `flex-shrink-0 p-3 sm:p-4 flex items-start justify-center border-r border-gray-200 dark:border-gray-700`
        *   Icon Background: `w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center`
    *   Details Section: `flex flex-col flex-grow p-4 sm:p-6 overflow-hidden`
        *   Metadata Footer: `pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-gray-200 dark:border-gray-700`

## 5. Buttons
(Content as before)
*   **Primary (Indigo):** `py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50 inline-flex items-center`
*   **Avatar Button (Navbar):** `flex items-center justify-center w-10 h-10 bg-indigo-100 dark:bg-indigo-800 rounded-full text-indigo-600 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-900 focus:ring-indigo-500 transition-colors duration-150 ease-in-out`
    *   Avatar Initial: `text-lg font-medium`
    *   Avatar Icon: `material-icons text-xl`

## 6. Icons (Material Icons)
(Content as before)
*   **Dropdown Menu Item Icons:** `material-icons text-lg mr-2 text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400` (for standard items) or `group-hover:text-red-700 dark:group-hover:text-red-300` (for destructive items).

## 7. Forms & Inputs
(Content as before)

## 8. Specific Component Patterns
(Content as before)

*   **Navigation Bar (`DashboardNav.tsx`):**
    *   Container: `nav className="bg-white dark:bg-gray-900 shadow-sm"`
    *   Inner Container: `div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"`
    *   Layout: `div className="flex items-center justify-between h-16"`
    *   Brand Link: `Link className="flex-shrink-0 text-2xl font-bold text-indigo-600 dark:text-indigo-400"`
    *   Navigation Links Area: `div className="flex items-center space-x-4"`
    *   Individual Nav Link: `Link className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-150 ease-in-out"`
    *   **Avatar Dropdown:**
        *   Button: (See "Avatar Button (Navbar)" under Section 5. Buttons)
        *   Dropdown Panel: `div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-xl bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 focus:outline-none z-50"`
        *   Header Section (in dropdown): `div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700"`
            *   "Signed in as" text: `p className="text-xs text-gray-500 dark:text-gray-400"`
            *   User display name: `p className="text-sm font-medium text-gray-900 dark:text-white truncate"`
        *   Menu Item Section: `div className="py-1"`
        *   Standard Menu Item (Link): `Link className="group flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"`
            *   Icon: (See "Dropdown Menu Item Icons" under Section 6. Icons)
        *   Destructive Menu Item (Button - e.g., Logout): `button className="group flex items-center w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300"`
            *   Icon: (See "Dropdown Menu Item Icons" under Section 6. Icons - destructive variant)

## General Principles
(Content as before)

This guide should serve as a living document and be updated as new patterns emerge or existing ones are refined.