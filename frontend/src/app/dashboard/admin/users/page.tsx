'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext'; // Assuming useAuth provides user and token
import { format, parseISO } from 'date-fns';

interface UserProfile {
  uid: string; // Firebase UID, which is the document ID in Firestore 'users' collection
  id: string; // Explicitly adding id for clarity, same as uid
  email: string;
  firstName?: string;
  lastName?: string;
  status: string;
  assignedRoleIds?: string[];
  assignedRoleNames?: string[];
  createdAt: string; // ISO string
  profilePictureUrl?: string;
}

export default function AdminUserManagementPage() {
  const router = useRouter();
  const { user, loading: authLoading, userProfile: adminUserProfile, fetchUserProfile, hasPrivilege } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const canViewUsers = adminUserProfile && (hasPrivilege ? hasPrivilege('users', 'list') : adminUserProfile.assignedRoleIds?.includes('sysadmin'));
  const canEditUsers = adminUserProfile && (hasPrivilege ? hasPrivilege('users', 'edit') : adminUserProfile.assignedRoleIds?.includes('sysadmin'));
  // Define canDeleteUsers, assuming a 'users:delete' privilege or sysadmin
  const canDeleteUsers = adminUserProfile && (hasPrivilege ? hasPrivilege('users', 'delete') : adminUserProfile.assignedRoleIds?.includes('sysadmin'));


  const fetchUsers = useCallback(async () => {
    if (!user || !canViewUsers) {
        if (user && !canViewUsers && adminUserProfile) setError("You don't have permission to view users.");
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      // TODO: Implement pagination in backend and add controls here
      const response = await fetch(`${backendUrl}/users?limit=100`, { // Fetching up to 100 users for now
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch users');
      }
      const data: UserProfile[] = await response.json();
      // Ensure 'id' field is populated if backend returns 'uid' or relies on Firestore doc ID mapping
      const processedData = data.map(u => ({ ...u, id: u.id || u.uid }));
      setUsers(processedData);
    } catch (err: any) {
      setError(err.message);
      console.error("Fetch users error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, canViewUsers, adminUserProfile]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && !adminUserProfile) { // If user is loaded but admin profile isn't
        fetchUserProfile(); // Fetch admin's own profile to get roles/privileges
    }
    if (user && adminUserProfile) { // Once admin profile is loaded, check permissions and fetch users
        fetchUsers();
    }
  }, [user, authLoading, adminUserProfile, fetchUserProfile, router, fetchUsers]);

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase();
    return (
      u.firstName?.toLowerCase().includes(term) ||
      u.lastName?.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  });

  if (authLoading || (!adminUserProfile && user)) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center">
        <p>Loading user data...</p>
      </div>
    );
  }

  if (!canViewUsers && adminUserProfile) {
    return (
        <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="bg-white dark:bg-gray-900 shadow-lg rounded-lg p-6 text-center">
                <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
                <p className="text-gray-700 dark:text-gray-300">You do not have permission to view this page.</p>
                <Link href="/dashboard" className="mt-6 inline-block px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                    Go to Dashboard
                </Link>
            </div>
        </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-red-500">Error: {error}</p>
        <button onClick={fetchUsers} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
          Retry
        </button>
      </main>
    );
  }
  
  return (
    <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
      </header>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-white"
        />
      </div>

      {isLoading && users.length === 0 ? (
         <div className="text-center py-10"><p>Loading users list...</p></div>
      ) : !isLoading && filteredUsers.length === 0 ? (
        <div className="text-center py-10 bg-white dark:bg-gray-900 shadow rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">
            {users.length === 0 ? "No users found in the system." : "No users found matching your search criteria."}
          </p>
        </div>
      ) : (
        <div className="shadow border-b border-gray-200 dark:border-gray-700 sm:rounded-lg overflow-hidden">
          <div className="bg-white dark:bg-gray-700 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
              <thead className="bg-gray-50 dark:bg-gray-600">
                <tr>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Roles</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Joined</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-500">
                {filteredUsers.map((userEntry) => (
                  <tr key={userEntry.id}>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        <div className="flex items-center">
                            {userEntry.profilePictureUrl ? (
                                <img src={userEntry.profilePictureUrl} alt="Profile" className="h-8 w-8 rounded-full mr-3" />
                            ) : (
                                <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 mr-3 flex items-center justify-center text-xs text-gray-600 dark:text-gray-300">
                                    {userEntry.firstName?.[0] || ''}{userEntry.lastName?.[0] || ''}
                                </div>
                            )}
                            <Link href={`/dashboard/admin/profile/${userEntry.id}`} className="hover:underline">
                                {userEntry.firstName} {userEntry.lastName}
                            </Link>
                        </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{userEntry.email}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        userEntry.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' 
                        : userEntry.status === 'disabled' ? 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100' // for pending_verification or other statuses
                      }`}>
                        {userEntry.status}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {(userEntry.assignedRoleNames && userEntry.assignedRoleNames.length > 0) ? userEntry.assignedRoleNames.join(', ') : 'N/A'}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {format(parseISO(userEntry.createdAt), 'PP')}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {canEditUsers && (
                        <Link href={`/dashboard/admin/users/${userEntry.id}/edit`} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 mr-3">
                          Edit
                        </Link>
                      )}
                      {canDeleteUsers && (
                        <Link href={`/dashboard/admin/users/${userEntry.id}/delete`} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200">
                          Delete
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