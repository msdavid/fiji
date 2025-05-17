'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO } from 'date-fns'; 
import UserSearchInput from '@/components/admin/UserSearchInput'; // Import the new component

interface Event {
  id: string; 
  eventName: string;
  eventType?: string;
  purpose?: string;
  description?: string;
  dateTime: string; 
  endTime?: string;  
  venue?: string; // Made optional to align with backend, though usually present
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
  point_of_contact?: string; // New field
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

interface UserSearchResult { // For UserSearchInput component
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
}


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
  
  const [selectedUserToAssign, setSelectedUserToAssign] = useState<UserSearchResult | null>(null);

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

  return (
      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6"> {/* Container for Back link */}
            <Link href="/dashboard/events" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                ← Back to Events
            </Link>
        </div>
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4"> 
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-0">{event.eventName}</h1>
              {canEditEvent && (<Link href={`/dashboard/events/${event.id}/edit`}><button className="py-2 px-4 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-md">Edit Event</button></Link>)}
            </div>
            
            {error && !actionInProgress && <p className="text-red-500 text-sm mt-2 mb-4">{error}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-6 text-sm text-gray-700 dark:text-gray-300"> 
              <p><strong>Type:</strong> {event.eventType || 'N/A'}</p>
              <p><strong>Start Date & Time:</strong> {event.dateTime ? format(parseISO(event.dateTime), 'PPP p') : 'N/A'}</p>
              <p><strong>Venue:</strong> {event.venue || 'N/A'}</p> 
              <p><strong>End Date & Time:</strong> {event.endTime ? format(parseISO(event.endTime), 'PPP p') : 'N/A'}</p>
              <p><strong>Status:</strong> <span className={`ml-2 px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${ event.status === 'open_for_signup' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' : event.status === 'draft' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100' : event.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100' : event.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100' }`}>{event.status.replace(/_/g, ' ')}</span></p>
              <p><strong>Volunteers Required:</strong> {event.volunteersRequired ?? 'N/A'}</p>
              <p><strong>Organizer:</strong> {organizerName}</p>
              {event.point_of_contact && <p><strong>Point of Contact:</strong> {event.point_of_contact}</p>}
              <p><strong>Created By:</strong> {creatorName}</p>
            </div>

            {event.purpose && ( <div className="mb-6"><h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Purpose</h2><p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{event.purpose}</p></div>)}
            {event.description && ( <div className="mb-6"><h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Description</h2><p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{event.description}</p></div>)}
            
            {user && !canEditEvent && ( 
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    {event.isCurrentUserSignedUp ? (
                        <div>
                            <p className="text-green-600 dark:text-green-400 mb-2">You are signed up. (Status: {event.currentUserAssignmentStatus?.replace(/_/g, ' ') || 'Unknown'})</p>
                            {canWithdraw && (<button onClick={handleWithdraw} disabled={actionInProgress} className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md disabled:opacity-50">{actionInProgress ? 'Processing...' : 'Withdraw Signup'}</button>)}
                        </div>
                    ) : (
                        canSignUp ? (<button onClick={handleSignup} disabled={actionInProgress} className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md disabled:opacity-50">{actionInProgress ? 'Processing...' : 'Sign Up'}</button>)
                        : (<p className="text-gray-500 dark:text-gray-400">Signup not available. (Status: {event.status.replace(/_/g, ' ')})</p>)
                    )}
                    {error && actionInProgress && <p className="text-red-500 text-sm mt-2">{error}</p>}
                </div>
            )}

            {canManageAssignments && (
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Manage Volunteers</h2>
                
                <form onSubmit={handleAssignVolunteer} className="mb-6 p-4 border dark:border-gray-700 rounded-md">
                  <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Assign Volunteer</h3>
                  <div className="space-y-2">
                    <UserSearchInput 
                        onUserSelected={(u) => setSelectedUserToAssign(u)}
                        label="Search for volunteer to assign:"
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

                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Assigned Volunteers ({assignments.length})</h3>
                {isLoadingAssignments ? <p>Loading assignments...</p> : assignments.length > 0 ? (
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
                  <p className="text-gray-500 dark:text-gray-400">No volunteers currently assigned to this event.</p>
                )}
                 {assignmentsError && !isLoadingAssignments && assignments.length === 0 && <p className="text-red-500 text-sm mt-2">{assignmentsError}</p>}
              </div>
            )}
          </div>
        </div>
      </main>
  );
}