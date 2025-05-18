'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient, { ApiResponse } from '@/lib/apiClient'; // Import ApiResponse

const ALL_PRIVILEGES: Record<string, { name: string; actions: { id: string; label: string }[] }> = {
  users: { name: 'Users', actions: [ { id: 'list', label: 'List Users' }, { id: 'view', label: 'View User Details' }, { id: 'edit', label: 'Edit Users' }, { id: 'delete', label: 'Delete Users' }, ] },
  roles: { name: 'Roles', actions: [ { id: 'list', label: 'List Roles' }, { id: 'create', label: 'Create Roles' }, { id: 'view', label: 'View Role Details' }, { id: 'edit', label: 'Edit Roles' }, { id: 'delete', label: 'Delete Roles' }, ] },
  events: { name: 'Events', actions: [ { id: 'list', label: 'List Events' }, { id: 'create', label: 'Create Events' }, { id: 'view', label: 'View Event Details' }, { id: 'edit', label: 'Edit Events' }, { id: 'delete', label: 'Delete Events' }, { id: 'manage_assignments', label: 'Manage Event Assignments' }, ] },
  working_groups: { name: 'Working Groups', actions: [ { id: 'list', label: 'List Working Groups' }, { id: 'create', label: 'Create Working Groups' }, { id: 'view', label: 'View WG Details' }, { id: 'edit', label: 'Edit Working Groups' }, { id: 'delete', label: 'Delete Working Groups' }, { id: 'manage_assignments', label: 'Manage WG Members' }, ] },
  donations: { name: 'Donations', actions: [ { id: 'list', label: 'List Donations' }, { id: 'create', label: 'Create Donations' }, { id: 'view', label: 'View Donation Details' }, { id: 'edit', label: 'Edit Donations' }, { id: 'delete', label: 'Delete Donations' }, ] },
  reports: { name: 'Reports', actions: [ { id: 'view_volunteer_hours', label: 'View Volunteer Hours Reports' }, { id: 'view_event_participation', label: 'View Event Participation Reports' }, { id: 'view_donation_summaries', label: 'View Donation Summaries' }, ] },
  invitations: { name: 'Invitations', actions: [ { id: 'list', label: 'List Invitations' }, { id: 'create', label: 'Create Invitations' }, { id: 'delete', label: 'Delete Invitations' }, ] },
  admin: { name: 'Admin Functions', actions: [{ id: 'view_summary', label: 'View Admin Dashboard Summary' }], },
};

interface RoleData {
  id: string;
  roleName: string;
  description?: string;
  privileges: Record<string, string[]>;
}

interface RoleUpdatePayload {
  roleName?: string;
  description?: string;
  privileges?: Record<string, string[]>;
}

export default function EditRolePage() {
  const router = useRouter();
  const params = useParams();
  const roleId = params.roleId as string;

  const { user, idToken, loading: authLoading, userProfile, fetchUserProfile, hasPrivilege, logout } = useAuth(); // Added logout
  
  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPrivileges, setSelectedPrivileges] = useState<Record<string, string[]>>({});
  const [originalRole, setOriginalRole] = useState<RoleData | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null); 
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canEditRoles = userProfile && (hasPrivilege ? hasPrivilege('roles', 'edit') : userProfile.assignedRoleIds?.includes('sysadmin'));
  const canDeleteRoles = userProfile && (hasPrivilege ? hasPrivilege('roles', 'delete') : userProfile.assignedRoleIds?.includes('sysadmin'));

  const fetchRoleDetails = useCallback(async () => {
    if (!user || !idToken || !roleId || roleId === 'undefined') {
      if (roleId === 'undefined') setPageError("Invalid role ID provided. Cannot fetch details.");
      setIsLoading(false); return;
    }
    if (userProfile && !canEditRoles) { // Check canEditRoles here as this is an edit page
        setPageError("You don't have permission to edit roles.");
        setIsLoading(false); return;
    }
    setIsLoading(true); setPageError(null);
    
    const result: ApiResponse<RoleData> = await apiClient<RoleData>({
      path: `/roles/${roleId}`, token: idToken, method: 'GET',
    });

    setIsLoading(false);
    if (result.ok && result.data) {
      setOriginalRole(result.data);
      setRoleName(result.data.roleName);
      setDescription(result.data.description || '');
      setSelectedPrivileges(result.data.privileges || {});
    } else {
      console.error("Fetch role error:", result.error);
      if (result.status === 401) { await logout(); return; }
      setPageError(result.error?.message || 'Failed to fetch role details.');
    }
  }, [user, idToken, roleId, userProfile, canEditRoles, logout]); // Added logout

  useEffect(() => {
    if (!authLoading && !user) { /* router.push('/login'); // Handled by layout/context */ }
    if (user && !userProfile && fetchUserProfile) fetchUserProfile();
    if (user && userProfile && idToken && roleId && roleId !== 'undefined') { 
      fetchRoleDetails();
    } else if (roleId === 'undefined') {
      setPageError("Invalid role ID provided. Cannot fetch details."); setIsLoading(false);
    }
  }, [user, authLoading, userProfile, fetchUserProfile, idToken, roleId, router, fetchRoleDetails]);

  const handlePrivilegeChange = (resource: string, action: string, checked: boolean) => {
    setSelectedPrivileges(prev => {
      const updatedResourcePrivileges = prev[resource] ? [...prev[resource]] : [];
      if (checked) { if (!updatedResourcePrivileges.includes(action)) updatedResourcePrivileges.push(action); } 
      else { const index = updatedResourcePrivileges.indexOf(action); if (index > -1) updatedResourcePrivileges.splice(index, 1); }
      const newPrivileges = { ...prev };
      if (updatedResourcePrivileges.length > 0) newPrivileges[resource] = updatedResourcePrivileges;
      else delete newPrivileges[resource];
      return newPrivileges;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalRole || !canEditRoles) { setSubmitError("Cannot submit: Insufficient permissions or original data missing."); return; }
    if (!roleName.trim()) { setSubmitError("Role Name cannot be empty."); return; }
    if (originalRole.roleName.toLowerCase() === 'sysadmin' && roleName.toLowerCase() !== 'sysadmin') {
        setSubmitError("The 'sysadmin' role name cannot be changed."); return;
    }
    setIsSubmitting(true); setSubmitError(null);

    const payload: RoleUpdatePayload = {};
    if (roleName.trim() !== originalRole.roleName) payload.roleName = roleName.trim();
    if (description.trim() !== (originalRole.description || '')) payload.description = description.trim();
    if (JSON.stringify(selectedPrivileges) !== JSON.stringify(originalRole.privileges)) payload.privileges = selectedPrivileges;

    if (Object.keys(payload).length === 0) {
      setSubmitError("No changes detected to submit."); setIsSubmitting(false); return;
    }
    if (!idToken) { setSubmitError("Authentication token not available."); setIsSubmitting(false); return; }
      
    const result: ApiResponse<any> = await apiClient({ // Expect any or no content for PUT
      path: `/roles/${roleId}`, token: idToken, method: 'PUT', data: payload,
    });
    
    setIsSubmitting(false);
    if (result.ok) {
      router.push('/dashboard/admin/roles'); 
    } else {
      console.error("Update role error:", result.error);
      if (result.status === 401) { await logout(); return; }
      setSubmitError(result.error?.message || 'Failed to update role.');
    }
  };

  const handleDeleteRole = async () => {
    if (!originalRole || !canDeleteRoles || !idToken) {
        setDeleteError("Cannot delete: Insufficient permissions or role data missing."); return;
    }
    if (originalRole.roleName.toLowerCase() === 'sysadmin') {
        setDeleteError("The 'sysadmin' role cannot be deleted."); return;
    }
    if (!confirm(`Are you sure you want to delete the role "${originalRole.roleName}"? This action cannot be undone.`)) return;

    setIsDeleting(true); setDeleteError(null);
    
    const result: ApiResponse<any> = await apiClient({ // Expect any or no content for DELETE
        path: `/roles/${roleId}`, token: idToken, method: 'DELETE',
    });

    setIsDeleting(false);
    if (result.ok) {
        router.push('/dashboard/admin/roles');
    } else {
        console.error("Delete role error:", result.error);
        if (result.status === 401) { await logout(); return; }
        setDeleteError(result.error?.message || 'Failed to delete role.');
    }
  };

  if (authLoading || (isLoading && !pageError)) {
    return (
      <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center">
        <span className="material-icons text-6xl text-indigo-500 dark:text-indigo-400 animate-spin mb-4">sync</span>
        <p className="text-lg text-gray-700 dark:text-gray-300">Loading role details...</p>
      </main>
    );
  }

  if (pageError) {
    return (
        <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 shadow-xl rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl mx-auto mb-3">error_outline</span>
                <h1 className="text-2xl font-semibold mb-4">Error Loading Role</h1>
                <p className="mb-6">{pageError}</p>
                <Link href="/dashboard/admin/roles" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm">
                    <span className="material-icons text-lg mr-2">arrow_back</span> Back to Roles List
                </Link>
            </div>
        </main>
    );
  }
  
  if (!canEditRoles && userProfile && !isLoading) { 
    return (
        <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
            <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-red-500 dark:text-red-400 mx-auto mb-3">lock</span>
                <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
                <p className="text-gray-700 dark:text-gray-300 mb-6">You do not have permission to edit roles.</p>
                <Link href="/dashboard/admin/roles" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm">
                    <span className="material-icons text-lg mr-2">arrow_back</span> Back to Roles List
                </Link>
            </div>
        </main>
    );
  }

  if (!originalRole && !isLoading && !pageError) { 
    return (
        <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-gray-400 dark:text-gray-500 mx-auto mb-3">search_off</span>
                <h1 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">Role Not Found</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">The role data could not be loaded for editing, or the role does not exist.</p>
                <Link href="/dashboard/admin/roles" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm">
                    <span className="material-icons text-lg mr-2">arrow_back</span> Back to Roles List
                </Link>
            </div>
        </main>
    );
  }

  const isSysAdminRole = originalRole?.roleName.toLowerCase() === 'sysadmin';

  return (
    <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
      <div className="mb-6">
        <Link href="/dashboard/admin/roles" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          <span className="material-icons text-lg mr-1">arrow_back_ios</span> Back to Roles List
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Edit Role: <span className="text-indigo-600 dark:text-indigo-400">{originalRole?.roleName}</span>
      </h1>
      
      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Role Details</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="roleName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role Name <span className="text-red-500">*</span></label>
                <input type="text" name="roleName" id="roleName" value={roleName} onChange={(e) => setRoleName(e.target.value)} required disabled={isSysAdminRole} 
                  className={`mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white ${isSysAdminRole ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}`} />
                {isSysAdminRole && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">The 'sysadmin' role name cannot be changed.</p>}
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea name="description" id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
              </div>
            </div>
          </div>

          <div className="pt-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-1">Permissions</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select the permissions this role will grant.</p>
            {isSysAdminRole && (<div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-md text-sm text-indigo-700 dark:text-indigo-300"><span className="material-icons text-lg mr-2 align-middle">info_outline</span>The 'sysadmin' role inherently has all permissions. Modifications are not recommended and may be restricted.</div>)}
            <div className="space-y-6">
              {Object.entries(ALL_PRIVILEGES).map(([resourceKey, resourceInfo]) => (
                <div key={resourceKey} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">{resourceInfo.name}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                    {resourceInfo.actions.map(action => (
                      <label key={`${resourceKey}-${action.id}`} className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={selectedPrivileges[resourceKey]?.includes(action.id) || false} onChange={(e) => handlePrivilegeChange(resourceKey, action.id, e.target.checked)} disabled={isSysAdminRole} 
                          className={`h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 dark:bg-gray-700 dark:checked:bg-indigo-500 ${isSysAdminRole ? 'cursor-not-allowed opacity-70' : ''}`} />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{action.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {submitError && ( <div className="my-4 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center" role="alert"><span className="material-icons text-lg mr-2">error_outline</span>{submitError}</div>)}
          <div className="flex flex-col sm:flex-row justify-between items-center pt-8 mt-4 border-t border-gray-200 dark:border-gray-700 space-y-4 sm:space-y-0">
            <div></div> {/* Placeholder for potential left-aligned items like delete button */}
            <div className="flex space-x-3 w-full sm:w-auto justify-end">
                <Link href="/dashboard/admin/roles" passHref><button type="button" className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"><span className="material-icons text-base mr-2">cancel</span>Cancel</button></Link>
                <button type="submit" disabled={isSubmitting || isLoading} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 inline-flex items-center">
                {isSubmitting ? (<><span className="material-icons animate-spin text-base mr-2">sync</span>Saving Changes...</>) : (<><span className="material-icons text-base mr-2">save</span>Save Changes</>)}
                </button>
            </div>
          </div>
        </form>

        {canDeleteRoles && originalRole && !isSysAdminRole && (
            <div className="mt-10 pt-6 border-t border-red-300 dark:border-red-700">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-3">Danger Zone</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Deleting this role is permanent. Users assigned this role will lose its associated permissions.</p>
                <button onClick={handleDeleteRole} disabled={isDeleting || isSubmitting} className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md shadow-sm inline-flex items-center disabled:opacity-50">
                    <span className="material-icons text-base mr-2">delete_forever</span>{isDeleting ? 'Deleting Role...' : 'Delete This Role'}
                </button>
                {deleteError && <div className="mt-3 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-md flex items-center" role="alert"><span className="material-icons text-lg mr-2">error_outline</span>{deleteError}</div>}
            </div>
        )}
      </div>
    </main>
  );
}