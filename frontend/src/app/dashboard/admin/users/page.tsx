'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast'; // Added for potential future use, though not directly used in this file update

interface UserProfile {
  uid: string; // Retained for potential internal use if needed, though 'id' is primary
  id: string; 
  email: string;
  firstName?: string;
  lastName?: string;
  status: string;
  assignedRoleIds?: string[];
  assignedRoleNames?: string[];
  createdAt: string; 
  profilePictureUrl?: string;
}

export default function AdminUserManagementPage() {
  const router = useRouter();
  const { user, loading: authLoading, userProfile: adminUserProfile, fetchUserProfile, hasPrivilege } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // Kept for fetchUsers error
  const [searchTerm, setSearchTerm] = useState('');

  // Use adminUserProfile.id for checking against current user, as user.uid is Firebase UID
  // and userProfile.id is our Firestore document ID (which should match Firebase UID)
  const currentAdminId = adminUserProfile?.id; 

  const canListUsers = adminUserProfile && (hasPrivilege ? hasPrivilege('users', 'list') : false);
  const canCreateUsers = adminUserProfile && (hasPrivilege ? hasPrivilege('users', 'admin_create') : false); // Corrected to 'admin_create'
  const canEditUsers = adminUserProfile && (hasPrivilege ? hasPrivilege('users', 'edit') : false);
  const canDeleteUsersGlobal = adminUserProfile && (hasPrivilege ? hasPrivilege('users', 'delete') : false);


  const fetchUsers = useCallback(async () => {
    if (!user || !canListUsers) { 
        if (user && !canListUsers && adminUserProfile) setError("You don't have permission to view users.");
        else if (!user && !authLoading) setError("Authentication required to view users."); // More specific error
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      // Fetching more users to better test pagination/search, adjust as needed
      const response = await fetch(`${backendUrl}/users?limit=200`, { 
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch users');
      }
      const data: UserProfile[] = await response.json();
      // Ensure 'id' field is consistently populated, preferring 'id' over 'uid' if both exist
      const processedData = data.map(u => ({ ...u, id: u.id || u.uid })); 
      setUsers(processedData);
    } catch (err: any) {
      setError(err.message);
      toast.error(`Error fetching users: ${err.message}`); // Also use toast for fetch errors
      console.error("Fetch users error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, canListUsers, adminUserProfile, authLoading]); 

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && !adminUserProfile && !authLoading) { // Ensure not to call if auth is still loading
        fetchUserProfile(); 
    }
    // Fetch users only if adminUserProfile is loaded and has permission
    if (user && adminUserProfile && canListUsers) { 
        fetchUsers();
    } else if (user && adminUserProfile && !canListUsers && !authLoading) {
        // If profile loaded but no permission, set error and stop loading
        setError("You don't have permission to view users.");
        setIsLoading(false);
    }
  }, [user, authLoading, adminUserProfile, fetchUserProfile, router, fetchUsers, canListUsers]);

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase();
    return (
      u.firstName?.toLowerCase().includes(term) ||
      u.lastName?.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.status?.toLowerCase().includes(term) ||
      u.assignedRoleNames?.join(', ').toLowerCase().includes(term)
    );
  });

  const statusColors: { [key: string]: string } = {
    active: 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100',
    disabled: 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100',
    pending_verification: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100',
  };


  if (authLoading || (user && !adminUserProfile)) { // Simplified loading condition
    return (
      <main className="max-w-7xl mx-auto text-center flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
        <span className="material-icons text-6xl text-indigo-500 dark:text-indigo-400 animate-spin mb-4">sync</span>
        <p className="text-lg text-gray-700 dark:text-gray-300">Loading user data...</p>
      </main>
    );
  }
  
  // This check is important for when adminUserProfile is loaded but permissions are not granted.
  if (!canListUsers && adminUserProfile) { 
    return (
        <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
            <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-red-500 dark:text-red-400 mb-4">lock</span>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">Access Denied</h1>
                <p className="text-gray-700 dark:text-gray-300 mb-6">You do not have permission to view this page.</p>
                <Link href="/dashboard" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm">
                    <span className="material-icons mr-2 text-base">arrow_back</span>
                    Go to Dashboard
                </Link>
            </div>
        </main>
    );
  }
  
  return (
    <main className="max-w-7xl mx-auto"> 
      <header className="mb-8 pt-8 flex flex-col sm:flex-row justify-between items-start sm:items-center"> 
        <div className="mb-4 sm:mb-0">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage all registered users in the system.</p>
        </div>
        {canCreateUsers && ( // Privilege for creating users is 'users:admin_create'
            <Link
                href="/dashboard/admin/users/new" 
                className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
            >
                <span className="material-icons mr-2 text-base">person_add</span>
                Create New User
            </Link>
        )}
      </header>

      <div className="mb-6 bg-white dark:bg-gray-900 rounded-lg shadow-md">
        <input
          type="text"
          placeholder="Search users by name, email, status, or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-white"
        />
      </div>

      {isLoading && users.length === 0 ? (
         <div className="text-center py-10 px-4 sm:px-6 lg:px-8"><p className="text-gray-500 dark:text-gray-400">Loading users list...</p></div>
      ) : error && !isLoading ? ( // Show error only if not loading
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-md shadow text-center">
            <p className="text-red-700 dark:text-red-300">Error: {error}</p>
            <button 
                onClick={fetchUsers} 
                className="mt-4 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
            >
                <span className="material-icons mr-2 text-base">refresh</span>
                Retry
            </button>
        </div>
      ) : !isLoading && filteredUsers.length === 0 ? (
        <div className="text-center py-10 bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6">
          <span className="material-icons text-5xl text-gray-400 dark:text-gray-500 mb-4">search_off</span>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No Users Found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {users.length === 0 ? "There are no users in the system yet." : "No users match your current search criteria."}
          </p>
          {users.length === 0 && canCreateUsers && (
             <Link 
                href="/dashboard/admin/users/new" 
                className="mt-6 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
              >
                <span className="material-icons mr-2 text-base">person_add</span>
                Create First User
            </Link>
          )}
        </div>
      ) : (
        <div className="shadow-xl border border-gray-200 dark:border-gray-700 sm:rounded-lg overflow-hidden mb-8"> 
          <div className="bg-white dark:bg-gray-900 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Roles</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Joined</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredUsers.map((userEntry) => (
                  <tr key={userEntry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center">
                            {userEntry.profilePictureUrl ? (
                                <img src={userEntry.profilePictureUrl} alt={`${userEntry.firstName} ${userEntry.lastName}`} className="h-10 w-10 rounded-full mr-3 object-cover" />
                            ) : (
                                <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-800 mr-3 flex items-center justify-center text-sm font-semibold text-indigo-600 dark:text-indigo-300">
                                    {(userEntry.firstName?.[0] || '').toUpperCase()}{(userEntry.lastName?.[0] || '').toUpperCase() || (userEntry.email?.[0] || '').toUpperCase()}
                                </div>
                            )}
                            <Link href={`/dashboard/admin/profile/${userEntry.id}`} className="hover:underline">
                                {userEntry.firstName || 'N/A'} {userEntry.lastName || ''}
                            </Link>
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{userEntry.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        statusColors[userEntry.status] || 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100'
                      }`}>
                        {userEntry.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {(userEntry.assignedRoleNames && userEntry.assignedRoleNames.length > 0) 
                        ? userEntry.assignedRoleNames.map(role => (
                            <span key={role} className="mr-1.5 mb-1 inline-block px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md">{role}</span>
                          ))
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {userEntry.createdAt ? format(parseISO(userEntry.createdAt), 'PP') : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                      {canEditUsers && userEntry.id !== currentAdminId && ( // Prevent editing self here too for consistency, though edit page might handle it
                        <Link href={`/dashboard/admin/users/${userEntry.id}/edit`} className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 inline-flex items-center">
                          <span className="material-icons mr-1 text-sm">edit</span>Edit
                        </Link>
                      )}
                      {canDeleteUsersGlobal && userEntry.id !== currentAdminId && ( // Check against currentAdminId
                        <Link href={`/dashboard/admin/users/${userEntry.id}/delete`} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 inline-flex items-center">
                          <span className="material-icons mr-1 text-sm">delete</span>Delete
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}