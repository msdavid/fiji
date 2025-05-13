'use client';

import { useAuth } from '@/context/AuthContext'; // Still needed for user display name/email

export default function DashboardPage() {
  const { user, loading: authContextLoading } = useAuth(); // Renamed to avoid conflict if page had its own loading

  // Primary loading, authError, and !user checks are handled by DashboardLayout.
  // This component renders if user is authenticated.
  // authContextLoading check here is for content specific to this page if needed.
  if (authContextLoading && !user) { // Or a more specific loading state for this page's data
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div>Loading dashboard content...</div>
        </div>
      </div>
    );
  }
  
  // If we reach here, user object should be available from useAuth.
  // If user is null here, it means DashboardLayout's logic might need review,
  // or there's a race condition with AuthContext.
  // For now, assume user is populated by the time layout allows rendering.

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Welcome to your Dashboard, {user?.displayName || user?.email}!
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            UID: {user?.uid}
          </p>
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            This is a placeholder for your dashboard content. More features will be added soon.
          </p>
        </div>
      </div>
    </div>
  );
}