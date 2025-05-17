'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO } from 'date-fns';

interface Event {
  id: string;
  eventName: string;
  eventType?: string;
  purpose?: string;
  description?: string;
  dateTime: string;
  endTime?: string;
  venue: string;
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

export default function EventsPage() {
  const router = useRouter();
  const { user, loading: authLoading, userProfile, fetchUserProfile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSysAdminUser = userProfile?.assignedRoleIds?.includes('sysadmin');
  // TODO: Replace with privilege-based check if available, e.g., hasPrivilege('events', 'create')
  const canCreateEvents = isSysAdminUser; 
  // TODO: Replace with privilege-based check if available, e.g., hasPrivilege('events', 'edit_any') or check ownership for 'edit_own'
  const canEditEvents = isSysAdminUser; 

  const fetchEvents = useCallback(async () => {
    if (!user) return;

    setIsLoadingEvents(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      if (!token) {
        throw new Error("Authentication token not available.");
      }
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/events`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to fetch events (status: ${response.status})`);
      }
      const data: Event[] = await response.json();
      setEvents(data);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while fetching events.');
      console.error("Fetch events error:", err);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && !userProfile) {
        fetchUserProfile();
    }
    if (user && userProfile) {
      fetchEvents();
    }
  }, [user, authLoading, router, userProfile, fetchUserProfile, fetchEvents]);


  if (authLoading || isLoadingEvents || (!userProfile && user)) {
    return (
      <div>
        <div className="text-center">
          <p className="text-gray-700 dark:text-gray-300">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <main>
      <div>
        <div className="flex justify-between items-center mb-8"> {/* Increased mb from 6 to 8 for consistency */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white"> {/* Matched h1 style from working groups */}
            Events
          </h1>
          {canCreateEvents && (
            <Link href="/dashboard/events/new">
              <button className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md">
                Create New Event
              </button>
            </Link>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800" role="alert">
            {error}
          </div>
        )}

        {events.length === 0 && !isLoadingEvents && !error && (
          <div className="text-center py-10 bg-white dark:bg-gray-900 shadow rounded-lg"> {/* Matched style from working groups */}
            <p className="text-gray-500 dark:text-gray-400">
              No events found.
            </p>
            {canCreateEvents && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    You can <Link href="/dashboard/events/new" className="text-indigo-600 hover:underline dark:text-indigo-400">create one now</Link>.
                </p>
            )}
          </div>
        )}

        {events.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <Link key={event.id} href={`/dashboard/events/${event.id}`} className="block hover:shadow-xl transition-shadow duration-200 ease-in-out group">
                <div className="bg-white dark:bg-gray-900 shadow-lg rounded-lg overflow-hidden h-full flex flex-col">
                  <div className="p-6 flex-grow">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {event.eventName}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      {event.eventType || 'General Event'} - Venue: {event.venue || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Date: {format(parseISO(event.dateTime), 'PPP p')}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      Status: <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        event.status === 'open_for_signup' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' :
                        event.status === 'draft' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100' :
                        event.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100' :
                        event.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                      }`}>{event.status.replace(/_/g, ' ')}</span>
                    </p>
                    {event.description && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2" title={event.description}>
                        {event.description}
                      </p>
                    )}
                  </div>
                  <div className="p-6 border-t border-gray-200 dark:border-gray-700 mt-auto">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          Created by: {event.creatorFirstName || ''} {event.creatorLastName || event.createdByUserId}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          Created on: {format(parseISO(event.createdAt), 'PP')}
                        </p>
                      </div>
                      {canEditEvents && (
                        <Link 
                          href={`/dashboard/events/${event.id}/edit`} 
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm py-1 px-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md"
                        >
                          Edit
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}