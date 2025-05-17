'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO } from 'date-fns';
import UserSearchInput from '@/components/admin/UserSearchInput'; 

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

interface Assignment { 
  id: string;
  userId: string;
  assignableId: string;
  assignableType: 'event' | 'workingGroup';
  status: string;
  assignedByUserId?: string;
  assignmentDate: string;
  createdAt: string;
  updatedAt: string;
  userFirstName?: string;
  userLastName?: string;
  userEmail?: string;
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
      <p className="text-sm text-gray-900 dark:text-white">{value}</p>
    </div>
  </div>
);


export default function WorkingGroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;

  const { user, loading: authLoading, userProfile, fetchUserProfile, hasPrivilege } = useAuth();
  
  const [workingGroup, setWorkingGroup] = useState<WorkingGroup | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); 
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null); 
  const [actionInProgress, setActionInProgress] = useState(false);
  
  const [selectedUserToAssign, setSelectedUserToAssign] = useState<UserSearchResult | null>(null);


  const canView = userProfile && (hasPrivilege ? hasPrivilege('working_groups', 'view') : userProfile.assignedRoleIds?.includes('sysadmin'));
  const canManageAssignments = userProfile && (hasPrivilege ? hasPrivilege('working_groups', 'manage_assignments') : userProfile.assignedRoleIds?.includes('sysadmin'));

  const fetchWorkingGroupDetails = useCallback(async () => {
    if (!user || !groupId || !canView) {
        if(user && !canView) setError("You don't have permission to view this working group.");
        setIsLoading(false);
        return;
    }
    setIsLoading(true); setError(null);
    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/working-groups/${groupId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error((await response.json()).detail || 'Failed to fetch working group details');
      setWorkingGroup(await response.json());
    } catch (err: any) { setError(err.message); } 
    finally { setIsLoading(false); }
  }, [user, groupId, canView]);

  const fetchAssignments = useCallback(async () => {
    if (!user || !groupId || !canManageAssignments) return;
    setActionInProgress(true); setAssignmentsError(null); 
    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/working-groups/${groupId}/assignments`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error((await response.json()).detail || 'Failed to fetch assignments');
      setAssignments(await response.json());
    } catch (err: any) { setAssignmentsError(err.message); } 
    finally { setActionInProgress(false); }
  }, [user, groupId, canManageAssignments]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user && !userProfile) fetchUserProfile();
    if (user && userProfile && groupId) { 
      fetchWorkingGroupDetails();
      if (canManageAssignments) fetchAssignments();
    }
  }, [user, authLoading, userProfile, fetchUserProfile, groupId, router, fetchWorkingGroupDetails, fetchAssignments, canManageAssignments]);

  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupId || !selectedUserToAssign || !canManageAssignments) {
        setAssignmentsError("Please select a user to assign.");
        return;
    }
    setActionInProgress(true); setAssignmentsError(null);
    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const payload = { userId: selectedUserToAssign.id, assignableId: groupId, assignableType: 'workingGroup', status: 'active' };
      const response = await fetch(`${backendUrl}/working-groups/${groupId}/assignments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error((await response.json()).detail || 'Failed to assign user');
      setSelectedUserToAssign(null); 
      await fetchAssignments(); 
    } catch (err: any) { setAssignmentsError(err.message); }
    finally { setActionInProgress(false); }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!user || !groupId || !canManageAssignments || !confirm("Remove this user from the group?")) return;
    setActionInProgress(true); setAssignmentsError(null);
    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/working-groups/${groupId}/assignments/${assignmentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok && response.status !== 204) { 
        const errorData = await response.json().catch(() => ({ detail: 'Failed to remove user from group' }));
        throw new Error(errorData.detail || 'Failed to remove user from group');
      }
      await fetchAssignments(); 
    } catch (err: any) { setAssignmentsError(err.message); }
    finally { setActionInProgress(false); }
  };

  if (authLoading || (isLoading && !workingGroup)) { // Show loading if auth is loading OR main content is loading
    return (
      <div className="flex flex-col justify-center items-center h-full min-h-[300px]">
        <span className="material-icons text-6xl text-indigo-500 dark:text-indigo-400 animate-spin mb-4">
          sync
        </span>
        <p className="text-lg text-gray-700 dark:text-gray-300">Loading details...</p>
      </div>
    );
  }
  
  if (!canView && userProfile) { // This check should ideally happen after userProfile is confirmed
    return (
        <div className="max-w-2xl mx-auto py-8"> 
            <div className="bg-white dark:bg-gray-900 shadow-lg rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-red-500 dark:text-red-400 mx-auto mb-3">lock</span>
                <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
                <p className="text-gray-700 dark:text-gray-300 mb-6">You do not have permission to view this page.</p>
                <Link href="/dashboard/admin/working-groups" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    <span className="material-icons text-lg mr-2">arrow_back</span>
                    Back to Working Groups
                </Link>
            </div>
        </div>
    );
  }

  if (error && !workingGroup) { // Main error fetching working group
    return (
        <div className="max-w-2xl mx-auto py-8">
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 shadow-lg rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl mx-auto mb-3">error_outline</span>
                <h1 className="text-2xl font-semibold mb-4">Error</h1>
                <p className="mb-6">{error}</p>
                <Link href="/dashboard/admin/working-groups" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                     <span className="material-icons text-lg mr-2">arrow_back</span>
                    Back to Working Groups
                </Link>
            </div>
        </div>
    );
  }
  
  if (!workingGroup) { // Not found state
    return (
        <div className="max-w-2xl mx-auto py-8">
            <div className="bg-white dark:bg-gray-900 shadow-lg rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-gray-400 dark:text-gray-500 mx-auto mb-3">search_off</span>
                <h1 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">Working Group Not Found</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">The requested working group could not be found.</p>
                <Link href="/dashboard/admin/working-groups" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    <span className="material-icons text-lg mr-2">arrow_back</span>
                    Back to Working Groups
                </Link>
            </div>
        </div>
    );
  }


  return (
    <main> 
        <div className="mb-6">
            <Link href="/dashboard/admin/working-groups" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                <span className="material-icons text-lg mr-1">arrow_back_ios</span>
                Back to Working Groups
            </Link>
        </div>

        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6 sm:p-8">
          <div className="flex items-center mb-4">
            <span className="material-icons text-3xl text-indigo-600 dark:text-indigo-400 mr-3">workspaces</span>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{workingGroup.groupName}</h1>
          </div>
          <div className="mb-6">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full inline-block ${ workingGroup.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100'}`}>
              {workingGroup.status.charAt(0).toUpperCase() + workingGroup.status.slice(1)}
            </span>
          </div>

          <div className="space-y-3 mb-6">
            <DetailItem
                icon="description"
                label="Description"
                value={workingGroup.description || 'No description provided.'}
            />
            <DetailItem
                icon="person"
                label="Created By"
                value={`${workingGroup.creatorFirstName || ''} ${workingGroup.creatorLastName || workingGroup.createdByUserId}`}
            />
            <DetailItem
                icon="calendar_today"
                label="Created On"
                value={format(parseISO(workingGroup.createdAt), 'PPpp')}
            />
             <DetailItem
                icon="update"
                label="Last Updated"
                value={format(parseISO(workingGroup.updatedAt), 'PPpp')}
            />
          </div>
          
          {/* Main error for WG fetch is handled by the full page error state now */}

          {canManageAssignments && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Manage Members</h2>
              <form onSubmit={handleAssignUser} className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg shadow-sm">
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Assign New Member</h3>
                <div className="space-y-3">
                  <UserSearchInput 
                    onUserSelected={(u) => setSelectedUserToAssign(u)}
                    label="Search for user to assign:"
                    placeholder="Type name or email..."
                  />
                  <button 
                    type="submit" 
                    disabled={actionInProgress || !selectedUserToAssign} 
                    className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md shadow-sm inline-flex items-center justify-center disabled:opacity-50"
                  >
                    <span className="material-icons text-lg mr-2">person_add</span>
                    {actionInProgress ? 'Assigning...' : `Assign ${selectedUserToAssign ? (selectedUserToAssign.firstName || selectedUserToAssign.email) : 'User'}`}
                  </button>
                </div>
                {assignmentsError && 
                  <div className="mt-3 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-md flex items-center" role="alert">
                    <span className="material-icons text-lg mr-2">error_outline</span>
                    {assignmentsError}
                  </div>
                }
              </form>

              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Current Members ({assignments.length})</h3>
              {actionInProgress && assignments.length === 0 && !assignmentsError ? (
                <div className="flex items-center text-gray-500 dark:text-gray-400">
                  <span className="material-icons animate-spin text-lg mr-2">sync</span>
                  Loading members...
                </div>
              ) : assignments.length > 0 ? (
                <ul className="space-y-3">
                  {assignments.map((assignment) => (
                    <li key={assignment.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md shadow-sm flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-gray-200">
                          {assignment.userFirstName || 'N/A'} {assignment.userLastName || ''} 
                          <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">({assignment.userEmail || assignment.userId})</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Status: {assignment.status.replace(/_/g, ' ')} | Assigned: {format(parseISO(assignment.assignmentDate), 'PP p')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveAssignment(assignment.id)}
                        disabled={actionInProgress}
                        className="py-1.5 px-3 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-700 dark:hover:bg-red-600 dark:text-red-100 text-xs font-medium rounded-md shadow-sm disabled:opacity-50 inline-flex items-center"
                      >
                        <span className="material-icons text-sm mr-1">person_remove</span>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No users currently assigned to this working group.</p>
              )}
              {/* Display assignment error here only if it's relevant and no members are shown, or it's a general error for the list */}
              {assignmentsError && assignments.length === 0 && !actionInProgress &&
                <div className="mt-3 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-md flex items-center" role="alert">
                  <span className="material-icons text-lg mr-2">error_outline</span>
                  {assignmentsError}
                </div>
              }
            </div>
          )}
        </div>
      </main>
  );
}