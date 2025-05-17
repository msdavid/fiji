# Fiji Platform - Frontend Styling Guide

This document outlines the key styling principles and common patterns used in the Fiji platform frontend to ensure a consistent and visually appealing user interface. It primarily references Tailwind CSS classes.

## 1. Color Palette

*   **Primary (Indigo):**
    *   Text/Icons: `text-indigo-600 dark:text-indigo-400` (links, primary icons)
    *   Hover Text/Icons: `hover:text-indigo-500 dark:hover:text-indigo-300` (general), `group-hover:text-indigo-700 dark:group-hover:text-indigo-500` (for icons within group-hover cards)
    *   Backgrounds: `bg-indigo-600` (buttons), `bg-indigo-100 dark:bg-indigo-800` (light accents, icon backgrounds)
    *   Button Hover: `hover:bg-indigo-700`
*   **Secondary/Accent (Yellow for Edit/Warning):**
    *   Backgrounds: `bg-yellow-500` (buttons)
    *   Button Hover: `hover:bg-yellow-600`
*   **Destructive (Red for Delete/Error):**
    *   Text: `text-red-600 dark:text-red-400` (error messages)
    *   Backgrounds: `bg-red-600` (buttons), `bg-red-50 dark:bg-red-900/30` (error message backgrounds)
    *   Button Hover: `hover:bg-red-700`
    *   Light Accent Buttons: `bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-700 dark:hover:bg-red-600 dark:text-red-100`
*   **Success (Green):**
    *   Text: `text-green-600 dark:text-green-400`
    *   Backgrounds: `bg-green-600` (buttons), `bg-green-50 dark:bg-green-900/30` (success message backgrounds)
    *   Button Hover: `hover:bg-green-700`
*   **Neutral Backgrounds:**
    *   Page: `bg-gray-100 dark:bg-gray-800` (overall page background, if not white/darker gray)
    *   Cards/Containers: `bg-white dark:bg-gray-900`
    *   Subtle Sections/Items: `bg-gray-50 dark:bg-gray-800` or `dark:bg-gray-800/50` (e.g., for `DetailItem`, Purpose/Description sections)
    *   Icon Backgrounds (Cards): `bg-gray-100 dark:bg-gray-800`
*   **Neutral Text:**
    *   Headings: `text-gray-900 dark:text-white` (general), `text-gray-800 dark:text-gray-200` (card titles)
    *   Body/Primary: `text-gray-700 dark:text-gray-300`
    *   Secondary/Muted: `text-gray-500 dark:text-gray-400` (labels, sub-text, card metadata)
    *   Card Description: `text-gray-600 dark:text-gray-300`
*   **Borders:**
    *   Standard: `border-gray-200 dark:border-gray-700`
    *   Inputs: `border-gray-300 dark:border-gray-600`

## 2. Typography

*   **Font:** Default Tailwind sans-serif stack (Inter, system-ui, etc.).
*   **Headings:**
    *   `H1 (Page Title)`: `text-3xl font-bold` (e.g., `text-gray-900 dark:text-white`)
    *   `H2 (Section Title)`: `text-2xl font-semibold` (e.g., `text-gray-800 dark:text-gray-200`)
    *   `H3 (Sub-section Title)`: `text-xl font-medium` or `font-semibold` (e.g., `text-gray-700 dark:text-gray-300`)
    *   Card Title: `text-lg sm:text-xl font-semibold` (e.g., `text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400`)
*   **Body Text:** `text-sm` or `text-base` (e.g., `text-gray-700 dark:text-gray-300`)
*   **Labels/Sub-text:** `text-xs` or `text-sm font-medium` (e.g., `text-gray-500 dark:text-gray-400`)
*   **Line Clamping:** `line-clamp-2` or `line-clamp-3` for descriptions in cards.

## 3. Layout & Spacing

*   **Page Container:**
    *   Default: `max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8` (adjust `max-w` as needed, e.g., `max-w-3xl` for forms).
    *   Full-width content sections (e.g., User Management table): `max-w-7xl mx-auto`. In this case, the `<main>` element itself has no horizontal padding. Direct children intended to be full-width (like headers, search bar wrappers, table wrappers) also omit `mx-*` or `px-*`. Internal content (text, inputs) within these children should then apply their own padding (e.g., `px-4 sm:px-6 lg:px-8` for header text, `p-3` for inputs).
*   **Card Padding:** `p-6 sm:p-8` for main content cards. `p-4 sm:p-6` for content within listing cards. `p-3 sm:p-4` for icon sections in listing cards.
*   **Margins:** Consistent bottom margins for sections (`mb-6`, `mb-8`). Top padding for initial page content (`pt-8`) if the main container has no padding.
*   **Grids:** Use Tailwind's grid system for layout (e.g., `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6` for card lists).
*   **Flexbox:** Used extensively for item alignment (`flex items-center`, `justify-between`, `flex-col`, `flex-grow`).
*   **Dividers:** `border-b border-gray-200 dark:border-gray-700` for horizontal dividers between sections. `border-r` for vertical dividers in cards.

## 4. Card Styling

*   **General Content/Form Card:** `bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8`
*   **Item Cards (e.g., assigned volunteers):** `bg-white dark:bg-gray-800 rounded-lg shadow-md p-4`
*   **Search Bar Container (Full-width context):** `mb-6 bg-white dark:bg-gray-900 rounded-lg shadow-md` (This container is full-width within its parent. The input inside has `p-3` for its own padding. If the container itself needs spacing from the edges of a padded parent, use `mx-4 sm:mx-6 lg:mx-8` and internal padding like `px-4 py-4` on this div).
*   **Event Listing Cards:**
    *   Outer: `bg-white dark:bg-gray-900 shadow-lg rounded-lg overflow-hidden h-full flex flex-col group hover:shadow-xl transition-shadow duration-200 ease-in-out`
    *   Structure: Two-column flex layout (icon on left, details on right).
    *   Icon Section: `flex-shrink-0 p-3 sm:p-4 flex items-start justify-center border-r border-gray-200 dark:border-gray-700`
        *   Icon Background: `w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center`
    *   Details Section: `flex flex-col flex-grow p-4 sm:p-6 overflow-hidden`
        *   Metadata Footer: `pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-gray-200 dark:border-gray-700`

## 5. Buttons

*   **Primary (Indigo):** `py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50 inline-flex items-center`
*   **Secondary/Accent (Yellow):** `py-2 px-4 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-md shadow-sm inline-flex items-center`
*   **Destructive (Red):** `py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50 inline-flex items-center`
*   **Small/Action (e.g., Remove):** `py-1.5 px-3 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-700 dark:hover:bg-red-600 dark:text-red-100 text-xs font-medium rounded-md shadow-sm disabled:opacity-50 inline-flex items-center`
*   **Link-style Back Button:** `inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300`

## 6. Icons (Material Icons)

*   **Usage:** `<span class="material-icons">icon_name</span>`
*   **Sizing:**
    *   General UI Icons (buttons, labels): `text-base` or `text-lg` (adjust with `mr-1` or `mr-2` for spacing).
    *   Detail Item Icons: `text-xl` or specific size (e.g., `mt-1` for alignment).
    *   Large Display Icons (headers, placeholders): `text-3xl` or larger.
    *   Card List Icons: `text-3xl sm:text-4xl`
*   **Coloring:**
    *   Paired with text: Inherit color or match text.
    *   Standalone/Accent: `text-indigo-500 dark:text-indigo-400` or context-specific color.
    *   Group Hover (Cards): `group-hover:text-indigo-700 dark:group-hover:text-indigo-500`

## 7. Forms & Inputs

*   **General Input:** `w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-white` (Note: `mt-1` is often used if label is separate).
*   **Form Sections:** Group related inputs within styled containers like `p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg` or use `border-b pb-6` and `pt-6` for separation within a larger form card.
*   **Labels:** `block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1`

## 8. Specific Component Patterns

*   **`DetailItem` (Event Detail Page):**
    *   Container: `flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg`
    *   Icon: `span.material-icons text-indigo-500 dark:text-indigo-400 mt-1`
    *   Label: `p.text-xs font-medium text-gray-500 dark:text-gray-400`
    *   Value: `p.text-sm text-gray-900 dark:text-white`
*   **Status Badges:** `px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full` (or `px-2 py-0.5`) with specific `bg-*` and `text-*` classes based on status.
*   **Role Badges (User List):** `mr-1.5 mb-1 inline-block px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md`

## General Principles

*   **Consistency:** Apply these patterns uniformly across the application.
*   **Responsiveness:** Ensure layouts adapt well to different screen sizes using Tailwind's responsive prefixes (sm, md, lg).
*   **Accessibility:** Pay attention to color contrast and keyboard navigation. Use appropriate ARIA attributes where necessary.
*   **Dark Mode:** Styles should support dark mode effectively using `dark:` variants.
*   **Simplicity:** Favor clean and uncluttered designs. Avoid excessive decoration.

This guide should serve as a living document and be updated as new patterns emerge or existing ones are refined.