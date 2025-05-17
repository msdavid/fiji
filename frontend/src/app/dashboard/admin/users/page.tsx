"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext'; // Correctly import useAuth
import apiClient from '@/lib/apiClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RoleManagementModal from '@/components/admin/RoleManagementModal';

// Matches UserResponse from backend
interface User {
  uid: string;
  email: string;
  firstName: string;
  lastName:string;
  phoneNumber?: string | null;
  assignedRoleIds: string[];
  status: string;
  createdAt: string; // Assuming these are ISO strings
  updatedAt: string; // Assuming these are ISO strings
}

// Custom hook for admin-specific authentication and authorization logic
const useAdminAuthCheck = () => {
  const { user, idToken, userProfile, loading: authLoading, error: authError } = useAuth();

  // Check if the user has the 'sysadmin' role ID.
  const hasAdminRole = userProfile?.assignedRoleIds?.includes('sysadmin');

  const canAccessPage = user && idToken && hasAdminRole;

  return { user, idToken, userProfile, canAccessPage, authLoading, authError };
};


const AdminUserManagementPage = () => {
  const { idToken, canAccessPage, authLoading, authError, userProfile } = useAdminAuthCheck();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true); // For data fetching specific to this page
  const [error, setError] = useState<string | null>(null); // For errors specific to this page's operations

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserForRoles, setSelectedUserForRoles] = useState<User | null>(null);

  useEffect(() => {
    // Wait for auth context to finish loading
    if (authLoading) {
      setIsLoading(true); // Keep page loading indicator active
      return;
    }

    // Handle auth errors from context
    if (authError) {
      setError(`Authentication error: ${authError.message}`);
      setIsLoading(false);
      return;
    }

    // Check for page access permission
    if (!canAccessPage) {
      setError("Access Denied. You do not have permission to view this page.");
      setIsLoading(false);
      // Optionally, redirect: router.push('/dashboard');
      return;
    }

    // Ensure ID token is available for API calls
    if (!idToken) {
        setError("Authentication token not available. Cannot fetch users.");
        setIsLoading(false);
        return;
    }

    // Fetch users if authorized and token is present
    const fetchUsers = async () => {
      setIsLoading(true); // Start loading for user data fetch
      setError(null); // Clear previous page-specific errors
      try {
        const data = await apiClient<User[]>({
          path: '/users', // Ensure this is the correct endpoint for fetching all users
          token: idToken,
        });
        setUsers(data);
      } catch (err: any) {
        console.error('Failed to fetch users:', err);
        setError(err.data?.detail || err.message || 'Failed to load users.');
      } finally {
        setIsLoading(false); // Finish loading for user data fetch
      }
    };

    fetchUsers();
  }, [canAccessPage, authLoading, authError, idToken, router]);

  const handleOpenModal = (userToManage: User) => {
    setSelectedUserForRoles(userToManage);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUserForRoles(null);
  };

  const handleRolesUpdated = (userId: string, updatedRoleIds: string[]) => {
    setUsers(prevUsers =>
      prevUsers.map(u => (u.uid === userId ? { ...u, assignedRoleIds: updatedRoleIds } : u))
    );
    // Optionally, show a success message
  };

  // Determine if the current admin user can manage roles (e.g., has 'sysadmin' role)
  const canManageUserRoles = userProfile?.assignedRoleIds?.includes('sysadmin');


  if (authLoading || (isLoading && users.length === 0 && !error)) {
    return <div className="flex justify-center items-center h-screen"><p className="text-lg">Loading users...</p></div>;
  }

  // If there was an auth error or access is denied, show a clear message
  if (authError || !canAccessPage) {
    return (
      <div className="container mx-auto p-6 max-w-4xl text-center">
        <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Users</h1>
        <p className="text-red-500 text-lg">{error || authError?.message || "Access Denied. You do not have permission to view this page."}</p>
        <Link href="/dashboard" className="text-indigo-600 dark:text-indigo-400 hover:underline mt-6 inline-block text-lg">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  // If there's a page-specific error after successful auth (e.g., failed to fetch users)
  if (error && users.length === 0) {
     return (
      <div className="container mx-auto p-6 max-w-4xl text-center">
        <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Users</h1>
        <p className="text-red-500 text-lg">Error: {error}</p>
        <Link href="/dashboard" className="text-indigo-600 dark:text-indigo-400 hover:underline mt-6 inline-block text-lg">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="flex justify-between items-center mb-2"> {/* Reduced mb for tighter spacing with new link */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200">Users</h1>
      </div>
      <div className="mb-6"> {/* New div for the link */}
        <Link href="/dashboard" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Display non-critical errors that occur after initial load, e.g. role update error */}
      {error && <p className="text-red-500 mb-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 p-3 rounded">{error}</p>}

      {users.length === 0 && !isLoading && ( // Check !isLoading here
        <div className="text-center py-10">
          <p className="text-gray-600 dark:text-gray-400 text-lg">No users found.</p>
          {/* You might want a button to invite users if applicable */}
        </div>
      )}

      {users.length > 0 && (
        <div className="overflow-x-auto bg-gray-50 dark:bg-gray-700 shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Roles</th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((userEntry) => (
                <tr key={userEntry.uid}>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{userEntry.firstName} {userEntry.lastName}</td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{userEntry.email}</td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 capitalize">{userEntry.status}</td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {userEntry.assignedRoleIds.join(', ') || 'N/A'}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleOpenModal(userEntry)}
                      className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!canManageUserRoles} // Disable if current admin cannot manage roles
                    >
                      Manage Roles
                    </button>
                    <Link href={`/dashboard/admin/profile/${userEntry.uid}`} className="ml-4 text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200">
                      View Profile
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedUserForRoles && idToken && ( // Ensure idToken is passed to modal if needed by its operations
        <RoleManagementModal
          user={selectedUserForRoles}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onRolesUpdated={handleRolesUpdated}
          // Pass idToken if RoleManagementModal makes its own API calls
          // currentAdminIdToken={idToken}
        />
      )}
    </div>
  );
};

export default AdminUserManagementPage;