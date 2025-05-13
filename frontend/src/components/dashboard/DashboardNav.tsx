'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig'; // Ensure this path is correct
import { useAuth } from '@/context/AuthContext';

export default function DashboardNav() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout Error:', error);
    }
  };

  const isAdmin = userProfile?.assignedRoleIds?.includes('sysadmin');

  if (authLoading && !user) { // Show loading only if user data isn't available yet
    return (
        <nav className="bg-white dark:bg-gray-900 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Link href="/dashboard" className="flex-shrink-0 text-xl font-bold text-indigo-600 dark:text-indigo-400">
                            Fiji Platform
                        </Link>
                    </div>
                    <div className="text-gray-700 dark:text-gray-300">Loading navigation...</div>
                </div>
            </div>
        </nav>
    );
  }

  if (!user) {
    // Should not happen if layout protects routes, but as a fallback.
    return null;
  }

  return (
    <nav className="bg-white dark:bg-gray-900 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex-shrink-0 text-xl font-bold text-indigo-600 dark:text-indigo-400">
                Fiji Platform
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard/profile"
              className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              My Profile
            </Link>
            {isAdmin && (
              <>
                <Link
                  href="/dashboard/admin/users"
                  className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  Users
                </Link>
                <Link
                  href="/dashboard/admin/working-groups"
                  className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  Working Groups
                </Link>
              </>
            )}
            <Link
              href="/dashboard/events" // Events link for all authenticated users
              className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              Events
            </Link>
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
  );
}