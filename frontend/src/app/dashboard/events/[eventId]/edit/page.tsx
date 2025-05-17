'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface EventFormData {
  eventName: string;
  eventType: string;
  purpose: string;
  description: string;
  dateTime: string; // Represents Start Date & Time
  endTime: string;  // New field for End Date & Time
  location: string; 
  volunteersRequired: number;
  status: string;
  organizerUserId: string | null; 
}

interface UserSearchResult {
  id: string; // Changed from uid to id
  firstName: string;
  lastName: string;
  email: string;
}

const formatDateTimeForInput = (dateString: string | Date): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
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

  const { user, loading: authLoading, userProfile, hasPrivilege } = useAuth(); 
  const [formData, setFormData] = useState<Partial<EventFormData>>({}); 
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false); 
  const [deleting, setDeleting] = useState(false); 

  const [organizerSearchQuery, setOrganizerSearchQuery] = useState('');
  const [organizerSearchResults, setOrganizerSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedOrganizerName, setSelectedOrganizerName] = useState<string | null>(null);
  const [isSearchingOrganizers, setIsSearchingOrganizers] = useState(false);

  const canEditEvent = userProfile && (hasPrivilege ? hasPrivilege('events', 'edit') : userProfile.assignedRoleIds?.includes('sysadmin'));
  const canDeleteEvent = userProfile && (hasPrivilege ? hasPrivilege('events', 'delete') : userProfile.assignedRoleIds?.includes('sysadmin'));


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
      const formattedDateTime = eventData.dateTime ? formatDateTimeForInput(eventData.dateTime) : '';
      const formattedEndTime = eventData.endTime ? formatDateTimeForInput(eventData.endTime) : '';
      
      const { durationMinutes, ...restOfEventData } = eventData; 

      setFormData({ 
        ...restOfEventData, 
        dateTime: formattedDateTime,
        endTime: formattedEndTime, 
        organizerUserId: eventData.organizerUserId || null, 
      });
      
      if (eventData.organizerUserId && eventData.organizerFirstName && eventData.organizerLastName) {
        setSelectedOrganizerName(`${eventData.organizerFirstName} ${eventData.organizerLastName} (${eventData.organizerEmail || 'email missing'})`);
      } else if (eventData.organizerUserId) {
        // Fallback: if name/email not directly on eventData, try to fetch organizer details
        // For now, just show UID. A separate fetch might be needed if full details are required here and not provided by /events/{id}
        try {
            const orgResponse = await fetch(`${backendUrl}/users/${eventData.organizerUserId}`, {
                 headers: { 'Authorization': `Bearer ${token}` },
            });
            if (orgResponse.ok) {
                const orgData = await orgResponse.json();
                setSelectedOrganizerName(`${orgData.firstName} ${orgData.lastName} (${orgData.email})`);
            } else {
                 setSelectedOrganizerName(`UID: ${eventData.organizerUserId} (Details unavailable)`);
            }
        } catch (orgErr) {
            console.error("Failed to fetch organizer details:", orgErr);
            setSelectedOrganizerName(`UID: ${eventData.organizerUserId} (Error fetching details)`);
        }
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
    if (!authLoading && user && !canEditEvent) { 
        setError("You are not authorized to edit events.");
        return;
    }
    if (user && eventId && canEditEvent) {
      fetchEventData();
    }
  }, [user, authLoading, eventId, router, canEditEvent, fetchEventData]);


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
        setOrganizerSearchResults([]);
        setIsSearchingOrganizers(false);
    } else if (query.trim().length >= 2) {
        if (formData.organizerUserId || selectedOrganizerName) { 
            setSelectedOrganizerName(null);
            setFormData(prev => ({ ...prev, organizerUserId: null }));
        }
        debouncedUserSearch(query);
    } else {
        setOrganizerSearchResults([]);
        setIsSearchingOrganizers(false);
    }
  };

  const handleSelectOrganizer = (organizer: UserSearchResult) => {
    setFormData(prev => ({ ...prev, organizerUserId: organizer.id })); // Changed from organizer.uid
    setSelectedOrganizerName(`${organizer.firstName} ${organizer.lastName} (${organizer.email})`);
    setOrganizerSearchQuery(''); 
    setOrganizerSearchResults([]); 
    setIsSearchingOrganizers(false);
  };

  const handleClearOrganizer = () => {
    setFormData(prev => ({ ...prev, organizerUserId: null }));
    setSelectedOrganizerName(null);
    setOrganizerSearchQuery('');
    setOrganizerSearchResults([]);
    setIsSearchingOrganizers(false);
  };


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (name === 'dateTime') {
      const newDateTime = value;
      let newEndTime = formData.endTime || ''; 
      if (newDateTime) {
        const startDate = new Date(newDateTime);
        if (!isNaN(startDate.getTime())) {
          const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); 
          newEndTime = formatDateTimeForInput(endDate);
        }
      }
      setFormData(prev => ({
        ...prev,
        dateTime: newDateTime,
        endTime: newEndTime, 
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? parseInt(value, 10) : value,
      }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEditEvent) {
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
        setError("Start Date & Time is required.");
        setSubmitting(false);
        return;
    }
    if (!formData.endTime) {
        setError("End Date & Time is required.");
        setSubmitting(false);
        return;
    }
    if (new Date(formData.endTime) <= new Date(formData.dateTime)) {
        setError("End Date & Time must be after Start Date & Time.");
        setSubmitting(false);
        return;
    }

    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      
      const { eventName, eventType, purpose, description, dateTime, endTime, location, volunteersRequired, status, organizerUserId } = formData;
      const updatePayload: Partial<EventFormData> = {};

      if (eventName !== undefined) updatePayload.eventName = eventName;
      if (eventType !== undefined) updatePayload.eventType = eventType;
      if (purpose !== undefined) updatePayload.purpose = purpose;
      if (description !== undefined) updatePayload.description = description;
      if (dateTime !== undefined) updatePayload.dateTime = dateTime;
      if (endTime !== undefined) updatePayload.endTime = endTime;
      if (location !== undefined) updatePayload.location = location;
      if (volunteersRequired !== undefined) updatePayload.volunteersRequired = volunteersRequired;
      if (status !== undefined) updatePayload.status = status;
      // Ensure organizerUserId is explicitly set to null if cleared, or the ID if selected
      updatePayload.organizerUserId = organizerUserId;


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

  const handleDelete = async () => {
    if (!user || !eventId || !canDeleteEvent) return;

    if (window.confirm(`Are you sure you want to delete the event "${formData.eventName || 'this event'}"? This action cannot be undone.`)) {
      setDeleting(true);
      setError(null);
      setSuccessMessage(null);
      try {
        const token = await user.getIdToken();
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
        const response = await fetch(`${backendUrl}/events/${eventId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok && response.status !== 204) { 
            const errorData = await response.json().catch(() => ({ detail: "Failed to delete event and parse error." }));
            throw new Error(errorData.detail || `Failed to delete event (status: ${response.status})`);
        }
        
        alert('Event deleted successfully!'); 
        router.push('/dashboard/events'); 
      } catch (err: any) {
        setError(err.message);
        alert(`Error: ${err.message}`); 
      } finally {
        setDeleting(false);
      }
    }
  };
  
  if (authLoading || isLoadingEvent) return <div className="flex items-center justify-center min-h-screen">Loading event data for editing...</div>;

  return (
    <>
      <div className="mb-6">
        <Link href={`/dashboard/events/${eventId}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
            ← Back to Event Details
        </Link>
      </div>
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
      
      {!canEditEvent && !authLoading && !isLoadingEvent && ( 
            <div className="mb-4 p-4 text-sm text-yellow-700 bg-yellow-100 rounded-lg dark:bg-yellow-200 dark:text-yellow-800" role="alert">
              You are not authorized to edit this event.
            </div>
      )}

      {canEditEvent && formData.eventName !== undefined && ( 
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
            <label htmlFor="dateTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date & Time</label>
            <input type="datetime-local" name="dateTime" id="dateTime" value={formData.dateTime || ''} onChange={handleChange} required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
          </div>
          <div>
            <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date & Time</label>
            <input type="datetime-local" name="endTime" id="endTime" value={formData.endTime || ''} onChange={handleChange} required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
          </div>
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Venue</label>
            <input type="text" name="location" id="location" value={formData.location || ''} onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
          </div>
          <div>
            <label htmlFor="volunteersRequired" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Volunteers Required</label>
            <input type="number" name="volunteersRequired" id="volunteersRequired" value={formData.volunteersRequired || 0} onChange={handleChange} min="0" required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
          </div>

          <div>
              <label htmlFor="organizerSearch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Event Organizer
              </label>
              {selectedOrganizerName ? (
                  <div className="flex items-center justify-between p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700">
                      <span className="text-sm text-green-600 dark:text-green-400 font-semibold">{selectedOrganizerName}</span>
                      <button 
                          type="button" 
                          onClick={handleClearOrganizer}
                          className="ml-2 text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          aria-label="Clear selected organizer"
                      >
                          (Clear)
                      </button>
                  </div>
              ) : (
                <div className="relative">
                  <input
                      type="text"
                      id="organizerSearch"
                      name="organizerSearch"
                      value={organizerSearchQuery}
                      onChange={handleOrganizerSearchChange}
                      placeholder="Search by name or email to select an organizer..."
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                  />
                  {isSearchingOrganizers && (
                    <div className="absolute top-full w-full mt-1">
                        <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">Searching...</p>
                    </div>
                  )}
                  {organizerSearchResults.length > 0 && !isSearchingOrganizers && (
                  <ul className="absolute top-full z-20 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md mt-1 max-h-60 overflow-auto shadow-lg">
                      {organizerSearchResults
                        .filter(org => org && org.id) // Added filter
                        .map(org => (
                        <li key={org.id} // Changed from org.uid
                            onClick={() => handleSelectOrganizer(org)}
                            className="px-3 py-2 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 cursor-pointer text-sm text-gray-900 dark:text-gray-200">
                            {org.firstName} {org.lastName} ({org.email})
                        </li>
                      ))}
                  </ul>
                  )}
                </div>
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

          <div className="flex justify-between items-center pt-4 border-t dark:border-gray-700">
              <div>
                  {canDeleteEvent && (
                      <button 
                          type="button" 
                          onClick={handleDelete}
                          disabled={deleting || submitting}
                          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                      >
                          {deleting ? 'Deleting...' : 'Delete Event'}
                      </button>
                  )}
              </div>
              <div className="flex space-x-3">
                  <Link href={`/dashboard/events/${eventId}`}>
                      <button type="button" className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                          Cancel
                      </button>
                  </Link>
                  <button type="submit" disabled={submitting || deleting || !canEditEvent}
                          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                      {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
              </div>
          </div>
        </form>
      )}
    </>
  );
}