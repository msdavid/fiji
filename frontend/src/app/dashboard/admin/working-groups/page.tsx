'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO } from 'date-fns';

interface WorkingGroup {
  id: string;
  groupName: string;
  description?: string;
  status: 'active' | 'archived';
  createdByUserId: string;
  creatorFirstName?: string;
  creatorLastName?: string;
  createdAt: string;
  updatedAt: string;
}

export default function WorkingGroupsListPage() {
  const router = useRouter();
  const { user, loading: authLoading, userProfile, fetchUserProfile, hasPrivilege } = useAuth();
  const [workingGroups, setWorkingGroups] = useState<WorkingGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canViewWorkingGroups = userProfile && (hasPrivilege ? hasPrivilege('working_groups', 'view') : userProfile.assignedRoleIds?.includes('sysadmin'));
  const canCreateWorkingGroups = userProfile && (hasPrivilege ? hasPrivilege('working_groups', 'create') : userProfile.assignedRoleIds?.includes('sysadmin'));

  const fetchWorkingGroups = useCallback(async () => {
    if (!user || !canViewWorkingGroups) {
      if (user && !canViewWorkingGroups) setError("You don't have permission to view working groups.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/working-groups`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch working groups');
      }
      const data: WorkingGroup[] = await response.json();
      setWorkingGroups(data);
    } catch (err: any) {
      setError(err.message);
      console.error("Fetch working groups error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, canViewWorkingGroups]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && !userProfile) {
        fetchUserProfile();
    }
    if (user && userProfile) {
        fetchWorkingGroups();
    }
  }, [user, authLoading, userProfile, fetchUserProfile, router, fetchWorkingGroups]);

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-full min-h-[300px]">
        <span className="material-icons text-6xl text-indigo-500 dark:text-indigo-400 animate-spin mb-4">
          sync
        </span>
        <p className="text-lg text-gray-700 dark:text-gray-300">Loading working groups...</p>
      </div>
    );
  }

  if (!canViewWorkingGroups && userProfile) {
    return (
        <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
            <div className="bg-white dark:bg-gray-900 shadow-lg rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-red-500 dark:text-red-400 mx-auto mb-3">lock</span>
                <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
                <p className="text-gray-700 dark:text-gray-300 mb-6">You do not have permission to view this page.</p>
                <Link href="/dashboard" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    <span className="material-icons text-lg mr-2">arrow_back</span>
                    Go to Dashboard
                </Link>
            </div>
        </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-400 flex items-center" role="alert">
        <span className="material-icons text-xl mr-2">error_outline</span>
        <span>Error: {error}</span>
        <Link href="/dashboard" className="ml-auto text-sm text-indigo-600 hover:underline dark:text-indigo-400 font-medium">
            Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div> 
      <header className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Working Groups</h1>
        {canCreateWorkingGroups && (
          <Link href="/dashboard/admin/working-groups/new" className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm inline-flex items-center">
            <span className="material-icons text-lg mr-2">group_add</span>
            New Working Group
          </Link>
        )}
      </header>

      {workingGroups.length === 0 ? (
        <div className="text-center py-10 bg-white dark:bg-gray-900 shadow-lg rounded-lg flex flex-col items-center justify-center min-h-[200px]">
          <span className="material-icons text-6xl text-gray-400 dark:text-gray-500 mb-4">
            workspaces_outline
          </span>
          <p className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">No working groups found.</p>
          {canCreateWorkingGroups && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                  You can <Link href="/dashboard/admin/working-groups/new" className="text-indigo-600 hover:underline dark:text-indigo-400 font-medium">create one now</Link>.
              </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workingGroups.map((wg) => (
            <div key={wg.id} className="bg-white dark:bg-gray-900 shadow-lg rounded-lg overflow-hidden h-full flex flex-col group hover:shadow-xl transition-shadow duration-200 ease-in-out">
              <Link href={`/dashboard/admin/working-groups/${wg.id}`} className="flex flex-col flex-grow">
                <div className="flex flex-row flex-grow">
                  <div className="flex-shrink-0 p-3 sm:p-4 flex items-start justify-center border-r border-gray-200 dark:border-gray-700">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <span className="material-icons text-3xl sm:text-4xl text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-500 transition-colors duration-150">
                        workspaces
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col flex-grow p-4 sm:p-6 overflow-hidden">
                    <div className="flex-grow">
                      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mb-2 transition-colors duration-150" title={wg.groupName}>
                        {wg.groupName}
                      </h2>
                      <p className={`text-xs font-medium px-2 py-1 rounded-full inline-block mb-3 ${
                        wg.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' 
                                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100'
                      }`}>
                        {wg.status.charAt(0).toUpperCase() + wg.status.slice(1)}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 line-clamp-2" title={wg.description}>
                        {wg.description || 'No description provided.'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                    Created by: {wg.creatorFirstName || ''} {wg.creatorLastName || wg.createdByUserId}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                    Created on: {format(parseISO(wg.createdAt), 'PP')}
                    </p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}