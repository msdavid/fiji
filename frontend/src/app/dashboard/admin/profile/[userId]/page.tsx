"use client";

import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient, { ApiResponse } from '@/lib/apiClient'; // Import ApiResponse
import { format, parseISO } from 'date-fns'; 

type Weekday = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
type SlotType = 'available' | 'unavailable';

interface GeneralAvailabilityRule { weekday: Weekday; from_time: string; to_time: string; }
interface SpecificDateSlot { date: string; from_time?: string; to_time?: string; slot_type: SlotType; }
interface UserAvailability { general_rules: GeneralAvailabilityRule[]; specific_slots: SpecificDateSlot[]; }

interface UserProfileData {
  uid: string; id: string; email: string; firstName: string; lastName: string;
  phone?: string | null; emergencyContactDetails?: string | null;
  skills?: string[] | null; qualifications?: string[] | null; preferences?: string | null; 
  profilePictureUrl?: string | null; availability?: UserAvailability; 
  assignedRoleIds: string[]; assignedRoleNames?: string[]; 
  status: string; createdAt: string; updatedAt: string; 
}

const useAdminAuthCheck = () => {
  const { user, idToken, userProfile, loading: authLoading, error: authError, hasPrivilege, logout } = useAuth(); // Added logout
  const isAdmin = userProfile && (hasPrivilege ? hasPrivilege('users', 'view') : userProfile.assignedRoleIds?.includes('sysadmin'));
  const canAccessPage = user && idToken && isAdmin;
  return { user, idToken, userProfile, canAccessPage, authLoading, authError, logout }; // Added logout
};

const ProfileField = ({ icon, label, value, isPreformatted = false, valueClassName }: { icon: string; label: string; value: React.ReactNode; isPreformatted?: boolean; valueClassName?: string; }) => {
  if (!value && typeof value !== 'number' && typeof value !== 'boolean') return null;
  let displayValue = value;
  if (Array.isArray(value)) displayValue = value.length > 0 ? value.join(', ') : 'N/A';
  else if (value === null || value === undefined || value === '') displayValue = 'N/A';
  return (
    <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <span className="material-icons text-indigo-600 dark:text-indigo-400 mt-1 text-lg">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        {isPreformatted ? (
          <pre className={`mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words w-full ${valueClassName || ''}`}>{displayValue}</pre>
        ) : (
          <p className={`mt-1 text-sm text-gray-700 dark:text-gray-300 break-words ${valueClassName || ''}`}>{displayValue}</p>
        )}
      </div>
    </div>
  );
};

const AdminViewUserProfilePage = () => {
  const { idToken, canAccessPage, authLoading, authError, logout } = useAdminAuthCheck(); // Added logout
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [viewedUserProfile, setViewedUserProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfileData = useCallback(async () => {
    if (!idToken || !userId) {
        setError("Required information (token or user ID) is missing.");
        setIsLoading(false); return;
    }
    setIsLoading(true); setError(null);
    
    const result: ApiResponse<UserProfileData> = await apiClient<UserProfileData>({
      path: `/users/${userId}`, token: idToken, method: 'GET',
    });

    setIsLoading(false);
    if (result.ok && result.data) {
      setViewedUserProfile(result.data);
    } else {
      console.error('Failed to fetch user profile:', result.error);
      if (result.status === 401) { await logout(); return; }
      setError(result.error?.message || 'Failed to load user profile.');
    }
  }, [userId, idToken, logout]); // Added logout

  useEffect(() => {
    if (authLoading) { setIsLoading(true); return; }
    if (authError) { setError(`Authentication error: ${authError.message || 'Unknown auth error'}`); setIsLoading(false); return; }
    if (!canAccessPage && !authLoading) { setError("Access Denied. You do not have permission to view this page."); setIsLoading(false); return; }
    if (!idToken && !authLoading) { setError("Authentication token not available."); setIsLoading(false); return; }
    if (!userId) { setError("User ID not found in URL."); setIsLoading(false); return; }
    
    if (idToken && userId && canAccessPage) {
        fetchUserProfileData();
    }
  }, [userId, idToken, canAccessPage, authLoading, authError, router, fetchUserProfileData]);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try { return format(parseISO(dateString), 'PPP p'); } 
    catch (e) { return dateString; }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-800">
        <div className="text-center p-6">
          <svg className="animate-spin h-10 w-10 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Loading user profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
            <Link href="/dashboard/admin/users" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                <span className="material-icons mr-1 text-lg">arrow_back</span> Back to User List
            </Link>
        </div>
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">View User Profile</h1>
          <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-md mb-6"><p className="text-red-600 dark:text-red-400 text-sm">{error}</p></div>
        </div>
      </main>
    );
  }

  if (!viewedUserProfile) {
    return (
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
         <div className="mb-6">
            <Link href="/dashboard/admin/users" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                <span className="material-icons mr-1 text-lg">arrow_back</span> Back to User List
            </Link>
        </div>
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">View User Profile</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">User profile not found.</p>
        </div>
      </main>
    );
  }
  
  const { firstName, lastName, email, status, phone, emergencyContactDetails, skills, qualifications, preferences, availability, assignedRoleNames, assignedRoleIds, uid, createdAt, updatedAt, profilePictureUrl } = viewedUserProfile;
  const statusColors: { [key: string]: string } = { active: 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100', pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100', inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100', suspended: 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100', };
  const statusDisplay = status?.replace(/_/g, ' ') || 'N/A';

  return (
    <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6"><Link href="/dashboard/admin/users" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 group"><span className="material-icons text-lg mr-1 group-hover:text-indigo-500 dark:group-hover:text-indigo-300">arrow_back_ios</span>Back to User List</Link></div>
      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:space-x-6 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex-shrink-0 mb-4 sm:mb-0">
              {profilePictureUrl ? (<img src={profilePictureUrl} alt={`${firstName} ${lastName}'s profile`} className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700 shadow-md" />) 
                                 : (<div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600"><span className="material-icons text-5xl">person_outline</span></div>)}
            </div>
            <div className="flex-grow">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{firstName} {lastName}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{email}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Status: <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'}`}>{statusDisplay}</span></p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Last updated: {formatDate(updatedAt)}</p>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Contact Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"><ProfileField icon="phone" label="Phone Number" value={phone} /></div>
          {emergencyContactDetails && (<div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"><h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2 inline-flex items-center"><span className="material-icons mr-2 text-indigo-500 dark:text-indigo-400">contact_emergency</span>Emergency Contact Details</h3><pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{emergencyContactDetails}</pre></div>)}
          {(skills && skills.length > 0) || (qualifications && qualifications.length > 0) || preferences ? (
            <><h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">Professional Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"><ProfileField icon="construction" label="Skills" value={skills} /><ProfileField icon="school" label="Qualifications" value={qualifications} /></div>
            {preferences && (<div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"><h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2 inline-flex items-center"><span className="material-icons mr-2 text-indigo-500 dark:text-indigo-400">tune</span>Preferences</h3><pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{preferences}</pre></div>)}</>
          ) : null}
          {availability && (availability.general_rules?.length > 0 || availability.specific_slots?.length > 0) && (
            <><h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">Availability</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {availability.general_rules && availability.general_rules.length > 0 && (<div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"><h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3 inline-flex items-center"><span className="material-icons mr-2 text-indigo-500 dark:text-indigo-400">event_repeat</span>General Recurring</h3><ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">{availability.general_rules.map((rule, index) => (<li key={index} className="flex items-center"><span className="material-icons text-base mr-2 text-gray-500 dark:text-gray-400">schedule</span>Every {rule.weekday} from {rule.from_time} to {rule.to_time}</li>))}</ul></div>)}
              {availability.specific_slots && availability.specific_slots.length > 0 && (<div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"><h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3 inline-flex items-center"><span className="material-icons mr-2 text-indigo-500 dark:text-indigo-400">date_range</span>Specific Dates</h3><ul className="space-y-2 text-sm">{availability.specific_slots.map((slot, index) => (<li key={index} className={`flex items-center ${slot.slot_type === 'unavailable' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}><span className={`material-icons text-base mr-2 ${slot.slot_type === 'unavailable' ? 'text-red-500' : 'text-green-500'}`}>{slot.slot_type === 'unavailable' ? 'event_busy' : 'event_available'}</span>{slot.date ? format(parseISO(slot.date), 'PPP') : 'Invalid Date'}{slot.from_time && slot.to_time ? ` from ${slot.from_time} to ${slot.to_time}` : ' (All day)'}{' '}({slot.slot_type})</li>))}</ul></div>)}
            </div></>
          )}
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">Account & System</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProfileField icon="admin_panel_settings" label="Assigned Roles" value={(assignedRoleNames && assignedRoleNames.length > 0 ? assignedRoleNames : (assignedRoleIds.length > 0 ? assignedRoleIds : ['No roles assigned']))} />
            <ProfileField icon="fingerprint" label="User ID (Firebase UID)" value={uid} />
            <ProfileField icon="history_toggle_off" label="Profile Created" value={formatDate(createdAt)} />
          </div>
        </div>
      </div>
    </main>
  );
};

export default AdminViewUserProfilePage;