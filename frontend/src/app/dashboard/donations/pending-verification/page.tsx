"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient, { ApiResponse } from '@/lib/apiClient';
import { format, parseISO } from 'date-fns';

interface Donation {
  id: string;
  donorName: string;
  donorEmail?: string | null;
  donorPhone?: string | null;
  donationType: 'monetary' | 'in_kind' | 'time_contribution';
  amount?: number | null;
  currency?: string | null;
  description: string;
  donationDate: string;
  notes?: string | null;
  status: 'pending_verification' | 'verified' | 'rejected' | 'could_not_verify' | 'dropped';
  recordedByUserId: string;
  recordedByUserFirstName?: string | null;
  recordedByUserLastName?: string | null;
  createdAt: string;
  updatedAt: string;
}

const statusOptions = [
  { value: 'verified', label: 'Verified', color: 'bg-green-600 hover:bg-green-700' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-600 hover:bg-red-700' },
  { value: 'could_not_verify', label: 'Could Not Verify', color: 'bg-orange-600 hover:bg-orange-700' },
];

const PendingVerificationPage = () => {
  const { user, sessionToken, loading: authLoading, hasPrivilege, userProfile, logout } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [statusNotes, setStatusNotes] = useState<string>('');

  const canManageDonations = userProfile && (hasPrivilege ? hasPrivilege('donations', 'edit') : userProfile.assignedRoleIds?.includes('sysadmin'));

  const fetchPendingDonations = useCallback(async () => {
    if (!sessionToken || !canManageDonations) { 
      if (user && userProfile && !canManageDonations) setError("You don't have permission to manage donations.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    const result: ApiResponse<Donation[]> = await apiClient<Donation[]>({
      path: '/donations/pending-verification',
      token: sessionToken,
      method: 'GET',
    });

    if (result.ok && result.data) {
      console.log('Pending donations fetched successfully:', result.data);
      setDonations(result.data);
      setIsLoading(false);
    } else {
      console.error('Failed to fetch pending donations:', result.error);
      console.error('Full response:', result);
      if (result.status === 401) {
        console.warn("PendingVerificationPage: Unauthorized (401) fetching donations. Logging out.");
        await logout(); 
        return; 
      } else {
        setError(result.error?.message || 'Failed to load pending donations.');
        setIsLoading(false);
      }
    }
  }, [sessionToken, canManageDonations, user, userProfile, logout]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        setIsLoading(false);
        return;
      }
      if (userProfile) { 
        fetchPendingDonations();
      }
    }
  }, [authLoading, user, userProfile, fetchPendingDonations]);

  const updateDonationStatus = async (donationId: string, newStatus: string, notes: string = '') => {
    if (!sessionToken) return;
    
    setIsUpdating(donationId);
    try {
      const result: ApiResponse<Donation> = await apiClient({
        path: `/donations/${donationId}/status`,
        token: sessionToken,
        method: 'PATCH',
        data: {
          status: newStatus,
          notes: notes.trim() || null,
        },
      });

      if (result.ok) {
        // Remove the donation from the list since it's no longer pending
        setDonations(prev => prev.filter(d => d.id !== donationId));
        setSelectedDonation(null);
        setStatusNotes('');
      } else {
        setError(result.error?.message || 'Failed to update donation status');
      }
    } catch (error) {
      console.error('Error updating donation status:', error);
      setError('Failed to update donation status');
    } finally {
      setIsUpdating(null);
    }
  };

  const formatAmount = (amount?: number, currency?: string) => {
    if (!amount || !currency) return null;
    return `${currency} ${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
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
  
  if (!canManageDonations && userProfile) { 
    return (
      <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6 sm:p-8 text-center">
          <span className="material-icons text-5xl text-red-500 dark:text-red-400 mb-4">lock</span>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">Access Denied</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-6">{error || "You do not have permission to manage donations."}</p>
          <Link href="/dashboard" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm">
            <span className="material-icons mr-2 text-base">arrow_back</span>
            Go to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/dashboard/donations" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          <span className="material-icons mr-1 text-lg">arrow_back_ios</span>
          Back to All Donations
        </Link>
      </div>

      <header className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pending Verification</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Review and verify submitted donations ({donations.length} pending)
            </p>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 text-sm text-red-700 bg-red-100 dark:bg-red-700 dark:text-red-100 rounded-lg shadow-md" role="alert">
          <div className="flex items-start">
            <span className="material-icons text-red-600 dark:text-red-300 mr-2 mt-0.5">error</span>
            <div>
              <span className="font-medium">Error:</span> {error}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-8 text-center">
          <svg className="animate-spin h-8 w-8 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600 dark:text-gray-400">Loading pending donations...</p>
        </div>
      ) : donations.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-8 text-center">
          <span className="material-icons text-6xl text-green-400 dark:text-green-500 mx-auto mb-4">check_circle</span>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">All Caught Up!</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">There are no donations pending verification.</p>
          <Link 
            href="/dashboard/donations" 
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <span className="material-icons mr-2 text-base">list</span>
            View All Donations
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {donations.map((donation) => (
            <div key={donation.id} className="bg-white dark:bg-gray-900 shadow-xl rounded-xl overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {donation.donorName}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Submitted on {formatDate(donation.createdAt)}
                    </p>
                  </div>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                    Pending Verification
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contact Information</h4>
                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <p><span className="font-medium">Email:</span> {donation.donorEmail}</p>
                      <p><span className="font-medium">Phone:</span> {donation.donorPhone}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Donation Details</h4>
                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <p><span className="font-medium">Type:</span> {donation.donationType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                      {formatAmount(donation.amount, donation.currency) && (
                        <p><span className="font-medium">Amount:</span> {formatAmount(donation.amount, donation.currency)}</p>
                      )}
                      <p><span className="font-medium">Date:</span> {formatDate(donation.donationDate)}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                    {donation.description}
                  </p>
                  {donation.notes && (
                    <>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mt-4">Additional Notes</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {donation.notes}
                      </p>
                    </>
                  )}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => updateDonationStatus(donation.id, option.value)}
                        disabled={isUpdating === donation.id}
                        className={`inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white ${option.color} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50`}
                      >
                        {isUpdating === donation.id ? (
                          <span className="material-icons animate-spin mr-2 text-sm">sync</span>
                        ) : (
                          <span className="material-icons mr-2 text-sm">
                            {option.value === 'verified' ? 'check_circle' : 
                             option.value === 'rejected' ? 'cancel' : 'help'}
                          </span>
                        )}
                        {option.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setSelectedDonation(donation)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      <span className="material-icons mr-2 text-sm">edit</span>
                      Add Notes & Update
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status Update Modal */}
      {selectedDonation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" onClick={() => setSelectedDonation(null)}>
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Update Donation Status
              </h3>
              <button
                onClick={() => setSelectedDonation(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span className="font-medium">Donation from:</span> {selectedDonation.donorName}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                {selectedDonation.description}
              </p>
            </div>

            <div className="mb-4">
              <label htmlFor="status-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes (Optional)
              </label>
              <textarea
                id="status-notes"
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                rows={3}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                placeholder="Add any notes about this status change..."
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateDonationStatus(selectedDonation.id, option.value, statusNotes)}
                  disabled={isUpdating === selectedDonation.id}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${option.color} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50`}
                >
                  {isUpdating === selectedDonation.id ? (
                    <span className="material-icons animate-spin mr-2 text-sm">sync</span>
                  ) : (
                    <span className="material-icons mr-2 text-sm">
                      {option.value === 'verified' ? 'check_circle' : 
                       option.value === 'rejected' ? 'cancel' : 'help'}
                    </span>
                  )}
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default PendingVerificationPage;