'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import apiClient, { ApiResponse } from '@/lib/apiClient'; // Import ApiResponse

interface Role {
  id: string; 
  roleName: string;
}

interface UserAdminCreatePayload {
  email: string;
  firstName?: string;
  lastName?: string;
  status: 'active' | 'disabled' | 'pending_verification';
  assignedRoleIds?: string[];
}

interface UserAdminCreateResponse extends UserAdminCreatePayload {
    id: string; 
    generatedPassword?: string; 
}

export default function AdminCreateNewUserPage() {
  const router = useRouter();
  const { user: adminAuthUser, idToken, loading: authLoading, userProfile: adminUserProfile, fetchUserProfile, hasPrivilege, logout } = useAuth(); // Added logout

  const [formData, setFormData] = useState<Omit<UserAdminCreatePayload, 'password'>>({
    email: '', firstName: '', lastName: '', status: 'pending_verification', assignedRoleIds: [],
  });
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null); 
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const canAdminCreateUser = adminUserProfile && (hasPrivilege ? hasPrivilege('users', 'admin_create') : adminUserProfile.assignedRoleIds?.includes('sysadmin'));
  const effectiveCanCreate = canAdminCreateUser || (adminUserProfile && (hasPrivilege ? hasPrivilege('users', 'create') : adminUserProfile.assignedRoleIds?.includes('sysadmin')));

  const fetchAllRoles = useCallback(async () => {
    if (!adminAuthUser || !idToken || !effectiveCanCreate) return;
    
    const result: ApiResponse<Role[]> = await apiClient<Role[]>({
        path: '/roles', token: idToken, method: 'GET',
    });

    if (result.ok && result.data) {
        setAllRoles(result.data);
    } else {
        console.error("Fetch all roles error:", result.error);
        if (result.status === 401) { await logout(); return; }
        setPageError(prev => prev ? `${prev}\\nFailed to load roles.` : result.error?.message || 'Failed to load roles for assignment.');
    }
  }, [adminAuthUser, idToken, effectiveCanCreate, logout]); // Added logout

  useEffect(() => {
    if (!authLoading && !adminAuthUser) { /* router.push('/login'); // Handled by layout/context */ return; }
    if (adminAuthUser && !adminUserProfile && fetchUserProfile) { fetchUserProfile(); return; }
    if (adminAuthUser && adminUserProfile) {
        if (!effectiveCanCreate) { setPageError("You don't have permission to create new users directly."); } 
        else { fetchAllRoles(); }
    }
  }, [adminAuthUser, authLoading, adminUserProfile, fetchUserProfile, router, effectiveCanCreate, fetchAllRoles]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (roleId: string, checked: boolean) => {
    setFormData(prev => {
        const currentAssignedRoleIds = prev.assignedRoleIds ? [...prev.assignedRoleIds] : [];
        if (checked) { return { ...prev, assignedRoleIds: [...currentAssignedRoleIds, roleId] }; } 
        else { return { ...prev, assignedRoleIds: currentAssignedRoleIds.filter(id => id !== roleId) }; }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveCanCreate || !idToken) { setSubmitError("Cannot submit: Insufficient permissions or not authenticated."); return; }
    if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email.trim())) { setSubmitError("A valid email address is required."); return; }
    if (!formData.firstName?.trim() || !formData.lastName?.trim()) { setSubmitError("First name and last name are required."); return; }

    setIsSubmitting(true); setSubmitError(null); setSubmitSuccess(null); setGeneratedPassword(null);

    const payload: UserAdminCreatePayload = {
      email: formData.email.trim(),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      status: formData.status,
      assignedRoleIds: formData.assignedRoleIds && formData.assignedRoleIds.length > 0 ? formData.assignedRoleIds : undefined,
    };

    const result: ApiResponse<UserAdminCreateResponse> = await apiClient<UserAdminCreateResponse>({ 
      path: '/users/admin-create', token: idToken, method: 'POST', data: payload,
    });
    
    setIsSubmitting(false);
    if (result.ok && result.data) {
      let successMsg = `User account for ${payload.email} created successfully.`;
      if (result.data.generatedPassword) {
        setGeneratedPassword(result.data.generatedPassword); 
        // successMsg += ` The initial password is: ${result.data.generatedPassword}`; // Password shown separately
      } else {
        successMsg += ` Please ensure the user is informed about how to set their initial password.`;
      }
      setSubmitSuccess(successMsg);
      setFormData({ email: '', firstName: '', lastName: '', status: 'pending_verification', assignedRoleIds: [] });
    } else {
      console.error("Admin create user error:", result.error);
      if (result.status === 401) { await logout(); return; }
      setSubmitError(result.error?.message || 'Failed to create user account.');
    }
  };

  if (authLoading || (adminAuthUser && !adminUserProfile && !pageError) ) {
    return ( <main className="max-w-xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center"><span className="material-icons text-6xl text-indigo-500 dark:text-indigo-400 animate-spin mb-4">sync</span><p className="text-lg text-gray-700 dark:text-gray-300">Loading...</p></main>);
  }
  if (pageError && !effectiveCanCreate) { 
    return ( <main className="max-w-xl mx-auto py-8 px-4 sm:px-6 lg:px-8"><div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 shadow-xl rounded-lg p-6 sm:p-8 text-center"><span className="material-icons text-5xl mx-auto mb-3">lock</span><h1 className="text-2xl font-semibold mb-4">Access Denied</h1><p className="mb-6">{pageError}</p><Link href="/dashboard/admin/users" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm"><span className="material-icons text-lg mr-2">arrow_back</span>Back to Users List</Link></div></main>);
  }

  const displayableRoles = allRoles.filter(role => role.id !== 'sysadmin');

  return (
    <main className="max-w-xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6"><Link href="/dashboard/admin/users" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"><span className="material-icons text-lg mr-1">arrow_back_ios</span>Back to Users List</Link></div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Create New User Account</h1>
      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">An initial password will be auto-generated. The new user should be prompted to change it upon their first login. The generated password will be displayed to you after successful account creation.</p>
          <section className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Account Details</h2>
            <div className="space-y-4">
                <div><label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address <span className="text-red-500">*</span></label><input type="email" name="email" id="email" value={formData.email} onChange={handleChange} required className="mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" /></div>
            </div>
          </section>
          <section className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">User Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div><label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name <span className="text-red-500">*</span></label><input type="text" name="firstName" id="firstName" value={formData.firstName || ''} onChange={handleChange} required className="mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" /></div>
                <div><label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name <span className="text-red-500">*</span></label><input type="text" name="lastName" id="lastName" value={formData.lastName || ''} onChange={handleChange} required className="mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" /></div>
                <div><label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Status</label><select name="status" id="status" value={formData.status} onChange={handleChange} className="mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"><option value="pending_verification">Pending Verification</option><option value="active">Active</option><option value="disabled">Disabled</option></select></div>
            </div>
          </section>
          {allRoles.length > 0 && (<section><h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Assign Roles (Optional)</h2><div className="space-y-2 max-h-60 overflow-y-auto p-3 border border-gray-200 dark:border-gray-700 rounded-md">{displayableRoles.map(role => (<label key={role.id} className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"><input type="checkbox" checked={formData.assignedRoleIds?.includes(role.id) || false} onChange={(e) => handleRoleChange(role.id, e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 dark:bg-gray-600 dark:checked:bg-indigo-500" /><span className="text-sm text-gray-700 dark:text-gray-300">{role.roleName}</span></label>))}</div></section>)}
          {pageError && effectiveCanCreate && (<div className="my-2 p-2 text-sm text-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 rounded-md flex items-center" role="alert"><span className="material-icons text-lg mr-2">warning_amber</span>{pageError}</div>)}
          {submitError && (<div className="my-4 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center" role="alert"><span className="material-icons text-lg mr-2">error_outline</span>{submitError}</div>)}
          {submitSuccess && (<div className="my-4 p-3 text-sm text-green-600 bg-green-50 dark:bg-green-900/30 rounded-lg" role="alert"><div className="flex items-center mb-2"><span className="material-icons text-lg mr-2">check_circle_outline</span>{submitSuccess.split(" The initial password is:")[0]}</div>{generatedPassword && (<div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded"><p className="text-xs text-gray-700 dark:text-gray-300">Initial auto-generated password:</p><p className="font-mono text-sm text-indigo-700 dark:text-indigo-400 break-all">{generatedPassword}</p><p className="mt-1 text-xs text-yellow-700 dark:text-yellow-500">Please provide this password to the user and advise them to change it immediately upon first login.</p></div>)}</div>)}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
            <Link href="/dashboard/admin/users" passHref><button type="button" className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"><span className="material-icons text-base mr-2">cancel</span>Cancel</button></Link>
            <button type="submit" disabled={isSubmitting || !effectiveCanCreate} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 inline-flex items-center">{isSubmitting ? (<><span className="material-icons animate-spin text-base mr-2">sync</span>Creating User...</>) : (<><span className="material-icons text-base mr-2">person_add</span>Create User Account</>)}</button>
          </div>
        </form>
      </div>
    </main>
  );
}