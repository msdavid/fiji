"use client";

import React, { useState, useEffect } from 'react'; 
import apiClient, { ApiResponse } from '@/lib/apiClient'; // Import ApiResponse
import { useAuth } from '@/context/AuthContext'; 

interface Role {
  roleId: string; 
  roleName: string;
  description?: string;
  privileges: Record<string, string[]>; 
  isSystemRole: boolean;
}

interface User {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  assignedRoleIds: string[];
}

interface RoleManagementModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onRolesUpdated: (userId: string, updatedRoles: string[]) => void;
}

const RoleManagementModal: React.FC<RoleManagementModalProps> = ({
  user,
  isOpen,
  onClose,
  onRolesUpdated,
}) => {
  const { idToken, userProfile, logout } = useAuth(); // Added logout

  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdminManageRoles = userProfile?.isSysadmin || userProfile?.assignedRoleIds?.includes('sysadmin'); // Check isSysadmin too

  useEffect(() => {
    if (isOpen && idToken && canAdminManageRoles) {
      const fetchRoles = async () => {
        setIsLoading(true);
        setError(null);
        const result: ApiResponse<Role[]> = await apiClient<Role[]>({ path: '/roles', token: idToken });

        if (result.ok && result.data) {
          setAvailableRoles(result.data.filter(role => !role.isSystemRole || role.roleName === 'sysadmin'));
        } else {
          console.error("Failed to fetch roles:", result.error);
          if (result.status === 401) {
            await logout();
            // onClose(); // Optionally close modal on logout
            return; // Stop further processing
          }
          setError(result.error?.message || "Failed to load available roles.");
        }
        setIsLoading(false);
      };
      fetchRoles();
    } else if (isOpen && !canAdminManageRoles) {
        setError("You do not have permission to manage roles.");
        setIsLoading(false);
    }
  }, [isOpen, idToken, canAdminManageRoles, logout]); // Added logout

  useEffect(() => {
    if (user) {
      setSelectedRoleIds(user.assignedRoleIds || []);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleRoleChange = (roleId: string) => {
    setSelectedRoleIds(prev =>
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSubmit = async () => {
    if (!idToken || !user || !canAdminManageRoles) {
      setError("Authentication, user data missing, or insufficient permissions.");
      return;
    }
    setIsLoading(true);
    setError(null);

    const result: ApiResponse<any> = await apiClient({ // Assuming any response or no content
      method: 'PUT',
      path: `/users/${user.uid}/roles`, 
      token: idToken,
      data: { assignedRoleIds: selectedRoleIds },
    });

    setIsLoading(false); // Set loading false after API call, before checking result

    if (result.ok) {
      onRolesUpdated(user.uid, selectedRoleIds);
      onClose(); 
    } else {
      console.error("Failed to update user roles:", result.error);
      if (result.status === 401) {
        await logout();
        // onClose(); // Optionally close modal on logout
        return; // Stop further processing
      }
      setError(result.error?.message || "Failed to update roles.");
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-md mx-auto">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Manage Roles for <span className="font-mono text-indigo-600 dark:text-indigo-400">{user.email}</span>
        </h2>
        
        {isLoading && <p className="text-gray-700 dark:text-gray-300">Loading roles...</p>}
        {error && <p className="text-red-500 dark:text-red-400 mb-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 p-2 rounded">{error}</p>}

        {!isLoading && !error && canAdminManageRoles && (
          <>
            {availableRoles.length > 0 ? (
              <div className="space-y-3 mb-6 max-h-60 overflow-y-auto p-1">
                {availableRoles.map(role => (
                  <div key={role.roleId} className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                    <input
                      type="checkbox"
                      id={`role-${role.roleId}-${user.uid}`} 
                      value={role.roleId}
                      checked={selectedRoleIds.includes(role.roleId)}
                      onChange={() => handleRoleChange(role.roleId)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:bg-gray-700"
                    />
                    <label htmlFor={`role-${role.roleId}-${user.uid}`} className="ml-3 block text-sm text-gray-900 dark:text-gray-200">
                      {role.roleName}
                      {role.description && <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">({role.description})</span>}
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 mb-3">No assignable roles found or available.</p>
            )}
          </>
        )}


        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 disabled:bg-gray-400 dark:disabled:bg-gray-600"
            disabled={isLoading || !canAdminManageRoles || (availableRoles.length === 0 && !error) }
          >
            {isLoading ? 'Saving...' : 'Save Roles'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleManagementModal;