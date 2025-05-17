"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';
import { format, parseISO } from 'date-fns';

interface Donation {
  id: string;
  donorName: string;
  donorEmail?: string | null;
  donationType: 'monetary' | 'in_kind' | 'time_contribution';
  amount?: number | null;
  currency?: string | null;
  description: string;
  donationDate: string; // ISO date string
  recordedByUserId: string;
  recordedByUserFirstName?: string | null;
  recordedByUserLastName?: string | null;
  createdAt: string; // ISO datetime string
  updatedAt: string; // ISO datetime string
}

const DonationsPage = () => {
  const { user, idToken, loading: authLoading, hasPrivilege, userProfile } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canViewDonations = userProfile && (hasPrivilege ? hasPrivilege('donations', 'list') : userProfile.assignedRoleIds?.includes('sysadmin'));
  const canCreateDonations = userProfile && (hasPrivilege ? hasPrivilege('donations', 'create') : userProfile.assignedRoleIds?.includes('sysadmin'));

  const fetchDonations = useCallback(async () => {
    if (!idToken || !canViewDonations) { 
      if (user && userProfile && !canViewDonations) setError("You don't have permission to view donations.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient<Donation[]>({
        path: '/donations',
        token: idToken,
        method: 'GET',
        params: { limit: 100, sort_by: 'donationDate', sort_order: 'desc' }
      });
      setDonations(data);
    } catch (err: any) {
      console.error('Failed to fetch donations:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load donations.');
    } finally {
      setIsLoading(false);
    }
  }, [idToken, canViewDonations, user, userProfile]);

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
            <div> {/* Removed padding from this div */}
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Donations</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">View and manage all recorded donations.</p>
            </div>
            {canCreateDonations && (
            <div> {/* Removed padding from this div */}
              <Link href="/dashboard/donations/new">
                  <button className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm inline-flex items-center text-sm">
                      <span className="material-icons mr-2 text-base">add_circle_outline</span>
                      Record New Donation
                  </button>
              </Link>
            </div>
            )}
        </div>
      </header>

      {/* Placeholder for Search/Filter bar - to be implemented if needed */}
      {/* 
      <div className="mb-6 bg-white dark:bg-gray-900 rounded-lg shadow-md px-4 py-4">
        <input
          type="text"
          placeholder="Search donations..."
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-white"
        />
      </div> 
      */}
      
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
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Donor</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount/Details</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Recorded By</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {donations.map((donation) => (
                  <tr key={donation.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{format(parseISO(donation.donationDate), 'PPP')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {donation.donorName}
                      {donation.donorEmail && <div className="text-xs text-gray-500 dark:text-gray-400">{donation.donorEmail}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 capitalize">{donation.donationType.replace('_', ' ')}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {donation.donationType === 'monetary' && donation.amount ? `${donation.amount.toFixed(2)} ${donation.currency || ''}`.trim() : donation.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {donation.recordedByUserFirstName || donation.recordedByUserId} {donation.recordedByUserLastName || ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link href={`/dashboard/donations/${donation.id}`} className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 inline-flex items-center">
                          <span className="material-icons mr-1 text-sm">visibility</span>View
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