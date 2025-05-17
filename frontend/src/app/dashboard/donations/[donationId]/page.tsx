"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';
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
  donationDate: string; // ISO date string "YYYY-MM-DD"
  notes?: string | null;
  recordedByUserId: string;
  recordedByUserFirstName?: string | null;
  recordedByUserLastName?: string | null;
  createdAt: string; // ISO datetime string
  updatedAt: string; // ISO datetime string
}

const DonationDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const donationId = params.donationId as string;

  const { user, idToken, loading: authLoading, hasPrivilege } = useAuth();
  const [donation, setDonation] = useState<Donation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canViewDonation = hasPrivilege ? hasPrivilege('donations', 'view') : false;

  const fetchDonationDetails = useCallback(async () => {
    if (!idToken || !donationId) {
      setIsLoading(false);
      return;
    }

    if (!authLoading && user && !canViewDonation) {
      setError("You don't have permission to view this donation.");
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient<Donation>({
        path: `/donations/${donationId}`,
        token: idToken,
        method: 'GET',
      });
      setDonation(data);
    } catch (err: any) {
      console.error('Failed to fetch donation details:', err);
      if (err.response?.status === 404) {
        setError(`Donation with ID "${donationId}" not found.`);
      } else {
        setError(err.response?.data?.detail || err.message || 'Failed to load donation details.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [idToken, donationId, authLoading, user, canViewDonation]);

  useEffect(() => {
    if (!authLoading) { 
        if (user) { 
            fetchDonationDetails();
        } else if (!user && !authLoading) { 
            setError("You must be logged in to view this page.");
            setIsLoading(false);
        }
    }
  }, [authLoading, user, fetchDonationDetails]);

  if (authLoading || isLoading) {
    return <div className="py-8 text-center">Loading donation details...</div>; // Adjusted padding
  }

  if (!user && !authLoading) {
     return (
        <div className="py-8 text-center"> {/* Adjusted padding */}
            <p className="text-red-500">{error || "You must be logged in."}</p>
            <Link href="/login" className="text-indigo-600 hover:underline">Go to Login</Link>
        </div>
    );
  }
  
  if (!canViewDonation && user) {
    return (
        <div className="py-8 text-center"> {/* Adjusted padding */}
            <p className="text-red-500">{error || "You don't have permission to view this donation."}</p>
            <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
              Go Back
            </button>
        </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center"> {/* Adjusted padding */}
        <p className="text-red-500">Error: {error}</p>
        <Link href="/dashboard/donations" className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
          Back to Donations List
        </Link>
      </div>
    );
  }

  if (!donation) {
    return (
      <div className="py-8 text-center"> {/* Adjusted padding */}
        <p>Donation not found.</p>
        <Link href="/dashboard/donations" className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
          Back to Donations List
        </Link>
      </div>
    );
  }

  const DetailItem = ({ label, value }: { label: string; value?: string | number | null }) => (
    value ? (
      <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">{value}</dd>
      </div>
    ) : null
  );

  return (
    <div> {/* Removed container mx-auto p-4 sm:p-6 */}
      <div className="mb-6">
        <Link href="/dashboard/donations" className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200">
          ← Back to Donations List
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Donation Details
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            ID: {donation.id}
          </p>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
            <div className="sm:px-6 py-3"> {/* Padding adjusted for sections within the card */}
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Donor Information</h3>
                <DetailItem label="Donor Name" value={donation.donorName} />
                <DetailItem label="Donor Email" value={donation.donorEmail} />
                <DetailItem label="Donor Phone" value={donation.donorPhone} />
            </div>

            <div className="sm:px-6 py-3"> {/* Padding adjusted for sections within the card */}
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Donation Information</h3>
                <DetailItem label="Donation Date" value={format(parseISO(donation.donationDate), 'PPP')} />
                <DetailItem label="Type" value={donation.donationType.replace('_', ' ')} />
                {donation.donationType === 'monetary' && (
                    <>
                        <DetailItem label="Amount" value={donation.amount?.toFixed(2)} />
                        <DetailItem label="Currency" value={donation.currency} />
                    </>
                )}
                <DetailItem label="Description" value={donation.description} />
                <DetailItem label="Notes" value={donation.notes} />
            </div>
            
            <div className="sm:px-6 py-3"> {/* Padding adjusted for sections within the card */}
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Record Information</h3>
                <DetailItem label="Recorded By" value={`${donation.recordedByUserFirstName || ''} ${donation.recordedByUserLastName || ''}`.trim() || donation.recordedByUserId} />
                <DetailItem label="Created At" value={format(parseISO(donation.createdAt), 'PPP p')} />
                <DetailItem label="Last Updated At" value={format(parseISO(donation.updatedAt), 'PPP p')} />
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};

export default DonationDetailPage;