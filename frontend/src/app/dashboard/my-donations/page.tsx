"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient, { ApiResponse } from '@/lib/apiClient';
import { format } from 'date-fns';

interface Donation {
  id: string;
  donorName: string;
  donorEmail: string;
  donorPhone: string;
  donationType: 'monetary' | 'in_kind' | 'time_contribution';
  amount?: number;
  currency?: string;
  description: string;
  donationDate: string;
  notes?: string;
  status: 'pending_verification' | 'verified' | 'rejected' | 'could_not_verify' | 'dropped';
  createdAt: string;
  updatedAt: string;
  recordedByUserFirstName?: string;
  recordedByUserLastName?: string;
}

const statusColors = {
  pending_verification: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  verified: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  could_not_verify: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  dropped: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const statusLabels = {
  pending_verification: 'Pending Verification',
  verified: 'Verified',
  rejected: 'Rejected',
  could_not_verify: 'Could Not Verify',
  dropped: 'Withdrawn',
};

const MyDonationsPage = () => {
  const { user, sessionToken, loading: authLoading, userProfile } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState<string | null>(null);

  const fetchDonations = async () => {
    if (!sessionToken) return;
    
    setLoading(true);
    try {
      const result: ApiResponse<Donation[]> = await apiClient({
        path: '/donations/my-submissions',
        token: sessionToken,
        method: 'GET',
      });

      if (result.ok) {
        setDonations(result.data || []);
        setError(null);
      } else {
        setError(result.error?.message || 'Failed to load donations');
      }
    } catch (error) {
      console.error('Error fetching donations:', error);
      setError('Failed to load donations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && sessionToken) {
      fetchDonations();
    }
  }, [authLoading, sessionToken]);

  const handleWithdraw = async (donationId: string) => {
    if (!sessionToken) return;
    
    setIsWithdrawing(donationId);
    try {
      const result: ApiResponse<any> = await apiClient({
        path: `/donations/my-submissions/${donationId}/withdraw`,
        token: sessionToken,
        method: 'PATCH',
      });

      if (result.ok) {
        // Refresh the donations list
        await fetchDonations();
        setSelectedDonation(null);
      } else {
        setError(result.error?.message || 'Failed to withdraw donation');
      }
    } catch (error) {
      console.error('Error withdrawing donation:', error);
      setError('Failed to withdraw donation');
    } finally {
      setIsWithdrawing(null);
    }
  };

  const formatAmount = (amount?: number, currency?: string) => {
    if (!amount || !currency) return null;
    return `${currency} ${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
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

  if (!user) {
    return (
      <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8 text-center">
          <span className="material-icons text-5xl text-red-500 dark:text-red-400 mx-auto mb-3">lock</span>
          <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-6">Please log in to view your donations.</p>
          <Link href="/login" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
            Go to Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">My Donations</h1>
          <p className="text-gray-600 dark:text-gray-400">Track the status of your declared donations</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link 
            href="/dashboard/donate" 
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <span className="material-icons mr-2 text-base">volunteer_activism</span>
            Declare New Donation
          </Link>
        </div>
      </div>

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

      {loading ? (
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-8 text-center">
          <svg className="animate-spin h-8 w-8 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600 dark:text-gray-400">Loading your donations...</p>
        </div>
      ) : donations.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-8 text-center">
          <span className="material-icons text-6xl text-gray-400 dark:text-gray-500 mx-auto mb-4">volunteer_activism</span>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No Donations Yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">You haven't declared any donations yet.</p>
          <Link 
            href="/dashboard/donate" 
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <span className="material-icons mr-2 text-base">add</span>
            Declare Your First Donation
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Your Donations ({donations.length})
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Donation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type & Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {donations.map((donation) => (
                  <tr key={donation.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {donation.description.length > 50 
                            ? `${donation.description.substring(0, 50)}...` 
                            : donation.description}
                        </div>
                        {donation.notes && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {donation.notes.length > 30 
                              ? `${donation.notes.substring(0, 30)}...` 
                              : donation.notes}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {donation.donationType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                      {formatAmount(donation.amount, donation.currency) && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {formatAmount(donation.amount, donation.currency)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(donation.donationDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[donation.status]}`}>
                        {statusLabels[donation.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedDonation(donation)}
                          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          View
                        </button>
                        {donation.status === 'pending_verification' && (
                          <>
                            <Link
                              href={`/dashboard/my-donations/${donation.id}/edit`}
                              className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleWithdraw(donation.id)}
                              disabled={isWithdrawing === donation.id}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                            >
                              {isWithdrawing === donation.id ? 'Withdrawing...' : 'Withdraw'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Donation Details Modal */}
      {selectedDonation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" onClick={() => setSelectedDonation(null)}>
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Donation Details</h3>
              <button
                onClick={() => setSelectedDonation(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {selectedDonation.donationType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[selectedDonation.status]}`}>
                    {statusLabels[selectedDonation.status]}
                  </span>
                </div>
                {formatAmount(selectedDonation.amount, selectedDonation.currency) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {formatAmount(selectedDonation.amount, selectedDonation.currency)}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {formatDate(selectedDonation.donationDate)}
                  </p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {selectedDonation.description}
                </p>
              </div>
              
              {selectedDonation.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {selectedDonation.notes}
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500 dark:text-gray-400">
                <div>
                  <label className="block font-medium">Declared</label>
                  <p>{formatDate(selectedDonation.createdAt)}</p>
                </div>
                <div>
                  <label className="block font-medium">Last Updated</label>
                  <p>{formatDate(selectedDonation.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default MyDonationsPage;