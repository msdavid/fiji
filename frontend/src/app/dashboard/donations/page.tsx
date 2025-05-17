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
  const { user, idToken, loading: authLoading, hasPrivilege } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canViewDonations = hasPrivilege ? hasPrivilege('donations', 'list') : false;
  const canCreateDonations = hasPrivilege ? hasPrivilege('donations', 'create') : false;

  const fetchDonations = useCallback(async () => {
    if (!idToken || !canViewDonations) {
      if (user && !canViewDonations) setError("You don't have permission to view donations.");
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
        params: { limit: 100, sort_by: 'donationDate', sort_order: 'desc' } // Example params
      });
      setDonations(data);
    } catch (err: any) {
      console.error('Failed to fetch donations:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load donations.');
    } finally {
      setIsLoading(false);
    }
  }, [idToken, canViewDonations, user]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        // router.push('/login'); // Handled by AuthContext or layout typically
        return;
      }
      fetchDonations();
    }
  }, [authLoading, user, fetchDonations]);

  if (authLoading || isLoading) {
    return <div className="p-8 text-center">Loading donations...</div>;
  }

  if (!canViewDonations && user) {
    return (
        <div className="p-8 text-center">
            <p className="text-red-500">{error || "You don't have permission to view donations."}</p>
        </div>
    );
  }
  
  if (error && donations.length === 0) {
     return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200">Donations</h1>
        {canCreateDonations && (
          <Link href="/dashboard/donations/new" legacyBehavior>
            <a className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm">
              Record New Donation
            </a>
          </Link>
        )}
      </div>

      {error && <p className="text-red-500 mb-4">Error fetching donations: {error}</p>}

      {donations.length === 0 && !isLoading && !error && (
        <p className="text-gray-600 dark:text-gray-400">No donations recorded yet.</p>
      )}

      {donations.length > 0 && (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Donor</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount/Details</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Recorded By</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {donations.map((donation) => (
                <tr key={donation.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{format(parseISO(donation.donationDate), 'PPP')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {donation.donorName}
                    {donation.donorEmail && <div className="text-xs text-gray-500 dark:text-gray-400">{donation.donorEmail}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 capitalize">{donation.donationType.replace('_', ' ')}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {donation.donationType === 'monetary' && donation.amount ? `${donation.amount.toFixed(2)} ${donation.currency}` : donation.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {donation.recordedByUserFirstName || donation.recordedByUserId} {donation.recordedByUserLastName || ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {/* Placeholder for View/Edit/Delete links if needed */}
                    <Link href={`/dashboard/donations/${donation.id}`} legacyBehavior>
                        <a className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200">View</a>
                    </Link>
                    {/* Add Edit/Delete links based on permissions later */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DonationsPage;