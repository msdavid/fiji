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

  if (authLoading || isLoading) return <div className="flex items-center justify-center min-h-screen"><p>Loading details...</p></div>;
  
  if (!canView && userProfile) {
    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-800 p-8">
            <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 shadow-lg rounded-lg p-6 text-center">
                <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
                <p className="text-gray-700 dark:text-gray-300">You do not have permission to view this page.</p>
                <Link href="/dashboard/admin/working-groups" className="mt-6 inline-block px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                    Back to Working Groups
                </Link>
            </div>
        </div>
    );
  }

  if (error && !workingGroup) return <div className="p-8 text-center text-red-500">Error: {error} <Link href="/dashboard/admin/working-groups" className="text-indigo-600 hover:underline">Back to list</Link></div>;
  if (!workingGroup) return <div className="p-8 text-center">Working group not found. <Link href="/dashboard/admin/working-groups" className="text-indigo-600 hover:underline">Back to list</Link></div>;

  return (
    // Removed the outer div with min-h-screen and bg-gray-100, as layout provides this
    <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Removed <nav> element */}
        <div className="mb-6"> {/* Container for back link */}
            <Link href="/dashboard/admin/working-groups" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                ← Back to Working Groups
            </Link>
        </div>

        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{workingGroup.groupName}</h1>
            <p className={`mt-1 text-sm px-2 py-0.5 rounded-full inline-block ${ workingGroup.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100'}`}>
              {workingGroup.status}
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{workingGroup.description || 'No description.'}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              Created by: {workingGroup.creatorFirstName || ''} {workingGroup.creatorLastName || workingGroup.createdByUserId} on {format(parseISO(workingGroup.createdAt), 'PP')}
            </p>
          </div>

          {error && !assignmentsError && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {canManageAssignments && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Manage Members</h2>
              <form onSubmit={handleAssignUser} className="mb-6 p-4 border dark:border-gray-700 rounded-md">
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Assign User</h3>
                <div className="space-y-2">
                  <UserSearchInput 
                    onUserSelected={(u) => setSelectedUserToAssign(u)}
                    label="Search for user to assign:"
                    placeholder="Type name or email..."
                  />
                  <button 
                    type="submit" 
                    disabled={actionInProgress || !selectedUserToAssign} 
                    className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md disabled:opacity-50"
                  >
                    {actionInProgress ? 'Assigning...' : `Assign ${selectedUserToAssign ? (selectedUserToAssign.firstName || selectedUserToAssign.email) : ''}`}
                  </button>
                </div>
                {assignmentsError && <p className="text-red-500 text-sm mt-2">{assignmentsError}</p>}
              </form>

              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Current Members ({assignments.length})</h3>
              {actionInProgress && assignments.length === 0 && !assignmentsError ? <p>Loading members...</p> : assignments.length > 0 ? (
                <ul className="space-y-3">
                  {assignments.map((assignment) => (
                    <li key={assignment.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md shadow-sm flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-gray-200">
                          {assignment.userFirstName || 'N/A'} {assignment.userLastName || ''} ({assignment.userEmail || assignment.userId})
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Status: {assignment.status.replace(/_/g, ' ')} | Assigned: {format(parseISO(assignment.assignmentDate), 'Pp')}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveAssignment(assignment.id)}
                        disabled={actionInProgress}
                        className="py-1 px-3 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-md disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No users currently assigned to this working group.</p>
              )}
              {assignmentsError && <p className="text-red-500 text-sm mt-2">{assignmentsError}</p>}
            </div>
          )}
        </div>
      </main>
  );
}