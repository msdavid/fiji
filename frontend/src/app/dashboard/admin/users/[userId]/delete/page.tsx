'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface UserProfileData {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  // Add other fields if needed for display, but keep it minimal for a delete confirmation
}

export default function DeleteUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const { user, loading: authLoading, userProfile: adminUserProfile, fetchUserProfile, hasPrivilege } = useAuth();
  const [userData, setUserData] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // For placeholder action

  const canDeleteUsers = adminUserProfile && (hasPrivilege ? hasPrivilege('users', 'delete') : adminUserProfile.assignedRoleIds?.includes('sysadmin'));

  const fetchUserData = useCallback(async () => {
    if (!user || !userId || !canDeleteUsers) {
      if (user && adminUserProfile && !canDeleteUsers) {
        setError("You don't have permission to delete users.");
      }
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch user data');
      }
      const data: UserProfileData = await response.json();
      setUserData(data);
    } catch (err: any) {
      setError(err.message);
      console.error("Fetch user data error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, userId, canDeleteUsers, adminUserProfile]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && !adminUserProfile) {
      fetchUserProfile(); // Fetch admin's profile for permission check
    }
    if (user && adminUserProfile && userId) {
      fetchUserData();
    }
  }, [user, authLoading, adminUserProfile, fetchUserProfile, userId, router, fetchUserData]);

  const handlePlaceholderDelete = async () => {
    setIsSubmitting(true);
    setError(null);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    alert(`Placeholder: User ${userData?.firstName} ${userData?.lastName} would be deleted. Actual deletion logic not implemented.`);
    setIsSubmitting(false);
    router.push('/dashboard/admin/users'); // Redirect after "deletion"
  };

  if (authLoading || (!adminUserProfile && user)) {
    return <div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>;
  }

  if (!canDeleteUsers && adminUserProfile) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-800 p-8">
        <div className="max-w-md mx-auto bg-white dark:bg-gray-900 shadow-lg rounded-lg p-6 text-center">
          <h1 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
          <p className="text-gray-700 dark:text-gray-300">You do not have permission to perform this action.</p>
          <Link href="/dashboard/admin/users" className="mt-6 inline-block px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
            Back to User List
          </Link>
        </div>
      </div>
    );
  }
  
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><p>Loading user details...</p></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-800 p-8">
        <div className="max-w-md mx-auto bg-white dark:bg-gray-900 shadow-lg rounded-lg p-6 text-center">
          <h1 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">Error</h1>
          <p className="text-gray-700 dark:text-gray-300">{error}</p>
          <Link href="/dashboard/admin/users" className="mt-6 inline-block px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
            Back to User List
          </Link>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-800 p-8">
        <div className="max-w-md mx-auto bg-white dark:bg-gray-900 shadow-lg rounded-lg p-6 text-center">
          <h1 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4">User Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400">The user you are trying to delete could not be found.</p>
          <Link href="/dashboard/admin/users" className="mt-6 inline-block px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
            Back to User List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6 sm:p-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">Confirm Deletion</h1>
        <p className="text-center text-gray-700 dark:text-gray-300 mb-6">
          Are you sure you want to delete the user: <br />
          <strong className="text-lg">{userData.firstName || ''} {userData.lastName || ''} ({userData.email})</strong>?
        </p>
        <p className="text-center text-sm text-yellow-600 dark:text-yellow-400 mb-6">
          Note: This is currently a placeholder action. Actual user deletion is not yet implemented.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={handlePlaceholderDelete}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Processing...' : 'Confirm Delete (Placeholder)'}
          </button>
          <Link href="/dashboard/admin/users">
            <button
              type="button"
              className="w-full sm:w-auto px-6 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}