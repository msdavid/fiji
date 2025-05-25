'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface WorkingGroupCreatePayload {
  groupName: string;
  description?: string;
  status: 'active' | 'archived';
}

export default function NewWorkingGroupPage() {
  const router = useRouter();
  const { user, loading: authLoading, userProfile, fetchUserProfile, hasPrivilege } = useAuth();

  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canCreateWorkingGroups = userProfile && (hasPrivilege ? hasPrivilege('working_groups', 'create') : userProfile.assignedRoleIds?.includes('sysadmin'));

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
    if (user && !userProfile) {
        fetchUserProfile(); 
    }
    if (userProfile && !canCreateWorkingGroups) {
        setError("You don't have permission to create working groups.");
    }
  }, [user, authLoading, userProfile, fetchUserProfile, router, canCreateWorkingGroups]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canCreateWorkingGroups) {
        setError("Cannot submit: No permission or user not authenticated.");
        return;
    }
    if (!groupName.trim()) {
        setError("Group Name is required.");
        return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: WorkingGroupCreatePayload = {
      groupName: groupName.trim(),
      description: description.trim() || undefined,
      status,
    };

    try {
      const idToken = await user.getIdToken();
      const authToken = localStorage.getItem('sessionToken') || idToken;
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/working-groups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create working group');
      }
      router.push('/dashboard/admin/working-groups'); 
    } catch (err: any) {
      setError(err.message);
      console.error("Create working group error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || (!userProfile && user)) { 
    return (
      <div className="flex flex-col justify-center items-center h-full min-h-[300px]">
        <span className="material-icons text-6xl text-indigo-500 dark:text-indigo-400 animate-spin mb-4">
          sync
        </span>
        <p className="text-lg text-gray-700 dark:text-gray-300">Loading page...</p>
      </div>
    );
  }

  if (!canCreateWorkingGroups) {
    return (
        <div className="max-w-2xl mx-auto py-8"> 
            <div className="bg-white dark:bg-gray-900 shadow-lg rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-red-500 dark:text-red-400 mx-auto mb-3">lock</span>
                <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
                <p className="text-gray-700 dark:text-gray-300 mb-6">You do not have permission to create new working groups.</p>
                <Link 
                  href="/dashboard/admin/working-groups" 
                  className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    <span className="material-icons text-lg mr-2">arrow_back</span>
                    Back to Working Groups
                </Link>
            </div>
        </div>
    );
  }

  return (
    <div> 
      <div className="mb-6">
        <Link href="/dashboard/admin/working-groups" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          <span className="material-icons text-lg mr-1">arrow_back_ios</span>
          Back to Working Groups
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">Create New Working Group</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Group Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="groupName"
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
              className="mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              name="description"
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'archived')}
              className="mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-800 dark:text-white"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {error && ( 
            <div className="my-4 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center" role="alert">
              <span className="material-icons text-lg mr-2">error_outline</span>
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <Link href="/dashboard/admin/working-groups" passHref>
              <button
                  type="button"
                  className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
              >
                  <span className="material-icons text-lg mr-2">cancel</span>
                  Cancel
              </button>
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 inline-flex items-center"
            >
              {isSubmitting ? (
                <>
                  <span className="material-icons animate-spin text-lg mr-2">sync</span>
                  Creating...
                </>
              ) : (
                <>
                  <span className="material-icons text-lg mr-2">add_circle_outline</span>
                  Create Working Group
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}