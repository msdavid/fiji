'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';

interface EventFormData {
  eventName: string;
  eventType: string;
  purpose: string;
  description: string;
  dateTime: string; 
  durationMinutes: number;
  location: string; // Field name remains 'location' for backend
  volunteersRequired: number;
  status: string;
  organizerUserId: string | null; 
}

interface UserSearchResult {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
}

const formatDateTimeForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise(resolve => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
}


export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.eventId as string;

  const { user, loading: authLoading, userProfile } = useAuth();
  const [formData, setFormData] = useState<Partial<EventFormData>>({}); 
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [organizerSearchQuery, setOrganizerSearchQuery] = useState('');
  const [organizerSearchResults, setOrganizerSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedOrganizerName, setSelectedOrganizerName] = useState<string | null>(null);
  const [isSearchingOrganizers, setIsSearchingOrganizers] = useState(false);

  const isAdmin = userProfile?.assignedRoleIds?.includes('sysadmin');

  const fetchEventData = useCallback(async () => {
    if (!user || !eventId) return;
    setIsLoadingEvent(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/events/${eventId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 404) throw new Error("Event not found to edit.");
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to fetch event data for editing.");
      }
      const eventData = await response.json();
      const formattedDateTime = eventData.dateTime ? formatDateTimeForInput(new Date(eventData.dateTime)) : '';
      setFormData({ 
        ...eventData, 
        dateTime: formattedDateTime,
        organizerUserId: eventData.organizerUserId || null, 
      });
      
      if (eventData.organizerUserId && eventData.organizerFirstName && eventData.organizerLastName) {
        setSelectedOrganizerName(`${eventData.organizerFirstName} ${eventData.organizerLastName} (${eventData.organizerEmail || 'email missing'})`);
      } else if (eventData.organizerUserId) {
        setSelectedOrganizerName(`UID: ${eventData.organizerUserId}`);
      } else {
        setSelectedOrganizerName(null);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingEvent(false);
    }
  }, [user, eventId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!authLoading && user && !isAdmin) {
        setError("You are not authorized to edit events.");
        return;
    }
    if (user && eventId && isAdmin) {
      fetchEventData();
    }
  }, [user, authLoading, eventId, router, isAdmin, fetchEventData]);


  const fetchUsers = async (query: string): Promise<UserSearchResult[]> => {
    if (!user || query.trim().length < 2) { 
      setOrganizerSearchResults([]);
      return [];
    }
    setIsSearchingOrganizers(true);
    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/users/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error('Failed to search users');
      }
      const results: UserSearchResult[] = await response.json();
      setOrganizerSearchResults(results);
      return results;
    } catch (err) {
      console.error("User search error:", err);
      setOrganizerSearchResults([]);
      return [];
    } finally {
      setIsSearchingOrganizers(false);
    }
  };

  const debouncedUserSearch = useCallback(debounce(fetchUsers, 500), [user]);

  const handleOrganizerSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setOrganizerSearchQuery(query);
    if (query.trim().length === 0) { 
        // setSelectedOrganizerName(null); // Keep selected name until explicitly cleared or new selection
        // setFormData(prev => ({ ...prev, organizerUserId: null }));
    } else if (query.trim().length >= 2) {
        if (formData.organizerUserId || selectedOrganizerName) { // If one is already selected, clear it before new search
            setSelectedOrganizerName(null);
            setFormData(prev => ({ ...prev, organizerUserId: null }));
        }
        debouncedUserSearch(query);
    } else {
        setOrganizerSearchResults([]);
    }
  };

  const handleSelectOrganizer = (organizer: UserSearchResult) => {
    setFormData(prev => ({ ...prev, organizerUserId: organizer.uid }));
    setSelectedOrganizerName(`${organizer.firstName} ${organizer.lastName} (${organizer.email})`);
    setOrganizerSearchQuery(''); 
    setOrganizerSearchResults([]); 
  };

  const handleClearOrganizer = () => {
    setFormData(prev => ({ ...prev, organizerUserId: null }));
    setSelectedOrganizerName(null);
    setOrganizerSearchQuery('');
    setOrganizerSearchResults([]);
  };


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) : value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
        setError("Unauthorized action.");
        return;
    }
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);

    if (!user) {
      setError("Authentication error.");
      setSubmitting(false);
      return;
    }
     if (!formData.dateTime) {
        setError("Date and Time is required.");
        setSubmitting(false);
        return;
    }

    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      
      const { eventName, eventType, purpose, description, dateTime, durationMinutes, location, volunteersRequired, status, organizerUserId } = formData;
      const updatePayload = { 
          eventName, eventType, purpose, description, dateTime, durationMinutes, location, volunteersRequired, status, 
          organizerUserId: organizerUserId || null 
      };

      const response = await fetch(`${backendUrl}/events/${eventId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to update event (status: ${response.status})`);
      }
      
      setSuccessMessage('Event updated successfully!');
      setTimeout(() => {
        router.push(`/dashboard/events/${eventId}`); 
      }, 1500);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };
  
  if (authLoading || isLoadingEvent) return <div className="flex items-center justify-center min-h-screen">Loading event data for editing...</div>;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800">
      <nav className="bg-white dark:bg-gray-900 shadow-sm mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/dashboard" className="flex-shrink-0 text-xl font-bold text-indigo-600 dark:text-indigo-400">
                Fiji Platform
            </Link>
            <Link href={`/dashboard/events/${eventId}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                ← Back to Event Details
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Edit Event</h1>
        
        {successMessage && (
          <div className="mb-4 p-4 text-sm text-green-700 bg-green-100 rounded-lg dark:bg-green-200 dark:text-green-800" role="alert">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800" role="alert">
            {error}
          </div>
        )}
        
        {!isAdmin && !authLoading && !isLoadingEvent && (
             <div className="mb-4 p-4 text-sm text-yellow-700 bg-yellow-100 rounded-lg dark:bg-yellow-200 dark:text-yellow-800" role="alert">
                You are not authorized to edit this event.
             </div>
        )}

        {isAdmin && formData.eventName !== undefined && ( 
          <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-900 p-8 rounded-lg shadow">
            <div>
              <label htmlFor="eventName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event Name</label>
              <input type="text" name="eventName" id="eventName" value={formData.eventName || ''} onChange={handleChange} required 
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label htmlFor="eventType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event Type</label>
              <input type="text" name="eventType" id="eventType" value={formData.eventType || ''} onChange={handleChange} 
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Purpose</label>
              <textarea name="purpose" id="purpose" value={formData.purpose || ''} onChange={handleChange} rows={3}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"></textarea>
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea name="description" id="description" value={formData.description || ''} onChange={handleChange} rows={4}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"></textarea>
            </div>
            <div>
              <label htmlFor="dateTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date & Time</label>
              <input type="datetime-local" name="dateTime" id="dateTime" value={formData.dateTime || ''} onChange={handleChange} required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label htmlFor="durationMinutes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Duration (Minutes)</label>
              <input type="number" name="durationMinutes" id="durationMinutes" value={formData.durationMinutes || 60} onChange={handleChange} min="1" required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Venue</label> {/* Changed Label */}
              <input type="text" name="location" id="location" value={formData.location || ''} onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label htmlFor="volunteersRequired" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Volunteers Required</label>
              <input type="number" name="volunteersRequired" id="volunteersRequired" value={formData.volunteersRequired || 0} onChange={handleChange} min="0" required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
            </div>

            <div className="relative">
                <label htmlFor="organizerSearch" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Event Organizer
                </label>
                {selectedOrganizerName && (
                    <div className="flex items-center justify-between mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700">
                        <span className="text-sm text-gray-700 dark:text-gray-200">{selectedOrganizerName}</span>
                        <button 
                            type="button" 
                            onClick={handleClearOrganizer}
                            className="ml-2 text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                            (Clear)
                        </button>
                    </div>
                )}
                {!selectedOrganizerName && (
                    <input
                        type="text"
                        id="organizerSearch"
                        name="organizerSearch"
                        value={organizerSearchQuery}
                        onChange={handleOrganizerSearchChange}
                        placeholder="Search by name or email to select an organizer..."
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    />
                )}
                {isSearchingOrganizers && <p className="text-xs text-gray-500 dark:text-gray-400">Searching...</p>}
                {organizerSearchResults.length > 0 && (
                <ul className="absolute z-10 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md mt-1 max-h-60 overflow-auto shadow-lg">
                    {organizerSearchResults.map(org => (
                    <li key={org.uid} 
                        onClick={() => handleSelectOrganizer(org)}
                        className="px-3 py-2 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 cursor-pointer text-sm text-gray-900 dark:text-gray-200">
                        {org.firstName} {org.lastName} ({org.email})
                    </li>
                    ))}
                </ul>
                )}
            </div>
            
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <select name="status" id="status" value={formData.status || 'draft'} onChange={handleChange} required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white">
                <option value="draft">Draft</option>
                <option value="open_for_signup">Open for Signup</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <Link href={`/dashboard/events/${eventId}`}>
                  <button type="button" className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                      Cancel
                  </button>
              </Link>
              <button type="submit" disabled={submitting || !isAdmin}
                      className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}