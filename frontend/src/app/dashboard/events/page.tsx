'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO, isBefore, isAfter, isEqual } from 'date-fns'; // Added isBefore, isAfter, isEqual

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
  status: string; // This will be the original status from backend
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
  icon?: string;
}

// Interface for the event object used in display, which might have a dynamically adjusted status
interface DisplayEvent extends Event {
  displayStatus: string; 
}

const EVENT_STATUSES = {
  ALL: "",
  DRAFT: "draft",
  OPEN_FOR_SIGNUP: "open_for_signup",
  ONGOING: "ongoing", 
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

const EVENT_STATUS_LABELS: { [key: string]: string } = {
  [EVENT_STATUSES.ALL]: "All Statuses",
  [EVENT_STATUSES.DRAFT]: "Draft",
  [EVENT_STATUSES.OPEN_FOR_SIGNUP]: "Open For Signup",
  [EVENT_STATUSES.ONGOING]: "Ongoing", 
  [EVENT_STATUSES.COMPLETED]: "Completed",
  [EVENT_STATUSES.CANCELLED]: "Cancelled",
};


export default function EventsPage() {
  const router = useRouter();
  const { user, loading: authLoading, userProfile, fetchUserProfile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(EVENT_STATUSES.ALL);
  const [currentTimeTick, setCurrentTimeTick] = useState(new Date()); // For periodic re-render

  const isSysAdminUser = userProfile?.assignedRoleIds?.includes('sysadmin');
  const canCreateEvents = isSysAdminUser; 

  // Effect to update currentTimeTick every minute
  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTimeTick(new Date());
    }, 60000); // Update every 60 seconds
    return () => clearInterval(timerId); // Cleanup interval on component unmount
  }, []);

  const fetchEvents = useCallback(async (currentStatusFilter: string) => {
    if (!user) return;

    setIsLoadingEvents(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      if (!token) {
        throw new Error("Authentication token not available.");
      }
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      let url = `${backendUrl}/events`;
      if (currentStatusFilter && currentStatusFilter !== EVENT_STATUSES.ALL) {
        url += `?status=${currentStatusFilter}`;
      }

      const response = await fetch(url, {
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
      fetchEvents(statusFilter);
    }
  }, [user, authLoading, router, userProfile, fetchUserProfile, fetchEvents, statusFilter]);

  const displayedEvents = useMemo(() => {
    const now = currentTimeTick; // Use the state variable that updates every minute

    const searchFilteredEvents = events.filter(event => {
      if (!searchTerm.trim()) return true;
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      const eventNameMatch = event.eventName.toLowerCase().includes(lowercasedSearchTerm);
      const descriptionMatch = event.description && event.description.toLowerCase().includes(lowercasedSearchTerm);
      let creatorFullName = '';
      if (event.creatorFirstName || event.creatorLastName) {
        creatorFullName = `${event.creatorFirstName || ''} ${event.creatorLastName || ''}`.trim().toLowerCase();
      }
      const creatorMatch = creatorFullName.includes(lowercasedSearchTerm);
      return eventNameMatch || descriptionMatch || creatorMatch;
    });

    return searchFilteredEvents.map(event => {
      let dynamicStatus = event.status;
      const originalStatus = event.status;

      // Don't override if already completed or cancelled
      if (originalStatus !== EVENT_STATUSES.COMPLETED && originalStatus !== EVENT_STATUSES.CANCELLED) {
        try {
          const eventStart = parseISO(event.dateTime);
          const eventEnd = event.endTime ? parseISO(event.endTime) : null;

          const isStarted = isAfter(now, eventStart) || isEqual(now, eventStart);
          const isNotEnded = !eventEnd || isBefore(now, eventEnd);
          
          if (isStarted && isNotEnded) {
            dynamicStatus = EVENT_STATUSES.ONGOING;
          }
        } catch (e) {
          console.error("Error parsing event dates for dynamic status:", event.id, e);
          // Keep original status if date parsing fails
        }
      }
      return { ...event, displayStatus: dynamicStatus };
    });
  }, [events, searchTerm, currentTimeTick]);


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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
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

        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="search-events" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search Events
            </label>
            <input
              type="text"
              id="search-events"
              placeholder="Search by name, description, or creator..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Filter by Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-white"
            >
              {Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800" role="alert">
            {error}
          </div>
        )}

        {displayedEvents.length === 0 && !isLoadingEvents && !error && (
          <div className="text-center py-10 bg-white dark:bg-gray-900 shadow rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || statusFilter !== EVENT_STATUSES.ALL ? 'No events match your criteria.' : 'No events found.'}
            </p>
            {canCreateEvents && !searchTerm && statusFilter === EVENT_STATUSES.ALL && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    You can <Link href="/dashboard/events/new" className="text-indigo-600 hover:underline dark:text-indigo-400">create one now</Link>.
                </p>
            )}
          </div>
        )}

        {displayedEvents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedEvents.map((event: DisplayEvent) => { // Use DisplayEvent type here
              let statusClass = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'; // Default
              if (event.displayStatus === EVENT_STATUSES.ONGOING) {
                statusClass = 'status-ongoing-blinking'; 
              } else if (event.displayStatus === EVENT_STATUSES.OPEN_FOR_SIGNUP) {
                statusClass = 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100';
              } else if (event.displayStatus === EVENT_STATUSES.DRAFT) {
                statusClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100';
              } else if (event.displayStatus === EVENT_STATUSES.COMPLETED) {
                statusClass = 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100';
              } else if (event.displayStatus === EVENT_STATUSES.CANCELLED) {
                statusClass = 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100';
              }

              return (
                <div key={event.id} className="bg-white dark:bg-gray-900 shadow-lg rounded-lg overflow-hidden h-full flex flex-col group hover:shadow-xl transition-shadow duration-200 ease-in-out">
                  <Link href={`/dashboard/events/${event.id}`} className="flex flex-grow">
                    <div className="flex-shrink-0 p-3 sm:p-4 flex items-start justify-center border-r border-gray-200 dark:border-gray-700">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                        <span className="material-icons text-3xl sm:text-4xl text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-500 transition-colors duration-150">
                          {event.icon || 'event'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col flex-grow p-4 sm:p-6 overflow-hidden">
                      <div className="flex-grow">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-200 mb-1 sm:mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate transition-colors duration-150" title={event.eventName}>
                          {event.eventName}
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">
                          {event.eventType || 'General Event'} - Venue: {event.venue || 'N/A'}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">
                          Date: {format(parseISO(event.dateTime), 'PP p')}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2 sm:mb-3">
                          Status: <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}`}>
                            {EVENT_STATUS_LABELS[event.displayStatus as keyof typeof EVENT_STATUS_LABELS] || event.displayStatus.replace(/_/g, ' ')}
                          </span>
                        </p>
                        {event.description && (
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 line-clamp-2 sm:line-clamp-3" title={event.description}>
                            {event.description}
                          </p>
                        )}
                      </div>
                      <div className="pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              By: {event.creatorFirstName || ''} {event.creatorLastName || event.createdByUserId.substring(0,8)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              On: {format(parseISO(event.createdAt), 'PP')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}