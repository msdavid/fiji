'use client';

import { useAuth } from '@/context/AuthContext'; 

export default function DashboardPage() {
  const { user, loading: authContextLoading } = useAuth(); 

  if (authContextLoading && !user) { 
    return (
      // This div is okay for a loading state specific to this page's content,
      // but the layout already handles overall page loading.
      // If this page had its own data fetching, this loading state would be more relevant.
      // For now, it will likely not be seen due to layout's loading.
      <div> 
        <div>Loading dashboard content...</div>
      </div>
    );
  }
  
  return (
    // Removed the redundant max-w-7xl container. Content will now be constrained by DashboardLayout.
    <div> 
      <div className="px-4 py-6 sm:px-0"> {/* This inner padding can be kept or adjusted if needed */}
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