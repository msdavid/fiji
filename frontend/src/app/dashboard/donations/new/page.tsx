"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient, { ApiResponse } from '@/lib/apiClient'; // Import ApiResponse
import { format } from 'date-fns';

type DonationType = 'monetary' | 'in_kind' | 'time_contribution';

interface NewDonationFormData {
  donorName: string;
  donorEmail: string; 
  donorPhone: string; 
  donorUserId: string;
  donationType: DonationType;
  amount: string; 
  currency: string;
  description: string;
  donationDate: string; 
  notes: string;
}

interface UserSearchResult {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

const initialFormData: NewDonationFormData = {
    donorName: '',
    donorEmail: '',
    donorPhone: '',
    donorUserId: '',
    donationType: 'monetary',
    amount: '',
    currency: 'SGD', 
    description: '',
    donationDate: format(new Date(), 'yyyy-MM-dd'), 
    notes: '',
};

const NewDonationPage = () => {
  const { user, idToken, loading: authLoading, userProfile, fetchUserProfile, hasPrivilege, logout } = useAuth(); // Added logout
  const router = useRouter();

  const [formData, setFormData] = useState<NewDonationFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // User search state
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showUserResults, setShowUserResults] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const canCreateDonations = userProfile && (hasPrivilege ? hasPrivilege('donations', 'create') : userProfile.assignedRoleIds?.includes('sysadmin'));

  useEffect(() => {
    if (!authLoading && !user) {
      // router.push('/login'); // Handled by AuthContext/DashboardLayout
      return;
    }
    if (user && !userProfile && fetchUserProfile) { // Check if fetchUserProfile exists
        fetchUserProfile();
    }
    if (!authLoading && user && userProfile && !canCreateDonations) {
        setError("You don't have permission to record new donations.");
    }
  }, [authLoading, user, userProfile, fetchUserProfile, canCreateDonations, router]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowUserResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // User search functionality
  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setUserSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await apiClient<UserSearchResult[]>({
        path: `/users/search?q=${encodeURIComponent(query)}`,
        token: idToken,
        method: 'GET',
      });

      if (result.ok) {
        setUserSearchResults(result.data || []);
      } else {
        console.error('Failed to search users:', result.error);
        setUserSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setUserSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUserSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setUserSearchQuery(query);
    setShowUserResults(true);
    
    if (query.length >= 2) {
      searchUsers(query);
    } else {
      setUserSearchResults([]);
    }
  };

  const selectUser = async (user: UserSearchResult) => {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    
    setSelectedUser(user);
    setFormData(prev => ({
      ...prev,
      donorUserId: user.id,
      donorName: fullName,
      donorEmail: user.email,
    }));
    setUserSearchQuery(fullName);
    setShowUserResults(false);

    // Fetch full user profile to get phone number
    try {
      const result = await apiClient<any>({
        path: `/users/${user.id}`,
        token: idToken,
        method: 'GET',
      });

      if (result.ok && result.data?.phone) {
        setFormData(prev => ({
          ...prev,
          donorPhone: result.data.phone,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch user phone:', error);
      // Don't show error to user, just continue without phone
    }
  };

  const clearUserSelection = () => {
    setSelectedUser(null);
    setFormData(prev => ({
      ...prev,
      donorUserId: '',
      donorName: '',
      donorEmail: '',
      donorPhone: '',
    }));
    setUserSearchQuery('');
    setShowUserResults(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // If user manually edits donor info, clear the user selection
    if ((name === 'donorName' || name === 'donorEmail' || name === 'donorPhone') && selectedUser) {
      setSelectedUser(null);
      setFormData(prev => ({ ...prev, [name]: value, donorUserId: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    if (name === "donationType" && value !== "monetary") {
        setFormData(prev => ({ ...prev, amount: '', currency: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken || !canCreateDonations) {
      setError("Cannot submit form. Missing token or permissions.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const payload: any = { 
        ...formData,
        donorUserId: formData.donorUserId.trim() === '' ? null : formData.donorUserId,
        notes: formData.notes.trim() === '' ? null : formData.notes,
     };

    if (formData.donationType === 'monetary') {
      if (!formData.amount || parseFloat(formData.amount.toString()) <= 0) {
        setError("Amount must be a positive number for monetary donations.");
        setIsSubmitting(false);
        return;
      }
      if (!formData.currency.trim()) {
        setError("Currency is required for monetary donations.");
        setIsSubmitting(false);
        return;
      }
      payload.amount = parseFloat(formData.amount.toString());
      payload.currency = formData.currency.trim();
    } else {
      payload.amount = null; 
      payload.currency = null; 
    }

    if (!formData.description.trim()) { 
        setError("Description is required.");
        setIsSubmitting(false);
        return;
    }
    
    if (!formData.donorPhone.trim()) {
        setError("Donor phone number is required.");
        setIsSubmitting(false);
        return;
    }
    
    if (!formData.donorEmail.trim()) {
        setError("Donor email is required.");
        setIsSubmitting(false);
        return;
    }
    
    const result: ApiResponse<any> = await apiClient({ // Assuming any response for POST
      path: '/donations',
      token: idToken,
      method: 'POST',
      data: payload,
    });

    setIsSubmitting(false);

    if (result.ok) {
      setSuccessMessage('Donation recorded successfully! Redirecting...');
      setFormData(initialFormData); 
      setTimeout(() => {
        router.push('/dashboard/donations');
      }, 1500);
    } else {
      console.error('Failed to record donation:', result.error);
      if (result.status === 401) {
        await logout();
        // No local error state set for 401 as logout is initiated
        return; 
      }
      setError(result.error?.message || 'Failed to record donation.');
    }
  };
  
  if (authLoading || (!userProfile && user)) {
    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-800">
            <div className="text-center p-6">
                <svg className="animate-spin h-10 w-10 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Loading...</p>
            </div>
        </div>
    );
  }

  if (!user || (userProfile && !canCreateDonations && !error)) { 
    return (
        <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="mb-6">
                <Link href="/dashboard/donations" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                    <span className="material-icons text-lg mr-1">arrow_back_ios</span>
                    Back to Donations
                </Link>
            </div>
            <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-red-500 dark:text-red-400 mx-auto mb-3">lock</span>
                <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
                <p className="text-gray-700 dark:text-gray-300 mb-6">{error || "You don't have permission to record new donations."}</p>
            </div>
        </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/dashboard/donations" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          <span className="material-icons mr-1 text-lg">arrow_back_ios</span>
          Back to Donations List
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Record New Donation</h1>

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
      
      {canCreateDonations && (
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Donor Information Section */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Donor Information</h2>
                
                {/* User Search */}
                <div className="mb-4">
                  <label htmlFor="userSearch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Search Existing User (Optional)
                  </label>
                  <div className="relative" ref={searchRef}>
                    <input
                      type="text"
                      id="userSearch"
                      value={userSearchQuery}
                      onChange={handleUserSearchChange}
                      onFocus={() => setShowUserResults(true)}
                      placeholder="Type name or email to search users..."
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-3">
                        <span className="material-icons animate-spin text-gray-400">sync</span>
                      </div>
                    )}
                    
                    {/* Search Results Dropdown */}
                    {showUserResults && userSearchQuery.length >= 2 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {userSearchResults.length === 0 && !isSearching ? (
                          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No users found</div>
                        ) : (
                          userSearchResults.map((user) => {
                            const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                            return (
                              <div
                                key={user.id}
                                onClick={() => selectUser(user)}
                                className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                              >
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{displayName}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                  
                  {selectedUser && (
                    <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-md flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="material-icons text-green-500 text-sm mr-2">check_circle</span>
                        <span className="text-sm text-green-700 dark:text-green-300">
                          Selected: {`${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.email}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={clearUserSelection}
                        className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
                      >
                        <span className="material-icons text-sm">close</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="donorName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Donor Name <span className="text-red-500">*</span></label>
                        <input type="text" name="donorName" id="donorName" value={formData.donorName} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                    </div>
                    <div>
                        <label htmlFor="donorEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Donor Email <span className="text-red-500">*</span></label>
                        <input type="email" name="donorEmail" id="donorEmail" value={formData.donorEmail} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                    </div>
                    <div>
                        <label htmlFor="donorPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Donor Phone <span className="text-red-500">*</span></label>
                        <input type="tel" name="donorPhone" id="donorPhone" value={formData.donorPhone} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                    </div>
                </div>
            </div>

            {/* Donation Details Section */}
            <div className="pt-6 space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Donation Details</h2>
                <div>
                    <label htmlFor="donationDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Donation Date <span className="text-red-500">*</span></label>
                    <input type="date" name="donationDate" id="donationDate" value={formData.donationDate} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                    <label htmlFor="donationType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Donation Type <span className="text-red-500">*</span></label>
                    <select name="donationType" id="donationType" value={formData.donationType} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white">
                        <option value="monetary">Monetary</option>
                        <option value="in_kind">In-Kind</option>
                        <option value="time_contribution">Time Contribution</option>
                    </select>
                </div>
                {formData.donationType === 'monetary' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount <span className="text-red-500">*</span></label>
                            <input type="number" name="amount" id="amount" value={formData.amount} onChange={handleInputChange} required min="0.01" step="0.01" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                        </div>
                        <div>
                            <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency <span className="text-red-500">*</span></label>
                            <input type="text" name="currency" id="currency" value={formData.currency} onChange={handleInputChange} required maxLength={3} placeholder="e.g., SGD" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                        </div>
                    </div>
                )}
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description <span className="text-red-500">*</span>
                    {formData.donationType !== 'monetary' && <span className="text-xs text-gray-500 dark:text-gray-400"> (Details of items/time)</span>}
                    </label>
                    <textarea name="description" id="description" value={formData.description} onChange={handleInputChange} rows={3} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                    <textarea name="notes" id="notes" value={formData.notes} onChange={handleInputChange} rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-8 mt-4 border-t border-gray-200 dark:border-gray-700">
                <Link 
                    href="/dashboard/donations" 
                    className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
                >
                    <span className="material-icons mr-2 text-base">cancel</span>
                    Cancel
                </Link>
                <button type="submit" disabled={isSubmitting || !canCreateDonations} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 inline-flex items-center">
                    <span className={`material-icons mr-2 text-base ${isSubmitting ? 'animate-spin' : ''}`}>{isSubmitting ? 'sync' : 'add_circle_outline'}</span>
                    {isSubmitting ? 'Submitting...' : 'Record Donation'}
                </button>
            </div>
            </form>
        </div>
      )}
    </main>
  );
};

export default NewDonationPage;