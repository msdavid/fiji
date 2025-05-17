'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface EventFormData {
  eventName: string;
  eventType: string;
  purpose: string;
  description: string;
  dateTime: string; 
  endTime: string;   
  location: string; 
  volunteersRequired: number;
  status: string; 
  organizerUserId: string | null; 
  icon: string; 
}

interface UserSearchResult {
  id: string; 
  firstName: string;
  lastName: string;
  email: string;
}

const initialFormData: EventFormData = {
  eventName: '',
  eventType: '',
  purpose: '',
  description: '',
  dateTime: '', 
  endTime: '',   
  location: '', 
  volunteersRequired: 1,
  status: 'draft',
  organizerUserId: null, 
  icon: 'event', 
};

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

export default function CreateEventPage() {
  const router = useRouter();
  const { user, loading, userProfile } = useAuth(); 
  const [formData, setFormData] = useState<EventFormData>(initialFormData);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [organizerSearchQuery, setOrganizerSearchQuery] = useState('');
  const [organizerSearchResults, setOrganizerSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedOrganizerName, setSelectedOrganizerName] = useState<string | null>(null);
  const [isSearchingOrganizers, setIsSearchingOrganizers] = useState(false);

  const handleIconClick = () => {
    localStorage.setItem('eventFormDraft', JSON.stringify(formData));
    router.push('/dashboard/events/select-icon?returnTo=/dashboard/events/new');
  };

  useEffect(() => {
    const selectedIcon = new URLSearchParams(window.location.search).get('selectedIcon');
    const storedDraft = localStorage.getItem('eventFormDraft');

    if (selectedIcon) {
      let draftData = initialFormData;
      if (storedDraft) {
        try {
          draftData = JSON.parse(storedDraft);
        } catch (e) {
          console.error("Failed to parse stored event form draft:", e);
        }
      }
      setFormData(prev => ({ ...draftData, icon: selectedIcon }));
      localStorage.removeItem('eventFormDraft');
      router.replace('/dashboard/events/new', undefined);
    } else if (storedDraft && !selectedIcon) {
        try {
            setFormData(JSON.parse(storedDraft));
        } catch (e) {
            console.error("Failed to parse stored event form draft on rehydration:", e);
        }
    }

    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && userProfile && !userProfile.assignedRoleIds?.includes('sysadmin')) {
       setError("You are not authorized to create events.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [user, loading, userProfile]); 


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (name === 'dateTime') {
      const newDateTime = value;
      let newEndTime = '';
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
    setSelectedOrganizerName(null); 
    setFormData(prev => ({ ...prev, organizerUserId: null })); 
    if (query.trim().length >= 2) {
      debouncedUserSearch(query);
    } else {
      setOrganizerSearchResults([]);
      setIsSearchingOrganizers(false); 
    }
  };

  const handleSelectOrganizer = (organizer: UserSearchResult) => {
    setFormData(prev => ({ ...prev, organizerUserId: organizer.id })); 
    setSelectedOrganizerName(`${organizer.firstName} ${organizer.lastName} (${organizer.email})`);
    setOrganizerSearchQuery(''); 
    setOrganizerSearchResults([]); 
    setIsSearchingOrganizers(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);

    if (!user) {
      setError("Authentication error. Please log in again.");
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

    const payload = { ...formData }; 

    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      
      const response = await fetch(`${backendUrl}/events`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload), 
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to create event (status: ${response.status})`);
      }
      
      setSuccessMessage('Event created successfully!');
      setFormData(initialFormData); 
      setSelectedOrganizerName(null); 
      localStorage.removeItem('eventFormDraft');
      setTimeout(() => {
        router.push('/dashboard/events'); 
      }, 1500); 

    } catch (err: any) {
      setError(err.message || 'An error occurred during submission.');
      console.error('Event submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading && !formData.icon) { 
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto"> 
      <div className="mb-6">
        <Link href="/dashboard/events" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
            ← Back to Events
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Create New Event</h1>
      
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

      {(!user || (userProfile && !userProfile.assignedRoleIds?.includes('sysadmin')) && !loading) && !error && (
            <div className="mb-4 p-4 text-sm text-yellow-700 bg-yellow-100 rounded-lg dark:bg-yellow-200 dark:text-yellow-800" role="alert">
              You might not have the necessary permissions to create an event. Please contact an administrator if you believe this is an error.
            </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-xl p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="md:flex md:space-x-6 items-start">
            <div className="flex-shrink-0 mb-6 md:mb-0 md:w-1/4 flex flex-col items-center"> {/* Changed md:items-start to items-center */}
              <div 
                onClick={handleIconClick}
                className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 border-2 border-gray-300 dark:border-gray-600 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors"
                title="Click to change icon"
              >
                <span className="material-icons" style={{ fontSize: '4rem' }}>
                  {formData.icon || 'add_photo_alternate'}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center w-32 sm:w-40">Click icon to change</p> {/* Ensured text-center for the paragraph itself */}
            </div>

            <div className="hidden md:block border-l border-gray-300 dark:border-gray-600 mx-3 h-auto"></div> 

            <div className="flex-grow space-y-6"> 
              <div>
                <label htmlFor="eventName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event Name</label>
                <input type="text" name="eventName" id="eventName" value={formData.eventName} onChange={handleChange} required 
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
              </div>
            
              <div className="md:grid md:grid-cols-2 md:gap-6">
                <div>
                  <label htmlFor="eventType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event Type</label>
                  <input type="text" name="eventType" id="eventType" value={formData.eventType} onChange={handleChange} 
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                  <select name="status" id="status" value={formData.status} onChange={handleChange} required
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white">
                    <option value="draft">Draft</option>
                    <option value="open_for_signup">Open for Signup</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Purpose</label>
            <textarea name="purpose" id="purpose" value={formData.purpose} onChange={handleChange} rows={3}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"></textarea>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={4}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"></textarea>
          </div>

          <div className="md:grid md:grid-cols-2 md:gap-6">
            <div>
              <label htmlFor="dateTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date & Time</label>
              <input type="datetime-local" name="dateTime" id="dateTime" value={formData.dateTime} onChange={handleChange} required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date & Time</label>
              <input type="datetime-local" name="endTime" id="endTime" value={formData.endTime} onChange={handleChange} required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
            </div>
          </div>

          <div className="md:grid md:grid-cols-2 md:gap-6">
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Venue</label>
              <input type="text" name="location" id="location" value={formData.location} onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label htmlFor="volunteersRequired" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Volunteers Required</label>
              <input type="number" name="volunteersRequired" id="volunteersRequired" value={formData.volunteersRequired} onChange={handleChange} min="0" required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
            </div>
          </div>

          <div>
            <label 
              htmlFor="organizerSearch" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Event Organizer{' '}
              {selectedOrganizerName ? (
                <span className="text-green-600 dark:text-green-400 font-semibold">(Selected: {selectedOrganizerName})</span>
              ) : (
                <span className="text-gray-500 dark:text-gray-400">(Optional)</span>
              )}
            </label>
            <div className="relative mt-1"> 
              <input
                type="text"
                id="organizerSearch"
                name="organizerSearch"
                value={organizerSearchQuery}
                onChange={handleOrganizerSearchChange}
                placeholder="Search by name or email..."
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
                    .filter(org => org && org.id)  
                    .map(org => (
                    <li key={org.id} 
                        onClick={() => handleSelectOrganizer(org)}
                        className="px-3 py-2 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 cursor-pointer text-sm text-gray-900 dark:text-gray-200">
                      {org.firstName} {org.lastName} ({org.email})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700"> 
            <Link href="/dashboard/events">
                <button type="button" className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    Cancel
                </button>
            </Link>
            <button type="submit" disabled={submitting || (!userProfile?.assignedRoleIds?.includes('sysadmin') && !loading)}
                    className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}