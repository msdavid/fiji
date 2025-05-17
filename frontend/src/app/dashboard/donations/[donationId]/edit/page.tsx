'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';
import { format, parseISO } from 'date-fns';

interface DonationFormData {
  donorName: string;
  donorEmail: string | null;
  donorPhone: string | null;
  donationType: 'monetary' | 'in_kind' | 'time_contribution';
  amount: number | null;
  currency: string | null;
  description: string;
  donationDate: string; // YYYY-MM-DD
  notes: string | null;
}

interface Donation extends DonationFormData {
  id: string;
  recordedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export default function EditDonationPage() {
  const params = useParams();
  const router = useRouter();
  const donationId = params.donationId as string;

  const { user, idToken, loading: authLoading, userProfile, fetchUserProfile, hasPrivilege } = useAuth();

  const [formData, setFormData] = useState<DonationFormData>({
    donorName: '',
    donorEmail: null,
    donorPhone: null,
    donationType: 'monetary',
    amount: null,
    currency: 'USD', 
    description: '',
    donationDate: format(new Date(), 'yyyy-MM-dd'), 
    notes: null,
  });
  const [originalDonation, setOriginalDonation] = useState<Donation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null); // General page load error
  const [submitError, setSubmitError] = useState<string | null>(null); // Form submission error
  const [successMessage, setSuccessMessage] = useState<string | null>(null); // Form submission success

  const canEditDonation = userProfile && (hasPrivilege ? hasPrivilege('donations', 'edit') : userProfile.assignedRoleIds?.includes('sysadmin'));
  const canDeleteDonation = userProfile && (hasPrivilege ? hasPrivilege('donations', 'delete') : userProfile.assignedRoleIds?.includes('sysadmin'));

  const fetchDonationDetails = useCallback(async () => {
    if (!idToken || !donationId ) { // Removed canEditDonation from initial fetch blocking
      setIsLoading(false);
      return;
    }
    setIsLoading(true); setError(null);
    try {
      const donationData = await apiClient<Donation>({
        path: `/donations/${donationId}`,
        token: idToken,
        method: 'GET',
      });
      setOriginalDonation(donationData);
      setFormData({
        donorName: donationData.donorName,
        donorEmail: donationData.donorEmail || null,
        donorPhone: donationData.donorPhone || null,
        donationType: donationData.donationType,
        amount: donationData.amount || null,
        currency: donationData.currency || 'USD',
        description: donationData.description,
        donationDate: donationData.donationDate ? format(parseISO(donationData.donationDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        notes: donationData.notes || null,
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch donation details.');
    } finally {
      setIsLoading(false);
    }
  }, [idToken, donationId]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user && !userProfile) fetchUserProfile();
    if (user && userProfile && idToken && donationId) { // Ensure userProfile is loaded before fetching
      fetchDonationDetails();
    }
  }, [user, authLoading, userProfile, fetchUserProfile, idToken, donationId, router, fetchDonationDetails]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (name === "donationType" && value !== "monetary") {
        setFormData(prev => ({
            ...prev,
            donationType: value as DonationFormData['donationType'],
            amount: null, 
            currency: null 
        }));
    } else if (type === 'number' && name === 'amount') {
        setFormData(prev => ({ ...prev, [name]: value === '' ? null : parseFloat(value) }));
    }
    else {
        setFormData(prev => ({ ...prev, [name]: value === '' && (name === 'donorEmail' || name === 'donorPhone' || name === 'notes' || name === 'currency') ? null : value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditDonation || !originalDonation) {
      setSubmitError("Cannot submit: Insufficient permissions or original data missing.");
      return;
    }
    if (!formData.donorName.trim()) {
        setSubmitError("Donor Name cannot be empty.");
        return;
    }
    if (formData.donationType === 'monetary' && (formData.amount == null || formData.amount <= 0)) {
        setSubmitError("Amount must be a positive number for monetary donations.");
        return;
    }
    if (formData.donationType === 'monetary' && !formData.currency?.trim()) {
        setSubmitError("Currency is required for monetary donations.");
        return;
    }
    if (!formData.description.trim()) {
        setSubmitError("Description cannot be empty.");
        return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      if (!idToken) throw new Error("Authentication token not available.");
      
      const payload: Partial<DonationFormData> = {};
      (Object.keys(formData) as Array<keyof DonationFormData>).forEach(key => {
        let formVal = formData[key];
        let originalVal = originalDonation[key];
        if (key === 'donorEmail' || key === 'donorPhone' || key === 'notes' || key === 'currency' || key === 'amount') {
            if (formVal === '') formVal = null;
            if (originalVal === '') originalVal = null;
        }
        if (key === 'donationDate' && originalDonation.donationDate) {
            originalVal = format(parseISO(originalDonation.donationDate), 'yyyy-MM-dd');
        }
        if (formVal !== originalVal) {
          // @ts-ignore
          payload[key] = formVal;
        }
      });
      
      if (formData.donationType === 'monetary' && originalDonation.donationType !== 'monetary') {
        payload.amount = formData.amount;
        payload.currency = formData.currency;
      }
      if (formData.donationType !== 'monetary' && originalDonation.donationType === 'monetary') {
        payload.amount = null;
        payload.currency = null;
      }

      if (Object.keys(payload).length === 0) {
        setSubmitError("No changes detected to submit.");
        setIsSubmitting(false);
        return;
      }
      
      await apiClient({
        path: `/donations/${donationId}`,
        token: idToken,
        method: 'PUT',
        data: payload,
      });
      setSuccessMessage('Donation updated successfully!');
      setTimeout(() => {
        router.push(`/dashboard/donations/${donationId}`);
      }, 1500);
    } catch (err: any) {
      setSubmitError(err.response?.data?.detail || err.message || 'Failed to update donation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDonation = async () => {
    if (!canDeleteDonation || !originalDonation) {
        setSubmitError("Cannot delete: Insufficient permissions or donation data missing."); // Use submitError for consistency
        return;
    }
    if (!confirm(`Are you sure you want to delete this donation from "${originalDonation.donorName}"? This action cannot be undone.`)) return;

    setIsDeleting(true);
    setSubmitError(null); // Clear submit error before attempting delete
    setSuccessMessage(null);
    try {
        if (!idToken) throw new Error("Authentication token not available.");
        await apiClient({
            path: `/donations/${donationId}`,
            token: idToken,
            method: 'DELETE',
        });
        alert('Donation deleted successfully!'); // Simple alert for now
        router.push('/dashboard/donations');
    } catch (err: any) {
        setSubmitError(err.response?.data?.detail || err.message || 'Failed to delete donation.'); // Use submitError
    } finally {
        setIsDeleting(false);
    }
  };

  if (authLoading || isLoading || (user && !userProfile && !error) ) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-800">
        <div className="text-center p-6">
          <svg className="animate-spin h-10 w-10 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Loading donation for editing...</p>
        </div>
      </div>
    );
  }
  
  // Page-level error (e.g., failed to fetch initial data) or access denied
  if (error || (userProfile && !canEditDonation && !isLoading) || (!isLoading && !originalDonation && !error)) {
    const displayError = error || (userProfile && !canEditDonation ? "Access Denied. You do not have permission to edit this donation." : "Donation not found for editing.");
    const isAccessDenied = userProfile && !canEditDonation;
    return (
        <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="mb-6">
                <Link href={originalDonation ? `/dashboard/donations/${donationId}` : "/dashboard/donations"} className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                    <span className="material-icons text-lg mr-1">arrow_back_ios</span>
                    {originalDonation ? "Back to Donation Details" : "Back to Donations List"}
                </Link>
            </div>
            <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8 text-center">
                <span className={`material-icons text-5xl mx-auto mb-3 ${isAccessDenied ? 'text-red-500 dark:text-red-400' : 'text-yellow-500 dark:text-yellow-400'}`}>{isAccessDenied ? 'lock' : 'error_outline'}</span>
                <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">{isAccessDenied ? "Access Denied" : "Error"}</h1>
                <div className={`${isAccessDenied ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'} p-4 rounded-md mb-6`}>
                    <p className="text-sm">{displayError}</p>
                </div>
            </div>
        </main>
    );
  }
  
  // This should ideally not be reached if the above covers all states
  if (!originalDonation) {
      return <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center"><p>Donation data is unavailable.</p></main>;
  }
  
  return (
    <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
            <Link href={`/dashboard/donations/${donationId}`} className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                <span className="material-icons text-lg mr-1">arrow_back_ios</span>
                Back to Donation Details
            </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            Edit Donation: <span className="text-indigo-600 dark:text-indigo-400">{originalDonation?.donorName}</span>
        </h1>

        {successMessage && (
            <div className="mb-6 p-4 text-sm text-green-700 bg-green-100 dark:bg-green-700 dark:text-green-100 rounded-lg shadow-md" role="alert">
            <span className="font-medium">Success!</span> {successMessage}
            </div>
        )}
        {submitError && ( // Changed from deleteError to submitError for general form errors
            <div className="mb-6 p-4 text-sm text-red-700 bg-red-100 dark:bg-red-700 dark:text-red-100 rounded-lg shadow-md" role="alert">
            <span className="font-medium">Error:</span> {submitError}
            </div>
        )}

        {canEditDonation && (
            <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Donor Information Section */}
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Donor Information</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="donorName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Donor Name <span className="text-red-500">*</span></label>
                                <input type="text" name="donorName" id="donorName" value={formData.donorName} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                            </div>
                            <div>
                                <label htmlFor="donorEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Donor Email</label>
                                <input type="email" name="donorEmail" id="donorEmail" value={formData.donorEmail || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                            </div>
                            <div>
                                <label htmlFor="donorPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Donor Phone</label>
                                <input type="tel" name="donorPhone" id="donorPhone" value={formData.donorPhone || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                            </div>
                        </div>
                    </div>

                    {/* Donation Details Section */}
                    <div className="pt-6 space-y-4">
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Donation Details</h2>
                        <div>
                            <label htmlFor="donationDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Donation Date <span className="text-red-500">*</span></label>
                            <input type="date" name="donationDate" id="donationDate" value={formData.donationDate} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                        </div>
                        <div>
                            <label htmlFor="donationType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Donation Type <span className="text-red-500">*</span></label>
                            <select name="donationType" id="donationType" value={formData.donationType} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white">
                                <option value="monetary">Monetary</option>
                                <option value="in_kind">In-Kind</option>
                                <option value="time_contribution">Time Contribution</option>
                            </select>
                        </div>
                        {formData.donationType === 'monetary' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount <span className="text-red-500">*</span></label>
                                    <input type="number" name="amount" id="amount" value={formData.amount || ''} onChange={handleChange} required min="0.01" step="0.01" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                                </div>
                                <div>
                                    <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency <span className="text-red-500">*</span></label>
                                    <input type="text" name="currency" id="currency" value={formData.currency || ''} onChange={handleChange} required maxLength={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" placeholder="e.g., USD, EUR"/>
                                </div>
                            </div>
                        )}
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description <span className="text-red-500">*</span></label>
                            <textarea name="description" id="description" rows={3} value={formData.description} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                        </div>
                        <div>
                            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                            <textarea name="notes" id="notes" rows={3} value={formData.notes || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" />
                        </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row justify-between items-center pt-8 mt-4 border-t border-gray-200 dark:border-gray-700 space-y-4 sm:space-y-0">
                        <div>
                            {canDeleteDonation && (
                                <button 
                                    type="button" 
                                    onClick={handleDeleteDonation}
                                    disabled={isDeleting || isSubmitting}
                                    className="w-full sm:w-auto py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 inline-flex items-center justify-center"
                                >
                                    <span className="material-icons mr-2 text-base">{isDeleting ? 'hourglass_empty' : 'delete_forever'}</span>
                                    {isDeleting ? 'Deleting...' : 'Delete Donation'}
                                </button>
                            )}
                        </div>
                        <div className="flex space-x-3 w-full sm:w-auto justify-end">
                            <Link href={`/dashboard/donations/${donationId}`} legacyBehavior>
                                <a className="w-full sm:w-auto py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center justify-center">
                                    <span className="material-icons mr-2 text-base">cancel</span>
                                    Cancel
                                </a>
                            </Link>
                            <button
                                type="submit"
                                disabled={isSubmitting || isDeleting || isLoading}
                                className="w-full sm:w-auto py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 inline-flex items-center justify-center"
                            >
                                <span className="material-icons mr-2 text-base">{isSubmitting ? 'hourglass_empty' : 'save'}</span>
                                {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        )}
    </main>
  );
}