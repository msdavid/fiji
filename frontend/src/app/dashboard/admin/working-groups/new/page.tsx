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
        fetchUserProfile(); // Ensure profile and privileges are loaded
    }
    // Redirect if user does not have permission after profile is loaded
    if (userProfile && !canCreateWorkingGroups) {
        setError("You don't have permission to create working groups.");
        // Optionally redirect after a delay or show a more prominent message
        // router.push('/dashboard/admin/working-groups'); 
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
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/working-groups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create working group');
      }
      // const createdGroup = await response.json();
      // console.log('Working group created:', createdGroup);
      router.push('/dashboard/admin/working-groups'); // Redirect to list page on success
    } catch (err: any) {
      setError(err.message);
      console.error("Create working group error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !userProfile) { // Wait for profile to load to check permissions
    return <div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>;
  }

  if (!canCreateWorkingGroups) {
    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-800 p-8">
            <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 shadow-lg rounded-lg p-6 text-center">
                <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
                <p className="text-gray-700 dark:text-gray-300">You do not have permission to create new working groups.</p>
                <Link href="/dashboard/admin/working-groups" className="mt-6 inline-block px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                    Back to Working Groups
                </Link>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800">
      <nav className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/dashboard" className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              Fiji
            </Link>
            <Link href="/dashboard/admin/working-groups" className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
              ← Back to Working Groups
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">Create New Working Group</h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Group Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="groupName"
                id="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                name="description"
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'archived')}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-800 dark:text-white"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="flex justify-end space-x-3">
              <Link href="/dashboard/admin/working-groups">
                <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    Cancel
                </button>
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Working Group'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
