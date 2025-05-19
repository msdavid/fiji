'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation'; 
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient'; 

interface EventFormData {
  eventName: string;
  eventType: string;
  // purpose: string; // Not in backend EventUpdate model
  description: string;
  dateTime: string; 
  endTime: string;  
  venue: string; // Changed from location
  volunteersRequired: number;
  status: string;
  organizerUserId: string | null; 
  icon: string; 
  // point_of_contact?: string; // Not in backend EventUpdate model
  workingGroupIds: string[]; 
  workingGroupId?: string | null; // Legacy, primarily use workingGroupIds
  recurrenceRule?: string; // Added for recurrence

  // Fields that might come from GET but not directly part of PUT payload structure
  id?: string;
  createdByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
  creatorFirstName?: string;
  creatorLastName?: string;
  organizerFirstName?: string;
  organizerLastName?: string;
  organizerEmail?: string;
  isCurrentUserSignedUp?: boolean;
  currentUserAssignmentStatus?: string;
  workingGroupNames?: string[]; 
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
  name?: string; 
}

const formatDateTimeForInput = (dateString: string | Date): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return ''; 
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
  const searchParams = useSearchParams(); 
  const eventId = params.eventId as string;

  const { user, loading: authLoading, userProfile, hasPrivilege, idToken } = useAuth(); 
  const [formData, setFormData] = useState<Partial<EventFormData>>({ icon: 'event', workingGroupIds: [], recurrenceRule: '' }); 
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false); 
  const [deleting, setDeleting] = useState(false); 

  const [organizerSearchQuery, setOrganizerSearchQuery] = useState('');
  const [organizerSearchResults, setOrganizerSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedOrganizerName, setSelectedOrganizerName] = useState<string | null>(null);
  const [isSearchingOrganizers, setIsSearchingOrganizers] = useState(false);

  const [workingGroups, setWorkingGroups] = useState<WorkingGroup[]>([]); 
  const [isLoadingWorkingGroups, setIsLoadingWorkingGroups] = useState(true); 

  const canEditEvent = userProfile && (hasPrivilege ? hasPrivilege('events', 'edit') : userProfile.isSysadmin);
  const canDeleteEvent = userProfile && (hasPrivilege ? hasPrivilege('events', 'delete') : userProfile.isSysadmin);

  const handleIconClick = () => {
    localStorage.setItem(`eventFormDraft-${eventId}`, JSON.stringify(formData));
    router.push(`/dashboard/events/select-icon?returnTo=/dashboard/events/${eventId}/edit`);
  };

  useEffect(() => {
    const fetchWorkingGroups = async () => {
      if (!idToken) { setIsLoadingWorkingGroups(false); return; }
      setIsLoadingWorkingGroups(true);
      try {
        const result = await apiClient<WorkingGroup[]>({
          path: '/working-groups?fields=id,groupName,name', 
          token: idToken,
          method: 'GET',
        });
        if (result.ok && result.data) {
          const normalizedWGs = result.data.map(wg => ({...wg, groupName: wg.groupName || wg.name || "Unnamed WG"}));
          setWorkingGroups(normalizedWGs);
        } else {
          setError(prev => prev ? `${prev}\nFailed to load working groups.` : 'Failed to load working groups.');
        }
      } catch (err) {
        setError(prev => prev ? `${prev}\nAn error occurred fetching working groups.` : 'An error occurred fetching working groups.');
      } finally {
        setIsLoadingWorkingGroups(false);
      }
    };
    if (idToken) fetchWorkingGroups();
  }, [idToken]);


  const fetchEventData = useCallback(async (initialLoad = true) => {
    if (!idToken || !eventId) return;
    if (initialLoad) setIsLoadingEvent(true);
    setError(null);
    try {
      // Backend GET /events/{id} returns EventWithSignupStatus which includes recurrenceRule
      const result = await apiClient<EventFormData>({ 
        path: `/events/${eventId}`, // This should fetch the master event data
        token: idToken,
        method: 'GET',
      });

      if (!result.ok || !result.data) {
        if (result.status === 404) throw new Error("Event not found to edit.");
        throw new Error(result.error?.message || "Failed to fetch event data for editing.");
      }
      const eventData = result.data;
      
      const formattedDateTime = eventData.dateTime ? formatDateTimeForInput(eventData.dateTime) : '';
      const formattedEndTime = eventData.endTime ? formatDateTimeForInput(eventData.endTime) : '';
      
      // Use 'venue' from backend, map to frontend's 'venue' (was 'location')
      const venue = eventData.venue; 

      const currentSelectedIcon = searchParams.get('selectedIcon');
      const iconToSet = currentSelectedIcon || eventData.icon || 'event';
      
      let wgIdsToSet: string[] = [];
      if (eventData.workingGroupIds && Array.isArray(eventData.workingGroupIds)) {
        wgIdsToSet = eventData.workingGroupIds;
      } else if (eventData.workingGroupId) { 
        wgIdsToSet = [eventData.workingGroupId];
      }

      let draftData: Partial<EventFormData> = { 
        ...eventData, // Spread all fetched data first
        venue: venue, 
        dateTime: formattedDateTime,
        endTime: formattedEndTime, 
        organizerUserId: eventData.organizerUserId || null, 
        icon: iconToSet,
        workingGroupIds: wgIdsToSet, 
        recurrenceRule: eventData.recurrenceRule || '', // Populate recurrence rule
      };

      // Remove fields not part of EventFormData for editing state
      // delete draftData.purpose; // If 'purpose' was in fetched data but not in form model
      // delete draftData.point_of_contact; // Same for point_of_contact

      const storedDraftKey = `eventFormDraft-${eventId}`;
      const storedDraft = localStorage.getItem(storedDraftKey);
      if (currentSelectedIcon && storedDraft) {
        try {
          const parsedDraft = JSON.parse(storedDraft);
          if (parsedDraft.workingGroupIds && !Array.isArray(parsedDraft.workingGroupIds)) {
            parsedDraft.workingGroupIds = [parsedDraft.workingGroupIds].filter(Boolean) as string[];
          } else if (!parsedDraft.workingGroupIds) {
            parsedDraft.workingGroupIds = [];
          }
          // Merge draft but prioritize fetched data, then apply icon
          draftData = { ...eventData, ...parsedDraft, venue: parsedDraft.venue || venue, icon: currentSelectedIcon, workingGroupIds: parsedDraft.workingGroupIds || wgIdsToSet, recurrenceRule: parsedDraft.recurrenceRule || eventData.recurrenceRule || '' }; 
        } catch (e) { /* console.error("Failed to parse stored event form draft for edit:", e); */ }
      }
      
      setFormData(draftData);
      
      if (eventData.organizerUserId && eventData.organizerFirstName && eventData.organizerLastName) {
        setSelectedOrganizerName(`${eventData.organizerFirstName} ${eventData.organizerLastName} (${eventData.organizerEmail || 'email missing'})`);
      } else if (eventData.organizerUserId) {
        try {
            const orgResult = await apiClient<UserSearchResult>({ path: `/users/${eventData.organizerUserId}`, token: idToken, method: 'GET' });
            if (orgResult.ok && orgResult.data) {
                const orgData = orgResult.data;
                setSelectedOrganizerName(`${orgData.firstName} ${orgData.lastName} (${orgData.email})`);
            } else { setSelectedOrganizerName(`UID: ${eventData.organizerUserId} (Details unavailable)`); }
        } catch (orgErr) { setSelectedOrganizerName(`UID: ${eventData.organizerUserId} (Error fetching details)`); }
      } else {
        setSelectedOrganizerName(null);
      }

    } catch (err: any) { setError(err.message); } 
    finally { if (initialLoad) setIsLoadingEvent(false); }
  }, [idToken, eventId, searchParams]); 

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading && user && !canEditEvent) { setError("You are not authorized to edit events."); setIsLoadingEvent(false); return; }
    
    if (idToken && eventId && canEditEvent) {
        const selectedIcon = searchParams.get('selectedIcon');
        const storedDraftKey = `eventFormDraft-${eventId}`;
        const storedDraft = localStorage.getItem(storedDraftKey);

        if (selectedIcon) {
            let draftData: Partial<EventFormData> = { icon: selectedIcon };
             if (storedDraft) {
                try { 
                    const parsedDraft = JSON.parse(storedDraft);
                    if (parsedDraft.workingGroupIds && !Array.isArray(parsedDraft.workingGroupIds)) {
                        parsedDraft.workingGroupIds = [parsedDraft.workingGroupIds].filter(Boolean) as string[];
                    } else if (!parsedDraft.workingGroupIds) {
                        parsedDraft.workingGroupIds = [];
                    }
                    draftData = { ...parsedDraft, icon: selectedIcon }; 
                }
                catch (e) { /* console.error("Failed to parse stored event form draft for edit:", e); */ }
            }
            setFormData(prev => ({ ...prev, ...draftData })); 
            localStorage.removeItem(storedDraftKey);
            const currentPath = window.location.pathname;
            window.history.replaceState({}, '', currentPath);
            if(isLoadingEvent) setIsLoadingEvent(false); 
        } else if (storedDraft && Object.keys(formData).length <= 4 && !selectedIcon) { // Increased initial field count due to recurrenceRule
            try { 
                const parsedDraft = JSON.parse(storedDraft);
                if (parsedDraft.workingGroupIds && !Array.isArray(parsedDraft.workingGroupIds)) {
                    parsedDraft.workingGroupIds = [parsedDraft.workingGroupIds].filter(Boolean) as string[];
                } else if (!parsedDraft.workingGroupIds) {
                    parsedDraft.workingGroupIds = [];
                }
                setFormData(parsedDraft); 
            }
            catch (e) { /* console.error("Failed to parse stored event form draft on rehydration (edit):", e); */ }
            if(isLoadingEvent) setIsLoadingEvent(false);
        } else if (Object.keys(formData).length <= 4 || formData.id !== eventId) { 
            fetchEventData(); 
        } else {
             if(isLoadingEvent) setIsLoadingEvent(false); 
        }
    } else if (!idToken && !authLoading) {
        setIsLoadingEvent(false); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken, authLoading, eventId, canEditEvent, fetchEventData]); 


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
      let newEndTime = formData.endTime || ''; 
      if (newDateTime) {
        const startDate = new Date(newDateTime);
        if (!isNaN(startDate.getTime())) {
          const currentEndDate = formData.endTime ? new Date(formData.endTime) : null;
          const suggestedEndDate = new Date(startDate.getTime() + ( (currentEndDate && currentEndDate > startDate) ? (currentEndDate.getTime() - startDate.getTime()) : (60 * 60 * 1000) ) );
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
      setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value, 10) : value }));
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
    setFormData(prev => ({ ...prev, organizerUserId: organizer.id })); 
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


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEditEvent) { setError("Unauthorized action."); return; }
    
    if (!formData.workingGroupIds || formData.workingGroupIds.length === 0) {
        setError("At least one Working Group must be selected."); return;
    }
    if (!formData.dateTime) { setError("Start Date & Time is required."); return; }
    if (!formData.endTime) { setError("End Date & Time is required."); return; }
    if (new Date(formData.endTime) <= new Date(formData.dateTime)) {
        setError("End Date & Time must be after Start Date & Time."); return;
    }
    if (formData.recurrenceRule && formData.recurrenceRule.trim() === "") {
        setError("Recurrence rule, if entered, cannot be empty. Remove it or provide a valid rule.");
        return;
    }

    setError(null); setSuccessMessage(null); setSubmitting(true);
    if (!idToken) { setError("Authentication error."); setSubmitting(false); return; }

    try {
      // Construct payload based on EventUpdate model
      const payloadToSend: any = {
        eventName: formData.eventName,
        eventType: formData.eventType || null,
        description: formData.description || null,
        dateTime: formData.dateTime ? new Date(formData.dateTime).toISOString() : null,
        endTime: formData.endTime ? new Date(formData.endTime).toISOString() : null,
        venue: formData.venue || null, // Changed from location
        volunteersRequired: formData.volunteersRequired,
        status: formData.status,
        organizerUserId: formData.organizerUserId, // Can be null
        icon: formData.icon || null,
        workingGroupIds: Array.isArray(formData.workingGroupIds) ? formData.workingGroupIds : [],
        recurrence_rule: formData.recurrenceRule || null, // Use recurrence_rule for backend
      };
      
      // Remove undefined fields to respect exclude_unset=True on backend Pydantic model
      Object.keys(payloadToSend).forEach(key => {
        if (payloadToSend[key] === undefined) {
          delete payloadToSend[key]; 
        }
      });
      // Explicitly send null if organizerUserId was cleared
      if ("organizerUserId" in formData && formData.organizerUserId === null) {
        payloadToSend.organizerUserId = null;
      }
      if ("recurrenceRule" in formData && formData.recurrenceRule === "") {
        payloadToSend.recurrence_rule = null; // Send null if cleared
      }


      const result = await apiClient({
        path: `/events/${eventId}`, token: idToken, method: 'PUT', data: payloadToSend, 
      });

      if (!result.ok) { 
        let errorMessage = `Failed to update event (status: ${result.status})`;
        const errorDetail = result.error?.detail;
        if (typeof errorDetail === 'string') {
            errorMessage = errorDetail;
        } else if (Array.isArray(errorDetail) && errorDetail.length > 0 && errorDetail[0].msg) {
            errorMessage = errorDetail.map((err: any) => `${err.loc ? err.loc.join('.') : 'field'} - ${err.msg}`).join('; ');
        } else if (result.error?.message) {
            errorMessage = result.error.message;
        } else if (result.error) {
            errorMessage = JSON.stringify(result.error);
        }
        throw new Error(errorMessage);
      }
      
      setSuccessMessage('Event updated successfully!');
      localStorage.removeItem(`eventFormDraft-${eventId}`); 
      fetchEventData(false); // Re-fetch to show updated data before redirect
      setTimeout(() => { router.push(`/dashboard/events/${eventId}`); }, 1500);

    } catch (err: any) { setError(err.message); } 
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => { 
    if (!idToken || !eventId || !canDeleteEvent) return;
    if (window.confirm(`Are you sure you want to delete the event "${formData.eventName || 'this event'}"? This action cannot be undone.`)) {
      setDeleting(true); setError(null); setSuccessMessage(null);
      try {
        const result = await apiClient({ path: `/events/${eventId}`, token: idToken, method: 'DELETE', });
        if (!result.ok && result.status !== 204) { throw new Error(result.error?.message || `Failed to delete event (status: ${result.status})`); }
        alert('Event deleted successfully!'); 
        localStorage.removeItem(`eventFormDraft-${eventId}`); 
        router.push('/dashboard/events'); 
      } catch (err: any) { setError(err.message); alert(`Error: ${err.message}`); } 
      finally { setDeleting(false); }
    }
  };
  
  if (authLoading || isLoadingEvent || isLoadingWorkingGroups ) {
     return <div className="flex items-center justify-center min-h-screen">Loading event data for editing...</div>;
  }

  const defaultInputStyle = "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white";

  return (
    <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
      <div className="mb-6">
        <Link href={`/dashboard/events/${eventId}`} className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
            <span className="material-icons mr-1 text-lg">arrow_back</span>
            Back to Event Details
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Edit Event</h1>
      
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
      
      {!canEditEvent && !authLoading && !isLoadingEvent && ( 
            <div className="mb-6 p-4 text-sm text-yellow-700 bg-yellow-100 dark:bg-yellow-700 dark:text-yellow-100 rounded-lg shadow-md" role="alert">
              You are not authorized to edit this event.
            </div>
      )}

      {canEditEvent && formData.eventName !== undefined && ( 
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                <div className="md:flex md:space-x-6 items-start">
                <div className="flex-shrink-0 mb-6 md:mb-0 md:w-1/4 flex flex-col items-center"> 
                    <div 
                        onClick={handleIconClick}
                        className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-300 border-2 border-indigo-300 dark:border-indigo-600 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors"
                        title="Click to change icon"
                    >
                        <span className="material-icons" style={{ fontSize: '5rem' }}>{formData.icon || 'add_photo_alternate'}</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center w-32 sm:w-40">Click icon to change</p> 
                </div>
                <div className="hidden md:block border-l border-gray-300 dark:border-gray-600 mx-3 h-auto self-stretch"></div>
                <div className="flex-grow space-y-6">
                    <div>
                        <label htmlFor="eventName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Name</label>
                        <input type="text" name="eventName" id="eventName" value={formData.eventName || ''} onChange={handleChange} required className={defaultInputStyle} />
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
                                {isLoadingWorkingGroups ? 'Loading working groups...' : 'No working groups available.'}
                            </p>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="eventType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Type</label>
                            <input type="text" name="eventType" id="eventType" value={formData.eventType || ''} onChange={handleChange} className={defaultInputStyle} />
                        </div>
                        <div>
                            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                            <select name="status" id="status" value={formData.status || 'draft'} onChange={handleChange} required className={defaultInputStyle}>
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
            </div>
            
            {/* Section 2: Details */}
            <div className="space-y-6 pt-6 border-b border-gray-200 dark:border-gray-700 pb-6">
                {/* 'purpose' field removed */}
                <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea name="description" id="description" value={formData.description || ''} onChange={handleChange} rows={4}
                            className={defaultInputStyle}></textarea>
                </div>
            </div>

            {/* Section 3: Date, Time, Location, Recurrence */}
            <div className="space-y-6 pt-6 border-b border-gray-200 dark:border-gray-700 pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="dateTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date & Time</label>
                    <input type="datetime-local" name="dateTime" id="dateTime" value={formData.dateTime || ''} onChange={handleChange} required
                        className={defaultInputStyle} />
                </div>
                <div>
                    <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date & Time</label>
                    <input type="datetime-local" name="endTime" id="endTime" value={formData.endTime || ''} onChange={handleChange} required
                        className={defaultInputStyle} />
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
                    className={defaultInputStyle} 
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Enter an <a href="https://icalendar.org/iCalendar-RFC-5545/3-8-5-3-recurrence-rule.html" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline dark:text-indigo-400">RRULE</a> string. Clear to remove recurrence.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="venue" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Venue</label>
                    <input type="text" name="venue" id="venue" value={formData.venue || ''} onChange={handleChange}
                        className={defaultInputStyle} />
                </div>
                {/* 'point_of_contact' field removed */}
                </div>
            </div>
            
            {/* Section 4: Volunteers and Organizer */}
            <div className="space-y-6 pt-6">
                <div>
                <label htmlFor="volunteersRequired" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Volunteers Required</label>
                <input type="number" name="volunteersRequired" id="volunteersRequired" value={formData.volunteersRequired === undefined ? 0 : formData.volunteersRequired} onChange={handleChange} min="0" required
                        className={defaultInputStyle} />
                </div>
                <div> 
                    <label htmlFor="organizerSearch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Event Organizer
                    </label>
                    {selectedOrganizerName ? (
                        <div className="flex items-center justify-between p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50">
                            <span className="text-sm text-green-600 dark:text-green-400 font-semibold">{selectedOrganizerName}</span>
                            <button 
                                type="button" 
                                onClick={handleClearOrganizer}
                                className="ml-2 text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 inline-flex items-center"
                                aria-label="Clear selected organizer"
                            >
                                <span className="material-icons mr-1 text-sm">close</span>
                                Clear
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
                            className={defaultInputStyle}
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
                    )}
                </div>
            </div>
            
            <div className="flex justify-between items-center pt-8 mt-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                    {canDeleteEvent && (
                        <button 
                            type="button" 
                            onClick={handleDelete}
                            disabled={deleting || submitting}
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 inline-flex items-center"
                        >
                            <span className="material-icons mr-2 text-base">{deleting ? 'hourglass_empty' : 'delete_forever'}</span>
                            {deleting ? 'Deleting...' : 'Delete Event'}
                        </button>
                    )}
                </div>
                <div className="flex space-x-3">
                    <Link href={`/dashboard/events/${eventId}`}>
                        <button type="button" className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center">
                            <span className="material-icons mr-2 text-base">cancel</span>
                            Cancel
                        </button>
                    </Link>
                    <button type="submit" disabled={submitting || deleting || !canEditEvent || (workingGroups.length === 0 && (!formData.workingGroupIds || formData.workingGroupIds.length === 0))}
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 inline-flex items-center">
                        <span className="material-icons mr-2 text-base">{submitting ? 'hourglass_empty' : 'save'}</span>
                        {submitting ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}