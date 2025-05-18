'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
// import { format, parseISO } from 'date-fns'; 
// TODO: Define Role interface in a shared models directory, e.g., import { Role } from '@/models/role';

interface Role {
  id: string;
  roleName: string;
  description?: string;
  privileges: Record<string, string[]>; 
  userCount?: number; 
  // createdAt?: string; 
}

export default function AdminRoleManagementPage() {
  const router = useRouter();
  const { user, loading: authLoading, userProfile: adminUserProfile, fetchUserProfile, hasPrivilege } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const canViewRoles = adminUserProfile && (hasPrivilege ? hasPrivilege('roles', 'list') : adminUserProfile?.assignedRoleIds?.includes('sysadmin'));
  const canCreateRoles = adminUserProfile && (hasPrivilege ? hasPrivilege('roles', 'create') : adminUserProfile?.assignedRoleIds?.includes('sysadmin'));
  const canEditRoles = adminUserProfile && (hasPrivilege ? hasPrivilege('roles', 'edit') : adminUserProfile?.assignedRoleIds?.includes('sysadmin'));
  const canDeleteRoles = adminUserProfile && (hasPrivilege ? hasPrivilege('roles', 'delete') : adminUserProfile?.assignedRoleIds?.includes('sysadmin'));

  const fetchRoles = useCallback(async () => {
    console.log("fetchRoles called. User:", !!user, "AdminProfile:", !!adminUserProfile, "CanViewRoles:", canViewRoles);
    if (!user) {
        setIsLoading(false);
        return;
    }
    if (!adminUserProfile) {
        setIsLoading(false); 
        return;
    }
    if (!canViewRoles) {
        setError("You don't have permission to view roles.");
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/roles`, { 
        headers: { 'Authorization': `Bearer ${token}` },
      });

      console.log("API Response Status:", response.status);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Failed to parse error response" }));
        console.error("API Error Data:", errorData);
        throw new Error(errorData.detail || `Failed to fetch roles, status: ${response.status}`);
      }
      
      const rawData: Role[] = await response.json();
      console.log("Raw data from /roles API:", rawData);
      
      // Ensure all roles have a valid ID; filter out those that don't.
      const validRoles = rawData.filter(role => {
        const isValid = role.id && typeof role.id === 'string' && role.id.trim() !== '';
        if (!isValid) {
            console.warn("Filtering out role with invalid id:", role);
        }
        return isValid;
      });
      console.log("Roles after ID validation filter:", validRoles);
      setRoles(validRoles);

    } catch (err: any) {
      console.error("Fetch roles error object:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user, adminUserProfile, canViewRoles]); 

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && !adminUserProfile) {
        fetchUserProfile(); 
    }
    if (user && adminUserProfile) { 
        fetchRoles();
    }
  }, [user, authLoading, adminUserProfile, fetchUserProfile, router, fetchRoles]);

  const filteredRoles = roles.filter(role => {
    if (!role || !role.id || typeof role.id !== 'string' || role.id.trim() === '') {
        // This should ideally not happen if the filter in fetchRoles is effective
        console.warn("Filtered out role with invalid id during search filtering:", role);
        return false; 
    }
    const term = searchTerm.toLowerCase();
    return (
      role.roleName.toLowerCase().includes(term) ||
      (role.description && role.description.toLowerCase().includes(term))
    );
  });
  
  // Log error state if it changes
  useEffect(() => {
    if (error) {
        console.error("Page error state:", error);
    }
  }, [error]);

  if (authLoading || (user && !adminUserProfile && !error)) { 
    return (
      <main className="max-w-7xl mx-auto text-center">
        <p className="text-gray-500 dark:text-gray-400 pt-8">Loading user data...</p>
      </main>
    );
  }

  if (!canViewRoles && adminUserProfile) { 
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Role Management</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage system roles and their permissions.</p>
        </div>
        {canCreateRoles && (
          <Link 
            href="/dashboard/admin/roles/new" 
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
          >
            <span className="material-icons mr-2 text-base">add_circle_outline</span>
            Create New Role
          </Link>
        )}
      </header>

      <div className="mb-6 bg-white dark:bg-gray-900 rounded-lg shadow-md">
        <input
          type="text"
          placeholder="Search roles by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-white"
        />
      </div>

      {isLoading && roles.length === 0 && !error ? ( 
         <div className="text-center py-10 px-4 sm:px-6 lg:px-8"><p className="text-gray-500 dark:text-gray-400">Loading roles list...</p></div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-md shadow text-center">
            <p className="text-red-700 dark:text-red-300">Error: {error}</p>
            {error !== "You don't have permission to view roles." && (
              <button 
                  onClick={fetchRoles} 
                  className="mt-4 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
              >
                  <span className="material-icons mr-2 text-base">refresh</span>
                  Retry
              </button>
            )}
        </div>
      ) : !isLoading && filteredRoles.length === 0 ? (
        <div className="text-center py-10 bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6">
          <span className="material-icons text-5xl text-gray-400 dark:text-gray-500 mb-4">admin_panel_settings</span>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No Roles Found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {roles.length === 0 && !searchTerm ? "There are no roles configured in the system yet, or none could be loaded." : "No roles match your current search criteria, or some roles have invalid data."}
          </p>
          {roles.length === 0 && !searchTerm && canCreateRoles && (
             <Link 
                href="/dashboard/admin/roles/new" 
                className="mt-6 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
              >
                <span className="material-icons mr-2 text-base">add_circle_outline</span>
                Create First Role
            </Link>
          )}
        </div>
      ) : (
        <div className="shadow-xl border border-gray-200 dark:border-gray-700 sm:rounded-lg overflow-hidden mb-8"> 
          <div className="bg-white dark:bg-gray-900 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Users</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredRoles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {role.roleName}
                    </td>
                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-500 dark:text-gray-400 max-w-md break-words"> 
                      {role.description || <span className="italic text-gray-400 dark:text-gray-500">No description</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {typeof role.userCount === 'number' ? role.userCount : <span className="italic text-gray-400 dark:text-gray-500">N/A</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                      {canEditRoles && (
                        <Link href={`/dashboard/admin/roles/${role.id}/edit`} className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 inline-flex items-center">
                          <span className="material-icons mr-1 text-sm">edit</span>Edit
                        </Link>
                      )}
                      {canDeleteRoles && role.roleName.toLowerCase() !== 'sysadmin' && ( 
                        <Link href={`/dashboard/admin/roles/${role.id}/delete`} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 inline-flex items-center">
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