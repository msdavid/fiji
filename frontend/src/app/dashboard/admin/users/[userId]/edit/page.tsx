"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';

// Interface for the user profile data (can be shared or adapted)
interface UserProfileData {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  skills?: string | null;
  qualifications?: string | null;
  preferences?: string | null;
  profilePictureUrl?: string | null;
  assignedRoleIds: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

const AdminEditUserProfilePage = () => {
  const { idToken, userProfile: adminUserProfile, loading: authLoading, error: authError } = useAuth();
  const params = useParams();
  const router = useRouter();
  const userIdToEdit = params.userId as string;

  const [userToEdit, setUserToEdit] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin auth check (simplified for this placeholder)
  const canAccessPage = adminUserProfile?.assignedRoleIds?.includes('sysadmin');

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
      setError("Access Denied. You do not have permission to edit this page.");
      setIsLoading(false);
      return;
    }

    if (!idToken) {
      setError("Authentication token not available. Cannot fetch user data.");
      setIsLoading(false);
      return;
    }

    if (!userIdToEdit) {
      setError("User ID not found in URL.");
      setIsLoading(false);
      return;
    }

    const fetchUserProfileToEdit = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiClient<UserProfileData>({
          path: `/users/${userIdToEdit}`,
          token: idToken,
          method: 'GET',
        });
        setUserToEdit(data);
      } catch (err: any) {
        console.error('Failed to fetch user profile for editing:', err);
        setError(err.data?.detail || err.message || 'Failed to load user profile for editing.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfileToEdit();
  }, [userIdToEdit, idToken, canAccessPage, authLoading, authError, router]);

  if (authLoading || isLoading) {
    return <div className="flex justify-center items-center h-screen"><p className="text-lg">Loading user data for editing...</p></div>;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-2xl text-center">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200">Edit User Profile</h1>
        <p className="text-red-500 text-lg">{error}</p>
        <Link href="/dashboard/admin/users" className="text-indigo-600 dark:text-indigo-400 hover:underline mt-6 inline-block">
          ← Back to User List
        </Link>
      </div>
    );
  }

  if (!userToEdit) {
    return (
      <div className="container mx-auto p-6 max-w-2xl text-center">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200">Edit User Profile</h1>
        <p className="text-gray-600 dark:text-gray-400">User profile not found for editing.</p>
        <Link href="/dashboard/admin/users" className="text-indigo-600 dark:text-indigo-400 hover:underline mt-6 inline-block">
          ← Back to User List
        </Link>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-3xl">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200">
          Edit User: {userToEdit.firstName} {userToEdit.lastName}
        </h1>
      </div>
      <div className="mb-6">
        <Link href="/dashboard/admin/users" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          ← Back to User List
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        <p className="text-gray-700 dark:text-gray-300">
          This is the placeholder page for editing user (UID: {userToEdit.uid}). 
          Full editing functionality will be implemented here.
        </p>
        {/* Placeholder for form fields */}
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Current Details (Read-only for now):</h3>
          <ul className="mt-2 list-disc list-inside text-gray-600 dark:text-gray-400">
            <li>Email: {userToEdit.email}</li>
            <li>Status: {userToEdit.status}</li>
            {/* Add more fields as needed for quick reference */}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminEditUserProfilePage;