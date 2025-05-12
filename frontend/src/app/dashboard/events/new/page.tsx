'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface EventFormData {
  eventName: string;
  eventType: string;
  purpose: string;
  description: string;
  dateTime: string; // ISO string format for datetime-local input
  durationMinutes: number;
  location: string;
  volunteersRequired: number;
  status: string; // e.g., "draft", "open_for_signup"
}

const initialFormData: EventFormData = {
  eventName: '',
  eventType: '',
  purpose: '',
  description: '',
  dateTime: '', // Reverted: No longer pre-filled
  durationMinutes: 60,
  location: '',
  volunteersRequired: 1,
  status: 'draft',
};

export default function CreateEventPage() {
  const router = useRouter();
  const { user, loading, userProfile } = useAuth(); // user object contains getIdToken
  const [formData, setFormData] = useState<EventFormData>(initialFormData);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    // Basic admin check, assuming only admins can create events
    // This should ideally be enforced by backend RBAC primarily
    if (!loading && user && userProfile && !userProfile.assignedRoleIds?.includes('sysadmin')) {
       setError("You are not authorized to create events.");
       // Optionally redirect: router.push('/dashboard');
    }
  }, [user, loading, userProfile, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) : value,
    }));
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
    
    // Ensure dateTime is not empty if required, or handle appropriately
    if (!formData.dateTime) {
        setError("Date and Time is required.");
        setSubmitting(false);
        return;
    }

    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      
      const response = await fetch(`${backendUrl}/events`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to create event (status: ${response.status})`);
      }
      
      // const createdEvent = await response.json(); // Process if needed
      setSuccessMessage('Event created successfully!');
      // alert('Event created successfully!'); // Using state for message display

      // Clear form or redirect
      // setFormData(initialFormData); // Option to clear form
      setTimeout(() => {
        router.push('/dashboard/events'); // Redirect to event list on success
      }, 1500); // Delay redirect to show success message

    } catch (err: any) {
      setError(err.message || 'An error occurred during submission.');
      console.error('Event submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  // No user check here, useEffect handles redirect. If error is set due to auth, it will show.

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800">
      <nav className="bg-white dark:bg-gray-900 shadow-sm mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/dashboard" className="flex-shrink-0 text-xl font-bold text-indigo-600 dark:text-indigo-400">
                Fiji Platform
            </Link>
            <Link href="/dashboard/events" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                ← Back to Events
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
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

        <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-900 p-8 rounded-lg shadow">
          <div>
            <label htmlFor="eventName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event Name</label>
            <input type="text" name="eventName" id="eventName" value={formData.eventName} onChange={handleChange} required 
                   className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
          </div>

          <div>
            <label htmlFor="eventType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event Type</label>
            <input type="text" name="eventType" id="eventType" value={formData.eventType} onChange={handleChange} 
                   className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
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

          <div>
            <label htmlFor="dateTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date & Time</label>
            <input type="datetime-local" name="dateTime" id="dateTime" value={formData.dateTime} onChange={handleChange} required
                   className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
          </div>
          
          <div>
            <label htmlFor="durationMinutes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Duration (Minutes)</label>
            <input type="number" name="durationMinutes" id="durationMinutes" value={formData.durationMinutes} onChange={handleChange} min="1" required
                   className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Location</label>
            <input type="text" name="location" id="location" value={formData.location} onChange={handleChange}
                   className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
          </div>

          <div>
            <label htmlFor="volunteersRequired" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Volunteers Required</label>
            <input type="number" name="volunteersRequired" id="volunteersRequired" value={formData.volunteersRequired} onChange={handleChange} min="0" required
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

          <div className="flex justify-end space-x-3">
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
      </main>
    </div>
  );
}