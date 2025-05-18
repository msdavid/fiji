"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext'; 
import apiClient, { ApiResponse } from '@/lib/apiClient'; // Import ApiResponse
import { useRouter } from 'next/navigation';
import Link from 'next/link'; 
import { format, parseISO, isValid } from 'date-fns';

// --- Availability Interfaces ---
type Weekday = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
const weekdays: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
type SlotType = 'available' | 'unavailable';
const slotTypes: SlotType[] = ['available', 'unavailable'];

interface GeneralAvailabilityRule {
  id?: string; 
  weekday: Weekday;
  from_time: string; 
  to_time: string;   
}

interface SpecificDateSlot {
  id?: string; 
  date: string; 
  from_time?: string; 
  to_time?: string;   
  slot_type: SlotType;
}

interface UserAvailability {
  general_rules: GeneralAvailabilityRule[];
  specific_slots: SpecificDateSlot[];
}
// --- End Availability Interfaces ---

interface UserWorkingGroupAssignment {
  id: string;
  assignableId: string; 
  assignableName?: string; 
  status: string;
}

interface UserDataFromBackend {
  id: string; 
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  emergencyContactDetails?: string | null; 
  skills?: string | string[]; 
  qualifications?: string | string[]; 
  preferences?: string | null; 
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
  phone?: string;
  emergencyContactDetails?: string; 
  skills?: string; 
  qualifications?: string; 
  preferences?: string; 
  profilePictureUrl?: string | null; 
  availability: UserAvailability; 
}

const baseInputStyles = "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white";
const disabledInputStyles = "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-100 dark:bg-gray-700/50 sm:text-sm text-gray-700 dark:text-gray-400 cursor-not-allowed";

const ProfilePage = () => {
  const { user, loading: authLoading, idToken, logout } = useAuth(); // Added logout
  const router = useRouter();

  const [profile, setProfile] = useState<UserDataFromBackend | null>(null);
  const [workingGroupAssignments, setWorkingGroupAssignments] = useState<UserWorkingGroupAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const initialFormData: EditableUserProfile = {
    firstName: '', lastName: '', email: '', phone: '', emergencyContactDetails: '', 
    skills: '', qualifications: '', preferences: '', profilePictureUrl: '',
    availability: { general_rules: [], specific_slots: [] },
  };
  const [formData, setFormData] = useState<EditableUserProfile>(initialFormData);

  const arrayFieldToString = (fieldValue: string | string[] | undefined): string => {
      if (Array.isArray(fieldValue)) return fieldValue.join('\\n');
      return fieldValue || '';
  };
  
  const initializeFormData = useCallback((profileData: UserDataFromBackend) => {
    setFormData({
      firstName: profileData.firstName || '', lastName: profileData.lastName || '',
      email: profileData.email || '', phone: profileData.phone || '',
      emergencyContactDetails: profileData.emergencyContactDetails || '', 
      skills: arrayFieldToString(profileData.skills),
      qualifications: arrayFieldToString(profileData.qualifications),
      preferences: profileData.preferences || '', 
      profilePictureUrl: profileData.profilePictureUrl || '',
      availability: { 
        general_rules: profileData.availability?.general_rules?.map(r => ({...r, id: r.id || Math.random().toString(36).substr(2, 9)})) || [],
        specific_slots: profileData.availability?.specific_slots?.map(s => ({
            ...s, id: s.id || Math.random().toString(36).substr(2, 9), 
            date: s.date && isValid(parseISO(s.date)) ? format(parseISO(s.date), 'yyyy-MM-dd') : '',
            from_time: s.from_time || '', to_time: s.to_time || '',     
        })) || [],
      },
    });
  }, []);

  const fetchProfileAndAssignments = useCallback(async () => {
    if (!idToken) { 
      setError("Authentication token is missing."); setIsLoading(false); return;
    }
    setIsLoading(true); setError(null);

    const profileResult: ApiResponse<UserDataFromBackend> = await apiClient<UserDataFromBackend>({
      method: 'GET', path: `/users/me`, token: idToken,
    });

    if (!profileResult.ok || !profileResult.data) {
      console.error("Failed to fetch profile:", profileResult.error);
      if (profileResult.status === 401) { await logout(); return; }
      setError(profileResult.error?.message || "Failed to fetch profile.");
      setIsLoading(false); return;
    }
    
    setProfile(profileResult.data);
    initializeFormData(profileResult.data); 
    setError(null); // Clear error if profile fetch is successful

    if (profileResult.data.id) { 
      setIsLoadingAssignments(true);
      const assignmentsResult: ApiResponse<UserWorkingGroupAssignment[]> = await apiClient<UserWorkingGroupAssignment[]>({
        method: 'GET', path: `/assignments?userId=me&assignableType=workingGroup`, token: idToken,
      });
      setIsLoadingAssignments(false);

      if (!assignmentsResult.ok) {
        console.error("Failed to fetch working group assignments:", assignmentsResult.error);
        if (assignmentsResult.status === 401) { await logout(); return; }
        // Non-critical error, append to existing or set new
        setError(prev => prev ? `${prev}\\nFailed to load working group memberships.` : assignmentsResult.error?.message || "Failed to load working group memberships.");
      } else if (assignmentsResult.data) {
        setWorkingGroupAssignments(assignmentsResult.data.filter(a => a.status === 'active'));
      }
    }
    setIsLoading(false);
  }, [idToken, initializeFormData, logout]); // Added logout

  useEffect(() => {
    if (authLoading) return;
    if (!user) { /* router.push('/login'); // Handled by layout/context */ return; }
    if (idToken) { // Fetch only if idToken is available
        fetchProfileAndAssignments();
    }
  }, [user, authLoading, idToken, router, fetchProfileAndAssignments]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGeneralRuleChange = (index: number, field: keyof GeneralAvailabilityRule, value: string) => {
    const updatedRules = formData.availability.general_rules.map((rule, i) => i === index ? { ...rule, [field]: value } : rule);
    setFormData(prev => ({ ...prev, availability: { ...prev.availability, general_rules: updatedRules }}));
  };
  const addGeneralRule = () => setFormData(prev => ({ ...prev, availability: { ...prev.availability, general_rules: [...prev.availability.general_rules, { id: Math.random().toString(36).substr(2, 9), weekday: 'Monday', from_time: '09:00', to_time: '17:00' }] }}));
  const removeGeneralRule = (idToRemove?: string) => { if (!idToRemove) return; setFormData(prev => ({ ...prev, availability: { ...prev.availability, general_rules: prev.availability.general_rules.filter(rule => rule.id !== idToRemove) }})); };
  
  const handleSpecificSlotChange = (index: number, field: keyof SpecificDateSlot, value: string | boolean) => {
    const updatedSlots = formData.availability.specific_slots.map((slot, i) => i === index ? { ...slot, [field]: value } : slot);
    setFormData(prev => ({ ...prev, availability: { ...prev.availability, specific_slots: updatedSlots }}));
  };
  const addSpecificSlot = () => setFormData(prev => ({ ...prev, availability: { ...prev.availability, specific_slots: [...prev.availability.specific_slots, { id: Math.random().toString(36).substr(2, 9), date: new Date().toISOString().split('T')[0], slot_type: 'unavailable', from_time: '', to_time: '' }] }}));
  const removeSpecificSlot = (idToRemove?: string) => { if(!idToRemove) return; setFormData(prev => ({ ...prev, availability: { ...prev.availability, specific_slots: prev.availability.specific_slots.filter(slot => slot.id !== idToRemove) }})); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) { setError("Authentication token is missing for update."); return; }
    setIsLoading(true); setError(null); 
    
    for (const rule of formData.availability.general_rules) {
        if (rule.from_time && rule.to_time && rule.to_time <= rule.from_time) {
            setError(`General Rule Error: 'To time' (${rule.to_time}) must be after 'From time' (${rule.from_time}) for ${rule.weekday}.`); setIsLoading(false); return;
        }
    }
    for (const slot of formData.availability.specific_slots) {
        if (slot.from_time && slot.to_time && slot.to_time <= slot.from_time) {
            setError(`Specific Slot Error (${slot.date}): 'To time' (${slot.to_time}) must be after 'From time' (${slot.from_time}).`); setIsLoading(false); return;
        }
        if ((slot.from_time && !slot.to_time) || (!slot.from_time && slot.to_time)) {
            setError(`Specific Slot Error (${slot.date}): Both 'From time' and 'To time' must be provided if one is specified, or leave both empty for an all-day slot.`); setIsLoading(false); return;
        }
    }

    const availabilityPayload: UserAvailability = {
        general_rules: formData.availability.general_rules.map(({ id, ...rest }) => rest),
        specific_slots: formData.availability.specific_slots.map(({ id, ...rest }) => ({
            ...rest, date: rest.date, from_time: rest.from_time || undefined, to_time: rest.to_time || undefined,     
        })),
    };
    const updatePayload: Omit<EditableUserProfile, 'availability' | 'preferences' | 'email'> & { 
      skills?: string[], qualifications?: string[], preferences?: string, availability: UserAvailability 
    } = {
      firstName: formData.firstName, lastName: formData.lastName, phone: formData.phone,
      emergencyContactDetails: formData.emergencyContactDetails || undefined, 
      preferences: formData.preferences || undefined, availability: availabilityPayload, 
    };
    if (typeof formData.skills === 'string') updatePayload.skills = formData.skills.split('\\n').map(s => s.trim()).filter(s => s);
    if (typeof formData.qualifications === 'string') updatePayload.qualifications = formData.qualifications.split('\\n').map(q => q.trim()).filter(q => q);
          
    const result: ApiResponse<UserDataFromBackend> = await apiClient<UserDataFromBackend>({
      method: 'PUT', path: `/users/me`, token: idToken, data: updatePayload,
    });

    setIsLoading(false);
    if (result.ok && result.data) {
      setProfile(result.data); 
      initializeFormData(result.data); 
      setIsEditing(false);
      alert("Profile updated successfully!");
    } else { 
      console.error("Failed to update profile:", result.error);
      if (result.status === 401) { await logout(); return; }
      const errorDetail = result.error?.details?.detail; // Adjusted to match apiClient error structure
      if (Array.isArray(errorDetail)) { 
        const pydanticError = errorDetail[0];
        setError(`Validation Error: ${pydanticError.msg} (Field: ${pydanticError.loc?.join(' -> ') || 'unknown'})`);
      } else {
        setError(result.error?.message || "Failed to update profile.");
      }
    }
  };

  if (authLoading || (isLoading && !isEditing && !profile)) {
    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-800">
            <div className="text-center">
                <span className="material-icons text-6xl text-indigo-500 dark:text-indigo-400 animate-spin mb-4">sync</span>
                <p className="text-lg text-gray-700 dark:text-gray-300">Loading profile...</p>
            </div>
        </div>
    );
  }
  if (error && !isEditing && !profile) { 
    return (
        <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-700 dark:text-red-100 shadow-md" role="alert">
                <span className="font-medium">Error:</span> {error}
            </div>
        </div>
    );
  }
  if (!profile && !isEditing) {
    return (
        <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="p-4 text-center text-gray-700 dark:text-gray-300">Profile data not found.</div>
        </div>
    );
  }

  const currentProfileData = profile || initialFormData; 
  const pageTitle = currentProfileData && currentProfileData.firstName ? `${currentProfileData.firstName} ${currentProfileData.lastName}` : "User Profile";

  const ProfileDetailItem = ({ label, value, icon, isTextArea = false }: { label: string; value: string | undefined | null; icon?: string; isTextArea?: boolean }) => {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return null;
    return (
      <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg shadow-sm">
        {icon && <span className="material-icons text-indigo-600 dark:text-indigo-400 mt-1 text-lg">{icon}</span>}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
          {isTextArea ? (
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{value}</p>
          ) : (
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 break-words">{value}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
      <div className="mb-6">
          <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
            <span className="material-icons text-lg mr-1">arrow_back_ios</span>
            Back to Dashboard
          </Link>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {isEditing ? `Editing Profile: ${pageTitle}` : pageTitle}
        </h1>
        {!isEditing && currentProfileData && currentProfileData.id && (
          <button onClick={() => { setIsEditing(true); if(profile) initializeFormData(profile); setError(null); }}
            className="mt-4 sm:mt-0 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center justify-center">
            <span className="material-icons mr-2 text-base">edit</span>
            Edit Profile
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-700 dark:text-red-100 shadow-md" role="alert">
            <span className="font-medium">Error:</span> {error}
        </div>
      )}
      {isLoading && isEditing && <p className="text-gray-700 dark:text-gray-300">Loading edit form...</p>}

      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
        {!isEditing && currentProfileData && currentProfileData.id ? ( 
          <div className="md:flex md:space-x-6">
            <div className="flex-shrink-0 mb-6 md:mb-0 md:w-1/4 flex flex-col items-center md:items-start">
              {currentProfileData.profilePictureUrl ? (
                <img src={currentProfileData.profilePictureUrl} alt="Profile" className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"/>
              ) : (
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 border-2 border-gray-300 dark:border-gray-600">
                  <span className="material-icons text-5xl">person</span>
                </div>
              )}
            </div>
            <div className="hidden md:block border-l border-gray-300 dark:border-gray-600 mx-3 self-stretch"></div>
            <div className="flex-grow space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ProfileDetailItem label="Phone" value={currentProfileData.phone || 'N/A'} icon="phone" />
                <ProfileDetailItem label="Email" value={currentProfileData.email} icon="email" />
              </div>
              <ProfileDetailItem label="Emergency Contact Details" value={currentProfileData.emergencyContactDetails || 'N/A'} icon="contact_emergency" isTextArea />
              <ProfileDetailItem label="Skills" value={arrayFieldToString(currentProfileData.skills) || 'N/A'} icon="psychology" isTextArea />
              <ProfileDetailItem label="Qualifications" value={arrayFieldToString(currentProfileData.qualifications) || 'N/A'} icon="school" isTextArea />
              <ProfileDetailItem label="Preferences" value={currentProfileData.preferences || 'N/A'} icon="tune" isTextArea />
              {currentProfileData.assignedRoleNames && currentProfileData.assignedRoleNames.length > 0 && (
                  <ProfileDetailItem label="Roles" value={currentProfileData.assignedRoleNames.join(', ')} icon="admin_panel_settings" />
              )}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 inline-flex items-center">
                    <span className="material-icons mr-2 text-indigo-600 dark:text-indigo-400">groups</span> My Working Groups
                </h2>
                {isLoadingAssignments ? <p className="text-sm text-gray-700 dark:text-gray-300">Loading memberships...</p> :
                  workingGroupAssignments.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1">
                      {workingGroupAssignments.map((assignment) => (
                        <li key={assignment.id} className="text-sm text-gray-700 dark:text-gray-300">
                          {assignment.assignableName || `Group ID: ${assignment.assignableId}`} (Status: {assignment.status})
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-gray-700 dark:text-gray-300">Not a member of any working groups.</p>
                }
              </div>
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 inline-flex items-center">
                    <span className="material-icons mr-2 text-indigo-600 dark:text-indigo-400">event_available</span> Availability
                </h2>
                <div>
                  <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">General Recurring Availability</h3>
                  {currentProfileData.availability?.general_rules && currentProfileData.availability.general_rules.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1">
                      {currentProfileData.availability.general_rules.map((rule, index) => (
                        <li key={rule.id || index} className="text-sm text-gray-700 dark:text-gray-300">
                          Every {rule.weekday} from {rule.from_time} to {rule.to_time}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-gray-700 dark:text-gray-300">Not specified.</p>}
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Specific Date Slots</h3>
                  {currentProfileData.availability?.specific_slots && currentProfileData.availability.specific_slots.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1">
                      {currentProfileData.availability.specific_slots.map((slot, index) => (
                        <li key={slot.id || index} className={`text-sm ${slot.slot_type === 'unavailable' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {slot.date && isValid(parseISO(slot.date)) ? format(parseISO(slot.date), 'PPP') : 'Invalid Date'}
                          {slot.from_time && slot.to_time ? ` from ${slot.from_time} to ${slot.to_time}` : ' (All day)'}
                          {' '}({slot.slot_type})
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-gray-700 dark:text-gray-300">No specific date slots defined.</p>}
                </div>
              </div>
            </div>
          </div>
        ) : !isLoading && isEditing && currentProfileData && currentProfileData.id ? ( 
          <div className="md:flex md:space-x-6">
            <div className="flex-shrink-0 mb-6 md:mb-0 md:w-1/4 flex flex-col items-center md:items-start">
              {currentProfileData.profilePictureUrl ? (
                <img src={currentProfileData.profilePictureUrl} alt="Profile" className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"/>
              ) : (
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 border-2 border-gray-300 dark:border-gray-600">
                  <span className="material-icons text-5xl">person</span>
                </div>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center md:text-left">Profile picture can be updated via Gravatar or future upload feature.</p>
            </div>
            <div className="hidden md:block border-l border-gray-300 dark:border-gray-600 mx-3 self-stretch"></div>
            <div className="flex-grow">
              <form onSubmit={handleSubmit} className="space-y-6">
                <section>
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Personal Information</h2>
                    <div className="space-y-4">
                        <div><label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name <span className="text-red-500">*</span></label><input type="text" name="firstName" id="firstName" value={formData.firstName} onChange={handleInputChange} className={baseInputStyles} required /></div>
                        <div><label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name <span className="text-red-500">*</span></label><input type="text" name="lastName" id="lastName" value={formData.lastName} onChange={handleInputChange} className={baseInputStyles} required /></div>
                        <div><label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label><input type="email" name="email" id="email" value={formData.email} readOnly className={disabledInputStyles} /></div>
                        <div><label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label><input type="tel" name="phone" id="phone" value={formData.phone || ''} onChange={handleInputChange} className={baseInputStyles} /></div>
                        <div><label htmlFor="emergencyContactDetails" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emergency Contact Details</label><textarea name="emergencyContactDetails" id="emergencyContactDetails" value={formData.emergencyContactDetails || ''} onChange={handleInputChange} rows={3} className={baseInputStyles} placeholder="e.g., Name, Relation, Phone Number"/></div>
                        <div><label htmlFor="skills" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Skills (one per line)</label><textarea name="skills" id="skills" value={formData.skills || ''} onChange={handleInputChange} rows={3} className={baseInputStyles} /></div>
                        <div><label htmlFor="qualifications" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Qualifications (one per line)</label><textarea name="qualifications" id="qualifications" value={formData.qualifications || ''} onChange={handleInputChange} rows={3} className={baseInputStyles} /></div>
                        <div><label htmlFor="preferences" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preferences</label><textarea name="preferences" id="preferences" value={formData.preferences || ''} onChange={handleInputChange} rows={3} className={baseInputStyles} placeholder="Enter any preferences as free text (e.g., communication, interests)"/></div>
                    </div>
                </section>
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 inline-flex items-center">
                    <span className="material-icons mr-2 text-indigo-600 dark:text-indigo-400">edit_calendar</span> Edit Availability
                  </h2>
                  <div className="space-y-3 mb-6">
                    <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">General Recurring Availability</h3>
                    {formData.availability.general_rules.map((rule, index) => (
                      <div key={rule.id || index} className="p-3 border border-gray-300 dark:border-gray-600 rounded-md space-y-2 relative bg-gray-50 dark:bg-gray-700/30 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div><label htmlFor={`ga_weekday_${index}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">Weekday</label><select name={`ga_weekday_${index}`} value={rule.weekday} onChange={(e) => handleGeneralRuleChange(index, 'weekday', e.target.value as Weekday)} className={`${baseInputStyles} text-sm`}>{weekdays.map(day => <option key={day} value={day}>{day}</option>)}</select></div>
                          <div><label htmlFor={`ga_from_${index}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">From Time</label><input type="time" name={`ga_from_${index}`} value={rule.from_time} onChange={(e) => handleGeneralRuleChange(index, 'from_time', e.target.value)} className={`${baseInputStyles} text-sm`} /></div>
                          <div><label htmlFor={`ga_to_${index}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">To Time</label><input type="time" name={`ga_to_${index}`} value={rule.to_time} onChange={(e) => handleGeneralRuleChange(index, 'to_time', e.target.value)} className={`${baseInputStyles} text-sm`} /></div>
                        </div>
                        <button type="button" onClick={() => removeGeneralRule(rule.id)} className="absolute -top-2 -right-2 text-red-500 hover:text-red-700 bg-white dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full p-0.5 leading-none shadow"><span className="material-icons text-sm">close</span></button>
                      </div>
                    ))}
                    <button type="button" onClick={addGeneralRule} className="text-sm py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded-md shadow-sm inline-flex items-center"><span className="material-icons mr-1 text-sm">add</span>Add General Rule</button>
                  </div>
                  <div className="space-y-3">
                     <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Specific Date Slots</h3>
                     {formData.availability.specific_slots.map((slot, index) => (
                       <div key={slot.id || index} className="p-3 border border-gray-300 dark:border-gray-600 rounded-md space-y-2 relative bg-gray-50 dark:bg-gray-700/30 shadow-sm">
                         <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                           <div><label htmlFor={`sd_date_${index}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">Date</label><input type="date" name={`sd_date_${index}`} value={slot.date} onChange={(e) => handleSpecificSlotChange(index, 'date', e.target.value)} className={`${baseInputStyles} text-sm`} /></div>
                           <div><label htmlFor={`sd_from_${index}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">From (Optional)</label><input type="time" name={`sd_from_${index}`} value={slot.from_time || ''} onChange={(e) => handleSpecificSlotChange(index, 'from_time', e.target.value)} className={`${baseInputStyles} text-sm`} /></div>
                           <div><label htmlFor={`sd_to_${index}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">To (Optional)</label><input type="time" name={`sd_to_${index}`} value={slot.to_time || ''} onChange={(e) => handleSpecificSlotChange(index, 'to_time', e.target.value)} className={`${baseInputStyles} text-sm`} /></div>
                           <div><label htmlFor={`sd_type_${index}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">Type</label><select name={`sd_type_${index}`} value={slot.slot_type} onChange={(e) => handleSpecificSlotChange(index, 'slot_type', e.target.value as SlotType)} className={`${baseInputStyles} text-sm`}>{slotTypes.map(type => <option key={type} value={type} className="capitalize">{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}</select></div>
                         </div>
                         <button type="button" onClick={() => removeSpecificSlot(slot.id)} className="absolute -top-2 -right-2 text-red-500 hover:text-red-700 bg-white dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full p-0.5 leading-none shadow"><span className="material-icons text-sm">close</span></button>
                       </div>
                     ))}
                     <button type="button" onClick={addSpecificSlot} className="text-sm py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded-md shadow-sm inline-flex items-center"><span className="material-icons mr-1 text-sm">add</span>Add Specific Date Slot</button>
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-3 pt-8 mt-6 border-t border-gray-200 dark:border-gray-700">
                  <button type="button" onClick={() => { setIsEditing(false); if (profile) initializeFormData(profile); setError(null); }} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center justify-center"><span className="material-icons mr-2 text-base">cancel</span>Cancel</button>
                  <button type="submit" disabled={isLoading} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 inline-flex items-center justify-center"><span className="material-icons mr-2 text-base">{isLoading ? 'sync' : 'save'}</span>{isLoading ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </form>
            </div>
          </div>
        ) : null }
        {!isLoading && !isEditing && (!currentProfileData || !currentProfileData.id) && (
            <div className="text-center p-4 text-gray-700 dark:text-gray-300">Could not load profile information.</div>
        )}
      </div>
    </main>
  );
};

export default ProfilePage;