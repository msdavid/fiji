"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient, { ApiResponse } from '@/lib/apiClient'; // Import ApiResponse
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

const DetailItem = ({ icon, label, value, isPreformatted = false, valueClassName }: { icon: string; label: string; value: React.ReactNode; isPreformatted?: boolean; valueClassName?: string; }) => {
  if (!value && typeof value !== 'number' && typeof value !== 'boolean') return null;
  
  let displayValue = value;
  if (Array.isArray(value)) {
    displayValue = value.length > 0 ? value.join(', ') : 'N/A';
  } else if (value === null || value === undefined || value === '') {
    displayValue = 'N/A';
  }

  return (
    <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <span className="material-icons text-indigo-600 dark:text-indigo-400 mt-1 text-lg">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        {isPreformatted ? (
          <pre className={`mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words w-full ${valueClassName || ''}`}>
            {displayValue}
          </pre>
        ) : (
          <p className={`mt-1 text-sm text-gray-700 dark:text-gray-300 break-words ${valueClassName || ''}`}>
            {displayValue}
          </p>
        )}
      </div>
    </div>
  );
};


const DonationDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const donationId = params.donationId as string;

  const { user, idToken, loading: authLoading, userProfile, fetchUserProfile, hasPrivilege, logout } = useAuth(); // Added logout
  const [donation, setDonation] = useState<Donation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canViewDonation = userProfile && (hasPrivilege ? hasPrivilege('donations', 'view') : userProfile.assignedRoleIds?.includes('sysadmin'));
  const canEditDonation = userProfile && (hasPrivilege ? hasPrivilege('donations', 'edit') : userProfile.assignedRoleIds?.includes('sysadmin'));


  const fetchDonationDetails = useCallback(async () => {
    if (!idToken || !donationId) {
      setIsLoading(false);
      return;
    }

    if (!authLoading && user && userProfile && !canViewDonation) {
      setError("You don't have permission to view this donation.");
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);

    const result: ApiResponse<Donation> = await apiClient<Donation>({
      path: `/donations/${donationId}`,
      token: idToken,
      method: 'GET',
    });

    setIsLoading(false); // Set loading false after API call

    if (result.ok && result.data) {
      setDonation(result.data);
    } else {
      console.error('Failed to fetch donation details:', result.error);
      if (result.status === 401) {
        await logout();
        return; 
      } else if (result.status === 404) {
        setError(`Donation with ID "${donationId}" not found.`);
      } else {
        setError(result.error?.message || 'Failed to load donation details.');
      }
    }
  }, [idToken, donationId, authLoading, user, userProfile, canViewDonation, logout]); // Added logout

  useEffect(() => {
    if (!authLoading && !user) {
        // router.push('/login'); // Handled by AuthContext/DashboardLayout
        return;
    }
    if (user && !userProfile && fetchUserProfile) { 
        fetchUserProfile();
    }
    if (user && userProfile && idToken) { 
        fetchDonationDetails();
    }
  }, [authLoading, user, userProfile, fetchUserProfile, idToken, router, fetchDonationDetails]);


  const getDonationTitle = (donationData: Donation | null): string => { // Renamed parameter
    if (!donationData) return "Donation Details";
    switch (donationData.donationType) {
        case 'monetary':
            return `Monetary Donation from ${donationData.donorName}`;
        case 'in_kind':
            return `In-Kind Donation from ${donationData.donorName}`;
        case 'time_contribution':
            return `Time Contribution from ${donationData.donorName}`;
        default:
            return `Donation from ${donationData.donorName}`;
    }
  };

  const getDonationIcon = (donationType?: string): string => {
    switch (donationType) {
        case 'monetary': return 'paid';
        case 'in_kind': return 'redeem';
        case 'time_contribution': return 'schedule';
        default: return 'volunteer_activism';
    }
  };


  if (authLoading || isLoading || (user && !userProfile && !error)) { 
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-800">
        <div className="text-center p-6">
          <svg className="animate-spin h-10 w-10 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Loading donation details...</p>
        </div>
      </div>
    );
  }
  
  if (error || (!isLoading && !donation) || (userProfile && !canViewDonation)) {
    const displayError = error || (userProfile && !canViewDonation ? "Access Denied. You do not have permission to view this donation." : "Donation not found.");
    const icon = error || (userProfile && !canViewDonation) ? "lock" : "search_off";
    const title = error || (userProfile && !canViewDonation) ? "Error Viewing Donation" : "Donation Not Found";

    return (
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
            <Link href="/dashboard/donations" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                <span className="material-icons mr-1 text-lg">arrow_back</span>
                Back to Donations List
            </Link>
        </div>
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8 text-center">
          <span className={`material-icons text-5xl mx-auto mb-3 ${icon === 'lock' ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>{icon}</span>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">{title}</h1>
          <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-md mb-6">
            <p className="text-red-600 dark:text-red-400 text-sm">{displayError}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!donation) { 
    return (
        <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center">
            <p>Donation data is unexpectedly unavailable.</p>
        </main>
    );
  }


  return (
    <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/dashboard/donations" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 group">
          <span className="material-icons text-lg mr-1 group-hover:text-indigo-500 dark:group-hover:text-indigo-300">arrow_back_ios</span>
          Back to Donations List
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-6 border-b border-gray-200 dark:border-gray-700"> 
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0 w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center">
                  <span className="material-icons text-3xl text-indigo-600 dark:text-indigo-300">{getDonationIcon(donation.donationType)}</span>
              </div>
              <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{getDonationTitle(donation)}</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Recorded: {format(parseISO(donation.createdAt), 'PPP p')}</p>
              </div>
            </div>
            {canEditDonation && (
              <Link href={`/dashboard/donations/${donation.id}/edit`} className="mt-4 sm:mt-0">
                  <button className="inline-flex items-center py-2 px-4 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-md shadow-sm">
                      <span className="material-icons mr-2 text-base">edit</span>
                      Edit Donation
                  </button>
              </Link>
            )}
          </div>

          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Donor Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <DetailItem icon="person" label="Donor Name" value={donation.donorName} />
            <DetailItem icon="email" label="Donor Email" value={donation.donorEmail} />
            <DetailItem icon="phone" label="Donor Phone" value={donation.donorPhone} />
          </div>

          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">Donation Specifics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <DetailItem icon="event_note" label="Donation Date" value={format(parseISO(donation.donationDate), 'PPP')} />
            <DetailItem icon="category" label="Type" value={donation.donationType.replace(/_/g, ' ')} />
            {donation.donationType === 'monetary' && (
                <>
                    <DetailItem icon="attach_money" label="Amount" value={donation.amount?.toFixed(2)} />
                    <DetailItem icon="savings" label="Currency" value={donation.currency} />
                </>
            )}
          </div>
          {donation.description && ( 
              <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2 inline-flex items-center">
                      <span className="material-icons mr-2 text-indigo-500 dark:text-indigo-400">description</span>
                      Description
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{donation.description}</p>
              </div>
          )}
          {donation.notes && ( 
              <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2 inline-flex items-center">
                      <span className="material-icons mr-2 text-indigo-500 dark:text-indigo-400">sticky_note_2</span>
                      Notes
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{donation.notes}</p>
              </div>
          )}
          
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">Administrative Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DetailItem 
                icon="badge" 
                label="Recorded By" 
                value={`${donation.recordedByUserFirstName || ''} ${donation.recordedByUserLastName || ''}`.trim() || donation.recordedByUserId} 
            />
            <DetailItem icon="update" label="Last Updated" value={format(parseISO(donation.updatedAt), 'PPP p')} />
          </div>
        </div>
      </div>
    </main>
  );
};

export default DonationDetailPage;