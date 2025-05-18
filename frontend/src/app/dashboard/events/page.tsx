'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react'; 
import Link from 'next/link';
import { useRouter } from 'next/navigation'; 
import { useAuth } from '@/context/AuthContext';
import apiClient, { ApiResponse } from '@/lib/apiClient';
import { format, parseISO, isBefore, isAfter, isEqual, isValid as isValidDate } from 'date-fns'; 

interface EventWithSignupStatus {
  id: string;
  eventName: string;
  eventType?: string;
  description?: string;
  dateTime: string | Date; 
  endTime: string | Date;  
  venue?: string;
  status: string;
  icon?: string;
  isCurrentUserSignedUp?: boolean;
  currentUserAssignmentStatus?: string;
  organizerFirstName?: string;
  organizerLastName?: string;
  organizerEmail?: string;
  createdByUserId: string; 
  creatorFirstName?: string;
  creatorLastName?: string;
  createdAt: string | Date; 
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

const EventCard = ({ event, onSignup, onWithdraw, isProcessingSignup, currentUserId }: { 
  event: EventWithSignupStatus & { displayStatus: string }; 
  onSignup: (eventId: string, eventName: string) => Promise<void>;
  onWithdraw: (eventId: string, eventName: string) => Promise<void>;
  isProcessingSignup: string | null; 
  currentUserId: string | null;
}) => {
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

  const isActionForThisEventInProgress = isProcessingSignup === event.id;
  const isEventOverOrCancelled = event.displayStatus === EVENT_STATUSES.COMPLETED || event.displayStatus === EVENT_STATUSES.CANCELLED || event.displayStatus === EVENT_STATUSES.ONGOING;

  const ensureDateString = (dateInput: string | Date | undefined | null): string | null => {
    if (!dateInput) return null;
    if (typeof dateInput === 'string') return dateInput;
    if (dateInput instanceof Date) return dateInput.toISOString();
    return null;
  };

  const dateTimeString = ensureDateString(event.dateTime);
  const createdAtString = ensureDateString(event.createdAt);

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
              {dateTimeString && isValidDate(parseISO(dateTimeString)) && (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Date: {format(parseISO(dateTimeString), 'PP p')}
                </p>
              )}
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
              By: {event.creatorFirstName || ''} {event.creatorLastName || event.createdByUserId?.substring(0,8) || 'N/A'}
            </p>
            {createdAtString && isValidDate(parseISO(createdAtString)) && (
                 <p className="text-xs text-gray-500 dark:text-gray-500">
                    On: {format(parseISO(createdAtString), 'PP')}
                 </p>
            )}
          </div>
          <div className="flex flex-col items-end space-y-2">
            {currentUserId && (
                <>
                {event.isCurrentUserSignedUp ? (
                    <>
                    <p className="text-xs font-medium text-green-600 dark:text-green-400 capitalize">
                        Status: {event.currentUserAssignmentStatus?.replace(/_/g, ' ') || 'Signed Up'}
                    </p>
                    <button
                        onClick={(e) => { e.stopPropagation(); onWithdraw(event.id, event.eventName); }}
                        disabled={isActionForThisEventInProgress || isEventOverOrCancelled}
                        className={`py-1.5 px-3 text-xs font-medium rounded-md shadow-sm inline-flex items-center transition-colors duration-150
                                    ${isActionForThisEventInProgress || isEventOverOrCancelled
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
                    onClick={(e) => { e.stopPropagation(); onSignup(event.id, event.eventName); }}
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
                </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


export default function EventsPage() {
  const { user, idToken, loading: authLoading, userProfile, fetchUserProfile, hasPrivilege, logout } = useAuth();
  const [events, setEvents] = useState<EventWithSignupStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null); 
  const [isProcessingSignup, setIsProcessingSignup] = useState<string | null>(null); 

  const [statusFilter, setStatusFilter] = useState<string>(EVENT_STATUSES.ALL); 
  // Default fromDateFilter to today's date in YYYY-MM-DD format
  const [fromDateFilter, setFromDateFilter] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [daysRangeFilter, setDaysRangeFilter] = useState<string>('14'); 
  const [currentTimeTick, setCurrentTimeTick] = useState(new Date()); 

  const canCreateEvents = userProfile && (hasPrivilege ? hasPrivilege('events', 'create') : userProfile.isSysadmin);

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTimeTick(new Date());
    }, 60000); 
    return () => clearInterval(timerId);
  }, []);

  const fetchEvents = useCallback(async () => {
    if (!idToken) {
      if (!authLoading) setIsLoading(false); 
      return;
    }
    setIsLoading(true); setError(null); setSignupError(null);

    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== EVENT_STATUSES.ALL) params.append('status', statusFilter);
    if (fromDateFilter) params.append('from_date', fromDateFilter);
    // Only send days_range if it's a valid positive number
    const days = parseInt(daysRangeFilter, 10);
    if (!isNaN(days) && days > 0) {
        params.append('days_range', days.toString());
    }
    
    const pathWithParams = `/events?${params.toString()}`;

    const result: ApiResponse<EventWithSignupStatus[]> = await apiClient({
      path: pathWithParams,
      token: idToken,
      method: 'GET',
    });

    setIsLoading(false);
    if (result.ok && result.data) {
      setEvents(result.data);
    } else {
      console.error("Fetch events error:", result.error);
      if (result.status === 401) { await logout(); return; }
      setError(result.error?.message || 'Failed to fetch events.');
    }
  }, [idToken, authLoading, statusFilter, fromDateFilter, daysRangeFilter, logout]);

  useEffect(() => {
    if (!authLoading && !user) { /* router.push('/login'); Handled by layout */ }
    if (user && !userProfile && fetchUserProfile) fetchUserProfile();
    if (idToken) { 
        fetchEvents();
    }
  }, [user, authLoading, userProfile, fetchUserProfile, idToken, statusFilter, fromDateFilter, daysRangeFilter, fetchEvents]);

  const displayedEvents = useMemo(() => {
    const now = currentTimeTick;
    const ensureDateStringInner = (dateInput: string | Date | undefined | null): string | null => {
        if (!dateInput) return null;
        if (typeof dateInput === 'string') return dateInput;
        if (dateInput instanceof Date) return dateInput.toISOString();
        return null;
    };

    return events.map(event => {
      let dynamicStatus = event.status;
      const originalStatus = event.status;
      if (originalStatus !== EVENT_STATUSES.COMPLETED && originalStatus !== EVENT_STATUSES.CANCELLED) {
        try {
          const startTimeString = ensureDateStringInner(event.dateTime);
          const endTimeString = ensureDateStringInner(event.endTime);

          if (startTimeString && isValidDate(parseISO(startTimeString))) {
            const eventStart = parseISO(startTimeString);
            const eventEnd = endTimeString && isValidDate(parseISO(endTimeString)) ? parseISO(endTimeString) : null;
            
            const isStarted = isAfter(now, eventStart) || isEqual(now, eventStart);
            const isNotEnded = !eventEnd || isBefore(now, eventEnd); 
            if (isStarted && isNotEnded) dynamicStatus = EVENT_STATUSES.ONGOING;
          }
        } catch (e) { console.error("Error parsing event dates for dynamic status:", event.id, e); }
      }
      return { ...event, displayStatus: dynamicStatus };
    });
  }, [events, currentTimeTick]);


  const handleSignup = async (eventId: string, eventName: string) => { 
    if (!idToken) { setSignupError("Authentication required."); return; }
    setIsProcessingSignup(eventId); setSignupError(null);
    
    const result = await apiClient({
      path: `/events/${eventId}/signup`,
      token: idToken,
      method: 'POST',
    });

    setIsProcessingSignup(null);
    if (result.ok) {
      fetchEvents(); 
    } else {
      console.error("Signup error:", result.error);
      if (result.status === 401) { await logout(); return; }
      const message = result.error?.message || `Failed to sign up for ${eventName}.`;
      setSignupError(message);
    }
  };

  const handleWithdraw = async (eventId: string, eventName: string) => { 
    if (!idToken) { setSignupError("Authentication required."); return; }
    setIsProcessingSignup(eventId); setSignupError(null);

    const result = await apiClient({
      path: `/events/${eventId}/signup`, 
      token: idToken,
      method: 'DELETE',
    });
    
    setIsProcessingSignup(null);
    if (result.ok) {
      fetchEvents(); 
    } else {
      console.error("Withdraw error:", result.error);
      if (result.status === 401) { await logout(); return; }
      const message = result.error?.message || `Failed to withdraw from ${eventName}.`;
      setSignupError(message);
    }
  };

  const clearDateAndDaysFilters = () => {
    setFromDateFilter(format(new Date(), 'yyyy-MM-dd')); // Reset From Date to today
    setDaysRangeFilter('14'); // Reset Days Range to default
  };


  if (authLoading || (isLoading && !userProfile)) { 
    return (
        <div className="flex flex-col justify-center items-center h-full min-h-[300px]">
            <span className="material-icons text-6xl text-indigo-500 dark:text-indigo-400 animate-spin mb-4">sync</span>
            <p className="text-lg text-gray-700 dark:text-gray-300">Loading events...</p>
        </div>
    );
  }
  
  return (
    <main className="max-w-7xl mx-auto"> 
      <div className="flex justify-between items-center mb-6 pt-8"> 
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Events</h1>
        {canCreateEvents && (
          <Link href="/dashboard/events/new">
            <button className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm inline-flex items-center">
              <span className="material-icons text-lg mr-2">add_circle_outline</span>
              Create New Event
            </button>
          </Link>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
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
        <div>
          <label htmlFor="from-date-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Date</label>
          <input 
            type="date"
            id="from-date-filter"
            value={fromDateFilter}
            onChange={(e) => setFromDateFilter(e.target.value)}
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="days-range-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Days Range</label>
          <input 
            type="number"
            id="days-range-filter"
            value={daysRangeFilter}
            onChange={(e) => setDaysRangeFilter(e.target.value)}
            min="1"
            max="90" 
            placeholder="e.g., 14"
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex-shrink-0"> 
            <button 
                onClick={clearDateAndDaysFilters}
                title="Clear date and days range filters"
                className="w-full sm:w-auto py-3 px-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-md shadow-sm text-sm inline-flex items-center justify-center"
            >
                <span className="material-icons text-base">event_busy</span>
            </button>
        </div>
      </div>

      {signupError && (
        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center" role="alert">
            <span className="material-icons text-lg mr-2">error_outline</span>
            {signupError}
        </div>
      )}

      {isLoading ? ( 
        <div className="flex flex-col justify-center items-center h-full min-h-[300px]">
            <span className="material-icons text-6xl text-indigo-500 dark:text-indigo-400 animate-spin mb-4">sync</span>
            <p className="text-lg text-gray-700 dark:text-gray-300">Loading events...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-md shadow text-center">
            <p className="text-red-700 dark:text-red-300">Error: {error}</p>
            <button 
                onClick={fetchEvents} 
                className="mt-4 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
            >
                <span className="material-icons mr-2 text-base">refresh</span>
                Retry
            </button>
        </div>
      ) : displayedEvents.length === 0 ? ( 
        <div className="text-center py-10 bg-white dark:bg-gray-900 shadow-lg rounded-lg flex flex-col items-center justify-center min-h-[200px]">
          <span className="material-icons text-6xl text-gray-400 dark:text-gray-500 mb-4">event_busy</span>
          <p className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">
            {statusFilter !== EVENT_STATUSES.ALL || fromDateFilter !== format(new Date(), 'yyyy-MM-dd') || (daysRangeFilter && daysRangeFilter !== '14') ? 'No events match your criteria.' : 'No events found.'}
          </p>
          {canCreateEvents && statusFilter === EVENT_STATUSES.ALL && fromDateFilter === format(new Date(), 'yyyy-MM-dd') && (!daysRangeFilter || daysRangeFilter === '14') && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                  You can <Link href="/dashboard/events/new" className="text-indigo-600 hover:underline dark:text-indigo-400 font-medium">create one now</Link>.
              </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedEvents.map(event => ( 
            <EventCard 
              key={event.id} 
              event={event} 
              onSignup={handleSignup}
              onWithdraw={handleWithdraw}
              isProcessingSignup={isProcessingSignup}
              currentUserId={user?.uid || null}
            />
          ))}
        </div>
      )}
    </main>
  );
}