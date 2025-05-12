'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
// Assuming you might have a shared layout or want a similar nav
// import MainNav from '@/components/layout/MainNav'; // Example if you have a shared nav

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

// Helper function to get current datetime in YYYY-MM-DDTHH:mm format
const getCurrentDateTimeLocal = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // Adjust for local timezone
  return now.toISOString().slice(0, 16);
};

const initialFormData: EventFormData = {
  eventName: '',
  eventType: '',
  purpose: '',
  description: '',
  dateTime: getCurrentDateTimeLocal(), // Pre-fill with current date and time
  durationMinutes: 60,
  location: '',
  volunteersRequired: 1,
  status: 'draft',
};

export default function CreateEventPage() {
  const router = useRouter();
  const { user, loading, userProfile } = useAuth();
  const [formData, setFormData] = useState<EventFormData>(initialFormData);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    // Add admin check if only admins can create events
    // if (!loading && user && !userProfile?.assignedRoleIds?.includes('sysadmin')) {
    //   router.push('/dashboard'); // Or an unauthorized page
    // }
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
    setSubmitting(true);

    // TODO: Implement API call to backend POST /events
    console.log('Submitting event data:', formData);

    try {
      // Replace with actual API call
      // const response = await fetch('/api/events', { // Your backend API endpoint
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json', /* Add Auth token */ },
      //   body: JSON.stringify(formData),
      // });
      // if (!response.ok) {
      //   const errorData = await response.json();
      //   throw new Error(errorData.message || 'Failed to create event');
      // }
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000)); 
      alert('Event creation submitted (simulated). Implement backend call.');
      // router.push('/dashboard/events'); // Redirect to event list on success

    } catch (err: any) {
      setError(err.message || 'An error occurred during submission.');
      console.error('Event submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!user) return <div className="flex items-center justify-center min-h-screen">Redirecting to login...</div>;
  // Add admin check display if needed

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800">
      {/* <MainNav /> You can place a shared navigation component here */}
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

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end space-x-3">
            <Link href="/dashboard/events">
                <button type="button" className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    Cancel
                </button>
            </Link>
            <button type="submit" disabled={submitting}
                    className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Create Event'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}