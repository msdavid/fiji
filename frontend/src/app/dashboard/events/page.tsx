'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function EventsPage() {
  const router = useRouter();
  const { user, loading, userProfile } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Basic admin check for now, can be refined with specific event privileges later
  const isAdmin = userProfile?.assignedRoleIds?.includes('sysadmin');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading events...</p>
      </div>
    );
  }

  if (!user) {
    // Should be caught by useEffect, but as a fallback
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Redirecting to login...</p>
      </div>
    );
  }
  
  // Optional: Add a check here if non-admins should not see this page at all,
  // or if they should see a read-only version. For now, assuming admin access implies access.

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800">
      {/* Re-using a similar nav structure for consistency, or use a shared Layout component */}
      <nav className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex-shrink-0 text-xl font-bold text-indigo-600 dark:text-indigo-400">
                Fiji Platform
              </Link>
            </div>
            <div className="flex items-center space-x-4">
                <Link href="/dashboard" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">
                    Dashboard
                </Link>
                {isAdmin && (
                    <Link href="/dashboard/admin/users" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">
                        User Management
                    </Link>
                )}
                 {/* Active page, so no link for Event Management here, or style differently */}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Event Management
            </h1>
            {isAdmin && (
              <Link href="/dashboard/events/new">
                <button className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md">
                  Create New Event
                </button>
              </Link>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
            <p className="text-gray-600 dark:text-gray-300">
              Event listing will appear here. (Placeholder)
            </p>
            {/* TODO: Fetch and display list of events */}
          </div>
        </div>
      </main>
    </div>
  );
}