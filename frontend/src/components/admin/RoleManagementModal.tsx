"use client";

import React, { useState, useEffect } from 'react'; // Removed useContext
import apiClient from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext'; // Import useAuth

interface Role {
  roleId: string; // This is the roleName (e.g., "sysadmin", "editor")
  roleName: string;
  description?: string;
  privileges: Record<string, string[]>; // Assuming privileges structure, adjust if different
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
  const { idToken, userProfile } = useAuth(); // Use the useAuth hook

  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine if the current admin user can actually manage roles (e.g., has 'sysadmin' role)
  // This is a safeguard, though the page opening this modal should already be protected.
  const canAdminManageRoles = userProfile?.assignedRoleIds?.includes('sysadmin');

  useEffect(() => {
    if (isOpen && idToken && canAdminManageRoles) {
      setIsLoading(true);
      setError(null);
      apiClient<Role[]>({ path: '/roles', token: idToken })
        .then(data => {
          // Filter out system roles that are not 'sysadmin'
          // Or, if 'sysadmin' should not be assignable here, filter it too.
          // Current logic: allow assigning 'sysadmin', filter other non-assignable system roles.
          setAvailableRoles(data.filter(role => !role.isSystemRole || role.roleName === 'sysadmin'));
        })
        .catch(err => {
          console.error("Failed to fetch roles:", err);
          setError(err.data?.detail || err.message || "Failed to load available roles.");
        })
        .finally(() => setIsLoading(false));
    } else if (isOpen && !canAdminManageRoles) {
        setError("You do not have permission to manage roles.");
        setIsLoading(false);
    }
  }, [isOpen, idToken, canAdminManageRoles]);

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
    try {
      // The backend endpoint expects role IDs (which are roleNames in our case)
      await apiClient({
        method: 'PUT',
        path: `/users/${user.uid}/roles`, 
        token: idToken,
        data: { assignedRoleIds: selectedRoleIds },
      });
      onRolesUpdated(user.uid, selectedRoleIds);
      onClose(); 
    } catch (err: any) {
      console.error("Failed to update user roles:", err);
      setError(err.data?.detail || err.message || "Failed to update roles.");
    } finally {
      setIsLoading(false);
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
                      id={`role-${role.roleId}-${user.uid}`} // Ensure unique ID if multiple modals could exist (though unlikely here)
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