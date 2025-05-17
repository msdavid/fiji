"use client";

import React, { useState, useEffect } from 'react';
import { useRouter }
from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';

type DonationType = 'monetary' | 'in_kind' | 'time_contribution';

interface NewDonationFormData {
  donorName: string;
  donorEmail?: string;
  donorPhone?: string;
  donationType: DonationType;
  amount?: number | string; // string for form input, number for payload
  currency?: string;
  description: string;
  donationDate: string; // YYYY-MM-DD
  notes?: string;
}

const NewDonationPage = () => {
  const { user, idToken, loading: authLoading, hasPrivilege } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState<NewDonationFormData>({
    donorName: '',
    donorEmail: '',
    donorPhone: '',
    donationType: 'monetary',
    amount: '',
    currency: 'SGD',
    description: '',
    donationDate: new Date().toISOString().split('T')[0], // Default to today
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canCreateDonations = hasPrivilege ? hasPrivilege('donations', 'create') : false;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
    if (!authLoading && user && !canCreateDonations) {
        setError("You don't have permission to record new donations.");
    }
  }, [authLoading, user, canCreateDonations, router]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

    const payload: any = { ...formData };
    if (formData.donationType === 'monetary') {
      if (!formData.amount || parseFloat(formData.amount.toString()) <= 0) {
        setError("Amount must be a positive number for monetary donations.");
        setIsSubmitting(false);
        return;
      }
      if (!formData.currency) {
        setError("Currency is required for monetary donations.");
        setIsSubmitting(false);
        return;
      }
      payload.amount = parseFloat(formData.amount.toString());
    } else {
      delete payload.amount;
      delete payload.currency;
      if (!formData.description) {
        setError("Description is required for non-monetary donations.");
        setIsSubmitting(false);
        return;
      }
    }
    
    try {
      await apiClient({
        path: '/donations',
        token: idToken,
        method: 'POST',
        data: payload,
      });
      setSuccessMessage('Donation recorded successfully! Redirecting...');
      setTimeout(() => {
        router.push('/dashboard/donations');
      }, 2000);
    } catch (err: any) {
      console.error('Failed to record donation:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to record donation.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (authLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!user || !canCreateDonations) {
    return (
        <div className="p-8 text-center">
            <p className="text-red-500">{error || "Access Denied."}</p>
            <Link href="/dashboard/donations" className="text-indigo-600 hover:underline mt-4 inline-block">Back to Donations</Link>
        </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-2xl">
      <div className="mb-6">
        <Link href="/dashboard/donations" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          ← Back to Donations List
        </Link>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">Record New Donation</h1>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 space-y-6">
        {error && <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-md">{error}</div>}
        {successMessage && <div className="p-3 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-200 rounded-md">{successMessage}</div>}

        <div>
          <label htmlFor="donorName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Donor Name*</label>
          <input type="text" name="donorName" id="donorName" value={formData.donorName} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
        </div>

        <div>
          <label htmlFor="donorEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Donor Email</label>
          <input type="email" name="donorEmail" id="donorEmail" value={formData.donorEmail} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
        </div>
        
        <div>
          <label htmlFor="donorPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Donor Phone</label>
          <input type="tel" name="donorPhone" id="donorPhone" value={formData.donorPhone} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
        </div>

        <div>
          <label htmlFor="donationDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Donation Date*</label>
          <input type="date" name="donationDate" id="donationDate" value={formData.donationDate} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
        </div>

        <div>
          <label htmlFor="donationType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Donation Type*</label>
          <select name="donationType" id="donationType" value={formData.donationType} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <option value="monetary">Monetary</option>
            <option value="in_kind">In-Kind</option>
            <option value="time_contribution">Time Contribution</option>
          </select>
        </div>

        {formData.donationType === 'monetary' && (
          <>
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount*</label>
              <input type="number" name="amount" id="amount" value={formData.amount} onChange={handleInputChange} required min="0.01" step="0.01" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Currency*</label>
              <input type="text" name="currency" id="currency" value={formData.currency} onChange={handleInputChange} required maxLength={3} placeholder="e.g., SGD" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            </div>
          </>
        )}

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description* 
            {formData.donationType !== 'monetary' && <span className="text-xs"> (Details of items/time)</span>}
          </label>
          <textarea name="description" id="description" value={formData.description} onChange={handleInputChange} rows={3} required={formData.donationType !== 'monetary'} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
          <textarea name="notes" id="notes" value={formData.notes} onChange={handleInputChange} rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
        </div>

        <div className="flex justify-end space-x-3">
          <Link href="/dashboard/donations" legacyBehavior>
            <a className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 font-medium rounded-md shadow-sm">Cancel</a>
          </Link>
          <button type="submit" disabled={isSubmitting || !canCreateDonations} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50">
            {isSubmitting ? 'Submitting...' : 'Record Donation'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewDonationPage;