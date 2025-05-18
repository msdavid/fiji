'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface UserToDelete {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export default function DeleteUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;
  
  const { user: currentUser, loading: authLoading, userProfile: adminUserProfile, hasPrivilege } = useAuth();
  const [userToDelete, setUserToDelete] = useState<UserToDelete | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPerformDelete = adminUserProfile && (hasPrivilege ? hasPrivilege('users', 'delete') : false);

  const fetchUserDetails = useCallback(async () => {
    if (!userId || !currentUser) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = await currentUser.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch user details');
      }
      const data: UserToDelete = await response.json();
      setUserToDelete(data);
    } catch (err: any) {
      setError(err.message);
      toast.error(`Error fetching user details: ${err.message}`);
      console.error("Fetch user details error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, currentUser]);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
      return;
    }
    if (currentUser && !canPerformDelete && !authLoading && adminUserProfile) {
        toast.error("You don't have permission to delete users.");
        router.push('/dashboard/admin/users');
        return;
    }
    if (currentUser && userId === currentUser.uid) {
        toast.error("You cannot delete your own account via this page.");
        router.push('/dashboard/admin/users');
        return;
    }
    if (currentUser && canPerformDelete) {
      fetchUserDetails();
    }
  }, [currentUser, authLoading, adminUserProfile, canPerformDelete, router, fetchUserDetails, userId]);

  const handleDelete = async () => {
    if (!userToDelete || !currentUser || !canPerformDelete || userId === currentUser.uid) {
      toast.error("Cannot proceed with deletion due to permission issues or self-deletion attempt.");
      return;
    }

    setIsDeleting(true);
    const loadingToastId = toast.loading(`Deleting user ${userToDelete.firstName || userToDelete.email}...`);
    
    try {
      const token = await currentUser.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        // Try to parse error detail, but handle cases where it might not be JSON
        let errorDetail = `Failed to delete user (status: ${response.status})`;
        try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
        } catch (e) {
            // response was not JSON, use default errorDetail
        }
        throw new Error(errorDetail);
      }
      
      toast.success(`User ${userToDelete.firstName || userToDelete.email} deleted successfully.`, { id: loadingToastId });
      router.push('/dashboard/admin/users'); 
    } catch (err: any) {
      toast.error(`Error deleting user: ${err.message}`, { id: loadingToastId });
      console.error("Delete user error:", err);
      setIsDeleting(false);
    }
    // No finally for setIsDeleting(false) here, as success leads to navigation
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
        <span className="material-icons text-6xl text-indigo-500 dark:text-indigo-400 animate-spin mb-4">sync</span>
        <p className="text-lg text-gray-700 dark:text-gray-300">Loading user data for deletion...</p>
      </div>
    );
  }

  if (error && !userToDelete) { // If error occurred and no user data was fetched
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white dark:bg-gray-800 shadow-xl rounded-lg text-center">
        <span className="material-icons text-5xl text-red-500 dark:text-red-400 mb-4">error_outline</span>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Error Loading User</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
        <Link href="/dashboard/admin/users" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium">
          Back to User List
        </Link>
      </div>
    );
  }
  
  if (!userToDelete) { // Should be covered by loading or error state, but as a fallback
    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-white dark:bg-gray-800 shadow-xl rounded-lg text-center">
            <p className="text-gray-600 dark:text-gray-300">User not found or unable to load details.</p>
            <Link href="/dashboard/admin/users" className="mt-4 inline-block text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium">
            Back to User List
            </Link>
        </div>
    );
  }

  const userName = `${userToDelete.firstName || ''} ${userToDelete.lastName || ''}`.trim() || userToDelete.email;

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="text-center">
            <span className="material-icons text-6xl text-red-500 dark:text-red-400 mb-4">warning_amber</span>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Confirm User Deletion</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to permanently delete the user: <strong className="font-semibold">{userName}</strong>?
            </p>
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              This action cannot be undone. All associated data like assignments will also be removed.
            </p>
          </div>

          <div className="mt-8 flex justify-center space-x-4">
            <Link
              href="/dashboard/admin/users"
              className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </Link>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={`py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                          ${isDeleting ? 'bg-red-400 dark:bg-red-700 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'}`}
            >
              {isDeleting ? (
                <>
                  <span className="material-icons text-sm animate-spin mr-2">sync</span>
                  Deleting...
                </>
              ) : (
                <>
                  <span className="material-icons text-sm mr-2">delete_forever</span>
                  Confirm Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}