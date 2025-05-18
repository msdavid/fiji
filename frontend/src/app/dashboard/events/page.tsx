"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react'; 
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient, { ApiResponse } from '@/lib/apiClient';
import { format, parseISO, isBefore, isAfter, isEqual, isValid as isValidDate } from 'date-fns'; 
import Tippy from '@tippyjs/react'; 

// Interface for the event data
interface EventWithSignupStatus {
  id: string;
  eventName: string;
  eventType?: string;
  description?: string;
  dateTime: string | Date; 
  endTime: string | Date;
  venue?: string;
  volunteersRequired?: number;
  status: string; 
  organizerUserId?: string;
  organizerFirstName?: string;
  organizerLastName?: string;
  icon?: string;
  isCurrentUserSignedUp?: boolean;
  currentUserAssignmentStatus?: string;
  createdByUserId?: string;
  creatorFirstName?: string;
  creatorLastName?: string;
  createdAt: string | Date; 
  workingGroupId?: string; 
  workingGroupIds?: string[]; 
  workingGroupNames?: string[]; 
  currentVolunteerCount?: number; 
  volunteerNames?: string[]; 
}

const EVENT_STATUSES = {
  ALL: 'all',
  DRAFT: 'draft',
  OPEN_FOR_SIGNUP: 'open_for_signup',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const statusDisplayMap: { [key: string]: string } = {
  all: 'All Statuses',
  draft: 'Draft',
  open_for_signup: 'Open for Signup',
  ongoing: 'Ongoing',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const statusColors: { [key: string]: string } = {
  draft: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  open_for_signup: 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100', 
  ongoing: 'bg-teal-100 text-teal-800 dark:bg-teal-700 dark:text-teal-100',
  completed: 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100',
  full: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100', 
};


const ensureDateString = (date: string | Date): string => {
  if (date instanceof Date) {
    return date.toISOString();
  }
  return date;
};

// Wrapper component for Tippy's child to correctly handle refs in React 19+
const TippyContentWrapper = React.forwardRef<HTMLSpanElement, { children: React.ReactNode }>(
  ({ children }, ref) => {
    return <span ref={ref}>{children}</span>;
  }
);
TippyContentWrapper.displayName = 'TippyContentWrapper';


export default function EventsPage() {
  const { user, idToken, loading: authLoading, userProfile, fetchUserProfile, hasPrivilege, logout } = useAuth();
  const [events, setEvents] = useState<EventWithSignupStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingSignup, setIsProcessingSignup] = useState<string | null>(null); 

  const [statusFilter, setStatusFilter] = useState<string>(EVENT_STATUSES.ALL); 
  const [fromDateFilter, setFromDateFilter] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [daysRangeFilter, setDaysRangeFilter] = useState<string>('14'); 
  const [currentTimeTick, setCurrentTimeTick] = useState(new Date()); 

  const canCreateEvents = userProfile && (hasPrivilege ? hasPrivilege('events', 'create') : userProfile.isSysadmin);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTimeTick(new Date()), 60000); 
    return () => clearInterval(timer);
  }, []);

  const fetchEvents = useCallback(async () => {
    if (!idToken && !authLoading) { 
        if (!authLoading && !user) { return; }
        setError("Authentication token not available. Please try logging in again.");
        setIsLoading(false);
        return;
    }
    if (!idToken && authLoading) { 
        return;
    }
    if (!idToken) return; 

    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== EVENT_STATUSES.ALL) params.append('status', statusFilter);
    if (fromDateFilter) params.append('from_date', fromDateFilter);
    const days = parseInt(daysRangeFilter, 10);
    if (!isNaN(days) && days > 0) {
        params.append('days_range', days.toString());
    }
    
    try {
      const response: ApiResponse<EventWithSignupStatus[]> = await apiClient({
        path: `/events?${params.toString()}`,
        token: idToken,
        method: 'GET',
      });

      if (response.ok && response.data) {
        const eventsWithMockedNames = response.data.map(event => {
          let mockNames: string[] = [];
          const actualVolunteerCount = event.isCurrentUserSignedUp ? 1 : 0; 
          if (actualVolunteerCount > 0) {
            mockNames = event.isCurrentUserSignedUp && userProfile?.firstName 
              ? [`${userProfile.firstName} ${userProfile.lastName || ''}`.trim()] 
              : ['Demo User 1'];
            if (actualVolunteerCount > 1) mockNames.push('Demo User 2'); 
          }
          return { 
            ...event, 
            currentVolunteerCount: actualVolunteerCount, 
            volunteerNames: mockNames 
          };
        });
        setEvents(eventsWithMockedNames);
      } else {
        if (response.status === 401) { await logout(); }
        setError(response.error?.message || 'Failed to fetch events.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [idToken, authLoading, statusFilter, fromDateFilter, daysRangeFilter, logout, user, userProfile]);

  useEffect(() => {
    if (!authLoading && !user) { }
    if (user && !userProfile && fetchUserProfile) fetchUserProfile();
    if (idToken) { 
        fetchEvents();
    }
  }, [user, authLoading, userProfile, fetchUserProfile, idToken, fetchEvents]);

  const displayedEvents = useMemo(() => {
    const now = currentTimeTick;
    return events.map(event => {
      const eventStartDateTime = parseISO(ensureDateString(event.dateTime));
      const eventEndDateTime = parseISO(ensureDateString(event.endTime));
      let dynamicStatus = event.status;

      if (event.status === 'open_for_signup' && isBefore(eventStartDateTime, now) && isAfter(eventEndDateTime, now)) {
        dynamicStatus = 'ongoing';
      } else if (event.status === 'open_for_signup' && isBefore(eventStartDateTime, now) && isBefore(eventEndDateTime, now)) {
         dynamicStatus = 'completed'; 
      } else if (event.status === 'draft' && isBefore(eventStartDateTime, now) && isAfter(eventEndDateTime, now)) {
        dynamicStatus = 'ongoing'; 
      } else if (event.status !== 'completed' && event.status !== 'cancelled' && isBefore(eventEndDateTime, now)) {
        dynamicStatus = 'completed'; 
      }
      
      return { ...event, dynamicStatus };
    }).sort((a, b) => {
      const dateA = isValidDate(parseISO(ensureDateString(a.dateTime))) ? parseISO(ensureDateString(a.dateTime)) : new Date(0);
      const dateB = isValidDate(parseISO(ensureDateString(b.dateTime))) ? parseISO(ensureDateString(b.dateTime)) : new Date(0);
      return dateA.getTime() - dateB.getTime();
    });
  }, [events, currentTimeTick]);


  const handleSignup = async (eventId: string) => {
    if (!idToken || !user) return;
    setIsProcessingSignup(eventId);
    try {
      const response = await apiClient({ path: `/events/${eventId}/signup`, token: idToken, method: 'POST' });
      if (!response.ok) throw new Error(response.error?.message || 'Failed to sign up');
      fetchEvents(); 
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessingSignup(null);
    }
  };

  const handleWithdraw = async (eventId: string) => {
    if (!idToken || !user) return;
    setIsProcessingSignup(eventId);
    try {
      const response = await apiClient({ path: `/events/${eventId}/signup`, token: idToken, method: 'DELETE' });
      if (!response.ok && response.status !== 204) throw new Error(response.error?.message || 'Failed to withdraw');
      fetchEvents(); 
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessingSignup(null);
    }
  };

  const clearDateAndDaysFilters = () => {
    setFromDateFilter(format(new Date(), 'yyyy-MM-dd'));
    setDaysRangeFilter('14'); 
  };

  const actionIconWrapperClass = "w-7 h-7 flex items-center justify-center"; 

  return (
    <main className="max-w-7xl mx-auto py-6 px-2 sm:px-4 lg:px-6"> 
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3"> 
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Events</h1>
        {canCreateEvents && (
          <Link href="/dashboard/events/new"
            className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"> 
            <span className="material-icons mr-1.5 text-lg">add_circle_outline</span> 
            Create New Event
          </Link>
        )}
      </div>

      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg shadow"> 
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"> 
          <div>
            <label htmlFor="status-filter" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Status</label> 
            <select id="status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="mt-1 block w-full pl-2 pr-8 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"> 
              {Object.entries(statusDisplayMap).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="from-date-filter" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">From Date</label>
            <input type="date" id="from-date-filter" value={fromDateFilter} onChange={e => setFromDateFilter(e.target.value)}
              className="mt-1 block w-full pl-2 pr-1 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" /> 
          </div>
          <div>
            <label htmlFor="days-range-filter" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Date Range</label> 
            <input type="number" id="days-range-filter" value={daysRangeFilter} onChange={e => setDaysRangeFilter(e.target.value)} min="1"
              className="mt-1 block w-full pl-2 pr-1 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" /> 
          </div>
          <div className="flex space-x-1.5"> 
            <button onClick={fetchEvents} disabled={isLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:focus:ring-offset-gray-800"> 
              <span className="material-icons mr-1 text-base sm:text-lg">{isLoading ? 'hourglass_empty' : 'refresh'}</span> 
              {isLoading ? 'Loading...' : 'Apply'} 
            </button>
            <button onClick={clearDateAndDaysFilters}
              className="w-full sm:w-auto mt-1.5 sm:mt-0 inline-flex items-center justify-center px-3 py-1.5 border border-gray-300 text-xs sm:text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 dark:border-gray-500 dark:focus:ring-offset-gray-800"> 
                <span className="material-icons mr-1 text-base sm:text-lg">clear_all</span> 
              Reset
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 text-xs sm:text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-200" role="alert"> 
          <span className="font-medium">Error:</span> {error}
        </div>
      )}

      <div className="shadow overflow-hidden border-b border-gray-200 dark:border-gray-700 sm:rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed"> 
            <colgroup> 
              <col style={{ width: '5%' }} />  
              <col style={{ width: '25%' }} /> 
              <col style={{ width: '15%' }} /> 
              <col style={{ width: '30%' }} /> 
              <col style={{ width: '10%' }} /> 
              <col style={{ width: '10%' }} /> 
              <col style={{ width: '5%' }} />  
            </colgroup>
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Icon</th> 
                <th scope="col" className="px-3 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Event Name</th> 
                <th scope="col" className="px-3 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date & Time</th> 
                <th scope="col" className="px-3 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Venue</th> 
                <th scope="col" className="px-3 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th> 
                <th scope="col" className="px-2 py-1 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Volunteers</th> 
                <th scope="col" className="px-3 py-1 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th> 
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading && !displayedEvents.length ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400"> 
                    Loading events...
                  </td>
                </tr>
              ) : !displayedEvents.length ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400"> 
                    No events found matching your criteria.
                  </td>
                </tr>
              ) : (
                displayedEvents.map((event) => {
                  const canEdit = userProfile && (hasPrivilege ? hasPrivilege('events', 'edit') : userProfile.isSysadmin);
                  const canSignUp = event.dynamicStatus === 'open_for_signup' && !event.isCurrentUserSignedUp;
                  const canWithdraw = event.isCurrentUserSignedUp && (event.dynamicStatus === 'open_for_signup' || event.dynamicStatus === 'ongoing');
                  const displayStatus = event.dynamicStatus.replace(/_/g, ' ');
                  
                  const eventDate = parseISO(ensureDateString(event.dateTime));
                  const formattedDate = isValidDate(eventDate) ? format(eventDate, 'MMM d, yy') : 'Invalid Date';
                  const formattedTime = isValidDate(eventDate) ? format(eventDate, 'p') : '';
                  
                  const volunteerNamesTooltipContent = event.volunteerNames && event.volunteerNames.length > 0 
                    ? event.volunteerNames.join(', ') 
                    : 'No volunteers signed up yet';

                  return (
                    <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-2 py-1 whitespace-nowrap"> 
                        <span className="material-icons text-gray-600 dark:text-gray-300 text-lg" title={event.icon || 'event'}>{event.icon || 'event'}</span> 
                      </td>
                      <td className="px-3 py-1 text-sm text-gray-700 dark:text-gray-200 whitespace-normal break-words"> 
                        <Link href={`/dashboard/events/${event.id}`} className="font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
                          {event.eventName}
                        </Link>
                        {event.eventType && <div className="text-xs text-gray-500 dark:text-gray-400">{event.eventType}</div>}
                      </td>
                      <td className="px-3 py-1 text-xs sm:text-sm text-gray-500 dark:text-gray-300 whitespace-normal"> 
                        {formattedDate !== 'Invalid Date' ? (
                          <>
                            <div>{formattedDate}</div>
                            <div className="text-gray-400 dark:text-gray-500">{formattedTime}</div>
                          </>
                        ) : (
                          'Invalid Date'
                        )}
                      </td>
                      <td className="px-3 py-1 text-xs sm:text-sm text-gray-500 dark:text-gray-300 whitespace-normal break-words" title={event.venue || 'N/A'}> 
                        {event.venue || 'N/A'}
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap"> 
                        <span className={`px-1.5 py-0.5 inline-flex text-xs leading-tight font-semibold rounded-full ${statusColors[event.dynamicStatus] || statusColors.draft}`}> 
                          {displayStatus}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-xs sm:text-sm text-gray-500 dark:text-gray-300 whitespace-nowrap text-center"> 
                        <Tippy content={volunteerNamesTooltipContent} placement="top" className="tippy-small-font">
                           <TippyContentWrapper>
                             {event.currentVolunteerCount ?? 0} / {event.volunteersRequired ?? 'N/A'}
                           </TippyContentWrapper>
                        </Tippy>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-sm font-medium"> 
                        <div className="flex items-center justify-end space-x-1">
                          <div className={actionIconWrapperClass}>
                            <Link href={`/dashboard/events/${event.id}`}
                                  className="text-indigo-500 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-100 p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-gray-700" 
                                  title="View Details">
                              <span className="material-icons text-base">visibility</span>
                            </Link>
                          </div>
                          <div className={actionIconWrapperClass}>
                            {canEdit && (
                              <Link href={`/dashboard/events/${event.id}/edit`}
                                    className="text-yellow-500 hover:text-yellow-700 dark:text-yellow-300 dark:hover:text-yellow-100 p-0.5 rounded hover:bg-yellow-100 dark:hover:bg-gray-700"
                                    title="Edit Event">
                                <span className="material-icons text-base">edit</span>
                              </Link>
                            )}
                          </div>
                          <div className={actionIconWrapperClass}>
                            {canSignUp && (
                              <button onClick={() => handleSignup(event.id)} disabled={isProcessingSignup === event.id}
                                      className="text-green-500 hover:text-green-700 dark:text-green-300 dark:hover:text-green-100 p-0.5 rounded hover:bg-green-100 dark:hover:bg-gray-700 disabled:opacity-50"
                                      title="Sign Up">
                                <span className="material-icons text-base">{isProcessingSignup === event.id ? 'hourglass_empty' : 'person_add'}</span>
                              </button>
                            )}
                            {canWithdraw && (
                              <button onClick={() => handleWithdraw(event.id)} disabled={isProcessingSignup === event.id}
                                      className="text-red-800 hover:text-red-800 dark:text-red-800 dark:hover:text-red-800 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-700/50 disabled:opacity-50"
                                      title="Withdraw Signup">
                                <span className="material-icons text-base">{isProcessingSignup === event.id ? 'hourglass_empty' : 'person_remove'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {(!isLoading && displayedEvents.length > 10) && (
         <p className="mt-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400"> 
            Displaying {displayedEvents.length} events. Consider refining filters for large lists.
        </p>
      )}
    </main>
  );
}