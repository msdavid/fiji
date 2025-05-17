"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';
import { format, parseISO } from 'date-fns'; // For date formatting

// Define UserAvailability interface matching Pydantic model
interface UserAvailability {
  general?: string;
  specificDatesUnavailable?: string[]; // Expect YYYY-MM-DD strings from backend
  specificDatesAvailable?: string[];   // Expect YYYY-MM-DD strings from backend
}

// Interface for the user profile data fetched from the backend
interface UserProfileData {
  uid: string; 
  id: string; 
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  skills?: string[] | null; 
  qualifications?: string[] | null; 
  preferences?: Record<string, any> | string | null; 
  profilePictureUrl?: string | null;
  availability?: UserAvailability; // Added availability field
  assignedRoleIds: string[];
  assignedRoleNames?: string[]; 
  status: string;
  createdAt: string; 
  updatedAt: string; 
}

const useAdminAuthCheck = () => {
  const { user, idToken, userProfile, loading: authLoading, error: authError, hasPrivilege } = useAuth();
  const isAdmin = userProfile && (hasPrivilege ? hasPrivilege('users', 'view') : userProfile.assignedRoleIds?.includes('sysadmin'));
  const canAccessPage = user && idToken && isAdmin;
  return { user, idToken, userProfile, canAccessPage, authLoading, authError };
};

const AdminViewUserProfilePage = () => {
  const { idToken, canAccessPage, authLoading, authError } = useAdminAuthCheck();
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [viewedUserProfile, setViewedUserProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    if (authError) {
      setError(`Authentication error: ${authError.message || 'Unknown auth error'}`);
      setIsLoading(false);
      return;
    }

    if (!canAccessPage && !authLoading) { 
      setError("Access Denied. You do not have permission to view this page.");
      setIsLoading(false);
      return;
    }

    if (!idToken && !authLoading) {
      setError("Authentication token not available. Cannot fetch user profile.");
      setIsLoading(false);
      return;
    }

    if (!userId) {
      setError("User ID not found in URL.");
      setIsLoading(false);
      return;
    }
    
    if (idToken && userId && canAccessPage) {
        const fetchUserProfileData = async () => {
          setIsLoading(true);
          setError(null);
          try {
            const data = await apiClient<UserProfileData>({
              path: `/users/${userId}`, 
              token: idToken,
              method: 'GET',
            });
            setViewedUserProfile(data);
          } catch (err: any) {
            console.error('Failed to fetch user profile:', err);
            setError(err.response?.data?.detail || err.message || 'Failed to load user profile.');
          } finally {
            setIsLoading(false);
          }
        };
        fetchUserProfileData();
    }
  }, [userId, idToken, canAccessPage, authLoading, authError, router]);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      return dateString; 
    }
  };

  const ProfileField = ({ label, value }: { label: string; value: string | undefined | null | string[] }) => {
    let displayValue: string;
    if (Array.isArray(value)) {
      displayValue = value.join(', ');
    } else {
      displayValue = value || 'N/A';
    }
    
    const usePre = typeof value === 'string' && (value.includes('\n') || value.length > 60);

    return (
      <div className="mb-4 last:mb-0">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        {usePre ? (
          <pre className="mt-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
            {displayValue}
          </pre>
        ) : (
          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-md">
            {displayValue}
          </p>
        )}
      </div>
    );
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
  
  const displaySkills = viewedUserProfile.skills && Array.isArray(viewedUserProfile.skills) ? viewedUserProfile.skills.join(', ') : 'N/A';
  const displayQualifications = viewedUserProfile.qualifications && Array.isArray(viewedUserProfile.qualifications) ? viewedUserProfile.qualifications.join(', ') : 'N/A';

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-3xl">
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

      {/* Card 1: Basic Information */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Basic Information</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Profile Picture</label>
          {viewedUserProfile.profilePictureUrl ? (
            <img 
              src={viewedUserProfile.profilePictureUrl} 
              alt={`${viewedUserProfile.firstName} ${viewedUserProfile.lastName}'s profile picture`}
              className="mt-1 w-32 h-32 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600" 
            />
          ) : (
            <div className="mt-1 w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 border-2 border-gray-300 dark:border-gray-600">
              <span>No Picture</span>
            </div>
          )}
        </div>
        <ProfileField label="Full Name" value={`${viewedUserProfile.firstName} ${viewedUserProfile.lastName}`} />
        <ProfileField label="Email" value={viewedUserProfile.email} />
        <ProfileField label="Phone Number" value={viewedUserProfile.phoneNumber} />
        <ProfileField label="Status" value={viewedUserProfile.status} />
      </div>

      {/* Card 2: Professional Details & Availability */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Professional Details & Availability</h2>
        {viewedUserProfile.skills && viewedUserProfile.skills.length > 0 && <ProfileField label="Skills" value={displaySkills} />}
        {viewedUserProfile.qualifications && viewedUserProfile.qualifications.length > 0 && <ProfileField label="Qualifications" value={displayQualifications} />}
        
        {typeof viewedUserProfile.preferences === 'object' && viewedUserProfile.preferences && Object.keys(viewedUserProfile.preferences).length > 0 && (
          <div className="mb-4 last:mb-0">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Preferences</label>
            <ul className="mt-1 list-disc list-inside space-y-1 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-md">
              {Object.entries(viewedUserProfile.preferences).map(([key, value]) => (
                <li key={key} className="text-sm text-gray-900 dark:text-gray-100">
                  <span className="font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span> {String(value)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {typeof viewedUserProfile.preferences === 'string' && viewedUserProfile.preferences && (
           <ProfileField label="Preferences (Legacy)" value={viewedUserProfile.preferences} />
        )}

        {/* Availability Display Section */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Availability</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">General Availability</label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-md whitespace-pre-wrap">
              {viewedUserProfile.availability?.general || 'Not specified'}
            </p>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Specific Dates Unavailable</label>
            {viewedUserProfile.availability?.specificDatesUnavailable && viewedUserProfile.availability.specificDatesUnavailable.length > 0 ? (
              <ul className="mt-1 list-disc list-inside bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-md">
                {viewedUserProfile.availability.specificDatesUnavailable.map(date => (
                  <li key={date} className="text-sm text-gray-900 dark:text-gray-100">{format(parseISO(date), 'PPP')}</li>
                ))}
              </ul>
            ) : <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-md">None specified</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Specific Dates Available</label>
            {viewedUserProfile.availability?.specificDatesAvailable && viewedUserProfile.availability.specificDatesAvailable.length > 0 ? (
              <ul className="mt-1 list-disc list-inside bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-md">
                {viewedUserProfile.availability.specificDatesAvailable.map(date => (
                  <li key={date} className="text-sm text-gray-900 dark:text-gray-100">{format(parseISO(date), 'PPP')}</li>
                ))}
              </ul>
            ) : <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-md">None specified</p>}
          </div>
        </div>
      </div>

      {/* Card 3: Account & System Information */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Account & System Information</h2>
        <ProfileField 
            label="Assigned Roles" 
            value={viewedUserProfile.assignedRoleNames && viewedUserProfile.assignedRoleNames.length > 0 
                   ? viewedUserProfile.assignedRoleNames.join(', ') 
                   : (viewedUserProfile.assignedRoleIds.length > 0 ? viewedUserProfile.assignedRoleIds.join(', ') : 'No roles assigned')} 
        />
        <ProfileField label="User ID (UID)" value={viewedUserProfile.uid} />
        <ProfileField label="Profile Created" value={formatDate(viewedUserProfile.createdAt)} />
        <ProfileField label="Profile Last Updated" value={formatDate(viewedUserProfile.updatedAt)} />
      </div>
    </div>
  );
};

export default AdminViewUserProfilePage;