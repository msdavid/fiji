'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';
import { format, parseISO, formatDistanceToNowStrict } from 'date-fns';

interface Invitation {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string; 
  createdAt: string; 
  createdByUserId: string; 
  assignedRoleIds?: string[];
  creatorName?: string; 
  assignedRoleNames?: string[]; 
}

export default function AdminInvitationsPage() {
  const router = useRouter();
  const { user: adminAuthUser, idToken, loading: authLoading, userProfile: adminUserProfile, fetchUserProfile, hasPrivilege } = useAuth();
  
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'accepted' | 'expired' | 'revoked'>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  const canListInvitations = adminUserProfile && (hasPrivilege ? hasPrivilege('invitations', 'list') : adminUserProfile.assignedRoleIds?.includes('sysadmin'));
  const canCreateInvitations = adminUserProfile && (hasPrivilege ? hasPrivilege('invitations', 'create') : adminUserProfile.assignedRoleIds?.includes('sysadmin'));
  const canDeleteInvitations = adminUserProfile && (hasPrivilege ? hasPrivilege('invitations', 'delete') : adminUserProfile.assignedRoleIds?.includes('sysadmin')); 

  const fetchInvitations = useCallback(async () => {
    if (!adminAuthUser || !idToken || !canListInvitations) {
      if (adminAuthUser && !canListInvitations) setError("You don't have permission to list invitations.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true); setError(null); setActionError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filterStatus !== 'all') {
        queryParams.append('status', filterStatus);
      }
      
      const pathWithParams = `/admin/invitations/?${queryParams.toString()}`; 

      const response = await apiClient<Invitation[]>({
        path: pathWithParams, 
        token: idToken,
        method: 'GET',
      });
      setInvitations(response);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch invitations.');
      console.error("Fetch invitations error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [adminAuthUser, idToken, canListInvitations, filterStatus]); 

  useEffect(() => {
    if (!authLoading && !adminAuthUser) router.push('/login');
    if (adminAuthUser && !adminUserProfile) fetchUserProfile();
    if (adminAuthUser && adminUserProfile && idToken) {
        fetchInvitations();
    }
  }, [adminAuthUser, authLoading, adminUserProfile, fetchUserProfile, idToken, router, fetchInvitations]);

  const handleRevokeInvitation = async (invitationId: string, email: string) => {
    if (!canDeleteInvitations || !idToken) {
        setActionError("You don't have permission to revoke invitations.");
        return;
    }
    if (!confirm(`Are you sure you want to revoke the invitation for ${email}? This cannot be undone.`)) {
        return;
    }
    setActionError(null);
    try {
        await apiClient({
            path: `/admin/invitations/${invitationId}`, 
            token: idToken,
            method: 'DELETE',
        });
        await fetchInvitations(); 
    } catch (err: any) {
        setActionError(err.response?.data?.detail || err.message || 'Failed to revoke invitation.');
        console.error("Revoke invitation error:", err);
    }
  };

  const filteredInvitations = invitations.filter(inv => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = searchTerm === '' || (
      inv.email.toLowerCase().includes(term) ||
      inv.id.toLowerCase().includes(term) ||
      (inv.creatorName && inv.creatorName.toLowerCase().includes(term)) ||
      (inv.assignedRoleNames && inv.assignedRoleNames.join(' ').toLowerCase().includes(term))
    );
    return matchesSearch; 
  });

  const statusColors: { [key: string]: string } = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100',
    accepted: 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100',
    expired: 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100',
    revoked: 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100',
  };

  if (authLoading || (adminAuthUser && !adminUserProfile && !error)) {
    return (
      <main className="max-w-7xl mx-auto text-center">
        <p className="text-gray-500 dark:text-gray-400 pt-8">Loading user data...</p>
      </main>
    );
  }

  if (!canListInvitations && adminUserProfile) {
    return (
        <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
            <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6 sm:p-8 text-center">
                <span className="material-icons text-5xl text-red-500 dark:text-red-400 mb-4">lock</span>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">Access Denied</h1>
                <p className="text-gray-700 dark:text-gray-300 mb-6">You do not have permission to view this page.</p>
                <Link href="/dashboard" className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm">
                    <span className="material-icons mr-2 text-base">arrow_back</span>
                    Go to Dashboard
                </Link>
            </div>
        </main>
    );
  }
  
  return (
    <main className="max-w-7xl mx-auto"> 
      <header className="mb-8 pt-8 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Invitation Management</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage user registration invitations.</p>
        </div>
        {canCreateInvitations && (
          <Link 
            href="/dashboard/admin/invitations/new" 
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
          >
            <span className="material-icons mr-2 text-base">add_circle_outline</span>
            Create New Invitation
          </Link>
        )}
      </header>

      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center">
        <div className="flex-grow w-full sm:w-auto">
            <label htmlFor="search-invitations" className="sr-only">Search Invitations</label>
            <input
            id="search-invitations"
            type="text"
            placeholder="Search by email, ID, creator, or roles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-white"
            />
        </div>
        <div className="w-full sm:w-auto">
            <label htmlFor="filter-status" className="sr-only">Filter by Status</label>
            <select
                id="filter-status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-white min-w-[180px]"
            >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="expired">Expired</option>
                <option value="revoked">Revoked</option>
            </select>
        </div>
      </div>

      {actionError && (
        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center" role="alert">
            <span className="material-icons text-lg mr-2">error_outline</span>
            {actionError}
        </div>
      )}

      {isLoading && invitations.length === 0 ? (
         <div className="text-center py-10 px-4 sm:px-6 lg:px-8"><p className="text-gray-500 dark:text-gray-400">Loading invitations...</p></div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-md shadow text-center">
            <p className="text-red-700 dark:text-red-300">Error: {error}</p>
            <button 
                onClick={fetchInvitations} 
                className="mt-4 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
            >
                <span className="material-icons mr-2 text-base">refresh</span>
                Retry
            </button>
        </div>
      ) : !isLoading && filteredInvitations.length === 0 ? (
        <div className="text-center py-10 bg-white dark:bg-gray-900 shadow-xl rounded-lg p-6">
          <span className="material-icons text-5xl text-gray-400 dark:text-gray-500 mb-4">mail_outline</span>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No Invitations Found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {invitations.length === 0 ? "There are no invitations in the system yet." : "No invitations match your current filters."}
          </p>
        </div>
      ) : (
        <div className="shadow-xl border border-gray-200 dark:border-gray-700 sm:rounded-lg overflow-hidden mb-8"> 
          <div className="bg-white dark:bg-gray-900 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">Expires</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">Created</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">Invited By</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Roles</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredInvitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-150">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs" title={inv.email}>{inv.email}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[inv.status] || 'bg-gray-100 text-gray-800'}`}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell" title={format(parseISO(inv.expiresAt), 'PPpp')}>
                        {formatDistanceToNowStrict(parseISO(inv.expiresAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                        {format(parseISO(inv.createdAt), 'PP')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell truncate max-w-[150px]" title={inv.creatorName || inv.createdByUserId}>
                        {inv.creatorName || inv.createdByUserId}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {(inv.assignedRoleNames && inv.assignedRoleNames.length > 0) 
                        ? (
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                                {inv.assignedRoleNames.slice(0, 2).map(roleName => (
                                    <span key={roleName} className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md">{roleName}</span>
                                ))}
                                {inv.assignedRoleNames.length > 2 && (
                                    <span className="px-1.5 py-0.5 text-xs bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-md" title={inv.assignedRoleNames.slice(2).join(', ')}>
                                        +{inv.assignedRoleNames.length - 2} more
                                    </span>
                                )}
                            </div>
                          )
                        : <span className="italic text-xs">None</span>}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      {inv.status === 'pending' && canDeleteInvitations && (
                        <button 
                            onClick={() => handleRevokeInvitation(inv.id, inv.email)}
                            title="Revoke Invitation"
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 inline-flex items-center p-1 rounded hover:bg-red-100 dark:hover:bg-red-800/50"
                        >
                          <span className="material-icons text-base">cancel</span>
                          {/* <span className="ml-1 hidden sm:inline">Revoke</span> */}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}