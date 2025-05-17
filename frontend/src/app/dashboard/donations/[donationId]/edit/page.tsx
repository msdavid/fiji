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
    currency: 'USD', // Default currency
    description: '',
    donationDate: format(new Date(), 'yyyy-MM-dd'), // Default to today
    notes: null,
  });
  const [originalDonation, setOriginalDonation] = useState<Donation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canEditDonation = userProfile && (hasPrivilege ? hasPrivilege('donations', 'edit') : userProfile.assignedRoleIds?.includes('sysadmin'));
  const canDeleteDonation = userProfile && (hasPrivilege ? hasPrivilege('donations', 'delete') : userProfile.assignedRoleIds?.includes('sysadmin'));

  const fetchDonationDetails = useCallback(async () => {
    if (!idToken || !donationId || !canEditDonation) {
      if (user && userProfile && !canEditDonation && !authLoading) {
        setError("You don't have permission to edit this donation.");
      }
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
  }, [idToken, donationId, canEditDonation, user, userProfile, authLoading]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user && !userProfile) fetchUserProfile();
    if (user && userProfile && idToken && donationId) {
      fetchDonationDetails();
    }
  }, [user, authLoading, userProfile, fetchUserProfile, idToken, donationId, router, fetchDonationDetails]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (name === "donationType" && value !== "monetary") {
        setFormData(prev => ({
            ...prev,
            donationType: value as DonationFormData['donationType'],
            amount: null, // Clear amount if not monetary
            currency: null // Clear currency if not monetary
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

    try {
      if (!idToken) throw new Error("Authentication token not available.");
      
      const payload: Partial<DonationFormData> = {};
      // Compare each field and add to payload if changed
      (Object.keys(formData) as Array<keyof DonationFormData>).forEach(key => {
        let formVal = formData[key];
        let originalVal = originalDonation[key];

        // Normalize empty strings to null for optional fields for comparison
        if (key === 'donorEmail' || key === 'donorPhone' || key === 'notes' || key === 'currency' || key === 'amount') {
            if (formVal === '') formVal = null;
            if (originalVal === '') originalVal = null;
        }
        if (key === 'donationDate' && originalDonation.donationDate) { // Ensure original date is also formatted for comparison
            originalVal = format(parseISO(originalDonation.donationDate), 'yyyy-MM-dd');
        }


        if (formVal !== originalVal) {
          // @ts-ignore
          payload[key] = formVal;
        }
      });
      
      // If donationType changed from non-monetary to monetary, ensure amount/currency are in payload
      if (formData.donationType === 'monetary' && originalDonation.donationType !== 'monetary') {
        payload.amount = formData.amount;
        payload.currency = formData.currency;
      }
      // If donationType changed to non-monetary, ensure amount/currency are explicitly nulled if they were not already
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
      router.push(`/dashboard/donations/${donationId}`);
    } catch (err: any) {
      setSubmitError(err.response?.data?.detail || err.message || 'Failed to update donation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDonation = async () => {
    if (!canDeleteDonation || !originalDonation) {
        setDeleteError("Cannot delete: Insufficient permissions or donation data missing.");
        return;
    }
    if (!confirm(`Are you sure you want to delete this donation from "${originalDonation.donorName}"? This action cannot be undone.`)) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
        if (!idToken) throw new Error("Authentication token not available.");
        await apiClient({
            path: `/donations/${donationId}`,
            token: idToken,
            method: 'DELETE',
        });
        router.push('/dashboard/donations');
    } catch (err: any) {
        setDeleteError(err.response?.data?.detail || err.message || 'Failed to delete donation.');
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

  if (error || (userProfile && !canEditDonation) || (!isLoading && !originalDonation)) {
    const displayError = error || (userProfile && !canEditDonation ? "Access Denied. You do not have permission to edit this donation." : "Donation not found for editing.");
    const icon = error || (userProfile && !canEditDonation) ? "lock" : "search_off";
    const title = error || (userProfile && !canEditDonation) ? "Error Editing Donation" : "Donation Not Found";
    return (
        <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="mb-6">
                <Link href={`/dashboard/donations/${donationId}`} className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                    <span className="material-icons text-lg mr-1">arrow_back_ios</span>
                    Back to Donation Details
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
  
  return (
    <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
            <Link href={`/dashboard/donations/${donationId}`} className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                <span className="material-icons text-lg mr-1">arrow_back_ios</span>
                Back to Donation Details
            </Link>
        </div>

        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">
                Edit Donation from: <span className="text-indigo-600 dark:text-indigo-400">{originalDonation?.donorName}</span>
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Donor Information */}
                <fieldset className="border border-gray-300 dark:border-gray-600 p-4 rounded-md">
                    <legend className="text-lg font-medium text-gray-900 dark:text-white px-2">Donor Information</legend>
                    <div className="space-y-4 mt-2">
                        <div>
                            <label htmlFor="donorName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Donor Name <span className="text-red-500">*</span></label>
                            <input type="text" name="donorName" id="donorName" value={formData.donorName} onChange={handleChange} required className="input-class" />
                        </div>
                        <div>
                            <label htmlFor="donorEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Donor Email</label>
                            <input type="email" name="donorEmail" id="donorEmail" value={formData.donorEmail || ''} onChange={handleChange} className="input-class" />
                        </div>
                        <div>
                            <label htmlFor="donorPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Donor Phone</label>
                            <input type="tel" name="donorPhone" id="donorPhone" value={formData.donorPhone || ''} onChange={handleChange} className="input-class" />
                        </div>
                    </div>
                </fieldset>

                {/* Donation Details */}
                <fieldset className="border border-gray-300 dark:border-gray-600 p-4 rounded-md">
                    <legend className="text-lg font-medium text-gray-900 dark:text-white px-2">Donation Details</legend>
                    <div className="space-y-4 mt-2">
                        <div>
                            <label htmlFor="donationDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Donation Date <span className="text-red-500">*</span></label>
                            <input type="date" name="donationDate" id="donationDate" value={formData.donationDate} onChange={handleChange} required className="input-class" />
                        </div>
                        <div>
                            <label htmlFor="donationType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Donation Type <span className="text-red-500">*</span></label>
                            <select name="donationType" id="donationType" value={formData.donationType} onChange={handleChange} required className="input-class">
                                <option value="monetary">Monetary</option>
                                <option value="in_kind">In-Kind</option>
                                <option value="time_contribution">Time Contribution</option>
                            </select>
                        </div>
                        {formData.donationType === 'monetary' && (
                            <>
                                <div>
                                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount <span className="text-red-500">*</span></label>
                                    <input type="number" name="amount" id="amount" value={formData.amount || ''} onChange={handleChange} required min="0.01" step="0.01" className="input-class" />
                                </div>
                                <div>
                                    <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency <span className="text-red-500">*</span></label>
                                    <input type="text" name="currency" id="currency" value={formData.currency || ''} onChange={handleChange} required maxLength={3} className="input-class" placeholder="e.g., USD, EUR"/>
                                </div>
                            </>
                        )}
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description <span className="text-red-500">*</span></label>
                            <textarea name="description" id="description" rows={3} value={formData.description} onChange={handleChange} required className="input-class" />
                        </div>
                        <div>
                            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                            <textarea name="notes" id="notes" rows={3} value={formData.notes || ''} onChange={handleChange} className="input-class" />
                        </div>
                    </div>
                </fieldset>
                
                <style jsx>{`
                    .input-class {
                        display: block;
                        width: 100%;
                        padding: 0.5rem 0.75rem;
                        border-width: 1px;
                        border-color: #D1D5DB; /* gray-300 */
                        border-radius: 0.375rem; /* rounded-md */
                        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
                        font-size: 0.875rem; /* sm:text-sm */
                    }
                    .dark .input-class {
                        background-color: #374151; /* dark:bg-gray-700 */
                        border-color: #4B5563; /* dark:border-gray-600 */
                        color: #F3F4F6; /* dark:text-white */
                    }
                    .input-class:focus {
                        outline: 2px solid transparent;
                        outline-offset: 2px;
                        border-color: #6366F1; /* focus:border-indigo-500 */
                        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.5); /* focus:ring-indigo-500 */
                    }
                `}</style>


                {submitError && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-md flex items-center" role="alert">
                        <span className="material-icons text-lg mr-2">error_outline</span>
                        {submitError}
                    </div>
                )}

                <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Link href={`/dashboard/donations/${donationId}`} legacyBehavior>
                        <a className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            Cancel
                        </a>
                    </Link>
                    <button
                        type="submit"
                        disabled={isSubmitting || isLoading}
                        className="inline-flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                        <span className="material-icons text-lg mr-2">{isSubmitting ? 'hourglass_empty' : 'save'}</span>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>

            {canDeleteDonation && originalDonation && (
            <div className="mt-10 pt-6 border-t border-red-300 dark:border-red-700">
                 <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-3">Danger Zone</h3>
                 <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Deleting this donation is permanent and cannot be undone.
                 </p>
                <button
                    onClick={handleDeleteDonation}
                    disabled={isDeleting || isSubmitting}
                    className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md shadow-sm inline-flex items-center disabled:opacity-50"
                >
                    <span className="material-icons text-lg mr-2">delete_forever</span>
                    {isDeleting ? 'Deleting...' : 'Delete This Donation'}
                </button>
                {deleteError && 
                    <div className="mt-3 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-md flex items-center" role="alert">
                    <span className="material-icons text-lg mr-2">error_outline</span>
                    {deleteError}
                    </div>
                }
            </div>
          )}
        </div>
    </main>
  );
}