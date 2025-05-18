'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; 
import { useAuth } from '@/context/AuthContext';
import apiClient, { ApiResponse } from '@/lib/apiClient';
import { format, parseISO, isValid as isValidDate } from 'date-fns';

interface EventWithSignupStatus {
  id: string;
  eventName: string;
  eventType?: string;
  description?: string;
  dateTime: string; // ISO string
  endTime: string;  // ISO string
  venue?: string;
  status: string;
  icon?: string;
  isCurrentUserSignedUp?: boolean;
  currentUserAssignmentStatus?: string;
  organizerFirstName?: string;
  organizerLastName?: string;
  organizerEmail?: string;
  creatorFirstName?: string;
  creatorLastName?: string;
}

const EventCard = ({ event, onSignup, onWithdraw, isProcessingSignup, currentUserId }: { 
  event: EventWithSignupStatus; 
  onSignup: (eventId: string) => Promise<void>;
  onWithdraw: (eventId: string) => Promise<void>;
  isProcessingSignup: string | null; 
  currentUserId: string | null;
}) => {
  const { hasPrivilege, userProfile } = useAuth();
  // const canEditEvent = userProfile && (hasPrivilege ? hasPrivilege('events', 'edit') : userProfile.isSysadmin); // Not used in this card version

  const isEventOver = new Date(event.endTime) < new Date();
  const canSignup = event.status === 'open_for_signup' && !isEventOver;

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden hover:shadow-2xl transition-shadow duration-300 flex flex-col">
      <div className="p-5 sm:p-6 flex-grow">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg sm:text-xl font-semibold text-indigo-700 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">
            <Link href={`/dashboard/events/${event.id}`}>{event.eventName}</Link>
          </h3>
          {event.icon && <span className="material-icons text-indigo-500 dark:text-indigo-400 ml-2">{event.icon}</span>}
        </div>
        {event.eventType && (
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{event.eventType}</p>
        )}
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
          <span className="font-semibold">Date:</span> {format(parseISO(event.dateTime), 'EEE, MMM d, yyyy')}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
          <span className="font-semibold">Time:</span> {format(parseISO(event.dateTime), 'h:mm a')} - {format(parseISO(event.endTime), 'h:mm a')}
        </p>
        {event.venue && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            <span className="font-semibold">Venue:</span> {event.venue}
          </p>
        )}
        <p className={`text-xs px-2 py-0.5 inline-block rounded-full font-semibold mb-4
          ${event.status === 'open_for_signup' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' :
            event.status === 'completed' || event.status === 'cancelled' ? 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200' :
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100'}`}>
          {event.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </p>
        {event.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{event.description}</p>
        )}
      </div>
      <div className="px-5 sm:px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
        <Link href={`/dashboard/events/${event.id}`} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
          View Details
        </Link>
        {currentUserId && (
          <>
            {event.isCurrentUserSignedUp ? (
              <button
                onClick={() => onWithdraw(event.id)}
                disabled={isProcessingSignup === event.id || isEventOver}
                className="py-1.5 px-3 text-xs font-medium rounded-md shadow-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 inline-flex items-center"
              >
                {isProcessingSignup === event.id ? <span className="material-icons animate-spin text-sm mr-1">sync</span> : <span className="material-icons text-sm mr-1">event_busy</span>}
                Withdraw
              </button>
            ) : canSignup ? (
              <button
                onClick={() => onSignup(event.id)}
                disabled={isProcessingSignup === event.id}
                className="py-1.5 px-3 text-xs font-medium rounded-md shadow-sm text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 inline-flex items-center"
              >
                 {isProcessingSignup === event.id ? <span className="material-icons animate-spin text-sm mr-1">sync</span> : <span className="material-icons text-sm mr-1">event_available</span>}
                Sign Up
              </button>
            ) : null}
          </>
        )}
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

  const [statusFilter, setStatusFilter] = useState<string>(''); 
  const [fromDateFilter, setFromDateFilter] = useState<string>('');
  const [toDateFilter, setToDateFilter] = useState<string>('');


  const canCreateEvents = userProfile && (hasPrivilege ? hasPrivilege('events', 'create') : userProfile.isSysadmin);

  const fetchEvents = useCallback(async () => {
    if (!idToken) {
      if (!authLoading) setIsLoading(false); 
      return;
    }
    setIsLoading(true); setError(null); setSignupError(null);

    const params = new URLSearchParams();
    if (statusFilter) params.append('status', statusFilter);
    if (fromDateFilter) params.append('from_date', fromDateFilter);
    if (toDateFilter) params.append('to_date', toDateFilter);
    
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
  }, [idToken, authLoading, statusFilter, fromDateFilter, toDateFilter, logout]);

  useEffect(() => {
    if (!authLoading && !user) { /* router.push('/login'); Handled by layout */ }
    if (user && !userProfile && fetchUserProfile) fetchUserProfile();
    if (idToken) { 
        fetchEvents();
    }
  }, [user, authLoading, userProfile, fetchUserProfile, idToken, statusFilter, fromDateFilter, toDateFilter, fetchEvents]);


  const handleSignup = async (eventId: string) => {
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
      setSignupError(result.error?.message || 'Failed to sign up for the event.');
    }
  };

  const handleWithdraw = async (eventId: string) => {
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
      setSignupError(result.error?.message || 'Failed to withdraw from the event.');
    }
  };

  const clearDateFilters = () => {
    setFromDateFilter('');
    setToDateFilter('');
  };


  if (authLoading && !userProfile) {
    return <div className="text-center py-10"><span className="material-icons animate-spin text-2xl text-indigo-500">sync</span><p className="mt-2">Loading user data...</p></div>;
  }
  
  return (
    <main className="max-w-7xl mx-auto">
      <header className="mb-8 pt-8 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Events</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Browse and sign up for upcoming events.</p>
        </div>
        {canCreateEvents && (
          <Link 
            href="/dashboard/events/new" 
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
          >
            <span className="material-icons mr-2 text-base">add_circle_outline</span>
            Create New Event
          </Link>
        )}
      </header>

      {/* Filters Section - Restored to a simpler flex layout */}
      <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4 sm:items-end">
            <div className="flex-1 min-w-0"> {/* Allow status to take more space if needed */}
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <select 
                id="status-filter" 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 block w-full p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="open_for_signup">Open for Signup</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="min-w-[150px]"> {/* Fixed width for date inputs */}
              <label htmlFor="from-date-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300">From Date</label>
              <input 
                type="date"
                id="from-date-filter"
                value={fromDateFilter}
                onChange={(e) => setFromDateFilter(e.target.value)}
                className="mt-1 block w-full p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>
            <div className="min-w-[150px]"> {/* Fixed width for date inputs */}
              <label htmlFor="to-date-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300">To Date</label>
              <input 
                type="date"
                id="to-date-filter"
                value={toDateFilter}
                onChange={(e) => setToDateFilter(e.target.value)}
                className="mt-1 block w-full p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>
            <div className="flex-shrink-0"> 
                <button 
                    onClick={clearDateFilters}
                    title="Clear date filters"
                    className="py-2 px-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium rounded-md shadow-sm text-sm inline-flex items-center"
                >
                    <span className="material-icons text-base">event_busy</span>
                </button>
            </div>
        </div>
      </div>

      {signupError && (
        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center" role="alert">
            <span className="material-icons text-lg mr-2">error_outline</span>
            {signupError}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-10"><span className="material-icons animate-spin text-2xl text-indigo-500">sync</span><p className="mt-2">Loading events...</p></div>
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
      ) : events.length === 0 ? (
        <div className="text-center py-10 bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
          <span className="material-icons text-5xl text-gray-400 dark:text-gray-500 mb-4">event_busy</span>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No Events Found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            There are no events matching your current filters, or no events have been created yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(event => (
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