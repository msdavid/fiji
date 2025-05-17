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
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredUsers = users.filter(user => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    return (
      fullName.includes(term) ||
      user.email.toLowerCase().includes(term)
    );
  });

  if (authLoading || (isLoading && users.length === 0 && !error)) {
    return <div className="flex justify-center items-center h-screen"><p className="text-lg">Loading users...</p></div>;
  }

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

  if (error && users.length === 0) { // This error is page-specific, e.g., failed to fetch users
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
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200">Users</h1>
      </div>
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Display non-critical errors that occur after initial load, e.g. role update error */}
      {error && <p className="text-red-500 mb-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 p-3 rounded">{error}</p>}

      {isLoading ? (
        <div className="text-center py-10">
          <p className="text-gray-600 dark:text-gray-400 text-lg">Loading users...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-600 dark:text-gray-400 text-lg">No users found.</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            No users found matching "{searchTerm}".
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-gray-700 shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-500">
            <thead className="bg-gray-50 dark:bg-gray-600">
              <tr>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Roles</th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-500">
              {filteredUsers.map((userEntry) => (
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
                      disabled={!canManageUserRoles}
                    >
                      Manage Roles
                    </button>
                    <Link href={`/dashboard/admin/profile/${userEntry.uid}`} className="ml-4 text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200">
                      View Profile
                    </Link>
                    <Link href={`/dashboard/admin/users/${userEntry.uid}/edit`} className="ml-4 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedUserForRoles && idToken && (
        <RoleManagementModal
          user={selectedUserForRoles}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onRolesUpdated={handleRolesUpdated}
        />
      )}
    </div>
  );
};

export default AdminUserManagementPage;