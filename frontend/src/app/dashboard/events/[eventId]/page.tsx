'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO } from 'date-fns'; 

interface Event {
  id: string; 
  eventName: string;
  icon?: string; // Added for icon display
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

// UserSearchInput is used but not directly defined here, assuming it's imported correctly
// interface UserSearchResult { ... } 

// Helper component for displaying detail items with icons
const DetailItem = ({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) => {
  if (!value && typeof value !== 'number') return null; // Don't render if value is empty (except for 0)
  return (
    <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
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

  const { user, loading: authLoading, userProfile, fetchUserProfile, hasPrivilege } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  
  const [selectedUserToAssign, setSelectedUserToAssign] = useState<any | null>(null); // Using 'any' as UserSearchResult is not defined here

  const canEditEvent = userProfile && (hasPrivilege ? hasPrivilege('events', 'edit') : userProfile.assignedRoleIds?.includes('sysadmin'));
  const canManageAssignments = userProfile && (hasPrivilege ? hasPrivilege('events', 'manage_assignments') : userProfile.assignedRoleIds?.includes('sysadmin'));

  const fetchEventDetails = useCallback(async () => {
    if (!user || !pageEventId) return;
    setIsLoadingEvent(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/events/${pageEventId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to fetch event details');
      }
      const data: EventDetail = await response.json();
      setEvent(data);
    } catch (err: any) {
      setError(err.message);
      setEvent(null); 
    } finally {
      setIsLoadingEvent(false);
    }
  }, [user, pageEventId]);

  const fetchEventAssignments = useCallback(async (currentEventId: string) => { 
    if (!user || !currentEventId || !canManageAssignments) return; 
    
    setIsLoadingAssignments(true);
    setAssignmentsError(null);
    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/events/${currentEventId}/assignments`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to fetch event assignments');
      }
      const data: Assignment[] = await response.json();
      setAssignments(data);
    } catch (err: any) {
      setAssignmentsError(err.message); 
      console.error("Fetch assignments error:", err);
    } finally {
      setIsLoadingAssignments(false);
    }
  }, [user, canManageAssignments]); 

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && !userProfile) {
        fetchUserProfile();
    }
    if (user && pageEventId) { 
      fetchEventDetails();
    }
  }, [user, authLoading, pageEventId, router, fetchEventDetails, userProfile, fetchUserProfile]);

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
    if (!user || !event) return;
    setActionInProgress(true); setError(null);
    try {
        const token = await user.getIdToken();
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
        const response = await fetch(`${backendUrl}/events/${event.id}/signup`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error((await response.json()).detail || 'Failed to sign up');
        await fetchEventDetails(); 
    } catch (err: any) { setError(err.message); } 
    finally { setActionInProgress(false); }
  };

  const handleWithdraw = async () => { 
    if (!user || !event) return;
    setActionInProgress(true); setError(null);
    try {
        const token = await user.getIdToken();
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
        const response = await fetch(`${backendUrl}/events/${event.id}/signup`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error((await response.json()).detail || 'Failed to withdraw');
        await fetchEventDetails();
    } catch (err: any) { setError(err.message); }
    finally { setActionInProgress(false); }
  };

  const handleAssignVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !event || !selectedUserToAssign) {
        setAssignmentsError("Please select a user to assign.");
        return;
    }
    setActionInProgress(true); setError(null); setAssignmentsError(null);
    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/events/${event.id}/assignments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserToAssign.id, assignableId: event.id, assignableType: 'event', status: 'confirmed_admin' }),
      });
      if (!response.ok) throw new Error((await response.json()).detail || 'Failed to assign volunteer');
      setSelectedUserToAssign(null); 
      // TODO: Clear UserSearchInput after successful assignment
      await fetchEventAssignments(event.id); 
      await fetchEventDetails(); 
    } catch (err: any) { setAssignmentsError(err.message); } 
    finally { setActionInProgress(false); }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!user || !event || !confirm("Are you sure you want to remove this volunteer?")) return;
    setActionInProgress(true); setError(null); setAssignmentsError(null);
    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/events/${event.id}/assignments/${assignmentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok && response.status !== 204) { 
        const errorData = await response.json().catch(() => ({ detail: 'Failed to remove volunteer assignment' }));
        throw new Error(errorData.detail || 'Failed to remove volunteer assignment');
      }
      await fetchEventAssignments(event.id); 
      await fetchEventDetails();
    } catch (err: any) { setAssignmentsError(err.message); } 
    finally { setActionInProgress(false); }
  };

  if (authLoading || isLoadingEvent || (!userProfile && user)) { 
    return <div className="flex items-center justify-center min-h-screen"><p>Loading event details...</p></div>;
  }
  if (error && !event) { 
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-800 p-8">
        <Link href="/dashboard/events" className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 mb-4 inline-block">← Back to Events</Link>
        <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Error</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-2">{error}</p>
        </div>
      </div>
    );
  }
  if (!event) { 
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-800 p-8">
        <Link href="/dashboard/events" className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 mb-4 inline-block">← Back to Events</Link>
        <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6 text-center">
          <p className="text-gray-600 dark:text-gray-300">Event data not available. It might have been deleted or an error occurred.</p>
        </div>
      </div>
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
                    <p className="text-sm text-gray-500 dark:text-gray-400">Last updated: {format(parseISO(event.updatedAt), 'PPP p')}</p>
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
              <DetailItem icon="event" label="Start Date & Time" value={event.dateTime ? format(parseISO(event.dateTime), 'PPP p') : 'N/A'} />
              <DetailItem icon="place" label="Venue" value={event.venue || 'N/A'} /> 
              <DetailItem icon="event_busy" label="End Date & Time" value={event.endTime ? format(parseISO(event.endTime), 'PPP p') : 'N/A'} />
              <DetailItem icon="info" label="Status" value={<span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[event.status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'}`}>{statusDisplay}</span>} />
              <DetailItem icon="groups" label="Volunteers Required" value={event.volunteersRequired ?? 'N/A'} />
              <DetailItem icon="person_pin" label="Organizer" value={organizerName} />
              {event.point_of_contact && <DetailItem icon="contact_mail" label="Point of Contact" value={event.point_of_contact} />}
              <DetailItem icon="person_add" label="Created By" value={creatorName} />
              <DetailItem icon="today" label="Created On" value={format(parseISO(event.createdAt), 'PPP p')} />
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
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">Manage Volunteers</h2>
                
                <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg shadow">
                  <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-3">Assign New Volunteer</h3>
                  <form onSubmit={handleAssignVolunteer} className="space-y-4">
                    <div>
                        {/* Assuming UserSearchInput is available and works */}
                        {/* <UserSearchInput 
                            onUserSelected={(u: any) => setSelectedUserToAssign(u)}
                            label="Search for volunteer to assign:"
                            placeholder="Type name or email..."
                        /> */}
                        <label htmlFor="user-search-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search for volunteer to assign:</label>
                        <input id="user-search-input" type="text" placeholder="UserSearchInput component placeholder" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                        {selectedUserToAssign && <p className="text-xs text-green-600 dark:text-green-400 mt-1">Selected: {selectedUserToAssign.firstName} {selectedUserToAssign.lastName}</p>}
                    </div>
                    <button 
                        type="submit" 
                        disabled={actionInProgress || !selectedUserToAssign} 
                        className="w-full inline-flex items-center justify-center py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50"
                    >
                      <span className="material-icons mr-2 text-base">person_add</span>
                      {actionInProgress ? 'Assigning...' : `Assign ${selectedUserToAssign ? (selectedUserToAssign.firstName || selectedUserToAssign.email) : ''}`}
                    </button>
                  </form>
                  {assignmentsError && <p className="text-red-500 text-sm mt-3 p-2 bg-red-50 dark:bg-red-900/30 rounded-md">{assignmentsError}</p>}
                </div>

                <div>
                    <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-4">
                        Assigned Volunteers ({assignments.length})
                    </h3>
                    {isLoadingAssignments ? <p className="text-gray-500 dark:text-gray-400">Loading assignments...</p> : assignments.length > 0 ? (
                    <ul className="space-y-4">
                        {assignments.map((assignment) => (
                        <li key={assignment.id} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center">
                            <div className="mb-3 sm:mb-0">
                            <p className="font-semibold text-gray-900 dark:text-white">
                                {assignment.userFirstName || 'N/A'} {assignment.userLastName || ''}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{assignment.userEmail || assignment.userId}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Status: <span className="font-medium">{assignment.status.replace(/_/g, ' ')}</span> | Assigned: {format(parseISO(assignment.assignmentDate), 'Pp')}
                            </p>
                            </div>
                            <button 
                            onClick={() => handleRemoveAssignment(assignment.id)} 
                            disabled={actionInProgress}
                            className="py-1.5 px-3 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-700 dark:hover:bg-red-600 dark:text-red-100 text-xs font-medium rounded-md shadow-sm disabled:opacity-50 inline-flex items-center"
                            >
                            <span className="material-icons mr-1 text-sm">person_remove</span>
                            Remove
                            </button>
                        </li>
                        ))}
                    </ul>
                    ) : (
                    <p className="text-gray-500 dark:text-gray-400">No volunteers currently assigned to this event.</p>
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