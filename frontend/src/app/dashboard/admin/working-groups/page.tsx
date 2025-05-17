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
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center">
        <p>Loading working groups...</p>
      </div>
    );
  }

  if (!canViewWorkingGroups && userProfile) {
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
        <Link href="/dashboard" className="text-indigo-600 hover:underline">Go to Dashboard</Link>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <header className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Working Groups</h1>
        {canCreateWorkingGroups && (
          <Link href="/dashboard/admin/working-groups/new" className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md">
            New Working Group
          </Link>
        )}
      </header>

      {workingGroups.length === 0 ? (
        <div className="text-center py-10 bg-white dark:bg-gray-900 shadow rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">No working groups found.</p>
          {canCreateWorkingGroups && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  You can <Link href="/dashboard/admin/working-groups/new" className="text-indigo-600 hover:underline dark:text-indigo-400">create one now</Link>.
              </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workingGroups.map((wg) => (
            <Link key={wg.id} href={`/dashboard/admin/working-groups/${wg.id}`} className="block hover:shadow-xl transition-shadow duration-200 ease-in-out">
              <div className="bg-white dark:bg-gray-900 shadow-lg rounded-lg overflow-hidden h-full flex flex-col">
                <div className="p-6 flex-grow">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">{wg.groupName}</h2>
                  <p className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block mb-3 ${
                    wg.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' 
                                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100'
                  }`}>
                    {wg.status}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 line-clamp-2" title={wg.description}>
                    {wg.description || 'No description provided.'}
                  </p>
                </div>
                <div className="p-6 border-t border-gray-200 dark:border-gray-700 mt-auto">
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                    Created by: {wg.creatorFirstName || ''} {wg.creatorLastName || wg.createdByUserId}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                    Created on: {format(parseISO(wg.createdAt), 'PP')}
                    </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}