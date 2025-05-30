"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient, { ApiResponse } from '@/lib/apiClient'; // Import ApiResponse
import { format, parseISO } from 'date-fns';

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

interface Donation {
  id: string;
  donorName: string;
  donorEmail?: string | null;
  donationType: 'monetary' | 'in_kind' | 'time_contribution';
  amount?: number | null;
  currency?: string | null;
  description: string;
  donationDate: string; // ISO date string
  status: 'pending_verification' | 'verified' | 'rejected' | 'could_not_verify' | 'dropped';
  recordedByUserId: string;
  recordedByUserFirstName?: string | null;
  recordedByUserLastName?: string | null;
  createdAt: string; // ISO datetime string
  updatedAt: string; // ISO datetime string
}

const DonationsPage = () => {
  const { user, idToken, loading: authLoading, hasPrivilege, userProfile, logout } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [filteredDonations, setFilteredDonations] = useState<Donation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const canViewDonations = userProfile && (hasPrivilege ? hasPrivilege('donations', 'list') : userProfile.assignedRoleIds?.includes('sysadmin'));
  const canCreateDonations = userProfile && (hasPrivilege ? hasPrivilege('donations', 'create') : userProfile.assignedRoleIds?.includes('sysadmin'));

  // Filter donations based on status
  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredDonations(donations);
    } else {
      setFilteredDonations(donations.filter(donation => donation.status === statusFilter));
    }
  }, [donations, statusFilter]);

  const pendingCount = donations.filter(d => d.status === 'pending_verification').length;

  const fetchDonations = useCallback(async () => {
    if (!idToken || !canViewDonations) { 
      if (user && userProfile && !canViewDonations) setError("You don't have permission to view donations.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    const result: ApiResponse<Donation[]> = await apiClient<Donation[]>({
      path: '/donations',
      token: idToken,
      method: 'GET',
    });

    if (result.ok && result.data) {
      setDonations(result.data);
      setIsLoading(false);
    } else {
      console.error('Failed to fetch donations:', result.error);
      if (result.status === 401) {
        console.warn("DonationsPage: Unauthorized (401) fetching donations. Logging out.");
        await logout(); 
        // setIsLoading(false) is not called here as component should unmount/redirect
        return; 
      } else {
        setError(result.error?.message || 'Failed to load donations.');
        setIsLoading(false);
      }
    }
  }, [idToken, canViewDonations, user, userProfile, logout]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        setIsLoading(false);
        return;
      }
      if (userProfile) { 
        fetchDonations();
      }
    }
  }, [authLoading, user, userProfile, fetchDonations]);


  if (authLoading || (!userProfile && user)) { 
    return <main className="max-w-7xl mx-auto text-center"><p className="text-gray-500 dark:text-gray-400 pt-8">Loading...</p></main>;
  }
  
  if (!canViewDonations && userProfile) { 
    return (
        <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
            <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-red-500 dark:text-red-400 mb-4">lock</span>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">Access Denied</h1>
                <p className="text-gray-700 dark:text-gray-300 mb-6">{error || "You do not have permission to view donations."}</p>
                <Link href="/dashboard" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm">
                    <span className="material-icons mr-2 text-base">arrow_back</span>
                    Go to Dashboard
                </Link>
            </div>
        </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto">
      <header className="mb-8 pt-8">
        <div className="flex justify-between items-center"> 
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Donations</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  View and manage all recorded donations.
                  {pendingCount > 0 && (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                      {pendingCount} pending verification
                    </span>
                  )}
                </p>
            </div>
            <div className="flex space-x-2">
              {canCreateDonations && (
                <Link href="/dashboard/donations/new" className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm transition-colors">
                  <span className="material-icons mr-1 text-sm">add</span>
                  Record New
                </Link>
              )}
              <Link href="/dashboard/donations/pending-verification" className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-md shadow-sm transition-colors">
                <span className="material-icons mr-1 text-sm">pending_actions</span>
                Review Pending ({pendingCount})
              </Link>
            </div>
        </div>
        
        {/* Status Filter */}
        <div className="mt-4">
          <div className="flex space-x-1">
            {['all', 'pending_verification', 'verified', 'rejected', 'could_not_verify', 'dropped'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  statusFilter === status
                    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {status === 'all' ? 'All' : statusLabels[status as keyof typeof statusLabels]}
                {status !== 'all' && (
                  <span className="ml-1 text-xs opacity-75">
                    ({donations.filter(d => d.status === status).length})
                  </span>
                )}
                {status === 'all' && (
                  <span className="ml-1 text-xs opacity-75">({donations.length})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>
      
      {isLoading && donations.length === 0 ? (
         <div className="text-center py-10 px-4 sm:px-6 lg:px-8"><p className="text-gray-500 dark:text-gray-400">Loading donations list...</p></div>
      ) : error && donations.length === 0 ? ( 
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-md shadow text-center">
            <p className="text-red-700 dark:text-red-300">Error: {error}</p>
            <button 
                onClick={fetchDonations} 
                className="mt-4 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
            >
                <span className="material-icons mr-2 text-base">refresh</span>
                Retry
            </button>
        </div>
      ) : !isLoading && donations.length === 0 ? (
        <div className="text-center py-10 bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6">
          <span className="material-icons text-5xl text-gray-400 dark:text-gray-500 mb-4">volunteer_activism</span>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No Donations Recorded</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            There are no donations recorded in the system yet.
            {canCreateDonations && (
                <Link href="/dashboard/donations/new" className="text-indigo-600 hover:underline dark:text-indigo-400 ml-1">Record one now</Link>
            )}
          </p>
        </div>
      ) : (
        <div className="shadow-xl border border-gray-200 dark:border-gray-700 sm:rounded-lg overflow-hidden mb-8">
          <div className="bg-white dark:bg-gray-900 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Donor</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount/Details</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Recorded By</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredDonations.map((donation) => (
                  <tr key={donation.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-150">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">{format(parseISO(donation.donationDate), 'MMM d, yyyy')}</td>
                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                      <div className="font-medium">{donation.donorName}</div>
                      {donation.donorEmail && <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]" title={donation.donorEmail}>{donation.donorEmail}</div>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100 capitalize">{donation.donationType.replace('_', ' ')}</td>
                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                      <div className="max-w-[200px]">
                        {donation.donationType === 'monetary' && donation.amount ? (
                          <span className="font-medium">{donation.amount.toFixed(2)} {donation.currency || ''}</span>
                        ) : (
                          <div className="truncate" title={donation.description}>{donation.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${statusColors[donation.status]}`}>
                        {statusLabels[donation.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                      <div className="truncate max-w-[100px]" title={`${donation.recordedByUserFirstName || donation.recordedByUserId} ${donation.recordedByUserLastName || ''}`.trim()}>
                        {donation.recordedByUserFirstName || donation.recordedByUserId} {donation.recordedByUserLastName || ''}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs font-medium">
                      <Link href={`/dashboard/donations/${donation.id}`} className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 inline-flex items-center">
                          <span className="material-icons text-sm">visibility</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
};

export default DonationsPage;