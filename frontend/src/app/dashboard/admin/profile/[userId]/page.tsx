"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';

// Interface for the user profile data fetched from the backend
// This should match the UserResponse model from the backend, including all relevant fields
interface UserProfileData {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  skills?: string | null;
  qualifications?: string | null;
  preferences?: string | null;
  assignedRoleIds: string[];
  status: string;
  createdAt: string; // Assuming ISO string from backend
  updatedAt: string; // Assuming ISO string from backend
  // Add any other fields that are part of the UserResponse model
}

// Custom hook for admin-specific authentication and authorization logic
// This can be reused or adapted from the AdminUserManagementPage
const useAdminAuthCheck = () => {
  const { user, idToken, userProfile, loading: authLoading, error: authError } = useAuth();
  const hasAdminRole = userProfile?.assignedRoleIds?.includes('sysadmin');
  const canAccessPage = user && idToken && hasAdminRole;
  return { user, idToken, userProfile, canAccessPage, authLoading, authError };
};

const AdminViewUserProfilePage = () => {
  const { idToken, canAccessPage, authLoading, authError } = useAdminAuthCheck();
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string; // Get userId from URL

  const [viewedUserProfile, setViewedUserProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    if (authError) {
      setError(`Authentication error: ${authError.message}`);
      setIsLoading(false);
      return;
    }

    if (!canAccessPage) {
      setError("Access Denied. You do not have permission to view this page.");
      setIsLoading(false);
      // Optionally redirect: router.push('/dashboard');
      return;
    }

    if (!idToken) {
      setError("Authentication token not available. Cannot fetch user profile.");
      setIsLoading(false);
      return;
    }

    if (!userId) {
      setError("User ID not found in URL.");
      setIsLoading(false);
      return;
    }

    const fetchUserProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiClient<UserProfileData>({
          path: `/users/${userId}`, // Endpoint to fetch a specific user's profile
          token: idToken,
          method: 'GET',
        });
        setViewedUserProfile(data);
      } catch (err: any) {
        console.error('Failed to fetch user profile:', err);
        setError(err.data?.detail || err.message || 'Failed to load user profile.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId, idToken, canAccessPage, authLoading, authError, router]);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      return dateString; // Fallback to original string if parsing fails
    }
  };

  if (authLoading || isLoading) {
    return <div className="flex justify-center items-center h-screen"><p className="text-lg">Loading user profile...</p></div>;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-2xl text-center">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200">View User Profile</h1>
        <p className="text-red-500 text-lg">{error}</p>
        <Link href="/dashboard/admin/users" className="text-indigo-600 dark:text-indigo-400 hover:underline mt-6 inline-block">
          ← Back to User List
        </Link>
      </div>
    );
  }

  if (!viewedUserProfile) {
    return (
      <div className="container mx-auto p-6 max-w-2xl text-center">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200">View User Profile</h1>
        <p className="text-gray-600 dark:text-gray-400">User profile not found.</p>
        <Link href="/dashboard/admin/users" className="text-indigo-600 dark:text-indigo-400 hover:underline mt-6 inline-block">
          ← Back to User List
        </Link>
      </div>
    );
  }

  // Helper component for displaying profile fields
  const ProfileField = ({ label, value }: { label: string; value: string | undefined | null | string[] }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      {typeof value === 'string' && (value.includes('\n') || value.length > 60) ? (
        <pre className="mt-1 block w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
          {value || 'N/A'}
        </pre>
      ) : (
        <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-md">
          {Array.isArray(value) ? value.join(', ') || 'N/A' : value || 'N/A'}
        </p>
      )}
    </div>
  );
  
  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-2xl">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200">
          User Profile: {viewedUserProfile.firstName} {viewedUserProfile.lastName}
        </h1>
      </div>
      <div className="mb-6">
        <Link href="/dashboard/admin/users" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          ← Back to User List
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        <ProfileField label="Full Name" value={`${viewedUserProfile.firstName} ${viewedUserProfile.lastName}`} />
        <ProfileField label="Email" value={viewedUserProfile.email} />
        <ProfileField label="Phone Number" value={viewedUserProfile.phoneNumber} />
        <ProfileField label="Status" value={viewedUserProfile.status} />
        <ProfileField label="Assigned Roles" value={viewedUserProfile.assignedRoleIds} />
        <ProfileField label="Skills" value={viewedUserProfile.skills} />
        <ProfileField label="Qualifications" value={viewedUserProfile.qualifications} />
        <ProfileField label="Preferences" value={viewedUserProfile.preferences} />
        <ProfileField label="User ID (UID)" value={viewedUserProfile.uid} />
        <ProfileField label="Profile Created" value={formatDate(viewedUserProfile.createdAt)} />
        <ProfileField label="Profile Last Updated" value={formatDate(viewedUserProfile.updatedAt)} />
      </div>
    </div>
  );
};

export default AdminViewUserProfilePage;