'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';
import Link from 'next/link';
import { format, parseISO, isFuture, isValid } from 'date-fns';

// Interfaces
interface UserProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  assignedRoleNames?: string[];
  // For AuthContext's hasPrivilege, we rely on its internal userProfile which might have more details
}

interface Assignment {
  id: string;
  assignableId: string;
  assignableName?: string;
  assignableType: 'event' | 'workingGroup';
  status: string;
  assignableStartDate?: string; // YYYY-MM-DD string, primarily for events
}

interface QuickLinkItem {
  href: string;
  label: string;
  icon: string; // Material Icon name
  privilege?: { resource: string; action: string }; // Optional: for RBAC
}

export default function DashboardPage() {
  const { user, idToken, loading: authContextLoading, userProfile: authUserProfile, hasPrivilege } = useAuth(); // Get hasPrivilege and authUserProfile
  const [profile, setProfile] = useState<UserProfile | null>(null); // This profile is from /users/me for dashboard display
  const [upcomingEvents, setUpcomingEvents] = useState<Assignment[]>([]);
  const [activeWorkingGroups, setActiveWorkingGroups] = useState<Assignment[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idToken || !user) {
      if (!authContextLoading) {
        setLoadingData(false);
      }
      return;
    }

    const fetchData = async () => {
      setLoadingData(true);
      setError(null);
      try {
        // Use authUserProfile if available and matches current user, otherwise fetch
        // Note: authUserProfile from AuthContext is already fetched from /users/me
        if (authUserProfile && authUserProfile.uid === user.uid) {
            setProfile({
                id: authUserProfile.uid,
                firstName: authUserProfile.firstName,
                lastName: authUserProfile.lastName,
                email: authUserProfile.email || undefined,
                assignedRoleNames: authUserProfile.assignedRoleIds, // Assuming UserProfile in AuthContext has assignedRoleIds
                                                                  // If it has names, use that. For now, using IDs as placeholder.
                                                                  // This needs alignment with AuthContext's UserProfile definition.
            });
        } else {
            // Fallback to fetch if authUserProfile is not suitable or to get latest
            const userProfileData = await apiClient<UserProfile>({
              method: 'GET',
              path: '/users/me',
              token: idToken,
            });
            setProfile(userProfileData);
        }
        

        const eventAssignmentsData = await apiClient<Assignment[]>({
          method: 'GET',
          path: '/assignments?userId=me&assignableType=event',
          token: idToken,
        });
        
        const futureEventAssignments = eventAssignmentsData.filter(a => {
          if (!a.assignableStartDate || !isValid(parseISO(a.assignableStartDate))) {
            return ['confirmed', 'pending_confirmation', 'interested'].includes(a.status);
          }
          return isFuture(parseISO(a.assignableStartDate)) || format(parseISO(a.assignableStartDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
        });
        futureEventAssignments.sort((a, b) => {
            if (!a.assignableStartDate) return 1;
            if (!b.assignableStartDate) return -1;
            return parseISO(a.assignableStartDate).getTime() - parseISO(b.assignableStartDate).getTime();
        });
        setUpcomingEvents(futureEventAssignments);

        const wgAssignmentsData = await apiClient<Assignment[]>({
          method: 'GET',
          path: '/assignments?userId=me&assignableType=workingGroup',
          token: idToken,
        });
        setActiveWorkingGroups(wgAssignmentsData.filter(a => a.status === 'active'));

      } catch (err: any) {
        console.error('Failed to load dashboard data:', err);
        setError(err.message || 'Failed to load dashboard data.');
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [idToken, user, authContextLoading, authUserProfile]); // Added authUserProfile to dependencies

  const allQuickLinks: QuickLinkItem[] = [
    { href: '/dashboard/events/new', label: 'Create New Event', icon: 'add_circle_outline', privilege: { resource: 'events', action: 'create' } },
    { href: '/dashboard/admin/users', label: 'Manage Users', icon: 'manage_accounts', privilege: { resource: 'users', action: 'list' } }, // Assuming 'list' implies management access view
    { href: '/dashboard/admin/roles', label: 'Manage Roles', icon: 'admin_panel_settings', privilege: { resource: 'roles', action: 'list' } },
    { href: '/dashboard/admin/invitations/new', label: 'Send Invitation', icon: 'person_add', privilege: { resource: 'invitations', action: 'create' } },
    { href: '/dashboard/donations', label: 'View Donations', icon: 'volunteer_activism', privilege: { resource: 'donations', action: 'list' } },
    { href: '/dashboard/donations/new', label: 'Record Donation', icon: 'savings', privilege: { resource: 'donations', action: 'create' } },
    { href: '/dashboard/admin/working-groups', label: 'Manage Working Groups', icon: 'workspaces', privilege: { resource: 'working_groups', action: 'list' } },
  ];

  const availableQuickLinks = allQuickLinks.filter(link => 
    !link.privilege || hasPrivilege(link.privilege.resource, link.privilege.action)
  );


  if (authContextLoading || (loadingData && !profile && !authUserProfile)) { // Check against both profile states
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-10rem)]">
        <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
          <span className="material-icons animate-spin text-xl">sync</span>
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Error</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-300">{error}</p>
      </div>
    );
  }
  
  // Use authUserProfile for display name and roles if local profile is still loading or failed, but auth context has it.
  const displayProfile = profile || (authUserProfile ? {
      id: authUserProfile.uid,
      firstName: authUserProfile.firstName,
      lastName: authUserProfile.lastName,
      email: authUserProfile.email || undefined,
      assignedRoleNames: authUserProfile.assignedRoleIds, // Adjust if AuthContext.UserProfile has role names
  } : null);

  const displayName = displayProfile?.firstName ? `${displayProfile.firstName} ${displayProfile.lastName || ''}` : user?.displayName || user?.email;
  const displayRoles = displayProfile?.assignedRoleNames?.join(', ') || (authUserProfile?.assignedRoleIds?.includes('sysadmin') ? 'System Administrator' : 'User');


  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome, {displayName}!
        </h1>
        {displayRoles && (
          <p className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium">
            Roles: {displayRoles}
          </p>
        )}
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          This is your central hub for managing your activities and contributions.
        </p>
      </div>

      {/* Quick Links Section */}
      {availableQuickLinks.length > 0 && (
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 inline-flex items-center">
            <span className="material-icons mr-2 text-indigo-600 dark:text-indigo-400">link</span>
            Quick Links
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {availableQuickLinks.map(link => (
              <Link key={link.href} href={link.href}
                className="group flex items-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:shadow-md transition-all duration-150 ease-in-out">
                <span className="material-icons text-2xl text-indigo-500 dark:text-indigo-400 mr-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">{link.icon}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 inline-flex items-center">
          <span className="material-icons mr-2 text-indigo-600 dark:text-indigo-400">event_upcoming</span>
          My Upcoming Events
        </h2>
        {upcomingEvents.length > 0 ? (
          <ul className="space-y-3">
            {upcomingEvents.map(event => (
              <li key={event.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md shadow-sm hover:shadow-md transition-shadow">
                <Link href={`/dashboard/events/${event.assignableId}`} className="group block">
                  <h3 className="text-md font-medium text-indigo-600 dark:text-indigo-400 group-hover:underline">
                    {event.assignableName || 'Event Details'}
                  </h3>
                  {event.assignableStartDate && isValid(parseISO(event.assignableStartDate)) && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {format(parseISO(event.assignableStartDate), 'EEEE, MMMM d, yyyy')}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Status: {event.status}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600 dark:text-gray-300">You have no upcoming events. <Link href="/dashboard/events" className="text-indigo-600 hover:underline dark:text-indigo-400">Browse events</Link>.</p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 inline-flex items-center">
          <span className="material-icons mr-2 text-indigo-600 dark:text-indigo-400">groups</span>
          My Active Working Groups
        </h2>
        {activeWorkingGroups.length > 0 ? (
          <ul className="space-y-3">
            {activeWorkingGroups.map(group => (
              <li key={group.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md shadow-sm hover:shadow-md transition-shadow">
                <Link href={`/dashboard/admin/working-groups/${group.assignableId}`} className="group block">
                  <h3 className="text-md font-medium text-indigo-600 dark:text-indigo-400 group-hover:underline">
                    {group.assignableName || 'Working Group Details'}
                  </h3>
                   <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Status: {group.status}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600 dark:text-gray-300">You are not currently a member of any active working groups.</p>
        )}
      </div>
    </div>
  );
}