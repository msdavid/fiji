'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';

// Define an interface for the event data expected from the backend
interface Event {
  eventId: string;
  eventName: string;
  eventType?: string;
  purpose?: string;
  description?: string;
  dateTime: string; 
  durationMinutes?: number;
  location: string; // Field name remains 'location' for backend
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
}

// Interface for the detailed event data, can be same as Event for now
interface EventDetail extends Event {}


export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.eventId as string; 

  const { user, loading: authLoading, userProfile } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);


  const isAdmin = userProfile?.assignedRoleIds?.includes('sysadmin');

  const fetchEventDetails = useCallback(async () => {
    if (!user || !eventId) return;

    setIsLoadingEvent(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      if (!token) throw new Error("Authentication token not available.");
      
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/events/${eventId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Event not found.");
        }
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to fetch event details (status: ${response.status})`);
      }
      const data: EventDetail = await response.json();
      setEvent(data);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while fetching event details.');
      console.error("Fetch event details error:", err);
    } finally {
      setIsLoadingEvent(false);
    }
  }, [user, eventId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && eventId) {
      fetchEventDetails();
    }
  }, [user, authLoading, eventId, router, fetchEventDetails]);

  const handleSignup = async () => {
    if (!user || !event) return;
    setActionInProgress(true);
    setError(null);
    try {
        const token = await user.getIdToken();
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
        const response = await fetch(`${backendUrl}/events/${event.eventId}/signup`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to sign up for event.');
        }
        alert('Successfully signed up for the event!');
        fetchEventDetails(); 
    } catch (err: any) {
        setError(err.message);
    } finally {
        setActionInProgress(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user || !event) return;
    setActionInProgress(true);
    setError(null);
    try {
        const token = await user.getIdToken();
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
        const response = await fetch(`${backendUrl}/events/${event.eventId}/signup`, { 
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to withdraw from event.');
        }
        alert('Successfully withdrawn from the event!');
        fetchEventDetails(); 
    } catch (err: any) {
        setError(err.message);
    } finally {
        setActionInProgress(false);
    }
  };


  if (authLoading || isLoadingEvent) {
    return <div className="flex items-center justify-center min-h-screen"><p>Loading event details...</p></div>;
  }

  if (error) {
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
          <p className="text-gray-600 dark:text-gray-300">Event data not available.</p>
        </div>
      </div>
    );
  }
  
  const canSignUp = event.status === 'open_for_signup' && !event.isCurrentUserSignedUp;
  const canWithdraw = event.isCurrentUserSignedUp;

  const organizerName = event.organizerFirstName && event.organizerLastName 
    ? `${event.organizerFirstName} ${event.organizerLastName}` 
    : event.organizerUserId || 'N/A';

  const creatorName = event.creatorFirstName && event.creatorLastName
    ? `${event.creatorFirstName} ${event.creatorLastName}`
    : event.createdByUserId;


  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800">
      <nav className="bg-white dark:bg-gray-900 shadow-sm mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/dashboard" className="flex-shrink-0 text-xl font-bold text-indigo-600 dark:text-indigo-400">
                Fiji Platform
            </Link>
            <Link href="/dashboard/events" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                ← Back to Events
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-0">{event.eventName}</h1>
              {isAdmin && (
                <Link href={`/dashboard/events/${event.eventId}/edit`}>
                  <button className="py-2 px-4 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-md">
                    Edit Event
                  </button>
                </Link>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-6 text-sm text-gray-700 dark:text-gray-300">
              <p><strong>Type:</strong> {event.eventType || 'N/A'}</p>
              <p><strong>Date & Time:</strong> {format(new Date(event.dateTime), 'PPP p')}</p>
              <p><strong>Venue:</strong> {event.location || 'N/A'}</p> {/* Changed Label */}
              <p><strong>Duration:</strong> {event.durationMinutes ? `${event.durationMinutes} minutes` : 'N/A'}</p>
              <p><strong>Status:</strong> 
                <span className={`ml-2 px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    event.status === 'open_for_signup' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' :
                    event.status === 'draft' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100' :
                    event.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100' :
                    event.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                }`}>{event.status.replace(/_/g, ' ')}</span>
              </p>
              <p><strong>Volunteers Required:</strong> {event.volunteersRequired ?? 'N/A'}</p>
              <p><strong>Organizer:</strong> {organizerName}</p>
              <p><strong>Created By:</strong> {creatorName}</p>
            </div>

            {event.purpose && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Purpose</h2>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{event.purpose}</p>
              </div>
            )}

            {event.description && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Description</h2>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{event.description}</p>
              </div>
            )}
            
            {!isAdmin && user && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    {event.isCurrentUserSignedUp ? (
                        <div>
                            <p className="text-green-600 dark:text-green-400 mb-2">
                                You are signed up for this event. (Status: {event.currentUserAssignmentStatus || 'Unknown'})
                            </p>
                            {canWithdraw && (
                                <button 
                                    onClick={handleWithdraw} 
                                    disabled={actionInProgress}
                                    className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md disabled:opacity-50"
                                >
                                    {actionInProgress ? 'Processing...' : 'Withdraw Signup'}
                                </button>
                            )}
                        </div>
                    ) : (
                        canSignUp ? (
                            <button 
                                onClick={handleSignup} 
                                disabled={actionInProgress}
                                className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md disabled:opacity-50"
                            >
                                {actionInProgress ? 'Processing...' : 'Sign Up for this Event'}
                            </button>
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400">
                                Signup is not currently available for this event. (Status: {event.status.replace(/_/g, ' ')})
                            </p>
                        )
                    )}
                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}