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
  recurrence_rule?: string; 
}

interface WorkingGroup {
  id: string;
  groupName: string; 
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

// TippyContentWrapper removed as it might be related to the React 19 ref warning.
// We will use a direct <span> as child of Tippy.

function debounce<F extends (...args: any[]) => void>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };
  return debounced;
}

// Utility function to parse RRULE and create human-readable recurrence description
function parseRecurrenceRule(rrule: string, startTime?: string, endTime?: string): string {
  try {
    // Parse DTSTART and RRULE parts
    const lines = rrule.split('\n');
    const ruleMap: { [key: string]: string } = {};
    
    lines.forEach(line => {
      if (line.startsWith('RRULE:')) {
        const rulePart = line.substring(6); // Remove 'RRULE:'
        const parts = rulePart.split(';');
        parts.forEach(part => {
          const [key, value] = part.split('=');
          if (key && value) {
            ruleMap[key] = value;
          }
        });
      }
    });

    const freq = ruleMap['FREQ'];
    const interval = parseInt(ruleMap['INTERVAL'] || '1', 10);
    const byDay = ruleMap['BYDAY'];
    const count = ruleMap['COUNT'];
    const until = ruleMap['UNTIL'];

    let description = '';
    
    // Format time range if available
    const timeRange = formatTimeRange(startTime, endTime);
    
    // Parse frequency
    if (freq === 'DAILY') {
      if (interval === 1) {
        description = 'Daily';
      } else {
        description = `Every ${interval} days`;
      }
    } else if (freq === 'WEEKLY') {
      if (byDay) {
        const days = parseDays(byDay);
        if (interval === 1) {
          description = `Weekly on ${days}`;
        } else {
          description = `Every ${interval} weeks on ${days}`;
        }
      } else {
        // Use the start day from startTime if no BYDAY specified
        const dayName = startTime ? format(parseISO(startTime), 'EEEE') : '';
        if (interval === 1) {
          description = dayName ? `Weekly on ${dayName}` : 'Weekly';
        } else {
          description = dayName ? `Every ${interval} weeks on ${dayName}` : `Every ${interval} weeks`;
        }
      }
    } else if (freq === 'MONTHLY') {
      if (interval === 1) {
        description = 'Monthly';
      } else {
        description = `Every ${interval} months`;
      }
    } else if (freq === 'YEARLY') {
      if (interval === 1) {
        description = 'Yearly';
      } else {
        description = `Every ${interval} years`;
      }
    } else {
      description = 'Recurring';
    }

    // Add time range if available
    if (timeRange) {
      description += ` ${timeRange}`;
    }

    // Add end condition
    if (count) {
      description += ` (${count} occurrences)`;
    } else if (until) {
      try {
        const endDate = parseISO(until.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/, '$1-$2-$3T$4:$5:$6Z'));
        description += ` (until ${format(endDate, 'MMM d, yyyy')})`;
      } catch {
        // Ignore invalid until date
      }
    }

    return description;
  } catch (error) {
    // Fallback for unparseable rules
    return 'Recurring event';
  }
}

// Helper to parse BYDAY values
function parseDays(byDay: string): string {
  const dayMap: { [key: string]: string } = {
    'MO': 'Monday', 'TU': 'Tuesday', 'WE': 'Wednesday', 'TH': 'Thursday', 
    'FR': 'Friday', 'SA': 'Saturday', 'SU': 'Sunday'
  };
  
  const days = byDay.split(',').map(day => {
    // Remove any numeric prefixes (e.g., "1MO" -> "MO")
    const cleanDay = day.replace(/^-?\d+/, '');
    return dayMap[cleanDay] || cleanDay;
  });
  
  if (days.length === 1) {
    return days[0];
  } else if (days.length === 2) {
    return `${days[0]} and ${days[1]}`;
  } else if (days.length > 2) {
    const lastDay = days.pop();
    return `${days.join(', ')}, and ${lastDay}`;
  }
  
  return 'selected days';
}

// Helper to format time range
function formatTimeRange(startTime?: string, endTime?: string): string {
  try {
    if (!startTime) return '';
    
    const start = parseISO(startTime);
    const startFormatted = format(start, 'h:mm a');
    
    if (endTime) {
      const end = parseISO(endTime);
      const endFormatted = format(end, 'h:mm a');
      return `from ${startFormatted} to ${endFormatted}`;
    }
    
    return `at ${startFormatted}`;
  } catch {
    return '';
  }
}

// Component for recurring event indicator
interface RecurringIndicatorProps {
  recurrenceRule: string;
  startTime?: string;
  endTime?: string;
}

function RecurringIndicator({ recurrenceRule, startTime, endTime }: RecurringIndicatorProps) {
  const description = parseRecurrenceRule(recurrenceRule, startTime, endTime);
  
  return (
    <Tippy 
      content={description}
      placement="top"
      theme="translucent"
    >
      <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 cursor-help">
        <span className="material-icons text-sm">repeat</span>
        <span>Recurring</span>
      </span>
    </Tippy>
  );
}


export default function EventsPage() {
  const { user, idToken, loading: authLoading, userProfile, fetchUserProfile, hasPrivilege, logout } = useAuth();
  const [events, setEvents] = useState<EventWithSignupStatus[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingSignup, setIsProcessingSignup] = useState<string | null>(null); 

  const [statusFilter, setStatusFilter] = useState<string>(EVENT_STATUSES.ALL); 
  const [fromDateFilter, setFromDateFilter] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [daysRangeFilter, setDaysRangeFilter] = useState<string>('14'); 
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentTimeTick, setCurrentTimeTick] = useState(new Date()); 

  const [workingGroupFilter, setWorkingGroupFilter] = useState<string>('all');
  const [availableWorkingGroups, setAvailableWorkingGroups] = useState<WorkingGroup[]>([]);
  const [isLoadingWorkingGroups, setIsLoadingWorkingGroups] = useState(true);

  const canCreateEvents = userProfile && (hasPrivilege ? hasPrivilege('events', 'create') : userProfile.isSysadmin);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTimeTick(new Date()), 60000); 
    return () => clearInterval(timer);
  }, []);

  const fetchAvailableWorkingGroups = useCallback(async () => {
    if (!idToken) return;
    setIsLoadingWorkingGroups(true);
    try {
      const response: ApiResponse<WorkingGroup[]> = await apiClient({
        path: '/working-groups?fields=id,groupName', 
        token: idToken,
        method: 'GET',
      });
      if (response.ok && response.data) {
        setAvailableWorkingGroups(response.data);
      } else {
        console.error("Failed to fetch working groups:", response.error);
      }
    } catch (err) {
      console.error("Error fetching working groups:", err);
    } finally {
      setIsLoadingWorkingGroups(false);
    }
  }, [idToken]);

  useEffect(() => {
    if (idToken) {
      fetchAvailableWorkingGroups();
    }
  }, [idToken, fetchAvailableWorkingGroups]);


  const fetchEvents = useCallback(async () => {
    if (!idToken) { 
        if (!authLoading && !user) { }
        return;
    }

    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== EVENT_STATUSES.ALL) params.append('status', statusFilter);
    if (fromDateFilter) params.append('from_date', fromDateFilter);
    const days = parseInt(daysRangeFilter, 10);
    if (!isNaN(days) && days > 0) {
        params.append('days_range', days.toString());
    }
    if (workingGroupFilter && workingGroupFilter !== 'all') {
      params.append('working_group_id', workingGroupFilter);
    }
    if (searchTerm.trim()) {
      params.append('q', searchTerm.trim());
    }
    
    try {
      const response: ApiResponse<EventWithSignupStatus[]> = await apiClient({
        path: `/events?${params.toString()}`,
        token: idToken,
        method: 'GET',
      });

      if (response.ok && response.data) {
        setEvents(response.data); 
      } else {
        if (response.status === 401) { await logout(); }
        setError(response.error?.message || 'Failed to fetch events.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [idToken, authLoading, statusFilter, fromDateFilter, daysRangeFilter, workingGroupFilter, searchTerm, logout, user]);

  const debouncedFetchEvents = useMemo(() => debounce(fetchEvents, 500), [fetchEvents]);

  useEffect(() => {
    if (!authLoading && !user && !idToken) {
      setIsLoading(false); 
      return;
    }
    if (user && !userProfile && fetchUserProfile) {
      fetchUserProfile();
    }
  
    if (idToken) {
      debouncedFetchEvents();
    }
  }, [idToken, authLoading, user, userProfile, fetchUserProfile, debouncedFetchEvents]); 


  const displayedEvents = useMemo(() => {
    const now = currentTimeTick;
    return events.map(eventInstance => {
      const eventStartDateTime = parseISO(ensureDateString(eventInstance.dateTime));
      const eventEndDateTime = parseISO(ensureDateString(eventInstance.endTime));
      let dynamicStatus = eventInstance.status; 

      if (dynamicStatus === 'open_for_signup' || dynamicStatus === 'draft') {
        if (isBefore(eventStartDateTime, now) && isAfter(eventEndDateTime, now)) {
          dynamicStatus = 'ongoing';
        } else if (isBefore(eventEndDateTime, now)) {
          dynamicStatus = 'completed';
        }
      } else if (dynamicStatus !== 'completed' && dynamicStatus !== 'cancelled' && isBefore(eventEndDateTime, now)) {
        dynamicStatus = 'completed';
      }
      
      const volunteerNames = eventInstance.volunteerNames || (eventInstance.isCurrentUserSignedUp && userProfile?.firstName ? [`${userProfile.firstName} ${userProfile.lastName || ''}`.trim()] : []);
      const currentVolunteerCount = eventInstance.currentVolunteerCount ?? (eventInstance.isCurrentUserSignedUp ? 1 : 0);

      return { ...eventInstance, dynamicStatus, volunteerNames, currentVolunteerCount };
    }).sort((a, b) => {
      const dateA = isValidDate(parseISO(ensureDateString(a.dateTime))) ? parseISO(ensureDateString(a.dateTime)) : new Date(0);
      const dateB = isValidDate(parseISO(ensureDateString(b.dateTime))) ? parseISO(ensureDateString(b.dateTime)) : new Date(0);
      return dateA.getTime() - dateB.getTime();
    });
  }, [events, currentTimeTick, userProfile]);


  const handleSignup = async (eventInstance: EventWithSignupStatus) => {
    if (!idToken || !user) return;
    const processingKey = `${eventInstance.id}-${ensureDateString(eventInstance.dateTime)}`;
    setIsProcessingSignup(processingKey);
    try {
      const response = await apiClient({ 
        path: `/events/${eventInstance.id}/signup`, 
        token: idToken, 
        method: 'POST',
        data: { 
            event_instance_start_date_time: ensureDateString(eventInstance.dateTime),
            event_instance_end_date_time: ensureDateString(eventInstance.endTime)
        }
      });
      if (!response.ok) throw new Error(response.error?.message || 'Failed to sign up');
      fetchEvents(); 
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessingSignup(null);
    }
  };

  const handleWithdraw = async (eventInstance: EventWithSignupStatus) => {
    if (!idToken || !user) return;
    const processingKey = `${eventInstance.id}-${ensureDateString(eventInstance.dateTime)}`;
    setIsProcessingSignup(processingKey);
    try {
      const response = await apiClient({ 
        path: `/events/${eventInstance.id}/signup`, 
        token: idToken, 
        method: 'DELETE',
        data: { 
            event_instance_start_date_time: ensureDateString(eventInstance.dateTime)
        }
      });
      if (!response.ok && response.status !== 204) throw new Error(response.error?.message || 'Failed to withdraw');
      fetchEvents(); 
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessingSignup(null);
    }
  };

  const clearAllFilters = () => {
    setFromDateFilter(format(new Date(), 'yyyy-MM-dd'));
    setDaysRangeFilter('14'); 
    setStatusFilter(EVENT_STATUSES.ALL);
    setWorkingGroupFilter('all');
    setSearchTerm(''); 
  };

  const actionIconWrapperClass = "w-7 h-7 flex items-center justify-center"; 
  const filterInputBaseClass = "mt-1 block w-full pl-2 pr-8 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50 h-9";
  const filterIconButtonClass = "p-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:focus:ring-offset-gray-800 h-9 flex items-center";
  const filterResetButtonClass = "p-1.5 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 dark:border-gray-500 dark:focus:ring-offset-gray-800 h-9 flex items-center";


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

      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg shadow space-y-3"> 
        <div>
          <label htmlFor="search-term" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Search Events</label>
          <input
            type="text"
            id="search-term"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or description ..."
            className={`${filterInputBaseClass} pr-2`} 
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-end"> 
          <div>
            <label htmlFor="status-filter" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Status</label> 
            <select id="status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className={filterInputBaseClass}> 
              {Object.entries(statusDisplayMap).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="working-group-filter" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Working Group</label>
            <select 
              id="working-group-filter" 
              value={workingGroupFilter} 
              onChange={e => setWorkingGroupFilter(e.target.value)}
              disabled={isLoadingWorkingGroups}
              className={filterInputBaseClass}
            >
              <option value="all">All Working Groups</option>
              {availableWorkingGroups.map(wg => (
                <option key={wg.id} value={wg.id}>{wg.groupName}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="from-date-filter" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">From Date</label>
            <input type="date" id="from-date-filter" value={fromDateFilter} onChange={e => setFromDateFilter(e.target.value)}
              className={`${filterInputBaseClass} pr-1`} /> 
          </div>
          <div>
            <label htmlFor="days-range-filter" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Days</label> 
            <input 
              type="number" 
              id="days-range-filter" 
              value={daysRangeFilter} 
              onChange={e => setDaysRangeFilter(e.target.value)} 
              min="1"
              className="mt-1 block w-16 px-1 py-1.5 text-sm text-center border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50 h-9" 
            /> 
          </div>
          <div className="flex space-x-1.5 items-center justify-end pt-4 sm:pt-0"> 
            <button onClick={fetchEvents} 
              disabled={isLoading || isLoadingWorkingGroups} 
              title="Apply Filters"
              className={filterIconButtonClass}> 
              <span className="material-icons text-lg">{isLoading ? 'hourglass_empty' : 'refresh'}</span> 
            </button>
            <button onClick={clearAllFilters}
              title="Reset All Filters"
              className={filterResetButtonClass}> 
                <span className="material-icons text-lg">clear_all</span> 
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
                displayedEvents.map((eventInstance) => {
                  const instanceKey = `${eventInstance.id}-${ensureDateString(eventInstance.dateTime)}`;
                  const processingKeyCompare = `${eventInstance.id}-${ensureDateString(eventInstance.dateTime)}`;

                  const canEdit = userProfile && (hasPrivilege ? hasPrivilege('events', 'edit') : userProfile.isSysadmin);
                  const canSignUp = eventInstance.dynamicStatus === 'open_for_signup' && !eventInstance.isCurrentUserSignedUp;
                  const canWithdraw = eventInstance.isCurrentUserSignedUp && (eventInstance.dynamicStatus === 'open_for_signup' || eventInstance.dynamicStatus === 'ongoing');
                  const displayStatus = eventInstance.dynamicStatus.replace(/_/g, ' ');
                  
                  const eventDate = parseISO(ensureDateString(eventInstance.dateTime)); 
                  const formattedDate = isValidDate(eventDate) ? format(eventDate, 'MMM d, yy') : 'Invalid Date';
                  const formattedTime = isValidDate(eventDate) ? format(eventDate, 'p') : '';
                  
                  const volunteerNamesTooltipContent = eventInstance.volunteerNames && eventInstance.volunteerNames.length > 0 
                    ? eventInstance.volunteerNames.join(', ') 
                    : 'No volunteers signed up yet';

                  const viewLink = `/dashboard/events/${eventInstance.id}?instanceStartDateTime=${encodeURIComponent(ensureDateString(eventInstance.dateTime))}`;
                  const editLink = `/dashboard/events/${eventInstance.id}/edit`;


                  return (
                    <tr key={instanceKey} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-2 py-1 whitespace-nowrap"> 
                        <span className="material-icons text-gray-600 dark:text-gray-300 text-lg" title={eventInstance.icon || 'event'}>{eventInstance.icon || 'event'}</span> 
                      </td>
                      <td className="px-3 py-1 text-sm text-gray-700 dark:text-gray-200 whitespace-normal break-words"> 
                        <div className="flex items-center gap-2">
                          <Link href={viewLink} className="font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
                            {eventInstance.eventName}
                          </Link>
                          {eventInstance.recurrence_rule && (
                            <RecurringIndicator 
                              recurrenceRule={eventInstance.recurrence_rule}
                              startTime={ensureDateString(eventInstance.dateTime)}
                              endTime={ensureDateString(eventInstance.endTime)}
                            />
                          )}
                        </div>
                        {eventInstance.eventType && <div className="text-xs text-gray-500 dark:text-gray-400">{eventInstance.eventType}</div>}
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
                      <td className="px-3 py-1 text-xs sm:text-sm text-gray-500 dark:text-gray-300 whitespace-normal break-words" title={eventInstance.venue || 'N/A'}> 
                        {eventInstance.venue || 'N/A'}
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap"> 
                        <span className={`px-1.5 py-0.5 inline-flex text-xs leading-tight font-semibold rounded-full ${statusColors[eventInstance.dynamicStatus] || statusColors.draft}`}> 
                          {displayStatus}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-xs sm:text-sm text-gray-500 dark:text-gray-300 whitespace-nowrap text-center"> 
                        <Tippy content={volunteerNamesTooltipContent} placement="top" className="tippy-small-font">
                           <span> {/* Direct span child for Tippy */}
                             {eventInstance.currentVolunteerCount ?? 0} / {eventInstance.volunteersRequired ?? 'N/A'}
                           </span>
                        </Tippy>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-sm font-medium"> 
                        <div className="flex items-center justify-end space-x-1">
                          <div className={actionIconWrapperClass}>
                            <Link href={viewLink}
                                  className="text-indigo-500 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-100 p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-gray-700" 
                                  title="View Event Instance Details">
                              <span className="material-icons text-base">visibility</span>
                            </Link>
                          </div>
                          <div className={actionIconWrapperClass}>
                            {canEdit && ( 
                              <Link href={editLink}
                                    className="text-yellow-500 hover:text-yellow-700 dark:text-yellow-300 dark:hover:text-yellow-100 p-0.5 rounded hover:bg-yellow-100 dark:hover:bg-gray-700"
                                    title="Edit Event Series">
                                <span className="material-icons text-base">edit</span>
                              </Link>
                            )}
                          </div>
                          <div className={actionIconWrapperClass}>
                            {canSignUp && (
                              <button onClick={() => handleSignup(eventInstance)} disabled={isProcessingSignup === processingKeyCompare}
                                      className="text-green-500 hover:text-green-700 dark:text-green-300 dark:hover:text-green-100 p-0.5 rounded hover:bg-green-100 dark:hover:bg-gray-700 disabled:opacity-50"
                                      title="Sign Up for this instance">
                                <span className="material-icons text-base">{isProcessingSignup === processingKeyCompare ? 'hourglass_empty' : 'person_add'}</span>
                              </button>
                            )}
                            {canWithdraw && (
                              <button onClick={() => handleWithdraw(eventInstance)} disabled={isProcessingSignup === processingKeyCompare}
                                      className="text-red-800 hover:text-red-800 dark:text-red-800 dark:hover:text-red-800 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-700/50 disabled:opacity-50"
                                      title="Withdraw from this instance">
                                <span className="material-icons text-base">{isProcessingSignup === processingKeyCompare ? 'hourglass_empty' : 'person_remove'}</span>
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
            Displaying {displayedEvents.length} event instances. Consider refining filters for large lists.
        </p>
      )}
    </main>
  );
}