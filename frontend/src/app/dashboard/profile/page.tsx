"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext'; 
import apiClient from '@/lib/apiClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; 
import { format, parseISO, isValid, parse } from 'date-fns';

interface UserAvailability {
  general?: string;
  specificDatesUnavailable?: string[];
  specificDatesAvailable?: string[];
}

interface UserDataFromBackend {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null; // Changed from phoneNumber
  skills?: string | string[]; 
  qualifications?: string | string[]; 
  preferences?: Record<string, any> | string; 
  profilePictureUrl?: string | null; 
  availability?: UserAvailability;
  assignedRoleIds?: string[];
  assignedRoleNames?: string[];
  status?: string;
  createdAt?: string; 
  updatedAt?: string;
}

interface EditableUserProfile {
  firstName: string;
  lastName:string;
  email: string; 
  phone?: string; // Changed from phoneNumber
  skills?: string; 
  qualifications?: string; 
  preferences?: string; 
  profilePictureUrl?: string | null; 
  availabilityGeneral?: string;
  availabilitySpecificDatesUnavailable?: string;
  availabilitySpecificDatesAvailable?: string;
}

const ProfilePage = () => {
  const authContext = useAuth(); 
  const { user, loading: authLoading, idToken } = authContext || {};
  const router = useRouter();

  const [profile, setProfile] = useState<UserDataFromBackend | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState<EditableUserProfile>({
    firstName: '',
    lastName: '',
    email: '', 
    phone: '', // Changed from phoneNumber
    skills: '', 
    qualifications: '', 
    preferences: '', 
    profilePictureUrl: '',
    availabilityGeneral: '',
    availabilitySpecificDatesUnavailable: '',
    availabilitySpecificDatesAvailable: '',
  });

  const arrayFieldToString = (fieldValue: string | string[] | undefined): string => {
      if (Array.isArray(fieldValue)) return fieldValue.join('\n');
      return fieldValue || '';
  };
  
  const dateArrayToString = (dates?: string[]): string => {
    if (Array.isArray(dates)) return dates.join(', ');
    return '';
  };

  const stringToDateArray = (dateString?: string): string[] => {
    if (!dateString) return [];
    return dateString.split(',')
      .map(d => d.trim())
      .filter(d => d && isValid(parse(d, 'yyyy-MM-dd', new Date()))) 
      .sort(); 
  };

  const preferencesObjectToStringForTextarea = (prefs: Record<string, any> | string | undefined): string => {
    if (typeof prefs === 'object' && prefs !== null) {
      return JSON.stringify(prefs, null, 2); 
    }
    return prefs || '';
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchProfile = async () => {
      if (!idToken) { 
        setError("Authentication token is missing.");
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const fetchedProfileData = await apiClient<UserDataFromBackend>({
          method: 'GET',
          path: `/users/me`, 
          token: idToken,
        });
        setProfile(fetchedProfileData);
        setFormData({
            firstName: fetchedProfileData.firstName || '',
            lastName: fetchedProfileData.lastName || '',
            email: fetchedProfileData.email || '', 
            phone: fetchedProfileData.phone || '', // Changed from phoneNumber
            skills: arrayFieldToString(fetchedProfileData.skills),
            qualifications: arrayFieldToString(fetchedProfileData.qualifications),
            preferences: preferencesObjectToStringForTextarea(fetchedProfileData.preferences),
            profilePictureUrl: fetchedProfileData.profilePictureUrl || '',
            availabilityGeneral: fetchedProfileData.availability?.general || '',
            availabilitySpecificDatesUnavailable: dateArrayToString(fetchedProfileData.availability?.specificDatesUnavailable),
            availabilitySpecificDatesAvailable: dateArrayToString(fetchedProfileData.availability?.specificDatesAvailable),
        });
        setError(null);
      } catch (err: any) {
        console.error("Failed to fetch profile:", err);
        const errorMessage = err.message || 
                             (err.response?.data?.detail) || 
                             "Failed to fetch profile. Please try again.";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user, authLoading, idToken, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) {
      setError("Authentication token is missing for update.");
      return;
    }
    try {
      setIsLoading(true);
      setError(null); 
      
      const updatePayload: Partial<EditableUserProfile> & { 
        skills?: string[], 
        qualifications?: string[], 
        preferences?: Record<string, any>,
        availability?: UserAvailability 
      } = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone, // Changed from phoneNumber
      };
      
      if (formData.preferences) {
        try {
          const parsedPreferences = JSON.parse(formData.preferences);
          if (typeof parsedPreferences === 'object' && parsedPreferences !== null) {
            updatePayload.preferences = parsedPreferences;
          } else {
            setError("Preferences must be a valid JSON object.");
            setIsLoading(false);
            return;
          }
        } catch (parseError) {
          setError("Preferences field contains invalid JSON. Please correct it or clear it.");
          setIsLoading(false);
          return;
        }
      } else {
        updatePayload.preferences = {}; 
      }

      if (typeof formData.skills === 'string') {
        updatePayload.skills = formData.skills.split('\n').map(s => s.trim()).filter(s => s);
      }
      if (typeof formData.qualifications === 'string') {
        updatePayload.qualifications = formData.qualifications.split('\n').map(q => q.trim()).filter(q => q);
      }
      
      const unavailableDates = stringToDateArray(formData.availabilitySpecificDatesUnavailable);
      const availableDates = stringToDateArray(formData.availabilitySpecificDatesAvailable);

      if (formData.availabilitySpecificDatesUnavailable && unavailableDates.length !== formData.availabilitySpecificDatesUnavailable.split(',').map(d=>d.trim()).filter(d=>d).length) {
        setError("Invalid date format in 'Specific Dates Unavailable'. Please use YYYY-MM-DD, comma-separated.");
        setIsLoading(false);
        return;
      }
      if (formData.availabilitySpecificDatesAvailable && availableDates.length !== formData.availabilitySpecificDatesAvailable.split(',').map(d=>d.trim()).filter(d=>d).length) {
        setError("Invalid date format in 'Specific Dates Available'. Please use YYYY-MM-DD, comma-separated.");
        setIsLoading(false);
        return;
      }
      
      updatePayload.availability = {
        general: formData.availabilityGeneral || undefined, 
        specificDatesUnavailable: unavailableDates.length > 0 ? unavailableDates : undefined,
        specificDatesAvailable: availableDates.length > 0 ? availableDates : undefined,
      };
      
      const updatedProfileData = await apiClient<UserDataFromBackend>({
        method: 'PUT',
        path: `/users/me`, 
        token: idToken,
        data: updatePayload,
      });

      setProfile(updatedProfileData); 
      setFormData({
        firstName: updatedProfileData.firstName || '',
        lastName: updatedProfileData.lastName || '',
        email: updatedProfileData.email || '',
        phone: updatedProfileData.phone || '', // Changed from phoneNumber
        skills: arrayFieldToString(updatedProfileData.skills), 
        qualifications: arrayFieldToString(updatedProfileData.qualifications), 
        preferences: preferencesObjectToStringForTextarea(updatedProfileData.preferences), 
        profilePictureUrl: updatedProfileData.profilePictureUrl || '',
        availabilityGeneral: updatedProfileData.availability?.general || '',
        availabilitySpecificDatesUnavailable: dateArrayToString(updatedProfileData.availability?.specificDatesUnavailable),
        availabilitySpecificDatesAvailable: dateArrayToString(updatedProfileData.availability?.specificDatesAvailable),
      });
      setIsEditing(false);
      alert("Profile updated successfully!");
    } catch (err: any) { 
      console.error("Failed to update profile:", err);
      const errorMessage = err.message || 
                           (err.response?.data?.detail) ||
                           "Failed to update profile. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || (isLoading && !isEditing)) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-300">Loading profile...</div>
      </div>
    );
  }

  if (error && !isEditing) { 
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <div className="bg-red-50 dark:bg-red-800/30 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 px-6 py-4 rounded-lg shadow-md">
          <h3 className="font-semibold text-lg mb-2">Error Loading Profile</h3>
          <p>{error}</p>
        </div>
        <Link href="/dashboard" className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm">
            Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!profile && !isEditing) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-300">Profile data not found.</div>
        <Link href="/dashboard" className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm">
            Back to Dashboard
        </Link>
      </div>
    );
  }
  
  const displaySkillsText = profile ? arrayFieldToString(profile.skills) : '';
  const displayQualificationsText = profile ? arrayFieldToString(profile.qualifications) : '';

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
            <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
              ← Back to Dashboard
            </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Your Profile
            </h1>
            {!isEditing && profile && (
              <button
                onClick={() => {
                    setIsEditing(true);
                    setFormData({ 
                        firstName: profile.firstName || '',
                        lastName: profile.lastName || '',
                        email: profile.email || '',
                        phone: profile.phone || '', // Changed from phoneNumber
                        skills: arrayFieldToString(profile.skills),
                        qualifications: arrayFieldToString(profile.qualifications),
                        preferences: preferencesObjectToStringForTextarea(profile.preferences),
                        profilePictureUrl: profile.profilePictureUrl || '',
                        availabilityGeneral: profile.availability?.general || '',
                        availabilitySpecificDatesUnavailable: dateArrayToString(profile.availability?.specificDatesUnavailable),
                        availabilitySpecificDatesAvailable: dateArrayToString(profile.availability?.specificDatesAvailable),
                    });
                    setError(null); 
                }}
                className="mt-4 sm:mt-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
              >
                Edit Profile
              </button>
            )}
          </div>

          {isLoading && isEditing && <p>Loading edit form...</p>}
          {!isLoading && !isEditing && !profile && <p>Could not load profile data to display.</p>}
          
          {!isEditing && profile ? (
            <div className="space-y-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Profile Picture</label>
                {profile.profilePictureUrl ? (
                  <img 
                    src={profile.profilePictureUrl} 
                    alt="Your profile picture"
                    className="mt-2 w-32 h-32 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600" 
                  />
                ) : (
                  <div className="mt-2 w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 border-2 border-gray-300 dark:border-gray-600">
                    <span>No Picture</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">First Name</label>
                <p className="mt-1 text-lg text-gray-800 dark:text-gray-200">{profile.firstName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Last Name</label>
                <p className="mt-1 text-lg text-gray-800 dark:text-gray-200">{profile.lastName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                <p className="mt-1 text-lg text-gray-800 dark:text-gray-200">{profile.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Phone Number</label>
                <p className="mt-1 text-lg text-gray-800 dark:text-gray-200">{profile.phone || 'Not provided'}</p> 
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Skills</label>
                <p className="mt-1 text-lg text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{displaySkillsText || 'Not specified'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Qualifications</label>
                <p className="mt-1 text-lg text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{displayQualificationsText || 'Not specified'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Preferences</label>
                {typeof profile.preferences === 'object' && profile.preferences !== null && Object.keys(profile.preferences).length > 0 ? (
                  <ul className="mt-1 list-disc list-inside space-y-1">
                    {Object.entries(profile.preferences).map(([key, value]) => (
                      <li key={key} className="text-lg text-gray-800 dark:text-gray-200">
                        <span className="font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span> {String(value)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-lg text-gray-800 dark:text-gray-200">Not specified</p>
                )}
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">Availability</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">General Availability</label>
                  <p className="mt-1 text-lg text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{profile.availability?.general || 'Not specified'}</p>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Specific Dates Unavailable</label>
                  {profile.availability?.specificDatesUnavailable && profile.availability.specificDatesUnavailable.length > 0 ? (
                    <ul className="mt-1 list-disc list-inside">
                      {profile.availability.specificDatesUnavailable.map(date => (
                        <li key={date} className="text-lg text-gray-800 dark:text-gray-200">{format(parseISO(date), 'PPP')}</li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-lg text-gray-800 dark:text-gray-200">None specified</p>}
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Specific Dates Available</label>
                  {profile.availability?.specificDatesAvailable && profile.availability.specificDatesAvailable.length > 0 ? (
                    <ul className="mt-1 list-disc list-inside">
                      {profile.availability.specificDatesAvailable.map(date => (
                        <li key={date} className="text-lg text-gray-800 dark:text-gray-200">{format(parseISO(date), 'PPP')}</li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-lg text-gray-800 dark:text-gray-200">None specified</p>}
                </div>
              </div>

              {profile.assignedRoleNames && profile.assignedRoleNames.length > 0 && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Roles</label>
                      <p className="mt-1 text-lg text-gray-800 dark:text-gray-200">{profile.assignedRoleNames.join(', ')}</p>
                  </div>
              )}
            </div>
          ) : !isLoading && isEditing && profile ? ( 
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && ( 
                <div className="p-3 bg-red-50 dark:bg-red-800/30 border border-red-300 dark:border-red-600 rounded-md">
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Profile Picture</label>
                {formData.profilePictureUrl ? ( <img src={formData.profilePictureUrl} alt="Your profile picture" className="mt-2 w-32 h-32 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600" />) 
                : (<div className="mt-2 w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 border-2 border-gray-300 dark:border-gray-600"><span>No Picture</span></div>)}
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Profile picture upload is not yet available.</p>
              </div>

              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
                <input type="text" name="firstName" id="firstName" value={formData.firstName} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700" required />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
                <input type="text" name="lastName" id="lastName" value={formData.lastName} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700" required />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <input type="email" name="email" id="email" value={formData.email} readOnly className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-100 dark:bg-gray-700/50 sm:text-sm text-gray-700 dark:text-gray-400 cursor-not-allowed" />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label> 
                <input
                  type="tel"
                  name="phone" // Changed from phoneNumber
                  id="phone"   // Changed from phoneNumber
                  value={formData.phone || ''} // Changed from phoneNumber
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label htmlFor="skills" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Skills (one per line)</label>
                <textarea name="skills" id="skills" value={formData.skills || ''} onChange={handleInputChange} rows={4} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700" />
              </div>
              <div>
                <label htmlFor="qualifications" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Qualifications (one per line)</label>
                <textarea name="qualifications" id="qualifications" value={formData.qualifications || ''} onChange={handleInputChange} rows={4} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700" />
              </div>
              <div>
                <label htmlFor="preferences" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Preferences (JSON format)</label>
                <textarea name="preferences" id="preferences" value={formData.preferences || ''} onChange={handleInputChange} rows={3} placeholder='e.g., {"communication": "email", "theme": "dark"}' className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700" />
              </div>

              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">Edit Availability</h2>
                <div>
                  <label htmlFor="availabilityGeneral" className="block text-sm font-medium text-gray-700 dark:text-gray-300">General Availability</label>
                  <textarea name="availabilityGeneral" id="availabilityGeneral" value={formData.availabilityGeneral || ''} onChange={handleInputChange} rows={3} placeholder="e.g., Weekends, Monday evenings after 6 PM" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700" />
                </div>
                <div className="mt-4">
                  <label htmlFor="availabilitySpecificDatesUnavailable" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Specific Dates Unavailable (YYYY-MM-DD, comma-separated)</label>
                  <textarea name="availabilitySpecificDatesUnavailable" id="availabilitySpecificDatesUnavailable" value={formData.availabilitySpecificDatesUnavailable || ''} onChange={handleInputChange} rows={2} placeholder="e.g., 2024-08-15, 2024-09-01" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700" />
                </div>
                <div className="mt-4">
                  <label htmlFor="availabilitySpecificDatesAvailable" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Specific Dates Available (YYYY-MM-DD, comma-separated)</label>
                  <textarea name="availabilitySpecificDatesAvailable" id="availabilitySpecificDatesAvailable" value={formData.availabilitySpecificDatesAvailable || ''} onChange={handleInputChange} rows={2} placeholder="e.g., 2024-07-20, 2024-07-21" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700" />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4">
                <button type="button" onClick={() => { setIsEditing(false); if (profile) { setFormData({ firstName: profile.firstName || '', lastName: profile.lastName || '', email: profile.email || '', phone: profile.phone || '', skills: arrayFieldToString(profile.skills), qualifications: arrayFieldToString(profile.qualifications), preferences: preferencesObjectToStringForTextarea(profile.preferences), profilePictureUrl: profile.profilePictureUrl || '', availabilityGeneral: profile.availability?.general || '', availabilitySpecificDatesUnavailable: dateArrayToString(profile.availability?.specificDatesUnavailable), availabilitySpecificDatesAvailable: dateArrayToString(profile.availability?.specificDatesAvailable), });} setError(null); }} className="px-4 py-2 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800">
                  Cancel
                </button>
                <button type="submit" disabled={isLoading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 disabled:opacity-50">
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
             (!isLoading && !profile && isEditing) && <p>Could not load profile data to edit.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;