'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient'; 

interface EventFormData {
  eventName: string;
  eventType: string;
  // purpose: string; // 'purpose' seems to be missing in backend EventCreate, using description
  description: string;
  dateTime: string; 
  endTime: string;   
  // location: string; // Backend uses 'venue'
  venue: string; 
  volunteersRequired: number;
  status: string; 
  organizerUserId: string | null; 
  icon: string; 
  // point_of_contact?: string; // Not in backend EventCreate
  workingGroupIds: string[]; 
  recurrenceRule?: string; // Added for recurrence
}

interface UserSearchResult {
  id: string; 
  firstName: string;
  lastName: string;
  email: string;
}

interface WorkingGroup { 
  id: string;
  groupName: string;
}

const initialFormData: EventFormData = {
  eventName: '',
  eventType: '',
  // purpose: '', // 'purpose' seems to be missing in backend EventCreate
  description: '',
  dateTime: '', 
  endTime: '',   
  venue: '', // Changed from location to venue
  volunteersRequired: 1,
  status: 'draft',
  organizerUserId: null, 
  icon: 'event', 
  // point_of_contact: '', // Not in backend EventCreate
  workingGroupIds: [], 
  recurrenceRule: '', // Added
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
  const { user, loading, userProfile, idToken, hasPrivilege } = useAuth(); 
  const [formData, setFormData] = useState<EventFormData>(initialFormData);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [organizerSearchQuery, setOrganizerSearchQuery] = useState('');
  const [organizerSearchResults, setOrganizerSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedOrganizerName, setSelectedOrganizerName] = useState<string | null>(null);
  const [isSearchingOrganizers, setIsSearchingOrganizers] = useState(false);

  const [workingGroups, setWorkingGroups] = useState<WorkingGroup[]>([]); 
  const [isLoadingWorkingGroups, setIsLoadingWorkingGroups] = useState(true); 

  const canCreateEvents = userProfile && (hasPrivilege ? hasPrivilege('events', 'create') : userProfile.isSysadmin);

  const handleIconClick = () => {
    localStorage.setItem('eventFormDraft', JSON.stringify(formData));
    router.push('/dashboard/events/select-icon?returnTo=/dashboard/events/new');
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    const fetchWGs = async () => {
      if (!idToken) {
        setIsLoadingWorkingGroups(false); 
        return;
      }
      setIsLoadingWorkingGroups(true);
      try {
        const result = await apiClient<WorkingGroup[]>({
          path: '/working-groups?fields=id,groupName',
          token: idToken,
          method: 'GET',
        });
        if (result.ok && result.data) {
          setWorkingGroups(result.data);
        } else {
          setError('Failed to load working groups. Please try again.');
        }
      } catch (err) {
        setError('An error occurred while fetching working groups.');
      } finally {
        setIsLoadingWorkingGroups(false);
      }
    };

    if (user) { 
        fetchWGs();
    } else if (!loading && !user) { 
        setIsLoadingWorkingGroups(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken, user, loading, router]);


  useEffect(() => {
    const selectedIcon = new URLSearchParams(window.location.search).get('selectedIcon');
    const storedDraft = localStorage.getItem('eventFormDraft');

    let draftToApply: Partial<EventFormData> = {};
    let draftLoaded = false;

    if (storedDraft) {
        try {
            draftToApply = JSON.parse(storedDraft);
            draftLoaded = true;
            if (draftToApply.workingGroupIds && !Array.isArray(draftToApply.workingGroupIds)) {
                draftToApply.workingGroupIds = [draftToApply.workingGroupIds].filter(Boolean) as string[];
            } else if (!draftToApply.workingGroupIds) {
                draftToApply.workingGroupIds = [];
            }
        } catch (e) {
            draftLoaded = false; 
        }
    }

    if (selectedIcon) {
        setFormData(prev => ({ ...initialFormData, ...draftToApply, icon: selectedIcon, workingGroupIds: draftToApply.workingGroupIds || [] }));
        localStorage.removeItem('eventFormDraft');
        const currentPath = window.location.pathname;
        window.history.replaceState({}, '', currentPath);
    } else if (draftLoaded) {
        setFormData(prev => ({ ...initialFormData, ...draftToApply }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    if (!isLoadingWorkingGroups && workingGroups.length > 0 && formData.workingGroupIds.length === 0) {
        const isFormPristineForWG = JSON.stringify(formData.workingGroupIds) === JSON.stringify(initialFormData.workingGroupIds);
        if (isFormPristineForWG) {
            // Default selection logic removed
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingGroups, isLoadingWorkingGroups]); 


  const handleWorkingGroupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData(prev => {
      const currentGroupIds = prev.workingGroupIds || [];
      if (checked) {
        return { ...prev, workingGroupIds: [...currentGroupIds, value] };
      } else {
        return { ...prev, workingGroupIds: currentGroupIds.filter(id => id !== value) };
      }
    });
  };


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (name === 'dateTime') {
      const newDateTime = value;
      let newEndTime = formData.endTime; // Keep existing endTime if already set and valid
      if (newDateTime) {
        const startDate = new Date(newDateTime);
        if (!isNaN(startDate.getTime())) {
          // Only auto-set endTime if it's blank or earlier than new start + 1hr
          const currentEndDate = formData.endTime ? new Date(formData.endTime) : null;
          const suggestedEndDate = new Date(startDate.getTime() + 60 * 60 * 1000);
          if (!currentEndDate || currentEndDate <= startDate) {
            newEndTime = formatDateTimeForInput(suggestedEndDate);
          }
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
    if (!idToken || query.trim().length < 2) { 
      setOrganizerSearchResults([]);
      return [];
    }
    setIsSearchingOrganizers(true);
    try {
      const result = await apiClient<UserSearchResult[]>({
        path: `/users/search?q=${encodeURIComponent(query)}`,
        token: idToken,
        method: 'GET',
      });
      if (result.ok && result.data) {
        setOrganizerSearchResults(result.data);
        return result.data;
      } else {
        setOrganizerSearchResults([]);
        return [];
      }
    } catch (err) {
      setOrganizerSearchResults([]);
      return [];
    } finally {
      setIsSearchingOrganizers(false); 
    }
  };

  const debouncedUserSearch = useCallback(debounce(fetchUsers, 500), [idToken]);

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
    
    if (!formData.workingGroupIds || formData.workingGroupIds.length === 0) { 
        setError("At least one Working Group must be selected.");
        return;
    }
    if (!formData.dateTime) {
        setError("Start Date & Time is required.");
        return;
    }
    if (!formData.endTime) {
        setError("End Date & Time is required.");
        return;
    }
    if (new Date(formData.endTime) <= new Date(formData.dateTime)) {
        setError("End Date & Time must be after Start Date & Time.");
        return;
    }
    // Basic RRULE validation: if present, it should not be an empty string after trimming.
    // More complex validation (like parsing) could be added here or rely on backend.
    if (formData.recurrenceRule && formData.recurrenceRule.trim() === "") {
        setError("Recurrence rule, if entered, cannot be empty. Remove it or provide a valid rule.");
        return;
    }


    setSubmitting(true);

    if (!idToken) {
      setError("Authentication error. Please log in again.");
      setSubmitting(false);
      return;
    }
    
    // Aligning with backend EventCreate model
    const payload: any = { 
        eventName: formData.eventName,
        eventType: formData.eventType || null, // Optional
        description: formData.description || null, // Optional
        dateTime: new Date(formData.dateTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        venue: formData.venue || null, // Optional
        volunteersRequired: formData.volunteersRequired,
        status: formData.status,
        organizerUserId: formData.organizerUserId, // Optional
        icon: formData.icon || null, // Optional
        workingGroupIds: formData.workingGroupIds,
        recurrence_rule: formData.recurrenceRule || null // Use recurrence_rule for backend
    }; 

    try {
      const result = await apiClient({
        path: '/events',
        token: idToken,
        method: 'POST',
        data: payload, 
      });

      if (!result.ok || !result.data) {
        const errorDetail = result.error?.detail || `Failed to create event (status: ${result.status})`;
        throw new Error(typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail));
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
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading || isLoadingWorkingGroups) { 
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!loading && !canCreateEvents) {
    return (
        <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="mb-6">
                <Link href="/dashboard/events" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                    <span className="material-icons mr-1 text-lg">arrow_back</span>
                    Back to Events
                </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Create New Event</h1>
            <div className="mb-6 p-4 text-sm text-red-700 bg-red-100 dark:bg-red-700 dark:text-red-100 rounded-lg shadow-md" role="alert">
              <span className="font-medium">Access Denied:</span> You do not have permission to create events.
            </div>
        </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
      <div className="mb-6">
        <Link href="/dashboard/events" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
            <span className="material-icons mr-1 text-lg">arrow_back</span>
            Back to Events
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Create New Event</h1>
      
      {successMessage && (
        <div className="mb-6 p-4 text-sm text-green-700 bg-green-100 dark:bg-green-700 dark:text-green-100 rounded-lg shadow-md" role="alert">
          <span className="font-medium">Success!</span> {successMessage}
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 text-sm text-red-700 bg-red-100 dark:bg-red-700 dark:text-red-100 rounded-lg shadow-md" role="alert">
          <span className="font-medium">Error:</span> {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Icon and Core Info */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <div className="md:flex md:space-x-6 items-start">
              <div className="flex-shrink-0 mb-6 md:mb-0 md:w-1/4 flex flex-col items-center"> 
                <div 
                  onClick={handleIconClick}
                  className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-300 border-2 border-indigo-300 dark:border-indigo-600 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors"
                  title="Click to change icon"
                >
                  <span className="material-icons" style={{ fontSize: '5rem' }}>
                    {formData.icon || 'add_photo_alternate'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center w-32 sm:w-40">Click icon to change</p> 
              </div>

              <div className="hidden md:block border-l border-gray-300 dark:border-gray-600 mx-3 h-auto self-stretch"></div> 

              <div className="flex-grow space-y-6"> 
                <div>
                  <label htmlFor="eventName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Name</label>
                  <input type="text" name="eventName" id="eventName" value={formData.eventName} onChange={handleChange} required 
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                </div>
                <div> 
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Working Groups (select at least one)</label>
                  <div className="mt-1 space-y-2 p-3 border border-gray-300 dark:border-gray-600 rounded-md max-h-48 overflow-y-auto">
                    {workingGroups.length > 0 ? workingGroups.map(wg => (
                      <label key={wg.id} className="flex items-center space-x-3 cursor-pointer p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                        <input 
                          type="checkbox"
                          name="workingGroupIds"
                          value={wg.id}
                          checked={(formData.workingGroupIds || []).includes(wg.id)}
                          onChange={handleWorkingGroupChange}
                          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-indigo-600 dark:ring-offset-gray-800"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{wg.groupName}</span>
                      </label>
                    )) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {isLoadingWorkingGroups ? 'Loading working groups...' : 'No working groups available. Please create one first.'}
                      </p>
                    )}
                  </div>
                </div>
              
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="eventType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Type</label>
                    <input type="text" name="eventType" id="eventType" value={formData.eventType} onChange={handleChange} 
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                  </div>
                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                    <select name="status" id="status" value={formData.status} onChange={handleChange} required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white">
                      <option value="draft">Draft</option>
                      <option value="open_for_signup">Open for Signup</option>
                      {/* <option value="completed">Completed</option> User should not create a completed event directly */}
                      {/* <option value="cancelled">Cancelled</option> User should not create a cancelled event directly */}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Details */}
          <div className="space-y-6 pt-6 border-b border-gray-200 dark:border-gray-700 pb-6">
            {/* 'purpose' field removed as it's not in backend EventCreate model */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={4}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"></textarea>
            </div>
          </div>

          {/* Section 3: Date, Time, Location, Recurrence */}
          <div className="space-y-6 pt-6 border-b border-gray-200 dark:border-gray-700 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="dateTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date & Time</label>
                <input type="datetime-local" name="dateTime" id="dateTime" value={formData.dateTime} onChange={handleChange} required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
              </div>
              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date & Time</label>
                <input type="datetime-local" name="endTime" id="endTime" value={formData.endTime} onChange={handleChange} required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
              </div>
            </div>
            <div>
              <label htmlFor="recurrenceRule" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Recurrence Rule (Optional)
              </label>
              <input 
                type="text" 
                name="recurrenceRule" 
                id="recurrenceRule" 
                value={formData.recurrenceRule || ''} 
                onChange={handleChange}
                placeholder="e.g., FREQ=WEEKLY;BYDAY=MO;INTERVAL=1"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" 
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Enter an <a href="https://icalendar.org/iCalendar-RFC-5545/3-8-5-3-recurrence-rule.html" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline dark:text-indigo-400">RRULE</a> string (e.g., FREQ=WEEKLY;BYDAY=TU;UNTIL=20241231T000000Z).
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="venue" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Venue</label>
                <input type="text" name="venue" id="venue" value={formData.venue} onChange={handleChange}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
              </div>
              {/* 'point_of_contact' field removed as it's not in backend EventCreate model */}
            </div>
          </div>
          
          {/* Section 4: Volunteers and Organizer */}
          <div className="space-y-6 pt-6">
            <div>
              <label htmlFor="volunteersRequired" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Volunteers Required</label>
              <input type="number" name="volunteersRequired" id="volunteersRequired" value={formData.volunteersRequired} onChange={handleChange} min="0" required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
            </div>

            <div>
              <label 
                htmlFor="organizerSearch" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Event Organizer{' '}
                {selectedOrganizerName ? (
                  <span className="text-green-600 dark:text-green-400 font-semibold">(Selected: {selectedOrganizerName})</span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">(Optional - Search below)</span>
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
                  <div className="absolute top-full w-full mt-1 z-10">
                    <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">Searching...</p>
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
          </div>
          
          <div className="flex justify-end space-x-3 pt-8 mt-4 border-t border-gray-200 dark:border-gray-700"> 
            <Link href="/dashboard/events">
                <button type="button" className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center">
                    <span className="material-icons mr-2 text-base">cancel</span>
                    Cancel
                </button>
            </Link>
            <button type="submit" disabled={submitting || !canCreateEvents || workingGroups.length === 0}
                    className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 inline-flex items-center">
              <span className="material-icons mr-2 text-base">{submitting ? 'hourglass_empty' : 'add_circle_outline'}</span>
              {submitting ? 'Submitting...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}