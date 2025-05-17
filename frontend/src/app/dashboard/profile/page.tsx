"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext'; 
import apiClient from '@/lib/apiClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; 
import { format, parseISO, isValid, parse as parseDateFns } from 'date-fns';

// --- New Availability Interfaces ---
type Weekday = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
const weekdays: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
type SlotType = 'available' | 'unavailable';
const slotTypes: SlotType[] = ['available', 'unavailable'];


interface GeneralAvailabilityRule {
  id?: string; 
  weekday: Weekday;
  from_time: string; // HH:MM
  to_time: string;   // HH:MM
}

interface SpecificDateSlot {
  id?: string; 
  date: string; // YYYY-MM-DD
  from_time?: string; // HH:MM
  to_time?: string;   // HH:MM
  slot_type: SlotType;
}

interface UserAvailability {
  general_rules: GeneralAvailabilityRule[];
  specific_slots: SpecificDateSlot[];
}
// --- End New Availability Interfaces ---

interface UserDataFromBackend {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
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
  phone?: string;
  skills?: string; 
  qualifications?: string; 
  preferences?: string; 
  profilePictureUrl?: string | null; 
  availability: UserAvailability; 
}

const ProfilePage = () => {
  const authContext = useAuth(); 
  const { user, loading: authLoading, idToken } = authContext || {};
  const router = useRouter();

  const [profile, setProfile] = useState<UserDataFromBackend | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const initialFormData: EditableUserProfile = {
    firstName: '',
    lastName: '',
    email: '', 
    phone: '',
    skills: '', 
    qualifications: '', 
    preferences: '', 
    profilePictureUrl: '',
    availability: { 
      general_rules: [],
      specific_slots: [],
    },
  };
  const [formData, setFormData] = useState<EditableUserProfile>(initialFormData);

  const arrayFieldToString = (fieldValue: string | string[] | undefined): string => {
      if (Array.isArray(fieldValue)) return fieldValue.join('\n');
      return fieldValue || '';
  };
  
  const preferencesObjectToStringForTextarea = (prefs: Record<string, any> | string | undefined): string => {
    if (typeof prefs === 'object' && prefs !== null) {
      return JSON.stringify(prefs, null, 2); 
    }
    return prefs || '';
  };

  const initializeFormData = useCallback((profileData: UserDataFromBackend) => {
    setFormData({
      firstName: profileData.firstName || '',
      lastName: profileData.lastName || '',
      email: profileData.email || '', 
      phone: profileData.phone || '',
      skills: arrayFieldToString(profileData.skills),
      qualifications: arrayFieldToString(profileData.qualifications),
      preferences: preferencesObjectToStringForTextarea(profileData.preferences),
      profilePictureUrl: profileData.profilePictureUrl || '',
      availability: { 
        general_rules: profileData.availability?.general_rules?.map(r => ({...r, id: r.id || Math.random().toString(36).substr(2, 9)})) || [],
        specific_slots: profileData.availability?.specific_slots?.map(s => ({
            ...s, 
            id: s.id || Math.random().toString(36).substr(2, 9), 
            date: s.date ? format(parseISO(s.date), 'yyyy-MM-dd') : '',
            from_time: s.from_time || '', 
            to_time: s.to_time || '',     
        })) || [],
      },
    });
  }, []);


  useEffect(() => {
    if (authLoading) return;
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
        initializeFormData(fetchedProfileData); 
        setError(null);
      } catch (err: any) {
        console.error("Failed to fetch profile:", err);
        setError(err.message || (err.response?.data?.detail) || "Failed to fetch profile.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [user, authLoading, idToken, router, initializeFormData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGeneralRuleChange = (index: number, field: keyof GeneralAvailabilityRule, value: string) => {
    const updatedRules = formData.availability.general_rules.map((rule, i) => 
      i === index ? { ...rule, [field]: value } : rule
    );
    setFormData(prev => ({ ...prev, availability: { ...prev.availability, general_rules: updatedRules }}));
  };

  const addGeneralRule = () => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        general_rules: [...prev.availability.general_rules, { id: Math.random().toString(36).substr(2, 9), weekday: 'Monday', from_time: '09:00', to_time: '17:00' }]
      }
    }));
  };

  const removeGeneralRule = (idToRemove?: string) => {
    if (!idToRemove) return;
    const updatedRules = formData.availability.general_rules.filter(rule => rule.id !== idToRemove);
    setFormData(prev => ({ ...prev, availability: { ...prev.availability, general_rules: updatedRules }}));
  };

  const handleSpecificSlotChange = (index: number, field: keyof SpecificDateSlot, value: string | boolean) => {
    const updatedSlots = formData.availability.specific_slots.map((slot, i) =>
      i === index ? { ...slot, [field]: value } : slot
    );
    setFormData(prev => ({ ...prev, availability: { ...prev.availability, specific_slots: updatedSlots }}));
  };

  const addSpecificSlot = () => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        specific_slots: [...prev.availability.specific_slots, { id: Math.random().toString(36).substr(2, 9), date: new Date().toISOString().split('T')[0], slot_type: 'unavailable', from_time: '', to_time: '' }]
      }
    }));
  };

  const removeSpecificSlot = (idToRemove?: string) => {
    if(!idToRemove) return;
    const updatedSlots = formData.availability.specific_slots.filter(slot => slot.id !== idToRemove);
    setFormData(prev => ({ ...prev, availability: { ...prev.availability, specific_slots: updatedSlots }}));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) {
      setError("Authentication token is missing for update.");
      return;
    }
    setIsLoading(true);
    setError(null); 
    
    // Frontend validation for time logic
    for (const rule of formData.availability.general_rules) {
        if (rule.from_time && rule.to_time && rule.to_time <= rule.from_time) {
            setError(`General Rule Error: 'To time' (${rule.to_time}) must be after 'From time' (${rule.from_time}) for ${rule.weekday}.`);
            setIsLoading(false);
            return;
        }
    }
    for (const slot of formData.availability.specific_slots) {
        if (slot.from_time && slot.to_time && slot.to_time <= slot.from_time) {
            setError(`Specific Slot Error (${slot.date}): 'To time' (${slot.to_time}) must be after 'From time' (${slot.from_time}).`);
            setIsLoading(false);
            return;
        }
        if ((slot.from_time && !slot.to_time) || (!slot.from_time && slot.to_time)) {
            setError(`Specific Slot Error (${slot.date}): Both 'From time' and 'To time' must be provided if one is specified, or leave both empty for an all-day slot.`);
            setIsLoading(false);
            return;
        }
    }

    const availabilityPayload: UserAvailability = {
        general_rules: formData.availability.general_rules.map(({ id, ...rest }) => rest),
        specific_slots: formData.availability.specific_slots.map(({ id, ...rest }) => ({
            ...rest,
            date: rest.date, 
            from_time: rest.from_time || undefined, 
            to_time: rest.to_time || undefined,     
        })),
    };

    const updatePayload: Omit<EditableUserProfile, 'availability'> & { 
      skills?: string[], 
      qualifications?: string[], 
      preferences?: Record<string, any>,
      availability: UserAvailability 
    } = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
      availability: availabilityPayload, 
    };
    
    if (formData.preferences) {
      try {
        const parsedPreferences = JSON.parse(formData.preferences);
        if (typeof parsedPreferences === 'object' && parsedPreferences !== null) {
          updatePayload.preferences = parsedPreferences;
        } else {
          setError("Preferences must be a valid JSON object.");
          setIsLoading(false); return;
        }
      } catch (parseError) {
        setError("Preferences field contains invalid JSON.");
        setIsLoading(false); return;
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
          
    try {
      const updatedProfileData = await apiClient<UserDataFromBackend>({
        method: 'PUT',
        path: `/users/me`, 
        token: idToken,
        data: updatePayload,
      });

      setProfile(updatedProfileData); 
      initializeFormData(updatedProfileData); 
      setIsEditing(false);
      alert("Profile updated successfully!");
    } catch (err: any) { 
      console.error("Failed to update profile:", err);
      const errorDetail = err.response?.data?.detail;
      if (Array.isArray(errorDetail)) { 
        const pydanticError = errorDetail[0];
        setError(`Validation Error: ${pydanticError.msg} (Field: ${pydanticError.loc?.join(' -> ') || 'unknown'})`);
      } else {
        setError(errorDetail || err.message || "Failed to update profile.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || (isLoading && !isEditing && !profile)) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading profile...</p></div>;
  }
  if (error && !isEditing) {
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  }
  if (!profile && !isEditing) {
    return <div className="p-8 text-center">Profile data not found.</div>;
  }

  const currentProfileData = profile || initialFormData;

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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Your Profile</h1>
            {!isEditing && currentProfileData && (
              <button onClick={() => { setIsEditing(true); if(profile) initializeFormData(profile); setError(null); }}
                className="mt-4 sm:mt-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm">
                Edit Profile
              </button>
            )}
          </div>

          {isLoading && isEditing && <p>Loading edit form...</p>}
          
          {!isEditing && currentProfileData ? (
            <div className="space-y-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Profile Picture</label>
                {currentProfileData.profilePictureUrl ? <img src={currentProfileData.profilePictureUrl} alt="Profile" className="mt-2 w-32 h-32 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"/> : <div className="mt-2 w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 border-2 border-gray-300 dark:border-gray-600">No Picture</div>}
              </div>
              <div><label className="block text-sm font-medium text-gray-500 dark:text-gray-400">First Name</label><p className="mt-1 text-lg text-gray-800 dark:text-gray-200">{currentProfileData.firstName}</p></div>
              <div><label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Last Name</label><p className="mt-1 text-lg text-gray-800 dark:text-gray-200">{currentProfileData.lastName}</p></div>
              <div><label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Email</label><p className="mt-1 text-lg text-gray-800 dark:text-gray-200">{currentProfileData.email}</p></div>
              <div><label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Phone</label><p className="mt-1 text-lg text-gray-800 dark:text-gray-200">{currentProfileData.phone || 'N/A'}</p></div>
              <div><label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Skills</label><p className="mt-1 text-lg text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{arrayFieldToString(currentProfileData.skills) || 'N/A'}</p></div>
              <div><label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Qualifications</label><p className="mt-1 text-lg text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{arrayFieldToString(currentProfileData.qualifications) || 'N/A'}</p></div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Preferences</label>
                {typeof currentProfileData.preferences === 'object' && currentProfileData.preferences && Object.keys(currentProfileData.preferences).length > 0 ? 
                  <pre className="mt-1 text-lg bg-gray-50 dark:bg-gray-700 p-2 rounded whitespace-pre-wrap">{JSON.stringify(currentProfileData.preferences, null, 2)}</pre> : <p className="mt-1 text-lg text-gray-800 dark:text-gray-200">N/A</p>}
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">Availability</h2>
                <div>
                  <h3 className="text-md font-medium text-gray-500 dark:text-gray-400">General Recurring Availability</h3>
                  {currentProfileData.availability?.general_rules && currentProfileData.availability.general_rules.length > 0 ? (
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {currentProfileData.availability.general_rules.map((rule, index) => (
                        <li key={index} className="text-lg text-gray-800 dark:text-gray-200">
                          Every {rule.weekday} from {rule.from_time} to {rule.to_time}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-lg text-gray-800 dark:text-gray-200">Not specified.</p>}
                </div>
                <div className="mt-4">
                  <h3 className="text-md font-medium text-gray-500 dark:text-gray-400">Specific Date Slots</h3>
                  {currentProfileData.availability?.specific_slots && currentProfileData.availability.specific_slots.length > 0 ? (
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {currentProfileData.availability.specific_slots.map((slot, index) => (
                        <li key={index} className={`text-lg ${slot.slot_type === 'unavailable' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {slot.date ? format(parseISO(slot.date), 'PPP') : 'Invalid Date'}
                          {slot.from_time && slot.to_time ? ` from ${slot.from_time} to ${slot.to_time}` : ' (All day)'}
                          {' '}({slot.slot_type})
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-lg text-gray-800 dark:text-gray-200">No specific date slots defined.</p>}
                </div>
              </div>
              {currentProfileData.assignedRoleNames && currentProfileData.assignedRoleNames.length > 0 && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Roles</label>
                      <p className="mt-1 text-lg text-gray-800 dark:text-gray-200">{currentProfileData.assignedRoleNames.join(', ')}</p>
                  </div>
              )}
            </div>
          ) : !isLoading && isEditing && currentProfileData ? ( 
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && <div className="p-3 bg-red-100 dark:bg-red-900/80 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-md">{error}</div>}
              
              <div><label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label><input type="text" name="firstName" id="firstName" value={formData.firstName} onChange={handleInputChange} className="mt-1 input-class" required /></div>
              <div><label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label><input type="text" name="lastName" id="lastName" value={formData.lastName} onChange={handleInputChange} className="mt-1 input-class" required /></div>
              <div><label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label><input type="email" name="email" id="email" value={formData.email} readOnly className="mt-1 input-class-disabled" /></div>
              <div><label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label><input type="tel" name="phone" id="phone" value={formData.phone || ''} onChange={handleInputChange} className="mt-1 input-class" /></div>
              <div><label htmlFor="skills" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Skills (one per line)</label><textarea name="skills" id="skills" value={formData.skills || ''} onChange={handleInputChange} rows={3} className="mt-1 input-class" /></div>
              <div><label htmlFor="qualifications" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Qualifications (one per line)</label><textarea name="qualifications" id="qualifications" value={formData.qualifications || ''} onChange={handleInputChange} rows={3} className="mt-1 input-class" /></div>
              <div><label htmlFor="preferences" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Preferences (JSON)</label><textarea name="preferences" id="preferences" value={formData.preferences || ''} onChange={handleInputChange} rows={3} className="mt-1 input-class" /></div>
              
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Edit Availability</h2>
                
                <div className="space-y-3 mb-6">
                  <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">General Recurring Availability</h3>
                  {formData.availability.general_rules.map((rule, index) => (
                    <div key={rule.id || index} className="p-3 border dark:border-gray-600 rounded-md space-y-2 relative bg-gray-50 dark:bg-gray-700/30">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label htmlFor={`ga_weekday_${index}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">Weekday</label>
                          <select name={`ga_weekday_${index}`} value={rule.weekday} onChange={(e) => handleGeneralRuleChange(index, 'weekday', e.target.value as Weekday)} className="input-class text-sm w-full">
                            {weekdays.map(day => <option key={day} value={day}>{day}</option>)}
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`ga_from_${index}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">From Time</label>
                          <input type="time" name={`ga_from_${index}`} value={rule.from_time} onChange={(e) => handleGeneralRuleChange(index, 'from_time', e.target.value)} className="input-class text-sm w-full" />
                        </div>
                        <div>
                          <label htmlFor={`ga_to_${index}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">To Time</label>
                          <input type="time" name={`ga_to_${index}`} value={rule.to_time} onChange={(e) => handleGeneralRuleChange(index, 'to_time', e.target.value)} className="input-class text-sm w-full" />
                        </div>
                      </div>
                      <button type="button" onClick={() => removeGeneralRule(rule.id)} className="absolute -top-2 -right-2 text-red-500 hover:text-red-700 bg-white dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full p-0.5 leading-none shadow">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addGeneralRule} className="text-sm px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md shadow-sm">
                    + Add General Rule
                  </button>
                </div>
                
                <div className="space-y-3">
                   <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Specific Date Slots</h3>
                   {formData.availability.specific_slots.map((slot, index) => (
                     <div key={slot.id || index} className="p-3 border dark:border-gray-600 rounded-md space-y-2 relative bg-gray-50 dark:bg-gray-700/30">
                       <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                         <div>
                           <label htmlFor={`sd_date_${index}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">Date</label>
                           <input type="date" name={`sd_date_${index}`} value={slot.date} onChange={(e) => handleSpecificSlotChange(index, 'date', e.target.value)} className="input-class text-sm w-full" />
                         </div>
                         <div>
                           <label htmlFor={`sd_from_${index}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">From (Optional)</label>
                           <input type="time" name={`sd_from_${index}`} value={slot.from_time || ''} onChange={(e) => handleSpecificSlotChange(index, 'from_time', e.target.value)} className="input-class text-sm w-full" />
                         </div>
                         <div>
                           <label htmlFor={`sd_to_${index}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">To (Optional)</label>
                           <input type="time" name={`sd_to_${index}`} value={slot.to_time || ''} onChange={(e) => handleSpecificSlotChange(index, 'to_time', e.target.value)} className="input-class text-sm w-full" />
                         </div>
                         <div>
                            <label htmlFor={`sd_type_${index}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">Type</label>
                            <select name={`sd_type_${index}`} value={slot.slot_type} onChange={(e) => handleSpecificSlotChange(index, 'slot_type', e.target.value as SlotType)} className="input-class text-sm w-full">
                                {slotTypes.map(type => <option key={type} value={type} className="capitalize">{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}
                            </select>
                         </div>
                       </div>
                       <button type="button" onClick={() => removeSpecificSlot(slot.id)} className="absolute -top-2 -right-2 text-red-500 hover:text-red-700 bg-white dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full p-0.5 leading-none shadow">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                       </button>
                     </div>
                   ))}
                   <button type="button" onClick={addSpecificSlot} className="text-sm px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md shadow-sm">
                     + Add Specific Date Slot
                   </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4">
                <button type="button" onClick={() => { setIsEditing(false); if (profile) initializeFormData(profile); setError(null); }} className="px-4 py-2 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium border border-gray-300 dark:border-gray-500 rounded-md shadow-sm">Cancel</button>
                <button type="submit" disabled={isLoading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50">
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// Basic styling for inputs (can be moved to globals.css or a utility)
const inputClass = "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100";
const inputClassDisabled = "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-100 dark:bg-gray-700/50 sm:text-sm text-gray-700 dark:text-gray-400 cursor-not-allowed";

export default ProfilePage;