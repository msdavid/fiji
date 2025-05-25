'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient, { ApiResponse } from '@/lib/apiClient'; // Import ApiResponse

interface WorkingGroupFormData {
  groupName: string;
  description: string;
  status: 'active' | 'archived'; 
}

interface WorkingGroup extends WorkingGroupFormData {
  id: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export default function EditWorkingGroupPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;

  const { user, idToken, loading: authLoading, userProfile, fetchUserProfile, hasPrivilege, logout } = useAuth(); // Added logout
  
  const [formData, setFormData] = useState<WorkingGroupFormData>({
    groupName: '', description: '', status: 'active',
  });
  const [originalGroup, setOriginalGroup] = useState<WorkingGroup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canEdit = userProfile && (hasPrivilege ? hasPrivilege('working_groups', 'edit') : userProfile.assignedRoleIds?.includes('sysadmin'));
  const canDelete = userProfile && (hasPrivilege ? hasPrivilege('working_groups', 'delete') : userProfile.assignedRoleIds?.includes('sysadmin'));

  const fetchWorkingGroupDetails = useCallback(async () => {
    if (!user || !idToken || !groupId ) { 
      setIsLoading(false); return;
    }
    // Check if this is the protected global working group
    if (groupId === 'organization-wide') {
        setError("The 'Organization Wide' working group is a system group and cannot be edited.");
        setIsLoading(false); return;
    }
    // Permission check moved after fetching userProfile ensures it's available
    if (userProfile && !canEdit) {
        setError("You don't have permission to edit this working group.");
        setIsLoading(false); return;
    }
    setIsLoading(true); setError(null);
    
    const result: ApiResponse<WorkingGroup> = await apiClient<WorkingGroup>({
      path: `/working-groups/${groupId}`, token: idToken, method: 'GET',
    });

    setIsLoading(false);
    if (result.ok && result.data) {
      setOriginalGroup(result.data);
      setFormData({
        groupName: result.data.groupName,
        description: result.data.description || '',
        status: result.data.status,
      });
    } else {
      console.error('Failed to fetch working group details:', result.error);
      if (result.status === 401) { await logout(); return; }
      setError(result.error?.message || 'Failed to fetch working group details.');
    }
  }, [user, idToken, groupId, userProfile, canEdit, logout]); // Added userProfile and logout

  useEffect(() => {
    if (!authLoading && !user) { /* router.push('/login'); // Handled by layout/context */ }
    if (user && !userProfile && fetchUserProfile) fetchUserProfile(); 
    if (user && userProfile && idToken && groupId) { // Ensure userProfile is loaded before fetch
      fetchWorkingGroupDetails();
    }
  }, [user, authLoading, userProfile, fetchUserProfile, idToken, groupId, router, fetchWorkingGroupDetails]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !originalGroup) { setSubmitError("Cannot submit: Insufficient permissions or original data missing."); return; }
    if (!formData.groupName.trim()) { setSubmitError("Group Name cannot be empty."); return; }
    setIsSubmitting(true); setSubmitError(null);

    if (!idToken) { setSubmitError("Authentication token not available."); setIsSubmitting(false); return; }
      
    const payload: Partial<WorkingGroupFormData> = {};
    if (formData.groupName !== originalGroup.groupName) payload.groupName = formData.groupName;
    if (formData.description !== (originalGroup.description || '')) payload.description = formData.description;
    if (formData.status !== originalGroup.status) payload.status = formData.status;

    if (Object.keys(payload).length === 0) {
      setSubmitError("No changes detected to submit."); setIsSubmitting(false); return;
    }
      
    const result: ApiResponse<any> = await apiClient({ // Expect any or no content for PUT
      path: `/working-groups/${groupId}`, token: idToken, method: 'PUT', data: payload,
    });
    
    setIsSubmitting(false);
    if (result.ok) {
      router.push(`/dashboard/admin/working-groups/${groupId}`); 
    } else {
      console.error("Update working group error:", result.error);
      if (result.status === 401) { await logout(); return; }
      setSubmitError(result.error?.message || 'Failed to update working group.');
    }
  };

  const handleDeleteWorkingGroup = async () => {
    if (!user || !idToken || !groupId || !canDelete || !originalGroup) {
        setDeleteError("Cannot delete: Insufficient permissions or group data missing."); return;
    }
    if (!confirm(`Are you sure you want to delete the working group "${originalGroup.groupName}"? This action cannot be undone.`)) return;

    setIsDeleting(true); setDeleteError(null);
    
    const result: ApiResponse<any> = await apiClient({ // Expect any or no content for DELETE
        path: `/working-groups/${groupId}`, token: idToken, method: 'DELETE',
    });

    setIsDeleting(false);
    if (result.ok) {
        router.push('/dashboard/admin/working-groups');
    } else {
        console.error("Delete working group error:", result.error);
        if (result.status === 401) { await logout(); return; }
        setDeleteError(result.error?.message || 'Failed to delete working group.');
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-full min-h-[300px]">
        <span className="material-icons text-6xl text-indigo-500 dark:text-indigo-400 animate-spin mb-4">sync</span>
        <p className="text-lg text-gray-700 dark:text-gray-300">Loading group details for editing...</p>
      </div>
    );
  }

  if (error) {
    return (
        <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 shadow-lg rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl mx-auto mb-3">error_outline</span>
                <h1 className="text-2xl font-semibold mb-4">Error Loading Group</h1>
                <p className="mb-6">{error}</p>
                <Link href={`/dashboard/admin/working-groups/${groupId}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 inline-flex items-center">
                    <span className="material-icons text-lg mr-1">arrow_back_ios</span> Back to Group Details
                </Link>
            </div>
        </div>
    );
  }
  
  if (!canEdit && userProfile) { 
    return (
        <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
            <div className="bg-white dark:bg-gray-900 shadow-lg rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-red-500 dark:text-red-400 mx-auto mb-3">lock</span>
                <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
                <p className="text-gray-700 dark:text-gray-300 mb-6">You do not have permission to edit this working group.</p>
                <Link href={`/dashboard/admin/working-groups/${groupId}`} className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    <span className="material-icons text-lg mr-2">arrow_back</span> Back to Group Details
                </Link>
            </div>
        </div>
    );
  }

  if (!originalGroup && !isLoading) { 
    return (
        <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="bg-white dark:bg-gray-900 shadow-lg rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-gray-400 dark:text-gray-500 mx-auto mb-3">search_off</span>
                <h1 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">Working Group Not Found</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">The working group data could not be loaded for editing.</p>
                <Link href="/dashboard/admin/working-groups" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    <span className="material-icons text-lg mr-2">arrow_back</span> Back to Working Groups List
                </Link>
            </div>
        </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
            <Link href={`/dashboard/admin/working-groups/${groupId}`} className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                <span className="material-icons text-lg mr-1">arrow_back_ios</span> Back to Group Details
            </Link>
        </div>
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">Edit Working Group: <span className="text-indigo-600 dark:text-indigo-400">{originalGroup?.groupName}</span></h1>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group Name</label>
                    <input type="text" name="groupName" id="groupName" value={formData.groupName} onChange={handleChange} required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                    <textarea name="description" id="description" rows={4} value={formData.description} onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                    <select name="status" id="status" value={formData.status} onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white">
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                    </select>
                </div>
                {submitError && (<div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-md flex items-center" role="alert"><span className="material-icons text-lg mr-2">error_outline</span>{submitError}</div>)}
                <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Link href={`/dashboard/admin/working-groups/${groupId}`} legacyBehavior><a className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Cancel</a></Link>
                    <button type="submit" disabled={isSubmitting || isLoading} className="inline-flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                        <span className="material-icons text-lg mr-2">{isSubmitting ? 'hourglass_empty' : 'save'}</span>{isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
            {canDelete && originalGroup && groupId !== 'organization-wide' && (
            <div className="mt-10 pt-6 border-t border-red-300 dark:border-red-700">
                 <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-3">Danger Zone</h3>
                 <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Deleting this working group is permanent and cannot be undone. All associated member assignments will also be removed.</p>
                <button onClick={handleDeleteWorkingGroup} disabled={isDeleting || isSubmitting} className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md shadow-sm inline-flex items-center disabled:opacity-50">
                    <span className={`material-icons text-lg mr-2 ${isDeleting ? 'animate-spin' : ''}`}>{isDeleting ? 'sync' : 'delete_forever'}</span>{isDeleting ? 'Deleting...' : 'Delete This Working Group'}
                </button>
                {deleteError && <div className="mt-3 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-md flex items-center" role="alert"><span className="material-icons text-lg mr-2">error_outline</span>{deleteError}</div>}
            </div>
          )}
        </div>
    </main>
  );
}