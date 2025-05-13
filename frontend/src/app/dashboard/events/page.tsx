'use client';

import { useState, useEffect, useCallback } from 'react'; // Added useCallback
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

  // Simplified privilege check: if 'sysadmin' role ID is present, grant general admin rights for this page.
  // For more granular control, the backend /users/me should return a privileges map or is_sysadmin flag.
  const isSysAdminUser = userProfile?.assignedRoleIds?.includes('sysadmin');
  const canCreateEvents = isSysAdminUser; // Sysadmin can create events
  const canEditEvents = isSysAdminUser; // Sysadmin can edit events (adjust if other roles can edit)


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
  }, [user]); // Dependency: user

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
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading events...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800">
      <nav className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex-shrink-0 text-xl font-bold text-indigo-600 dark:text-indigo-400">
                Fiji Platform
              </Link>
            </div>
            <div className="flex items-center space-x-4">
                <Link href="/dashboard" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">
                    Dashboard
                </Link>
                {isSysAdminUser && ( // Show User Management only for sysadmin
                    <Link href="/dashboard/admin/users" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">
                        Users
                    </Link>
                )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
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
            <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6 text-center">
              <p className="text-gray-600 dark:text-gray-300">
                No events found. {canCreateEvents ? "Try creating one!" : ""}
              </p>
            </div>
          )}

          {events.length > 0 && (
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                        <Link href={`/dashboard/events/${event.id}`}>{event.eventName}</Link>
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {event.eventType || 'General Event'} - Venue: {event.venue || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Date: {format(parseISO(event.dateTime), 'PPP p')}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Status: <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          event.status === 'open_for_signup' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' :
                          event.status === 'draft' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100' :
                          event.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100' :
                          event.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                        }`}>{event.status.replace(/_/g, ' ')}</span>
                      </p>
                    </div>
                    {canEditEvents && (
                      <div className="flex space-x-2">
                        <Link href={`/dashboard/events/${event.id}/edit`}>
                          <button className="text-sm py-1 px-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md">Edit</button>
                        </Link>
                      </div>
                    )}
                  </div>
                  {event.description && <p className="mt-2 text-gray-700 dark:text-gray-300 text-sm">{event.description.substring(0,150)}{event.description.length > 150 ? '...' : ''}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}