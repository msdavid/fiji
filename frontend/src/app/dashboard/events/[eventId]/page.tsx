'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO, isValid } from 'date-fns'; 
// apiClient import removed as we are switching to direct fetch for this specific call
import UserSearchInput from '@/components/admin/UserSearchInput'; 

interface UserSearchResultForPage { 
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

interface Event {
  id: string; 
  eventName: string;
  icon?: string; 
  eventType?: string;
  purpose?: string;
  description?: string;
  dateTime: string; 
  endTime?: string;  
  venue?: string; 
  volunteersRequired?: number; 
  status: string;
  createdByUserId: string;
  creatorFirstName?: string; 
  creatorLastName?: string;  
  createdAt: string; 
  updatedAt: string; 
  isCurrentUserSignedUp?: boolean;
  currentUserAssignmentStatus?: string;
  organizerUserId?: string; 
  organizerFirstName?: string; 
  organizerLastName?: string;
  point_of_contact?: string; 
  workingGroupId?: string; 
  workingGroupIds?: string[]; 
  workingGroupNames?: string[]; 
}
interface EventDetail extends Event {}

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
  performanceNotes?: string;
  hoursContributed?: number;
}

// apiClient is still used elsewhere, so we need to keep it for other calls or refactor them too.
// For now, only modifying the problematic call.
// If apiClient is not used elsewhere in this file after this change, it can be fully removed.
// For now, assuming it might be used by other functions not directly in handleAssignVolunteer.
// Re-checking usage: fetchEventDetails, fetchEventAssignments, handleSignup, handleWithdraw, handleRemoveAssignment
// still use apiClient. So, the import should remain.
import apiClient from '@/lib/apiClient';


const DetailItem = ({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) => {
  if (!value && typeof value !== 'number' && typeof value !== 'boolean') return null; 
  return (
    <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg shadow-sm">
      <span className="material-icons text-indigo-500 dark:text-indigo-400 mt-1">{icon}</span>
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
};


export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const pageEventId = params.eventId as string; 

  const { user, idToken, loading: authLoading, userProfile, fetchUserProfile, hasPrivilege, logout } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  
  const [selectedUserToAssign, setSelectedUserToAssign] = useState<UserSearchResultForPage | null>(null); 

  const canEditEvent = userProfile && (hasPrivilege ? hasPrivilege('events', 'edit') : userProfile.isSysadmin);
  const canManageAssignments = userProfile && (hasPrivilege ? hasPrivilege('events', 'manage_assignments') : userProfile.isSysadmin);

  const fetchEventDetails = useCallback(async () => {
    if (!idToken || !pageEventId) return;
    setIsLoadingEvent(true);
    setError(null);
    try {
      // This still uses apiClient, which is fine if it works for GET requests
      const result = await apiClient<EventDetail>({
        path: `/events/${pageEventId}`,
        token: idToken,
        method: 'GET',
      });
      if (!result.ok || !result.data) {
        if (result.status === 401) { await logout(); router.push('/login'); return; }
        if (result.status === 403) { setError("You are not authorized to view this event."); setEvent(null); setIsLoadingEvent(false); return; }
        if (result.status === 404) { setError("Event not found."); setEvent(null); setIsLoadingEvent(false); return; }
        throw new Error(result.error?.message || 'Failed to fetch event details');
      }
      setEvent(result.data);
    } catch (err: any) {
      setError(err.message);
      setEvent(null); 
    } finally {
      setIsLoadingEvent(false);
    }
  }, [idToken, pageEventId, logout, router]);

  const fetchEventAssignments = useCallback(async (currentEventId: string) => { 
    if (!idToken || !currentEventId || !canManageAssignments) return; 
    
    setIsLoadingAssignments(true);
    setAssignmentsError(null);
    try {
      // This still uses apiClient
      const result = await apiClient<Assignment[]>({
        path: `/events/${currentEventId}/assignments`,
        token: idToken,
        method: 'GET',
      });
      if (!result.ok || !result.data) {
        if (result.status === 401) { await logout(); router.push('/login'); return; }
        throw new Error(result.error?.message || 'Failed to fetch event assignments');
      }
      setAssignments(result.data);
    } catch (err: any) {
      setAssignmentsError(err.message); 
      console.error("Fetch assignments error:", err);
    } finally {
      setIsLoadingAssignments(false);
    }
  }, [idToken, canManageAssignments, logout, router]); 

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && !userProfile && fetchUserProfile) { 
        fetchUserProfile();
    }
    if (idToken && pageEventId) { 
      fetchEventDetails();
    }
  }, [user, authLoading, pageEventId, router, fetchEventDetails, userProfile, fetchUserProfile, idToken]);

  useEffect(() => {
    if (event && event.id && canManageAssignments) {
        if (event.id === pageEventId) { 
            fetchEventAssignments(event.id);
        } else {
            console.warn("Mismatch between pageEventId and loaded event.id", pageEventId, event.id);
        }
    }
  }, [event, canManageAssignments, fetchEventAssignments, pageEventId]);


  const handleSignup = async () => { 
    if (!idToken || !event) return;
    setActionInProgress(true); setError(null);
    try {
        // This still uses apiClient
        const result = await apiClient({
            path: `/events/${event.id}/signup`,
            token: idToken,
            method: 'POST'
        });
        if (!result.ok) throw new Error(result.error?.message || 'Failed to sign up');
        await fetchEventDetails(); 
    } catch (err: any) { setError(err.message); } 
    finally { setActionInProgress(false); }
  };

  const handleWithdraw = async () => { 
    if (!idToken || !event) return;
    setActionInProgress(true); setError(null);
    try {
        // This still uses apiClient
        const result = await apiClient({
            path: `/events/${event.id}/signup`,
            token: idToken,
            method: 'DELETE'
        });
        if (!result.ok && result.status !== 204) throw new Error(result.error?.message || 'Failed to withdraw');
        await fetchEventDetails();
    } catch (err: any) { setError(err.message); }
    finally { setActionInProgress(false); }
  };

  const handleUserSelectedForAssignment = (selectedUser: UserSearchResultForPage) => {
    setSelectedUserToAssign(selectedUser);
  };

  const handleAssignVolunteer = async (e: React.FormEvent) => { 
    e.preventDefault();
    if (!user || !event || !selectedUserToAssign) { // Check for user object for getIdToken
        setAssignmentsError("User session, event details, or selected user is missing. Please select a user to add to signups.");
        return;
    }

    if (!event.id) {
        console.error("Critical: Event ID is missing before attempting to assign user.", event);
        setAssignmentsError("Event information is incomplete. Please refresh the page.");
        return;
    }
    if (!selectedUserToAssign.id) {
        console.error("Critical: Selected user ID is missing before attempting to assign.", selectedUserToAssign);
        setAssignmentsError("Selected user information is incomplete. Please select the user again.");
        return;
    }

    const payload = { 
        userId: selectedUserToAssign.id, 
        assignableId: event.id, 
        assignableType: 'event' as 'event', 
        status: 'confirmed_admin' 
    };
    
    console.log("Attempting to create assignment with payload (direct fetch):", JSON.stringify(payload, null, 2));

    setActionInProgress(true); setError(null); setAssignmentsError(null);
    try {
      const currentIdToken = await user.getIdToken(); // Get fresh token
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/events/${event.id}/assignments`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${currentIdToken}`,
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorDetail = 'Failed to add signup.';
        try {
            const errorData = await response.json();
            errorDetail = errorData.detail || (errorData.message ? JSON.stringify(errorData.message) : errorDetail);
            if (Array.isArray(errorData.detail)) { // Handle Pydantic's detailed error messages
                errorDetail = errorData.detail.map((d: any) => `${d.loc.join('.')} - ${d.msg}`).join('; ');
            }
        } catch (jsonError) {
            // If parsing error JSON fails, stick with a generic message or response status text
            errorDetail = response.statusText || errorDetail;
        }
        throw new Error(`HTTP ${response.status}: ${errorDetail}`);
      }
      
      // Assuming successful response is 201 with the created assignment data
      // const createdAssignment = await response.json(); 
      // console.log("Assignment created:", createdAssignment);

      setSelectedUserToAssign(null); 
      await fetchEventAssignments(event.id); // Refresh assignments list (uses apiClient)
      await fetchEventDetails(); // Refresh event details (uses apiClient)
    } catch (err: any) { 
        console.error("Error in handleAssignVolunteer (direct fetch):", err);
        setAssignmentsError(`${err.message}`); 
    } 
    finally { setActionInProgress(false); }
  };

  const handleRemoveAssignment = async (assignmentId: string) => { 
    if (!idToken || !event || !confirm("Are you sure you want to remove this signup?")) return;
    setActionInProgress(true); setError(null); setAssignmentsError(null);
    try {
      // This still uses apiClient
      const result = await apiClient({
        path: `/events/${event.id}/assignments/${assignmentId}`,
        token: idToken,
        method: 'DELETE',
      });
      if (!result.ok && result.status !== 204) { 
        throw new Error(result.error?.message || 'Failed to remove signup');
      }
      await fetchEventAssignments(event.id); 
      await fetchEventDetails();
    } catch (err: any) { setAssignmentsError(err.message); } 
    finally { setActionInProgress(false); }
  };

  if (authLoading || isLoadingEvent || (!userProfile && user && !idToken)) { 
    return <div className="flex items-center justify-center min-h-screen"><p>Loading event details...</p></div>;
  }
  
  if (error && !event) { 
    return (
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
            <Link href="/dashboard/events" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200">← Back to Events</Link>
        </div>
        <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Access Error</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-2">{error}</p>
        </div>
      </main>
    );
  }
  if (!event && !isLoadingEvent) { 
    return (
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
            <Link href="/dashboard/events" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200">← Back to Events</Link>
        </div>
        <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6 text-center">
          <p className="text-gray-600 dark:text-gray-300">Event data not available. It might have been deleted or an error occurred.</p>
        </div>
      </main>
    );
  }
  
  if (!event) {
    return (
        <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
             <p className="text-center text-gray-500 dark:text-gray-400">No event data to display.</p>
        </main>
    );
  }

  const canSignUp = event.status === 'open_for_signup' && !event.isCurrentUserSignedUp;
  const canWithdraw = event.isCurrentUserSignedUp;
  const organizerName = event.organizerFirstName && event.organizerLastName ? `${event.organizerFirstName} ${event.organizerLastName}` : event.organizerUserId || 'N/A';
  const creatorName = event.creatorFirstName && event.creatorLastName ? `${event.creatorFirstName} ${event.creatorLastName}` : event.createdByUserId;
  const statusColors: { [key: string]: string } = {
    open_for_signup: 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100',
    draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100',
    ongoing: 'bg-teal-100 text-teal-800 dark:bg-teal-700 dark:text-teal-100 animate-pulse',
  };
  const statusDisplay = event.status.replace(/_/g, ' ');
  
  const displayWorkingGroupNames = event.workingGroupNames && event.workingGroupNames.length > 0 
    ? event.workingGroupNames.join(', ') 
    : (event.workingGroupName || 'N/A'); 

  return (
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
            <Link href="/dashboard/events" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                <span className="material-icons mr-1 text-lg">arrow_back</span>
                Back to Events
            </Link>
        </div>
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-6 border-b border-gray-200 dark:border-gray-700"> 
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center">
                    <span className="material-icons text-3xl text-indigo-600 dark:text-indigo-300">{event.icon || 'event'}</span>
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{event.eventName}</h1>
                    {event.updatedAt && isValid(parseISO(event.updatedAt)) && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Last updated: {format(parseISO(event.updatedAt), 'PPP p')}</p>
                    )}
                </div>
              </div>
              {canEditEvent && (
                <Link href={`/dashboard/events/${event.id}/edit`} className="mt-4 sm:mt-0">
                    <button className="inline-flex items-center py-2 px-4 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-md shadow-sm">
                        <span className="material-icons mr-2 text-base">edit</span>
                        Edit Event
                    </button>
                </Link>
              )}
            </div>
            
            {error && !actionInProgress && <p className="text-red-500 text-sm my-4 p-3 bg-red-50 dark:bg-red-900/30 rounded-md">{error}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"> 
              <DetailItem icon="category" label="Type" value={event.eventType || 'N/A'} />
              <DetailItem icon="event" label="Start Date & Time" value={event.dateTime && isValid(parseISO(event.dateTime)) ? format(parseISO(event.dateTime), 'PPP p') : 'N/A'} />
              <DetailItem icon="place" label="Venue" value={event.venue || 'N/A'} /> 
              <DetailItem icon="event_busy" label="End Date & Time" value={event.endTime && isValid(parseISO(event.endTime)) ? format(parseISO(event.endTime), 'PPP p') : 'N/A'} />
              <DetailItem icon="info" label="Status" value={<span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[event.status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'}`}>{statusDisplay}</span>} />
              <DetailItem icon="groups" label="Signups Required" value={event.volunteersRequired ?? 'N/A'} />
              <DetailItem icon="person_pin" label="Organizer" value={organizerName} />
              {event.point_of_contact && <DetailItem icon="contact_mail" label="Point of Contact" value={event.point_of_contact} />}
              <DetailItem icon="person_add" label="Created By" value={creatorName} />
              <DetailItem icon="today" label="Created On" value={event.createdAt && isValid(parseISO(event.createdAt)) ? format(parseISO(event.createdAt), 'PPP p') : 'N/A'} />
              <DetailItem icon="group_work" label="Working Groups" value={displayWorkingGroupNames} />
            </div>

            {event.purpose && ( 
                <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2 inline-flex items-center">
                        <span className="material-icons mr-2 text-indigo-500 dark:text-indigo-400">flag</span>
                        Purpose
                    </h2>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{event.purpose}</p>
                </div>
            )}
            {event.description && ( 
                <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2 inline-flex items-center">
                        <span className="material-icons mr-2 text-indigo-500 dark:text-indigo-400">description</span>
                        Description
                    </h2>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{event.description}</p>
                </div>
            )}
            
            {user && !canEditEvent && ( 
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                    {event.isCurrentUserSignedUp ? (
                        <div className="flex flex-col items-start space-y-3">
                            <p className="text-green-600 dark:text-green-400 font-medium inline-flex items-center">
                                <span className="material-icons mr-2">check_circle</span>
                                You are signed up. (Status: {event.currentUserAssignmentStatus?.replace(/_/g, ' ') || 'Unknown'})
                            </p>
                            {canWithdraw && (<button onClick={handleWithdraw} disabled={actionInProgress} className="inline-flex items-center py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50">
                                <span className="material-icons mr-2 text-base">logout</span>
                                {actionInProgress ? 'Processing...' : 'Withdraw Signup'}
                                </button>)}
                        </div>
                    ) : (
                        canSignUp ? (<button onClick={handleSignup} disabled={actionInProgress} className="inline-flex items-center py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50">
                            <span className="material-icons mr-2 text-base">how_to_reg</span>
                            {actionInProgress ? 'Processing...' : 'Sign Up'}
                            </button>)
                        : (<p className="text-gray-500 dark:text-gray-400 inline-flex items-center">
                            <span className="material-icons mr-2">info</span>
                            Signup not available. (Status: {statusDisplay})
                            </p>)
                    )}
                    {error && actionInProgress && <p className="text-red-500 text-sm mt-2">{error}</p>}
                </div>
            )}

            {canManageAssignments && (
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">Manage Signups</h2>
                
                <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg shadow">
                  <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-3">Signup Users</h3>
                  <form onSubmit={handleAssignVolunteer} className="space-y-4">
                    <div>
                        <UserSearchInput
                            onUserSelected={handleUserSelectedForAssignment}
                            label="Search for user to sign up:"
                            placeholder="Search by name or email..."
                        />
                        {selectedUserToAssign && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                Selected for signup: {selectedUserToAssign.firstName || ''} {selectedUserToAssign.lastName || ''} ({selectedUserToAssign.email})
                            </p>
                        )}
                    </div>
                    <button 
                        type="submit" 
                        disabled={actionInProgress || !selectedUserToAssign} 
                        className="w-full inline-flex items-center justify-center py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50"
                    >
                      <span className="material-icons mr-2 text-base">person_add</span>
                      {actionInProgress ? 'Manually Signing Up...' : `Manually Signup ${selectedUserToAssign ? (selectedUserToAssign.firstName || selectedUserToAssign.email) : 'Selected User'}`}
                    </button>
                  </form>
                  {assignmentsError && <p className="text-red-500 text-sm mt-3 p-2 bg-red-50 dark:bg-red-900/30 rounded-md">{assignmentsError}</p>}
                </div>

                <div>
                    <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-4">
                        Current Signups ({assignments.length})
                    </h3>
                    {isLoadingAssignments ? <p className="text-gray-500 dark:text-gray-400">Loading signups...</p> : assignments.length > 0 ? (
                    <ul className="space-y-4">
                        {assignments.map((assignment) => (
                        <li key={assignment.id} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center">
                            <div className="mb-3 sm:mb-0">
                            <p className="font-semibold text-gray-900 dark:text-white">
                                {assignment.userFirstName || 'N/A'} {assignment.userLastName || ''}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{assignment.userEmail || assignment.userId}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Status: <span className="font-medium">{assignment.status.replace(/_/g, ' ')}</span> | Signed Up: {assignment.assignmentDate && isValid(parseISO(assignment.assignmentDate)) ? format(parseISO(assignment.assignmentDate), 'Pp') : 'N/A'}
                            </p>
                            </div>
                            <button 
                            onClick={() => handleRemoveAssignment(assignment.id)} 
                            disabled={actionInProgress}
                            className="py-1.5 px-3 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-700 dark:hover:bg-red-600 dark:text-red-100 text-xs font-medium rounded-md shadow-sm disabled:opacity-50 inline-flex items-center"
                            >
                            <span className="material-icons mr-1 text-sm">person_remove</span>
                            Remove Signup
                            </button>
                        </li>
                        ))}
                    </ul>
                    ) : (
                    <p className="text-gray-500 dark:text-gray-400">No users currently signed up for this event.</p>
                    )}
                    {assignmentsError && !isLoadingAssignments && assignments.length === 0 && <p className="text-red-500 text-sm mt-2">{assignmentsError}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
  );
}
