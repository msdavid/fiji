'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';

// Interfaces
interface UserDetails {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string; // Changed from phoneNumber to match backend UserUpdate model more closely
  profilePictureUrl?: string;
  status: 'active' | 'disabled' | 'pending_verification';
  assignedRoleIds: string[];
  skills?: string[];
  qualifications?: string[];
  preferences?: string;
  emergencyContactDetails?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

interface Role {
  id: string; 
  roleName: string;
  description?: string;
}

interface UserUpdatePayload {
  firstName?: string;
  lastName?: string;
  phone?: string; // Changed from phoneNumber
  profilePictureUrl?: string;
  status?: 'active' | 'disabled' | 'pending_verification';
  assignedRoleIds?: string[];
  skills?: string[];
  qualifications?: string[];
  preferences?: string;
  emergencyContactDetails?: string;
  notes?: string;
}

const baseInputStyles = "mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white";
const disabledInputStyles = "mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed";


export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const { user: adminUser, idToken, loading: authLoading, userProfile: adminUserProfile, fetchUserProfile, hasPrivilege } = useAuth();
  
  const [formData, setFormData] = useState<UserUpdatePayload>({
    assignedRoleIds: [],
    skills: [],
    qualifications: [],
  });
  const [originalUser, setOriginalUser] = useState<UserDetails | null>(null);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canEditUser = adminUserProfile && (hasPrivilege ? hasPrivilege('users', 'edit') : adminUserProfile.isSysadmin);
  const canDeleteUser = adminUserProfile && (hasPrivilege ? hasPrivilege('users', 'delete') : adminUserProfile.isSysadmin);

  const fetchUserDetails = useCallback(async () => {
    if (!adminUser || !idToken || !userId || userId === 'undefined') {
      if (userId === 'undefined') setPageError("Invalid user ID provided.");
      return false; 
    }
    // Permission check moved to useEffect to avoid premature error display
    
    setPageError(null);
    try {
      const fetchedUser = await apiClient<UserDetails>({
        path: `/users/${userId}`,
        token: idToken,
        method: 'GET',
      });
      setOriginalUser(fetchedUser);
      setFormData({
        firstName: fetchedUser.firstName || '',
        lastName: fetchedUser.lastName || '',
        phone: fetchedUser.phone || '', // Ensure this matches the UserDetails interface field name
        profilePictureUrl: fetchedUser.profilePictureUrl || '',
        status: fetchedUser.status,
        assignedRoleIds: fetchedUser.assignedRoleIds || [],
        skills: fetchedUser.skills || [],
        qualifications: fetchedUser.qualifications || [],
        preferences: fetchedUser.preferences || '',
        emergencyContactDetails: fetchedUser.emergencyContactDetails || '',
        notes: fetchedUser.notes || '',
      });
      return true; 
    } catch (err: any) {
      setPageError(err.response?.data?.detail || err.message || 'Failed to fetch user details.');
      console.error("Fetch user error:", err);
      return false; 
    }
  }, [adminUser, idToken, userId]); // Removed adminUserProfile, canEditUser as they are checked in useEffect

  const fetchAllRoles = useCallback(async () => {
    if (!adminUser || !idToken) { // Removed canEditUser check here, will be checked before rendering form
        return false;
    }
    try {
        const rolesData = await apiClient<Role[]>({
            path: '/roles',
            token: idToken,
            method: 'GET',
        });
        setAllRoles(rolesData);
        return true;
    } catch (err: any) {
        console.error("Fetch all roles error:", err);
        setPageError(prev => prev ? `${prev}\nFailed to fetch roles.` : 'Failed to fetch roles.');
        return false;
    }
  }, [adminUser, idToken]);

  useEffect(() => {
    if (!authLoading && !adminUser) {
        router.push('/login');
        return;
    }
    if (adminUser && !adminUserProfile) {
        fetchUserProfile(); // Trigger fetch if adminUser exists but profile doesn't
        return; // Wait for adminUserProfile to be populated
    }
    
    if (adminUser && adminUserProfile && idToken && userId && userId !== 'undefined') {
        if (!canEditUser) { // Check permission after adminUserProfile is available
            setPageError("You don't have permission to edit users.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        Promise.all([fetchUserDetails(), fetchAllRoles()])
            .catch(() => { /* Errors handled in individual functions by setting pageError */ })
            .finally(() => setIsLoading(false));
    } else if (userId === 'undefined') {
        setPageError("Invalid user ID provided.");
        setIsLoading(false);
    } else if (adminUser && adminUserProfile && (!idToken || !userId)) {
        setIsLoading(false);
    }
  }, [adminUser, authLoading, adminUserProfile, fetchUserProfile, idToken, userId, router, fetchUserDetails, fetchAllRoles, canEditUser]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMultiTextChange = (name: 'skills' | 'qualifications', value: string) => {
    const arr = value.split(',').map(s => s.trim()).filter(s => s);
    setFormData(prev => ({ ...prev, [name]: arr }));
  };
  
  const handleRoleChange = (roleId: string, checked: boolean) => {
    setFormData(prev => {
        const currentAssignedRoleIds = prev.assignedRoleIds ? [...prev.assignedRoleIds] : [];
        if (checked) {
            if (!currentAssignedRoleIds.includes(roleId)) {
                return { ...prev, assignedRoleIds: [...currentAssignedRoleIds, roleId] };
            }
        } else {
            if (roleId === 'sysadmin' && originalUser?.id === adminUser?.uid) {
                const sysadminRolesCount = currentAssignedRoleIds.filter(id => id === 'sysadmin').length;
                if (sysadminRolesCount <= 1) { 
                    console.warn("Attempted to unassign the last/only 'sysadmin' role from self.");
                    // Optionally show a persistent error message to the user
                    setSubmitError("You cannot unassign your own last 'sysadmin' role.");
                    return prev; 
                }
            }
            return { ...prev, assignedRoleIds: currentAssignedRoleIds.filter(id => id !== roleId) };
        }
        return prev;
    });
    // Clear submit error if user makes a change after trying to remove last sysadmin role
    if (submitError === "You cannot unassign your own last 'sysadmin' role.") {
        setSubmitError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalUser || !canEditUser || !idToken) {
      setSubmitError("Cannot submit: Insufficient permissions or data missing.");
      return;
    }

    setIsSubmitting(true); setSubmitError(null);

    const payload: UserUpdatePayload = {};
    if (formData.firstName !== (originalUser.firstName || '')) payload.firstName = formData.firstName;
    if (formData.lastName !== (originalUser.lastName || '')) payload.lastName = formData.lastName;
    if (formData.phone !== (originalUser.phone || '')) payload.phone = formData.phone;
    if (formData.profilePictureUrl !== (originalUser.profilePictureUrl || '')) payload.profilePictureUrl = formData.profilePictureUrl;
    if (formData.status !== originalUser.status) payload.status = formData.status;
    
    const sortedFormDataRoles = [...(formData.assignedRoleIds || [])].sort();
    const sortedOriginalRoles = [...(originalUser.assignedRoleIds || [])].sort();
    if (JSON.stringify(sortedFormDataRoles) !== JSON.stringify(sortedOriginalRoles)) {
        payload.assignedRoleIds = formData.assignedRoleIds;
    }

    const sortedFormDataSkills = [...(formData.skills || [])].sort();
    const sortedOriginalSkills = [...(originalUser.skills || [])].sort();
    if (JSON.stringify(sortedFormDataSkills) !== JSON.stringify(sortedOriginalSkills)) {
        payload.skills = formData.skills;
    }

    const sortedFormDataQuals = [...(formData.qualifications || [])].sort();
    const sortedOriginalQuals = [...(originalUser.qualifications || [])].sort();
    if (JSON.stringify(sortedFormDataQuals) !== JSON.stringify(sortedOriginalQuals)) {
        payload.qualifications = formData.qualifications;
    }
    
    if (formData.preferences !== (originalUser.preferences || '')) payload.preferences = formData.preferences;
    if (formData.emergencyContactDetails !== (originalUser.emergencyContactDetails || '')) payload.emergencyContactDetails = formData.emergencyContactDetails;
    if (formData.notes !== (originalUser.notes || '')) payload.notes = formData.notes;

    if (Object.keys(payload).length === 0) {
      setSubmitError("No changes detected to submit.");
      setIsSubmitting(false);
      return;
    }
    
    try {
      await apiClient({
        path: `/users/${userId}`,
        token: idToken,
        method: 'PUT',
        data: payload,
      });
      router.push(`/dashboard/admin/users`); 
    } catch (err: any) {
      setSubmitError(err.response?.data?.detail || err.message || 'Failed to update user.');
      console.error("Update user error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!originalUser || !canDeleteUser || !idToken) {
        setDeleteError("Cannot delete: Insufficient permissions or user data missing.");
        return;
    }
    if (originalUser.id === adminUser?.uid) {
        setDeleteError("You cannot delete your own account through this admin interface.");
        return;
    }
    if (!confirm(`Are you sure you want to delete the user "${originalUser.firstName || originalUser.email}"? This action is permanent.`)) return;

    setIsDeleting(true); setDeleteError(null);
    try {
        await apiClient({
            path: `/users/${userId}`, 
            token: idToken,
            method: 'DELETE',
        });
        router.push('/dashboard/admin/users'); 
    } catch (err: any) {
        setDeleteError(err.response?.data?.detail || err.message || 'Failed to delete user.');
        console.error("Delete user error:", err);
    } finally {
        setIsDeleting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center">
        <div className="flex flex-col items-center justify-center min-h-[300px]">
            <span className="material-icons text-6xl text-indigo-500 dark:text-indigo-400 animate-spin mb-4">sync</span>
            <p className="text-lg text-gray-700 dark:text-gray-300">Loading user details...</p>
        </div>
      </main>
    );
  }

  if (pageError && (!originalUser || !canEditUser)) { // Show pageError if critical data (originalUser) isn't loaded or no permission
    return (
        <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 shadow-xl rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl mx-auto mb-3">error_outline</span>
                <h1 className="text-2xl font-semibold mb-4">Error Loading User Data</h1>
                <p className="mb-6">{pageError}</p>
                <Link href="/dashboard/admin/users" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm">
                    <span className="material-icons text-lg mr-2">arrow_back</span>
                    Back to Users List
                </Link>
            </div>
        </main>
    );
  }
  
  if (!canEditUser && adminUserProfile && !isLoading && !pageError) { // This condition might be redundant if pageError covers it
    return (
        <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
            <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-red-500 dark:text-red-400 mx-auto mb-3">lock</span>
                <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
                <p className="text-gray-700 dark:text-gray-300 mb-6">You do not have permission to edit users.</p>
                <Link href="/dashboard/admin/users" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm">
                    <span className="material-icons text-lg mr-2">arrow_back</span>
                    Back to Users List
                </Link>
            </div>
        </main>
    );
  }

  if (!originalUser && !isLoading && !pageError) {
    return (
        <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-gray-400 dark:text-gray-500 mx-auto mb-3">person_search</span>
                <h1 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">User Not Found</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">The user data could not be loaded for editing (ID: {userId}).</p>
                <Link href="/dashboard/admin/users" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm">
                    <span className="material-icons text-lg mr-2">arrow_back</span>
                    Back to Users List
                </Link>
            </div>
        </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/dashboard/admin/users" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          <span className="material-icons text-lg mr-1">arrow_back_ios</span>
          Back to Users List
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Edit User: <span className="text-indigo-600 dark:text-indigo-400">{originalUser?.firstName || originalUser?.email}</span>
      </h1>
      
      {pageError && !submitError && ( // Show page-level error if it exists and isn't a submit error
            <div className="mb-6 p-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-700 dark:text-red-100 shadow-md" role="alert">
                <span className="font-medium">Error:</span> {pageError}
            </div>
      )}

      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                <input type="text" name="firstName" id="firstName" value={formData.firstName || ''} onChange={handleChange} className={baseInputStyles} />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                <input type="text" name="lastName" id="lastName" value={formData.lastName || ''} onChange={handleChange} className={baseInputStyles} />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                <input type="email" name="email" id="email" value={originalUser?.email || ''} disabled className={disabledInputStyles} />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Email cannot be changed by an admin.</p>
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                <input type="tel" name="phone" id="phone" value={formData.phone || ''} onChange={handleChange} className={baseInputStyles} />
              </div>
              <div>
                <label htmlFor="profilePictureUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Profile Picture URL</label>
                <input type="url" name="profilePictureUrl" id="profilePictureUrl" value={formData.profilePictureUrl || ''} onChange={handleChange} className={baseInputStyles} />
              </div>
            </div>
          </section>

          <section className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Account Status & Roles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Status</label>
                    <select name="status" id="status" value={formData.status || 'pending_verification'} onChange={handleChange} className={baseInputStyles}>
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                        <option value="pending_verification">Pending Verification</option>
                    </select>
                </div>
                <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assigned Roles</label>
                    <div className="space-y-2 max-h-60 overflow-y-auto p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800/50">
                        {allRoles.length > 0 ? allRoles.map(role => (
                            <label key={role.id} className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                                <input
                                type="checkbox"
                                checked={formData.assignedRoleIds?.includes(role.id) || false}
                                onChange={(e) => handleRoleChange(role.id, e.target.checked)}
                                disabled={role.id === 'sysadmin' && originalUser?.id === adminUser?.uid && (formData.assignedRoleIds?.filter(id => id === 'sysadmin').length ?? 0) <=1 && (formData.assignedRoleIds?.includes('sysadmin') || false)}
                                className="h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-500 rounded focus:ring-indigo-500 dark:bg-gray-600 dark:checked:bg-indigo-500"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">{role.roleName}</span>
                                {role.id === 'sysadmin' && originalUser?.id === adminUser?.uid && (formData.assignedRoleIds?.filter(id => id === 'sysadmin').length ?? 0) <=1 && (formData.assignedRoleIds?.includes('sysadmin') || false) && (
                                    <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-2">(Cannot unassign last sysadmin role from self)</span>
                                )}
                            </label>
                        )) : <p className="text-sm text-gray-500 dark:text-gray-400 italic p-2">No roles available or failed to load roles.</p>}
                    </div>
                </div>
            </div>
          </section>
          
          <section className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Additional Information</h2>
            <div className="space-y-4">
                <div>
                    <label htmlFor="skills" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Skills (comma-separated)</label>
                    <input type="text" name="skills" id="skills" value={formData.skills?.join(', ') || ''} onChange={(e) => handleMultiTextChange('skills', e.target.value)} className={baseInputStyles} />
                </div>
                <div>
                    <label htmlFor="qualifications" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Qualifications (comma-separated)</label>
                    <input type="text" name="qualifications" id="qualifications" value={formData.qualifications?.join(', ') || ''} onChange={(e) => handleMultiTextChange('qualifications', e.target.value)} className={baseInputStyles} />
                </div>
                 <div>
                    <label htmlFor="preferences" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preferences</label>
                    <textarea name="preferences" id="preferences" rows={3} value={formData.preferences || ''} onChange={handleChange} className={baseInputStyles} />
                </div>
                 <div>
                    <label htmlFor="emergencyContactDetails" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emergency Contact Details</label>
                    <textarea name="emergencyContactDetails" id="emergencyContactDetails" rows={3} value={formData.emergencyContactDetails || ''} onChange={handleChange} className={baseInputStyles} />
                </div>
                <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Administrative Notes</label>
                    <textarea name="notes" id="notes" rows={4} value={formData.notes || ''} onChange={handleChange} className={baseInputStyles} />
                </div>
            </div>
          </section>

          {submitError && ( 
            <div className="my-4 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center shadow-md" role="alert">
              <span className="material-icons text-lg mr-2">error_outline</span>
              {submitError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-end items-center pt-8 mt-4 border-t border-gray-200 dark:border-gray-700 space-y-3 sm:space-y-0 sm:space-x-3">
            <Link href="/dashboard/admin/users" passHref>
              <button type="button" className="w-full sm:w-auto py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center justify-center">
                  <span className="material-icons text-base mr-2">cancel</span>
                  Cancel
              </button>
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full sm:w-auto py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 inline-flex items-center justify-center"
            >
              <span className="material-icons text-base mr-2">{isSubmitting ? 'sync' : 'save'}</span>
              {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>

        {canDeleteUser && originalUser && (
            <div className="mt-10 pt-6 border-t border-red-300 dark:border-red-700">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-3 inline-flex items-center">
                    <span className="material-icons mr-2">warning_amber</span>
                    Danger Zone
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Deleting this user is permanent and cannot be undone.
                </p>
                <button
                    onClick={handleDeleteUser}
                    disabled={isDeleting || isSubmitting || originalUser.id === adminUser?.uid}
                    className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md shadow-sm inline-flex items-center disabled:opacity-50"
                >
                    <span className="material-icons text-base mr-2">delete_forever</span>
                    {isDeleting ? 'Deleting User...' : 'Delete This User'}
                </button>
                {originalUser.id === adminUser?.uid && <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">You cannot delete your own account via this admin page.</p>}
                {deleteError && 
                    <div className="mt-3 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-md flex items-center shadow-md" role="alert">
                    <span className="material-icons text-lg mr-2">error_outline</span>
                    {deleteError}
                    </div>
                }
            </div>
        )}
      </div>
    </main>
  );
}