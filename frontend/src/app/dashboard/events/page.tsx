'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO, isBefore, isAfter, isEqual } from 'date-fns';
import toast from 'react-hot-toast'; 

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
  icon?: string;
}

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
  // Added logout to useAuth destructuring
  const { user, loading: authLoading, userProfile, hasPrivilege, logout } = useAuth(); 
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<{[eventId: string]: boolean}>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(EVENT_STATUSES.ALL);
  const [currentTimeTick, setCurrentTimeTick] = useState(new Date());

  const canCreateEvents = useMemo(() => {
    return hasPrivilege('events', 'create'); 
  }, [hasPrivilege]); 

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTimeTick(new Date());
    }, 60000); 
    return () => clearInterval(timerId);
  }, []);

  const fetchEvents = useCallback(async (currentStatusFilter: string) => {
    if (!user) return;

    setIsLoadingEvents(true);
    let response; // Define response here to access status in catch
    try {
      const token = await user.getIdToken();
      // No need to throw if token is null, getIdToken() would throw or AuthContext handles it
      // if (!token) { 
      //   logout(); // This would be handled by AuthContext if getIdToken fails
      //   return;
      // }
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      let url = `${backendUrl}/events`;
      if (currentStatusFilter && currentStatusFilter !== EVENT_STATUSES.ALL) {
        url += `?status=${currentStatusFilter}`;
      }

      response = await fetch(url, { // Assign to outer scope response
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Check for 401 specifically before trying to parse JSON
        if (response.status === 401) {
          console.warn("EventsPage: Unauthorized (401) fetching events. Logging out.");
          await logout(); // Call logout from AuthContext
          return; // Stop further processing
        }
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to fetch events (status: ${response.status})`);
      }
      const data: Event[] = await response.json();
      setEvents(data);
    } catch (err: any) {
      // If logout was called due to 401, response might be undefined or this catch might not be hit in that path.
      // Only show toast if it's not a 401 that's being handled by logout.
      // The check `response?.status !== 401` ensures we don't toast for handled auth errors.
      if (response?.status !== 401) {
        toast.error(err.message || 'An unexpected error occurred while fetching events.');
        console.error("Fetch events error:", err);
      }
    } finally {
      setIsLoadingEvents(false);
    }
  }, [user, logout]); // Added logout to dependencies

  useEffect(() => {
    // This effect already handles redirect if !user after authLoading.
    // AuthContext is now more aggressive in nullifying user on token issues.
    if (!authLoading && !user) {
      // router.push('/login'); // This redirect is handled by DashboardLayout or AuthContext
      return;
    }
    if (user && !authLoading) { 
      fetchEvents(statusFilter);
    }
  }, [user, authLoading, fetchEvents, statusFilter]); // Removed router from here as redirect is handled elsewhere

  const displayedEvents = useMemo(() => {
    const now = currentTimeTick;
    const permissionFilteredEvents = events.filter(event => {
      if (event.status === EVENT_STATUSES.DRAFT) {
        const currentUserIsCreator = user && event.createdByUserId === user.uid;
        const currentUserCanManageEvents = hasPrivilege('events', 'edit'); 
        if (!currentUserIsCreator && !currentUserCanManageEvents) return false;
      }
      return true;
    });
    const searchFilteredEvents = permissionFilteredEvents.filter(event => {
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
      if (originalStatus !== EVENT_STATUSES.COMPLETED && originalStatus !== EVENT_STATUSES.CANCELLED) {
        try {
          const eventStart = parseISO(event.dateTime);
          const eventEnd = event.endTime ? parseISO(event.endTime) : null;
          const isStarted = isAfter(now, eventStart) || isEqual(now, eventStart);
          const isNotEnded = !eventEnd || isBefore(now, eventEnd);
          if (isStarted && isNotEnded) dynamicStatus = EVENT_STATUSES.ONGOING;
        } catch (e) { console.error("Error parsing event dates:", event.id, e); }
      }
      return { ...event, displayStatus: dynamicStatus };
    });
  }, [events, searchTerm, currentTimeTick, user, hasPrivilege]);

  const handleSignUp = async (eventId: string, eventName: string) => {
    if (!user) return;
    setActionInProgress(prev => ({...prev, [eventId]: true}));
    const loadingToastId = toast.loading(`Signing up for ${eventName}...`);
    let response;
    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      response = await fetch(`${backendUrl}/events/${eventId}/signup`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        if (response.status === 401) {
          console.warn("EventsPage: Unauthorized (401) signing up. Logging out.");
          toast.dismiss(loadingToastId);
          await logout(); return;
        }
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to sign up for event.');
      }
      setEvents(prevEvents => prevEvents.map(e => 
        e.id === eventId ? { ...e, isCurrentUserSignedUp: true, currentUserAssignmentStatus: 'confirmed' } : e
      ));
      toast.success(`Successfully signed up for ${eventName}!`, { id: loadingToastId });
    } catch (err: any) {
      if (response?.status !== 401) {
        toast.error(err.message || `Failed to sign up for ${eventName}.`, { id: loadingToastId });
        console.error("Sign up error:", err);
      }
    } finally {
      setActionInProgress(prev => ({...prev, [eventId]: false}));
    }
  };

  const handleWithdraw = async (eventId: string, eventName: string) => {
    if (!user) return;
    setActionInProgress(prev => ({...prev, [eventId]: true}));
    const loadingToastId = toast.loading(`Withdrawing from ${eventName}...`);
    let response;
    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      response = await fetch(`${backendUrl}/events/${eventId}/signup`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 401) {
          console.warn("EventsPage: Unauthorized (401) withdrawing. Logging out.");
          toast.dismiss(loadingToastId);
          await logout(); return;
        }
        const errorData = await response.json().catch(() => ({})); 
        throw new Error(errorData.detail || 'Failed to withdraw from event.');
      }
      setEvents(prevEvents => prevEvents.map(e => 
        e.id === eventId ? { ...e, isCurrentUserSignedUp: false, currentUserAssignmentStatus: undefined } : e
      ));
      toast.success(`Successfully withdrew from ${eventName}.`, { id: loadingToastId });
    } catch (err: any) {
      if (response?.status !== 401) {
        toast.error(err.message || `Failed to withdraw from ${eventName}.`, { id: loadingToastId });
        console.error("Withdraw error:", err);
      }
    } finally {
      setActionInProgress(prev => ({...prev, [eventId]: false}));
    }
  };

  if (authLoading || (!user && !isLoadingEvents)) { // Adjusted loading condition
    return (
      <div className="flex flex-col justify-center items-center h-full min-h-[300px]">
        <span className="material-icons text-6xl text-indigo-500 dark:text-indigo-400 animate-spin mb-4">
          sync
        </span>
        <p className="text-lg text-gray-700 dark:text-gray-300">Loading events...</p>
      </div>
    );
  }
  
  // If after auth loading, user is null, DashboardLayout should handle redirect.
  // This page shouldn't render its content if user is null.
  // The loading check above might need to be combined with !user check more carefully.
  // However, AuthContext and DashboardLayout are primary guards.

  return (
    <div> 
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Events
        </h1>
        {canCreateEvents && (
          <Link href="/dashboard/events/new">
            <button className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm inline-flex items-center">
              <span className="material-icons text-lg mr-2">add_circle_outline</span>
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
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-white"
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
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-white"
          >
            {Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {displayedEvents.length === 0 && !isLoadingEvents && ( 
        <div className="text-center py-10 bg-white dark:bg-gray-900 shadow-lg rounded-lg flex flex-col items-center justify-center min-h-[200px]">
          <span className="material-icons text-6xl text-gray-400 dark:text-gray-500 mb-4">
            event_busy 
          </span>
          <p className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">
            {searchTerm || statusFilter !== EVENT_STATUSES.ALL ? 'No events match your criteria.' : 'No events found.'}
          </p>
          {canCreateEvents && !searchTerm && statusFilter === EVENT_STATUSES.ALL && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                  You can <Link href="/dashboard/events/new" className="text-indigo-600 hover:underline dark:text-indigo-400 font-medium">create one now</Link>.
              </p>
          )}
        </div>
      )}

      {displayedEvents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedEvents.map((event: DisplayEvent) => {
            let statusClass = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'; 
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
            
            const isActionForThisEventInProgress = actionInProgress[event.id];

            return (
              <div key={event.id} className="bg-white dark:bg-gray-900 shadow-lg rounded-lg overflow-hidden h-full flex flex-col group hover:shadow-xl transition-shadow duration-200 ease-in-out">
                <Link href={`/dashboard/events/${event.id}`} className="flex flex-col flex-grow">
                  <div className="flex flex-row flex-grow">
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
                          Status: <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}`}>
                            {EVENT_STATUS_LABELS[event.displayStatus as keyof typeof EVENT_STATUS_LABELS] || event.displayStatus.replace(/_/g, ' ')}
                          </span>
                        </p>
                        {event.description && (
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 line-clamp-2 sm:line-clamp-3" title={event.description}>
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link> 
                
                <div className="p-4 sm:p-6 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        By: {event.creatorFirstName || ''} {event.creatorLastName || event.createdByUserId.substring(0,8)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        On: {format(parseISO(event.createdAt), 'PP')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      {event.isCurrentUserSignedUp ? (
                        <>
                          <p className="text-xs font-medium text-green-600 dark:text-green-400 capitalize">
                            Status: {event.currentUserAssignmentStatus?.replace(/_/g, ' ') || 'Signed Up'}
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleWithdraw(event.id, event.eventName); }}
                            disabled={isActionForThisEventInProgress || event.displayStatus === EVENT_STATUSES.COMPLETED || event.displayStatus === EVENT_STATUSES.CANCELLED || event.displayStatus === EVENT_STATUSES.ONGOING}
                            className={`py-1.5 px-3 text-xs font-medium rounded-md shadow-sm inline-flex items-center transition-colors duration-150
                                        ${isActionForThisEventInProgress || event.displayStatus === EVENT_STATUSES.COMPLETED || event.displayStatus === EVENT_STATUSES.CANCELLED || event.displayStatus === EVENT_STATUSES.ONGOING
                                          ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                          : 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white'}`}
                          >
                            {isActionForThisEventInProgress ? (
                              <span className="material-icons text-sm animate-spin mr-1">sync</span>
                            ) : (
                              <span className="material-icons text-sm mr-1">event_busy</span>
                            )}
                            Withdraw
                          </button>
                        </>
                      ) : event.status === EVENT_STATUSES.OPEN_FOR_SIGNUP && event.displayStatus !== EVENT_STATUSES.COMPLETED && event.displayStatus !== EVENT_STATUSES.CANCELLED ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSignUp(event.id, event.eventName); }}
                          disabled={isActionForThisEventInProgress}
                          className={`py-1.5 px-3 text-xs font-medium rounded-md shadow-sm inline-flex items-center transition-colors duration-150
                                      ${isActionForThisEventInProgress 
                                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                        : 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white'}`}
                        >
                          {isActionForThisEventInProgress ? (
                            <span className="material-icons text-sm animate-spin mr-1">sync</span>
                          ) : (
                            <span className="material-icons text-sm mr-1">how_to_reg</span>
                          )}
                          Sign Up
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}