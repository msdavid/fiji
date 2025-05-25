"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient, { ApiResponse } from '@/lib/apiClient';
import { format } from 'date-fns';

type DonationType = 'monetary' | 'in_kind' | 'time_contribution';

interface UserDonationFormData {
  donorName: string;
  donorEmail: string; 
  donorPhone: string; 
  donationType: DonationType;
  amount: string; 
  currency: string;
  description: string;
  donationDate: string; 
  notes: string;
}

const UserDonatePage = () => {
  const { user, sessionToken, loading: authLoading, userProfile } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState<UserDonationFormData>({
    donorName: '',
    donorEmail: '',
    donorPhone: '',
    donationType: 'monetary',
    amount: '',
    currency: 'SGD', 
    description: '',
    donationDate: format(new Date(), 'yyyy-MM-dd'), 
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Pre-fill user information when profile loads
  useEffect(() => {
    if (userProfile && user) {
      const fullName = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim();
      setFormData(prev => ({
        ...prev,
        donorName: fullName || user.displayName || '',
        donorEmail: userProfile.email || user.email || '',
        donorPhone: userProfile.phone || '',
      }));
    }
  }, [userProfile, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      return;
    }
  }, [authLoading, user, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === "donationType" && value !== "monetary") {
        setFormData(prev => ({ ...prev, amount: '', currency: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken) {
      setError("Authentication required. Please log in again.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const payload: any = { 
        ...formData,
        notes: formData.notes.trim() === '' ? null : formData.notes,
     };

    if (formData.donationType === 'monetary') {
      if (!formData.amount || parseFloat(formData.amount.toString()) <= 0) {
        setError("Amount must be a positive number for monetary donations.");
        setIsSubmitting(false);
        return;
      }
      if (!formData.currency.trim()) {
        setError("Currency is required for monetary donations.");
        setIsSubmitting(false);
        return;
      }
      payload.amount = parseFloat(formData.amount.toString());
      payload.currency = formData.currency.trim();
    } else {
      payload.amount = null; 
      payload.currency = null; 
    }

    if (!formData.description.trim()) { 
        setError("Description is required.");
        setIsSubmitting(false);
        return;
    }
    
    if (!formData.donorPhone.trim()) {
        setError("Phone number is required.");
        setIsSubmitting(false);
        return;
    }
    
    if (!formData.donorEmail.trim()) {
        setError("Email is required.");
        setIsSubmitting(false);
        return;
    }
    
    const result: ApiResponse<any> = await apiClient({
      path: '/donations/user-submission',
      token: sessionToken,
      method: 'POST',
      data: payload,
    });

    setIsSubmitting(false);

    if (result.ok) {
      setSuccessMessage('Donation declared successfully! Your donation is now pending verification. You will receive an email notification once it has been reviewed.');
      setFormData(prev => ({
        ...prev,
        donationType: 'monetary',
        amount: '',
        currency: 'SGD',
        description: '',
        donationDate: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
      }));
      setTimeout(() => {
        router.push('/dashboard/my-donations');
      }, 3000);
    } else {
      console.error('Failed to declare donation:', result.error);
      setError(result.error?.message || 'Failed to declare donation.');
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
        <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-red-500 dark:text-red-400 mx-auto mb-3">lock</span>
                <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
                <p className="text-gray-700 dark:text-gray-300 mb-6">Please log in to declare a donation.</p>
                <Link href="/login" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                    Go to Login
                </Link>
            </div>
        </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          <span className="material-icons mr-1 text-lg">arrow_back_ios</span>
          Back to Dashboard
        </Link>
      </div>
      
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Declare a Donation</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Thank you for your generosity! Your donation will be reviewed and verified by our team.
        </p>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 text-sm text-green-700 bg-green-100 dark:bg-green-700 dark:text-green-100 rounded-lg shadow-md" role="alert">
          <div className="flex items-start">
            <span className="material-icons text-green-600 dark:text-green-300 mr-2 mt-0.5">check_circle</span>
            <div>
              <span className="font-medium">Success!</span> {successMessage}
            </div>
          </div>
        </div>
      )}
      
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
      
      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Donor Information Section */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Your Information</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="donorName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  name="donorName" 
                  id="donorName" 
                  value={formData.donorName} 
                  onChange={handleInputChange} 
                  required 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" 
                />
              </div>
              <div>
                <label htmlFor="donorEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input 
                  type="email" 
                  name="donorEmail" 
                  id="donorEmail" 
                  value={formData.donorEmail} 
                  onChange={handleInputChange} 
                  required 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" 
                />
              </div>
              <div>
                <label htmlFor="donorPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input 
                  type="tel" 
                  name="donorPhone" 
                  id="donorPhone" 
                  value={formData.donorPhone} 
                  onChange={handleInputChange} 
                  required 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                  placeholder="+65 9123 4567"
                />
              </div>
            </div>
          </div>

          {/* Donation Details Section */}
          <div className="pt-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Donation Details</h2>
            
            <div>
              <label htmlFor="donationDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Donation Date <span className="text-red-500">*</span>
              </label>
              <input 
                type="date" 
                name="donationDate" 
                id="donationDate" 
                value={formData.donationDate} 
                onChange={handleInputChange} 
                required 
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" 
              />
            </div>
            
            <div>
              <label htmlFor="donationType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Donation Type <span className="text-red-500">*</span>
              </label>
              <select 
                name="donationType" 
                id="donationType" 
                value={formData.donationType} 
                onChange={handleInputChange} 
                required 
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              >
                <option value="monetary">Monetary Donation</option>
                <option value="in_kind">In-Kind Donation (Goods/Items)</option>
                <option value="time_contribution">Time/Volunteer Contribution</option>
              </select>
            </div>
            
            {formData.donationType === 'monetary' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="number" 
                    name="amount" 
                    id="amount" 
                    value={formData.amount} 
                    onChange={handleInputChange} 
                    required 
                    min="0.01" 
                    step="0.01" 
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" 
                  />
                </div>
                <div>
                  <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Currency <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    name="currency" 
                    id="currency" 
                    value={formData.currency} 
                    onChange={handleInputChange} 
                    required 
                    maxLength={3} 
                    placeholder="e.g., SGD" 
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" 
                  />
                </div>
              </div>
            )}
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description <span className="text-red-500">*</span>
                {formData.donationType === 'in_kind' && <span className="text-xs text-gray-500 dark:text-gray-400"> (Please describe the items you're donating)</span>}
                {formData.donationType === 'time_contribution' && <span className="text-xs text-gray-500 dark:text-gray-400"> (Please describe the time/service you're contributing)</span>}
              </label>
              <textarea 
                name="description" 
                id="description" 
                value={formData.description} 
                onChange={handleInputChange} 
                rows={4} 
                required 
                placeholder={
                  formData.donationType === 'monetary' ? 'Please describe the purpose or context of your donation...' :
                  formData.donationType === 'in_kind' ? 'Please provide details about the items you\'re donating (condition, quantity, etc.)...' :
                  'Please describe the type of volunteer work or time you\'re contributing...'
                }
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" 
              />
            </div>
            
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Additional Notes (Optional)
              </label>
              <textarea 
                name="notes" 
                id="notes" 
                value={formData.notes} 
                onChange={handleInputChange} 
                rows={3} 
                placeholder="Any additional information you'd like to share..."
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" 
              />
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md p-4">
            <div className="flex items-start">
              <span className="material-icons text-blue-500 dark:text-blue-400 mr-2 mt-0.5">info</span>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">What happens next?</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Your donation will be declared with a "Pending Verification" status</li>
                  <li>Our team will review and verify your donation</li>
                  <li>You'll receive an email notification once the review is complete</li>
                  <li>You can view the status of your donations in your dashboard</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-8 mt-4 border-t border-gray-200 dark:border-gray-700">
            <Link 
              href="/dashboard" 
              className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
            >
              <span className="material-icons mr-2 text-base">cancel</span>
              Cancel
            </Link>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 inline-flex items-center"
            >
              <span className={`material-icons mr-2 text-base ${isSubmitting ? 'animate-spin' : ''}`}>
                {isSubmitting ? 'sync' : 'volunteer_activism'}
              </span>
              {isSubmitting ? 'Submitting...' : 'Declare Donation'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};

export default UserDonatePage;