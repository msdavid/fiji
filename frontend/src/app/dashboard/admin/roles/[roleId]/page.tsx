'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO } from 'date-fns';
import UserSearchInput from '@/components/admin/UserSearchInput'; 
import apiClient, { ApiResponse } from '@/lib/apiClient'; // Import ApiResponse

interface RoleDetails {
  id: string;
  roleName: string;
  description?: string;
  privileges: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}

interface UserAssignment { 
  userId: string; 
  userFirstName?: string;
  userLastName?: string;
  userEmail?: string;
  assignedAt?: string; 
  id?: string; 
  firstName?: string; 
  lastName?: string; 
  email?: string; 
}

interface UserSearchResult { 
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

const DetailItem = ({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) => (
  <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
    <span className="material-icons text-xl text-indigo-500 dark:text-indigo-400 mt-0.5">{icon}</span>
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm text-gray-900 dark:text-white break-words">{value}</p>
    </div>
  </div>
);


export default function RoleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const roleId = params.roleId as string; 

  const { user, idToken, loading: authLoading, userProfile, fetchUserProfile, hasPrivilege, logout } = useAuth(); // Added logout
  
  const [roleDetails, setRoleDetails] = useState<RoleDetails | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<UserAssignment[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null); 
  const [assignmentError, setAssignmentError] = useState<string | null>(null); 
  const [actionInProgress, setActionInProgress] = useState(false); 
  
  const [selectedUserToAssign, setSelectedUserToAssign] = useState<UserSearchResult | null>(null);

  const canViewRole = userProfile && (hasPrivilege ? hasPrivilege('roles', 'view') : userProfile.assignedRoleIds?.includes('sysadmin'));
  const canEditRole = userProfile && (hasPrivilege ? hasPrivilege('roles', 'edit') : userProfile.assignedRoleIds?.includes('sysadmin'));
  const canManageRoleAssignments = userProfile && (hasPrivilege ? hasPrivilege('roles', 'manage_assignments') : userProfile.assignedRoleIds?.includes('sysadmin'));

  const fetchRoleDetailsCallback = useCallback(async () => {
    if (!user || !idToken || !roleId || roleId === 'undefined') {
        if (roleId === 'undefined') setPageError("Invalid role ID provided.");
        setIsLoading(false); return;
    }
    if (userProfile && !canViewRole) {
        setPageError("You don't have permission to view this role.");
        setIsLoading(false); return;
    }
    setIsLoading(true); setPageError(null);
    
    const result: ApiResponse<RoleDetails> = await apiClient<RoleDetails>({
      path: `/roles/${roleId}`, token: idToken, method: 'GET',
    });
    
    setIsLoading(false);
    if (result.ok && result.data) {
      setRoleDetails(result.data);
    } else { 
      console.error("Fetch role details error:", result.error);
      if (result.status === 401) { await logout(); return; }
      setPageError(result.error?.message || 'Failed to fetch role details.');
    } 
  }, [user, idToken, roleId, userProfile, canViewRole, logout]); // Added logout

  const fetchAssignedUsers = useCallback(async () => {
    if (!user || !idToken || !roleId || !canManageRoleAssignments || roleId === 'undefined') return;
    
    setActionInProgress(true); setAssignmentError(null); 
    
    const result: ApiResponse<UserAssignment[]> = await apiClient<UserAssignment[]>({ 
      path: `/users?roleId=${roleId}`, token: idToken, method: 'GET',
    });
    
    setActionInProgress(false);
    if (result.ok && result.data) {
      const processedUsers = result.data.map(u => ({
        userId: u.id || u.userId, 
        userFirstName: u.firstName || u.userFirstName,
        userLastName: u.lastName || u.userLastName,
        userEmail: u.email || u.userEmail,
        assignedAt: u.assignedAt 
      }));
      setAssignedUsers(processedUsers);
    } else { 
      console.error("Fetch assigned users error:", result.error);
      if (result.status === 401) { await logout(); return; }
      setAssignmentError(result.error?.message || 'Failed to fetch assigned users.');
    } 
  }, [user, idToken, roleId, canManageRoleAssignments, logout]); // Added logout

  useEffect(() => {
    if (!authLoading && !user) { /* router.push('/login'); // Handled by layout/context */ }
    if (user && !userProfile && fetchUserProfile) fetchUserProfile();
    if (user && userProfile && idToken && roleId && roleId !== 'undefined') { 
      fetchRoleDetailsCallback();
      if (canManageRoleAssignments) fetchAssignedUsers();
    } else if (roleId === 'undefined') {
        setPageError("Invalid role ID provided."); setIsLoading(false);
    }
  }, [user, authLoading, userProfile, fetchUserProfile, idToken, roleId, router, fetchRoleDetailsCallback, fetchAssignedUsers, canManageRoleAssignments]);

  const handleAssignUserToRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !idToken || !roleId || !selectedUserToAssign || !canManageRoleAssignments) {
        setAssignmentError("Please select a user to assign."); return;
    }
    if (assignedUsers.some(au => au.userId === selectedUserToAssign.id)) {
        setAssignmentError(`${selectedUserToAssign.firstName || selectedUserToAssign.email} is already assigned to this role.`); return;
    }

    setActionInProgress(true); setAssignmentError(null);
    
    const result: ApiResponse<any> = await apiClient({
      path: `/users/${selectedUserToAssign.id}/roles/${roleId}`, token: idToken, method: 'POST', 
    });
    
    setActionInProgress(false);
    if (result.ok) {
      setSelectedUserToAssign(null); 
      await fetchAssignedUsers(); 
    } else { 
      console.error("Assign user to role error:", result.error);
      if (result.status === 401) { await logout(); return; }
      setAssignmentError(result.error?.message || 'Failed to assign user to role.');
    }
  };

  const handleUnassignUserFromRole = async (userIdToUnassign: string) => {
    if (!user || !idToken || !roleId || !canManageRoleAssignments || !confirm("Remove this user from the role?")) return;
    
    setActionInProgress(true); setAssignmentError(null);
    
    const result: ApiResponse<any> = await apiClient({
      path: `/users/${userIdToUnassign}/roles/${roleId}`, token: idToken, method: 'DELETE',
    });

    setActionInProgress(false);
    if (result.ok) {
      await fetchAssignedUsers(); 
    } else { 
      console.error("Unassign user from role error:", result.error);
      if (result.status === 401) { await logout(); return; }
      setAssignmentError(result.error?.message || 'Failed to unassign user from role.');
    }
  };

  if (authLoading || (isLoading && !roleDetails && !pageError)) {
    return (
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center">
        <span className="material-icons text-6xl text-indigo-500 dark:text-indigo-400 animate-spin mb-4">sync</span>
        <p className="text-lg text-gray-700 dark:text-gray-300">Loading role details...</p>
      </main>
    );
  }
  
  if (pageError && !roleDetails) { 
    return (
        <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 shadow-xl rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl mx-auto mb-3">error_outline</span>
                <h1 className="text-2xl font-semibold mb-4">Error</h1>
                <p className="mb-6">{pageError}</p>
                <Link href="/dashboard/admin/roles" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm">
                     <span className="material-icons text-lg mr-2">arrow_back</span> Back to Roles List
                </Link>
            </div>
        </main>
    );
  }
  
  if (!canViewRole && userProfile && !isLoading) { 
    return (
        <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
            <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-red-500 dark:text-red-400 mx-auto mb-3">lock</span>
                <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
                <p className="text-gray-700 dark:text-gray-300 mb-6">You do not have permission to view this role.</p>
                <Link href="/dashboard/admin/roles" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm">
                    <span className="material-icons text-lg mr-2">arrow_back</span> Back to Roles List
                </Link>
            </div>
        </main>
    );
  }
  
  if (!roleDetails && !isLoading && !pageError) { 
    return (
        <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-gray-400 dark:text-gray-500 mx-auto mb-3">search_off</span>
                <h1 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">Role Not Found</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">The requested role (ID: {roleId}) could not be found.</p>
                <Link href="/dashboard/admin/roles" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm">
                    <span className="material-icons text-lg mr-2">arrow_back</span> Back to Roles List
                </Link>
            </div>
        </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
        <div className="mb-6">
            <Link href="/dashboard/admin/roles" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                <span className="material-icons text-lg mr-1">arrow_back_ios</span> Back to Roles List
            </Link>
        </div>

        {roleDetails && (
            <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center mb-4 sm:mb-0">
                    <span className="material-icons text-3xl text-indigo-600 dark:text-indigo-400 mr-3">admin_panel_settings</span>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{roleDetails.roleName}</h1>
                </div>
                {canEditRole && (
                    <Link href={`/dashboard/admin/roles/${roleId}/edit`} className="shrink-0">
                        <button className="inline-flex items-center py-2 px-4 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-md shadow-sm">
                            <span className="material-icons mr-2 text-base">edit</span> Edit Role Details
                        </button>
                    </Link>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <DetailItem icon="badge" label="Role ID / Name" value={roleDetails.id} />
                <DetailItem icon="description" label="Description" value={roleDetails.description || <span className="italic text-gray-400 dark:text-gray-500">No description</span>} />
                <DetailItem icon="calendar_today" label="Created On" value={format(parseISO(roleDetails.createdAt), 'PPpp')} />
                <DetailItem icon="update" label="Last Updated" value={format(parseISO(roleDetails.updatedAt), 'PPpp')} />
            </div>
            
            <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">Permissions Granted</h2>
                {Object.keys(roleDetails.privileges).length > 0 ? (
                    <div className="space-y-2">
                    {Object.entries(roleDetails.privileges).map(([resource, actions]) => (
                        <div key={resource} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{resource.replace(/_/g, ' ')}:</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 pl-2">{actions.join(', ')}</p>
                        </div>
                    ))}</div>
                ) : ( <p className="text-sm text-gray-500 dark:text-gray-400 italic">This role has no specific permissions assigned.</p> )}
            </div>
            
            {canManageRoleAssignments && (
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Manage User Assignments</h2>
                <form onSubmit={handleAssignUserToRole} className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg shadow-sm">
                    <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Assign User to this Role</h3>
                    <div className="space-y-3">
                    <UserSearchInput onUserSelected={(u) => setSelectedUserToAssign(u)} label="Search for user to assign:" placeholder="Type name or email..." />
                    <button type="submit" disabled={actionInProgress || !selectedUserToAssign} className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md shadow-sm inline-flex items-center justify-center disabled:opacity-50">
                        <span className="material-icons text-lg mr-2">person_add</span>
                        {actionInProgress && selectedUserToAssign ? 'Assigning...' : `Assign ${selectedUserToAssign ? (selectedUserToAssign.firstName || selectedUserToAssign.email) : 'User'}`}
                    </button>
                    </div>
                    {assignmentError && <div className="mt-3 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-md flex items-center" role="alert"><span className="material-icons text-lg mr-2">error_outline</span>{assignmentError}</div>}
                </form>

                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Users Assigned to "{roleDetails.roleName}" ({assignedUsers.length})</h3>
                {actionInProgress && assignedUsers.length === 0 && !assignmentError ? (
                    <div className="flex items-center text-gray-500 dark:text-gray-400"><span className="material-icons animate-spin text-lg mr-2">sync</span>Loading assigned users...</div>
                ) : assignedUsers.length > 0 ? (
                    <ul className="space-y-3">
                    {assignedUsers.map((assignedUser) => (
                        <li key={assignedUser.userId} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md shadow-sm flex justify-between items-center">
                        <div>
                            <p className="font-medium text-gray-800 dark:text-gray-200">{assignedUser.userFirstName || 'N/A'} {assignedUser.userLastName || ''} <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">({assignedUser.userEmail || assignedUser.userId})</span></p>
                            {assignedUser.assignedAt && (<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Assigned: {format(parseISO(assignedUser.assignedAt), 'PP p')}</p>)}
                        </div>
                        <button onClick={() => handleUnassignUserFromRole(assignedUser.userId)} disabled={actionInProgress} className="py-1.5 px-3 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-700 dark:hover:bg-red-600 dark:text-red-100 text-xs font-medium rounded-md shadow-sm disabled:opacity-50 inline-flex items-center">
                            <span className="material-icons text-sm mr-1">person_remove</span>Unassign
                        </button>
                        </li>
                    ))}</ul>
                ) : ( <p className="text-gray-500 dark:text-gray-400 italic">No users currently assigned to this role.</p> )}
                {assignmentError && assignedUsers.length === 0 && !actionInProgress && <div className="mt-3 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-md flex items-center" role="alert"><span className="material-icons text-lg mr-2">error_outline</span>{assignmentError}</div>}
                </div>
            )}
            </div>
        )}
    </main>
  );
}