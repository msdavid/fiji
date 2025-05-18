'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface RoleCreatePayload {
  roleName: string;
  description?: string;
  privileges: Record<string, string[]>;
}

// Define available resources and their actions based on SRS and common practice
const ALL_PRIVILEGES: Record<string, { name: string; actions: { id: string; label: string }[] }> = {
  users: {
    name: 'Users',
    actions: [
      { id: 'list', label: 'List Users' },
      { id: 'view', label: 'View User Details' },
      { id: 'edit', label: 'Edit Users' },
      { id: 'delete', label: 'Delete Users' },
      // 'create' for users is typically handled by invitation system, not a direct role privilege
    ],
  },
  roles: {
    name: 'Roles',
    actions: [
      { id: 'list', label: 'List Roles' },
      { id: 'create', label: 'Create Roles' },
      { id: 'view', label: 'View Role Details' }, // Assuming a detail view might exist
      { id: 'edit', label: 'Edit Roles' },
      { id: 'delete', label: 'Delete Roles' },
    ],
  },
  events: {
    name: 'Events',
    actions: [
      { id: 'list', label: 'List Events' },
      { id: 'create', label: 'Create Events' },
      { id: 'view', label: 'View Event Details' },
      { id: 'edit', label: 'Edit Events' },
      { id: 'delete', label: 'Delete Events' },
      { id: 'manage_assignments', label: 'Manage Event Assignments' },
    ],
  },
  working_groups: {
    name: 'Working Groups',
    actions: [
      { id: 'list', label: 'List Working Groups' },
      { id: 'create', label: 'Create Working Groups' },
      { id: 'view', label: 'View Working Group Details' },
      { id: 'edit', label: 'Edit Working Groups' },
      { id: 'delete', label: 'Delete Working Groups' },
      { id: 'manage_assignments', label: 'Manage WG Members' },
    ],
  },
  donations: {
    name: 'Donations',
    actions: [
      { id: 'list', label: 'List Donations' },
      { id: 'create', label: 'Create Donations' },
      { id: 'view', label: 'View Donation Details' },
      { id: 'edit', label: 'Edit Donations' },
      { id: 'delete', label: 'Delete Donations' },
    ],
  },
  reports: {
    name: 'Reports',
    actions: [
      { id: 'view_volunteer_hours', label: 'View Volunteer Hours Reports' },
      { id: 'view_event_participation', label: 'View Event Participation Reports' },
      { id: 'view_donation_summaries', label: 'View Donation Summaries' },
      // Add other specific report view privileges if any
    ],
  },
  invitations: {
    name: 'Invitations',
    actions: [
      { id: 'list', label: 'List Invitations' },
      { id: 'create', label: 'Create Invitations' },
      { id: 'delete', label: 'Delete/Revoke Invitations' },
    ],
  },
  admin: {
    name: 'Admin Functions',
    actions: [
      { id: 'view_summary', label: 'View Admin Dashboard Summary' },
      // Add other system-wide admin privileges if any
    ],
  },
};


export default function NewRolePage() {
  const router = useRouter();
  const { user, loading: authLoading, userProfile, fetchUserProfile, hasPrivilege } = useAuth();

  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPrivileges, setSelectedPrivileges] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canCreateRoles = userProfile && (hasPrivilege ? hasPrivilege('roles', 'create') : userProfile.assignedRoleIds?.includes('sysadmin'));

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
    if (user && !userProfile) {
        fetchUserProfile(); 
    }
    // This check is primarily for UI display, actual API call will be protected by backend
    if (userProfile && !canCreateRoles) {
        setError("You don't have permission to create roles."); 
    }
  }, [user, authLoading, userProfile, fetchUserProfile, router, canCreateRoles]);

  const handlePrivilegeChange = (resource: string, action: string, checked: boolean) => {
    setSelectedPrivileges(prev => {
      const updatedResourcePrivileges = prev[resource] ? [...prev[resource]] : [];
      if (checked) {
        if (!updatedResourcePrivileges.includes(action)) {
          updatedResourcePrivileges.push(action);
        }
      } else {
        const index = updatedResourcePrivileges.indexOf(action);
        if (index > -1) {
          updatedResourcePrivileges.splice(index, 1);
        }
      }
      const newPrivileges = { ...prev };
      if (updatedResourcePrivileges.length > 0) {
        newPrivileges[resource] = updatedResourcePrivileges;
      } else {
        delete newPrivileges[resource]; // Remove resource if no actions are selected
      }
      return newPrivileges;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canCreateRoles) {
        setError("Cannot submit: No permission or user not authenticated.");
        return;
    }
    if (!roleName.trim()) {
        setError("Role Name is required.");
        return;
    }
    // Ensure at least one privilege is selected (optional, based on requirements)
    // if (Object.keys(selectedPrivileges).length === 0) {
    //     setError("At least one privilege must be selected.");
    //     return;
    // }

    setIsSubmitting(true);
    setError(null);

    const payload: RoleCreatePayload = {
      roleName: roleName.trim(),
      description: description.trim() || undefined,
      privileges: selectedPrivileges,
    };

    try {
      const token = await user.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/roles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create role');
      }
      router.push('/dashboard/admin/roles'); 
    } catch (err: any) {
      setError(err.message);
      console.error("Create role error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || (!userProfile && user)) { 
    return (
      <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center">
        <span className="material-icons text-6xl text-indigo-500 dark:text-indigo-400 animate-spin mb-4">sync</span>
        <p className="text-lg text-gray-700 dark:text-gray-300">Loading page...</p>
      </main>
    );
  }

  if (!canCreateRoles && userProfile) { // Check again after userProfile is loaded
    return (
        <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
            <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-red-500 dark:text-red-400 mx-auto mb-3">lock</span>
                <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
                <p className="text-gray-700 dark:text-gray-300 mb-6">You do not have permission to create new roles.</p>
                <Link 
                  href="/dashboard/admin/roles" 
                  className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    <span className="material-icons text-lg mr-2">arrow_back</span>
                    Back to Roles List
                </Link>
            </div>
        </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
      <div className="mb-6">
        <Link href="/dashboard/admin/roles" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          <span className="material-icons text-lg mr-1">arrow_back_ios</span>
          Back to Roles List
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Create New Role</h1>
      
      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Role Name and Description Section */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Role Details</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="roleName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="roleName"
                  id="roleName"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  required
                  className="mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  id="description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Privileges Section */}
          <div className="pt-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-1">Permissions</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select the permissions this role will grant.</p>
            
            <div className="space-y-6">
              {Object.entries(ALL_PRIVILEGES).map(([resourceKey, resourceInfo]) => (
                <div key={resourceKey} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">{resourceInfo.name}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                    {resourceInfo.actions.map(action => (
                      <label key={`${resourceKey}-${action.id}`} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPrivileges[resourceKey]?.includes(action.id) || false}
                          onChange={(e) => handlePrivilegeChange(resourceKey, action.id, e.target.checked)}
                          className="h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 dark:bg-gray-700 dark:checked:bg-indigo-500"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{action.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && ( 
            <div className="my-4 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center" role="alert">
              <span className="material-icons text-lg mr-2">error_outline</span>
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-8 mt-4 border-t border-gray-200 dark:border-gray-700">
            <Link href="/dashboard/admin/roles" passHref>
              <button
                  type="button"
                  className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
              >
                  <span className="material-icons text-base mr-2">cancel</span>
                  Cancel
              </button>
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 inline-flex items-center"
            >
              {isSubmitting ? (
                <>
                  <span className="material-icons animate-spin text-base mr-2">sync</span>
                  Creating Role...
                </>
              ) : (
                <>
                  <span className="material-icons text-base mr-2">add_circle_outline</span>
                  Create Role
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}