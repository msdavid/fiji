'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient, { ApiResponse } from '@/lib/apiClient'; // Import ApiResponse

interface InvitationCreatePayload {
  email: string;
}

interface InvitationCreateResponse {
    id: string; 
    email: string;
    token: string; 
    expiresAt: string; 
    status: string; 
}

export default function CreateInvitationPage() {
  const router = useRouter();
  const { user: adminAuthUser, idToken, loading: authLoading, userProfile: adminUserProfile, fetchUserProfile, hasPrivilege, logout } = useAuth(); // Added logout

  const [email, setEmail] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null); 
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const canCreateInvitations = adminUserProfile && (hasPrivilege ? hasPrivilege('invitations', 'create') : adminUserProfile.assignedRoleIds?.includes('sysadmin'));
  const canListInvitations = adminUserProfile && (hasPrivilege ? hasPrivilege('invitations', 'list') : adminUserProfile.assignedRoleIds?.includes('sysadmin'));


  useEffect(() => {
    if (!authLoading && !adminAuthUser) { /* router.push('/login'); // Handled by layout/context */ return; }
    if (adminAuthUser && !adminUserProfile && fetchUserProfile) { fetchUserProfile(); return; }
    if (adminAuthUser && adminUserProfile) {
        if (!canCreateInvitations) {
            setPageError("You don't have permission to create user invitations.");
        }
    }
  }, [adminAuthUser, authLoading, adminUserProfile, fetchUserProfile, router, canCreateInvitations]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateInvitations || !idToken) {
        setSubmitError("Cannot submit: Insufficient permissions or not authenticated."); return;
    }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
        setSubmitError("A valid email address is required."); return;
    }

    setIsSubmitting(true); setSubmitError(null); setSubmitSuccess(null);

    const payload: InvitationCreatePayload = {
      email: email.trim(),
    };

    const result: ApiResponse<InvitationCreateResponse> = await apiClient<InvitationCreateResponse>({ 
      path: '/admin/invitations/', 
      token: idToken,
      method: 'POST',
      data: payload,
    });
    
    setIsSubmitting(false);

    if (result.ok) {
      setSubmitSuccess(`Invitation successfully sent to ${payload.email}.`);
      setEmail('');
    } else {
      console.error("Create invitation error:", result.error);
      if (result.status === 401) {
        await logout();
        return;
      }
      setSubmitError(result.error?.message || 'Failed to send invitation.');
    }
  };

  if (authLoading || (adminAuthUser && !adminUserProfile && !pageError) ) {
    return (
      <main className="max-w-xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center">
        <span className="material-icons text-6xl text-indigo-500 dark:text-indigo-400 animate-spin mb-4">sync</span>
        <p className="text-lg text-gray-700 dark:text-gray-300">Loading...</p>
      </main>
    );
  }

  if (pageError && !canCreateInvitations) { 
    return (
        <main className="max-w-xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 shadow-xl rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl mx-auto mb-3">lock</span>
                <h1 className="text-2xl font-semibold mb-4">Access Denied</h1>
                <p className="mb-6">{pageError}</p>
                <Link href="/dashboard/admin" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm">
                    <span className="material-icons text-lg mr-2">arrow_back</span>
                    Back to Admin Dashboard
                </Link>
            </div>
        </main>
    );
  }


  return (
    <main className="max-w-xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        {canListInvitations ? (
          <Link href="/dashboard/admin/invitations" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
            <span className="material-icons text-lg mr-1">arrow_back_ios</span>
            Back to Invitations List
          </Link>
        ) : (
          <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
            <span className="material-icons text-lg mr-1">arrow_back_ios</span>
            Back to Dashboard
          </Link>
        )}
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Create New User Invitation</h1>
      
      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            An invitation email with a unique registration link will be sent to the specified address.
            All new users will be assigned the "Associate" role upon successful registration.
          </p>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address to Invite <span className="text-red-500">*</span>
            </label>
            <input
              type="email" name="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)}
              required placeholder="recipient@example.com"
              className="mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md p-4">
            <div className="flex items-center">
              <span className="material-icons text-blue-500 text-lg mr-2">info</span>
              <div>
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                  Default Role Assignment
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  New users will automatically receive the "Associate" role with basic event viewing permissions.
                </p>
              </div>
            </div>
          </div>
          {pageError && canCreateInvitations && ( 
             <div className="my-2 p-2 text-sm text-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 rounded-md flex items-center" role="alert">
                <span className="material-icons text-lg mr-2">warning_amber</span>
                {pageError}
            </div>
          )}

          {submitError && ( 
            <div className="my-4 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center" role="alert">
              <span className="material-icons text-lg mr-2">error_outline</span>
              {submitError}
            </div>
          )}
          {submitSuccess && (
            <div className="my-4 p-3 text-sm text-green-600 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center" role="alert">
              <span className="material-icons text-lg mr-2">check_circle_outline</span>
              {submitSuccess}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
            <Link href="/dashboard/admin/invitations" passHref> 
              <button type="button" className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center">
                  <span className="material-icons text-base mr-2">cancel</span> Cancel
              </button>
            </Link>
            <button type="submit" disabled={isSubmitting || !canCreateInvitations} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 inline-flex items-center">
              {isSubmitting ? ( <><span className="material-icons animate-spin text-base mr-2">sync</span> Sending Invitation...</> ) 
                           : ( <><span className="material-icons text-base mr-2">send</span> Send Invitation</> )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}