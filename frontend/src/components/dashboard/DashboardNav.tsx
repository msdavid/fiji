'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig'; // Ensure this path is correct
import { useAuth } from '@/context/AuthContext';
import React from 'react'; // Import React for JSX elements in array and keys

export default function DashboardNav() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading, hasPrivilege } = useAuth(); // Added hasPrivilege

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

  const displayName = userProfile?.firstName ? userProfile.firstName : (user.email || "Profile");

  const linkClassName = "text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400";
  const separatorClassName = "text-gray-400 dark:text-gray-500 select-none";

  const navLinkComponents = [];

  if (isAdmin) {
    navLinkComponents.push(
      <Link key="users" href="/dashboard/admin/users" className={linkClassName}>
        Users
      </Link>
    );
    navLinkComponents.push(
      <Link key="wg" href="/dashboard/admin/working-groups" className={linkClassName}>
        Working Groups
      </Link>
    );
  }

  // Conditionally add Donations link
  if (hasPrivilege && hasPrivilege('donations', 'list')) {
    navLinkComponents.push(
      <Link key="donations" href="/dashboard/donations" className={linkClassName}>
        Donations
      </Link>
    );
  }

  navLinkComponents.push(
    <Link key="events" href="/dashboard/events" className={linkClassName}>
      Events
    </Link>
  );
  navLinkComponents.push(
    <Link key="profile" href="/dashboard/profile" className={linkClassName}>
      {displayName}
    </Link>
  );

  const renderedNavItems = [];
  navLinkComponents.forEach((item, index) => {
    renderedNavItems.push(item);
    if (index < navLinkComponents.length - 1) {
      renderedNavItems.push(
        <span key={`sep-${index}`} className={separatorClassName}>
          |
        </span>
      );
    }
  });

  return (
    <nav className="bg-white dark:bg-gray-900 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex-shrink-0 text-xl font-bold text-indigo-600 dark:text-indigo-400">
                Fiji Platform
            </Link>
          </div>
          <div className="flex items-center space-x-3"> 
            {renderedNavItems}
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