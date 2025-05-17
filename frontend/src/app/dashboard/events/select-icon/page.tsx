'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link'; // Import Link for navigation

export default function SelectEventIconPage() {
  const router = useRouter();

  // In a future step, this page will:
  // 1. Fetch/display Google Material Icons.
  // 2. Allow the user to select an icon.
  // 3. Pass the selected icon name back to the event form (e.g., via query params or state).

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        {/* Attempt to go back to the previous page in history, or a default if not possible */}
        <button
          onClick={() => router.back()}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          ← Back to Event Form 
        </button>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Select Event Icon</h1>
      
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-xl p-6 sm:p-8">
        <p className="text-gray-700 dark:text-gray-300">
          Icon selection gallery will be displayed here.
        </p>
        <p className="mt-4 text-gray-700 dark:text-gray-300">
          For now, please manually note the icon name you wish to use from {' '}
          <a 
            href="https://fonts.google.com/icons" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Google Material Icons
          </a>
          {' '} and return to the form to enter it (this functionality will be improved).
        </p>
      </div>
    </div>
  );
}