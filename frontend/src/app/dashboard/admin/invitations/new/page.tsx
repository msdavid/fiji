'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';

interface Role {
  id: string; 
  roleName: string;
}

interface InvitationCreatePayload {
  email: string;
  assignedRoleIds?: string[];
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
  const { user: adminAuthUser, idToken, loading: authLoading, userProfile: adminUserProfile, fetchUserProfile, hasPrivilege } = useAuth();

  const [email, setEmail] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null); 
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const canCreateInvitations = adminUserProfile && (hasPrivilege ? hasPrivilege('invitations', 'create') : adminUserProfile.assignedRoleIds?.includes('sysadmin'));

  const fetchAllRoles = useCallback(async () => {
    if (!adminAuthUser || !idToken || !canCreateInvitations) {
        return;
    }
    try {
        const rolesData = await apiClient<Role[]>({
            path: '/roles',
            token: idToken,
            method: 'GET',
        });
        setAllRoles(rolesData);
    } catch (err: any) {
        console.error("Fetch all roles error:", err);
        setPageError(prev => prev ? `${prev}\nFailed to load roles.` : 'Failed to load roles for pre-assignment.');
    }
  }, [adminAuthUser, idToken, canCreateInvitations]);

  useEffect(() => {
    if (!authLoading && !adminAuthUser) {
      router.push('/login');
      return;
    }
    if (adminAuthUser && !adminUserProfile) {
        fetchUserProfile();
        return; 
    }
    if (adminAuthUser && adminUserProfile) {
        if (!canCreateInvitations) {
            setPageError("You don't have permission to create user invitations.");
        } else {
            fetchAllRoles();
        }
    }
  }, [adminAuthUser, authLoading, adminUserProfile, fetchUserProfile, router, canCreateInvitations, fetchAllRoles]);

  const handleRoleChange = (roleId: string, checked: boolean) => {
    setSelectedRoleIds(prev => {
        if (checked) {
            return prev.includes(roleId) ? prev : [...prev, roleId];
        } else {
            return prev.filter(id => id !== roleId);
        }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateInvitations || !idToken) {
        setSubmitError("Cannot submit: Insufficient permissions or not authenticated.");
        return;
    }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
        setSubmitError("A valid email address is required.");
        return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    const payload: InvitationCreatePayload = {
      email: email.trim(),
      assignedRoleIds: selectedRoleIds.length > 0 ? selectedRoleIds : undefined,
    };

    try {
      await apiClient<InvitationCreateResponse>({ 
        path: '/admin/invitations/', 
        token: idToken,
        method: 'POST',
        data: payload,
      });
      setSubmitSuccess(`Invitation successfully sent to ${payload.email}.`);
      setEmail(''); 
      setSelectedRoleIds([]);
    } catch (err: any) {
      setSubmitError(err.response?.data?.detail || err.message || 'Failed to send invitation.');
      console.error("Create invitation error:", err);
    } finally {
      setIsSubmitting(false);
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

  const displayableRoles = allRoles.filter(role => role.id !== 'sysadmin');

  return (
    <main className="max-w-xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/dashboard/admin/invitations" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          <span className="material-icons text-lg mr-1">arrow_back_ios</span>
          Back to Invitations List
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Create New User Invitation</h1>
      
      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            An invitation email with a unique registration link will be sent to the specified address.
            You can optionally pre-assign roles that will be applied upon successful registration.
          </p>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address to Invite <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="recipient@example.com"
              className="mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            />
          </div>

          {displayableRoles.length > 0 && (
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pre-assign Roles (Optional)
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                    {displayableRoles.map(role => (
                        <label key={role.id} className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                            <input
                            type="checkbox"
                            checked={selectedRoleIds.includes(role.id)}
                            onChange={(e) => handleRoleChange(role.id, e.target.checked)}
                            className="h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 dark:bg-gray-600 dark:checked:bg-indigo-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{role.roleName}</span>
                        </label>
                    ))}
                </div>
            </div>
          )}
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
              <button
                  type="button"
                  className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
              >
                  <span className="material-icons text-base mr-2">cancel</span>
                  Cancel
              </button>
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !canCreateInvitations}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 inline-flex items-center"
            >
              {isSubmitting ? (
                <>
                  <span className="material-icons animate-spin text-base mr-2">sync</span>
                  Sending Invitation...
                </>
              ) : (
                <>
                  <span className="material-icons text-base mr-2">send</span>
                  Send Invitation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}