'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; 
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { useAuth } from '@/context/AuthContext'; 

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, error: authError, userProfile } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout Error:', error);
    }
  };

  // Updated isAdmin check:
  // Assumes 'sysadmin' is the ID of the sysadmin role in the assignedRoleIds array.
  // If your sysadmin role ID is different (e.g., a UUID), replace 'sysadmin' with that ID.
  const isAdmin = userProfile?.assignedRoleIds?.includes('sysadmin');
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
        <div>Loading dashboard...</div>
      </div>
    );
  }

  if (authError) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 dark:bg-red-900 p-4">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl text-center">
                <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Authentication Error</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                    {authError.message || "An unexpected authentication error occurred."}
                </p>
                <button
                    onClick={() => router.push('/login')}
                    className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md"
                >
                    Go to Login
                </button>
            </div>
        </div>
    );
  }

  if (!user) {
    // This case should ideally be handled by the useEffect redirect,
    // but it's a good fallback.
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
        <div>Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800">
      <nav className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 text-xl font-bold text-indigo-600 dark:text-indigo-400">
                Fiji Platform
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard/profile" 
                className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                My Profile
              </Link>
              {isAdmin && (
                <Link 
                  href="/dashboard/admin/users" 
                  className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  User Management
                </Link>
              )}
              {isAdmin && ( // Added Event Management link for admin
                <Link 
                  href="/dashboard/events" 
                  className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  Event Management
                </Link>
              )}
              <span className="text-gray-700 dark:text-gray-300">
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="py-2 px-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Welcome to your Dashboard, {user.displayName || user.email}!
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-300">
                UID: {user.uid}
              </p>
              <p className="mt-4 text-gray-600 dark:text-gray-300">
                This is a placeholder for your dashboard content. More features will be added soon.
              </p>
              {/* You can also display userProfile details here for quick verification */}
              {/* {userProfile && (
                <pre className="mt-4 p-2 bg-gray-200 dark:bg-gray-700 rounded text-sm overflow-x-auto">
                  {JSON.stringify(userProfile, null, 2)}
                </pre>
              )} */}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}