"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext'; 
import apiClient from '@/lib/apiClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // Import Link for navigation

interface UserDataFromBackend {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  skills?: string | string[]; 
  qualifications?: string | string[]; 
  preferences?: string;
  assignedRoleIds?: string[];
  status?: string;
  createdAt?: string; 
  updatedAt?: string;
}

interface EditableUserProfile {
  firstName: string;
  lastName:string;
  email: string; 
  phoneNumber?: string;
  skills?: string; 
  qualifications?: string; 
  preferences?: string; 
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
    phoneNumber: '',
    skills: '', 
    qualifications: '', 
    preferences: '',
  });

  const skillsToString = (s: string | string[] | undefined): string => {
      if (Array.isArray(s)) return s.join('\n');
      return s || '';
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
      if (!idToken || !user?.uid) {
        setError("Authentication details are missing.");
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const fetchedProfileData = await apiClient<UserDataFromBackend>({
          method: 'GET',
          path: `/users/${user.uid}`,
          token: idToken,
        });
        setProfile(fetchedProfileData);
        setFormData({
            firstName: fetchedProfileData.firstName || '',
            lastName: fetchedProfileData.lastName || '',
            email: fetchedProfileData.email || '', 
            phoneNumber: fetchedProfileData.phoneNumber || '',
            skills: skillsToString(fetchedProfileData.skills),
            qualifications: skillsToString(fetchedProfileData.qualifications),
            preferences: fetchedProfileData.preferences || '',
        });
        setError(null);
      } catch (err: any) {
        console.error("Failed to fetch profile:", err);
        const errorMessage = err.message || 
                             (typeof err.data?.detail === 'string' ? err.data.detail : null) || 
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
    if (!idToken || !user?.uid) {
      setError("Authentication details are missing for update.");
      return;
    }
    try {
      setIsLoading(true);
      
      const updatePayload: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
      };
      
      if (typeof formData.preferences === 'string') {
        updatePayload.preferences = formData.preferences.trim();
      }
      if (typeof formData.skills === 'string') {
        updatePayload.skills = formData.skills.trim();
      }
      if (typeof formData.qualifications === 'string') {
        updatePayload.qualifications = formData.qualifications.trim();
      }

      const updatedProfileData = await apiClient<UserDataFromBackend>({
        method: 'PUT',
        path: `/users/${user.uid}`,
        token: idToken,
        data: updatePayload,
      });

      setProfile(updatedProfileData);
      setFormData({
        firstName: updatedProfileData.firstName || '',
        lastName: updatedProfileData.lastName || '',
        email: updatedProfileData.email || '',
        phoneNumber: updatedProfileData.phoneNumber || '',
        skills: skillsToString(updatedProfileData.skills), 
        qualifications: skillsToString(updatedProfileData.qualifications), 
        preferences: updatedProfileData.preferences || '', 
      });
      setIsEditing(false);
      setError(null);
      alert("Profile updated successfully!");
    } catch (err: any) { 
      console.error("Failed to update profile:", err);
      const errorMessage = err.message || 
                           (typeof err.data?.detail === 'string' ? err.data.detail : null) || 
                           "Failed to update profile. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-300">Loading profile...</div>
      </div>
    );
  }

  if (error) { 
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

  if (!profile) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-300">Profile data not found.</div>
        <Link href="/dashboard" className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm">
            Back to Dashboard
        </Link>
      </div>
    );
  }
  
  const displaySkillsText = typeof profile.skills === 'string' ? profile.skills : (Array.isArray(profile.skills) ? profile.skills.join('\n') : 'Not specified');
  const displayQualificationsText = typeof profile.qualifications === 'string' ? profile.qualifications : (Array.isArray(profile.qualifications) ? profile.qualifications.join('\n') : 'Not specified');

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
            {!isEditing && (
              <button
                onClick={() => {
                    setIsEditing(true);
                    setFormData({
                        firstName: profile.firstName || '',
                        lastName: profile.lastName || '',
                        email: profile.email || '',
                        phoneNumber: profile.phoneNumber || '',
                        skills: skillsToString(profile.skills),
                        qualifications: skillsToString(profile.qualifications),
                        preferences: profile.preferences || '',
                    });
                }}
                className="mt-4 sm:mt-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
              >
                Edit Profile
              </button>
            )}
          </div>

          {!isEditing ? (
            <div className="space-y-6">
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
                <p className="mt-1 text-lg text-gray-800 dark:text-gray-200">{profile.phoneNumber || 'Not provided'}</p>
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
                <p className="mt-1 text-lg text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{profile.preferences || 'Not specified'}</p>
              </div>
              {profile.assignedRoleIds && profile.assignedRoleIds.length > 0 && (
                  <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Roles</label>
                      <p className="mt-1 text-lg text-gray-800 dark:text-gray-200">{profile.assignedRoleIds.join(', ')}</p>
                  </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  id="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  required
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  id="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  required
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={formData.email} 
                  readOnly 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-100 dark:bg-gray-700/50 sm:text-sm text-gray-700 dark:text-gray-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label>
                <input
                  type="tel"
                  name="phoneNumber"
                  id="phoneNumber"
                  value={formData.phoneNumber || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label htmlFor="skills" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Skills</label>
                <textarea
                  name="skills"
                  id="skills"
                  value={formData.skills || ''} 
                  onChange={handleInputChange}
                  rows={4}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label htmlFor="qualifications" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Qualifications</label>
                <textarea
                  name="qualifications"
                  id="qualifications"
                  value={formData.qualifications || ''} 
                  onChange={handleInputChange}
                  rows={4}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label htmlFor="preferences" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Preferences</label>
                <textarea
                  name="preferences"
                  id="preferences"
                  value={formData.preferences || ''}
                  onChange={handleInputChange}
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                />
              </div>
              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    if (profile) {
                        setFormData({
                            firstName: profile.firstName || '',
                            lastName: profile.lastName || '',
                            email: profile.email || '',
                            phoneNumber: profile.phoneNumber || '',
                            skills: skillsToString(profile.skills),
                            qualifications: skillsToString(profile.qualifications),
                            preferences: profile.preferences || '',
                        });
                    }
                    setError(null); 
                  }}
                  className="px-4 py-2 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;