'use client';

import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { useAuth } from '@/context/AuthContext';
import apiClient, { ApiResponse } from '@/lib/apiClient'; // Import ApiResponse
import Link from 'next/link';
import { format, parseISO, isFuture, isValid } from 'date-fns';

// Interfaces
interface UserProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  assignedRoleNames?: string[];
}

interface Assignment {
  id: string;
  assignableId: string;
  assignableName?: string;
  assignableType: 'event' | 'workingGroup';
  status: string;
  assignableStartDate?: string; 
}

interface QuickLinkItem {
  href: string;
  label: string;
  icon: string; 
  privilege?: { resource: string; action: string }; 
}

interface VolunteerActivityEntry {
  userId: string;
  totalHours: number;
}
interface VolunteerActivityReport {
  data: VolunteerActivityEntry[];
  totalHoursOverall?: number;
  totalVolunteers?: number;
}


export default function DashboardPage() {
  const { user, idToken, loading: authContextLoading, userProfile: authUserProfile, hasPrivilege, logout } = useAuth(); // Added logout
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<Assignment[]>([]);
  const [activeWorkingGroups, setActiveWorkingGroups] = useState<Assignment[]>([]);
  const [userTotalHours, setUserTotalHours] = useState<number | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false); // Keep this for the stats section
  const [error, setError] = useState<string | null>(null); // For non-401 errors

  const fetchData = useCallback(async () => {
    if (!idToken || !user) {
      if (!authContextLoading) setLoadingData(false);
      return;
    }

    setLoadingData(true);
    setError(null);
    let criticalErrorOccurred = false;

    // 1. Fetch User Profile (if not already from authUserProfile)
    if (authUserProfile && authUserProfile.id === user.uid) { // Use id from UserProfileFromBackend
        setProfile({
            id: authUserProfile.id, 
            firstName: authUserProfile.firstName,
            lastName: authUserProfile.lastName,
            email: authUserProfile.email || undefined,
            assignedRoleNames: authUserProfile.assignedRoleNames || [], 
        });
    } else {
        const profileResult = await apiClient<UserProfile>({ 
          method: 'GET',
          path: '/users/me',
          token: idToken,
        });
        if (!profileResult.ok) {
          console.error('Failed to load user profile:', profileResult.error);
          if (profileResult.status === 401) { await logout(); criticalErrorOccurred = true; } 
          else { setError(profileResult.error?.message || 'Failed to load profile.'); }
        } else if (profileResult.data) {
          setProfile(profileResult.data);
        }
    }
    if (criticalErrorOccurred) { setLoadingData(false); return; }


    // 2. Fetch Event Assignments
    const eventAssignmentsResult = await apiClient<Assignment[]>({
      method: 'GET',
      path: '/assignments?user_id=me&assignableType=event', 
      token: idToken,
    });
    if (!eventAssignmentsResult.ok) {
      console.error('Failed to load event assignments:', eventAssignmentsResult.error);
      if (eventAssignmentsResult.status === 401) { await logout(); criticalErrorOccurred = true; }
      else { setError(prev => prev || eventAssignmentsResult.error?.message || 'Failed to load event assignments.'); }
    } else if (eventAssignmentsResult.data) {
      const futureEventAssignments = eventAssignmentsResult.data.filter(a => {
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
    }
    if (criticalErrorOccurred) { setLoadingData(false); return; }

    // 3. Fetch Working Group Assignments
    const wgAssignmentsResult = await apiClient<Assignment[]>({
      method: 'GET',
      path: '/assignments?user_id=me&assignableType=workingGroup', 
      token: idToken,
    });
    if (!wgAssignmentsResult.ok) {
      console.error('Failed to load working group assignments:', wgAssignmentsResult.error);
      if (wgAssignmentsResult.status === 401) { await logout(); criticalErrorOccurred = true; }
      else { setError(prev => prev || wgAssignmentsResult.error?.message || 'Failed to load working group assignments.'); }
    } else if (wgAssignmentsResult.data) {
      setActiveWorkingGroups(wgAssignmentsResult.data.filter(a => a.status === 'active'));
    }
    if (criticalErrorOccurred) { setLoadingData(false); return; }

    // 4. Fetch Volunteer Activity Stats (nested, keep its own loading)
    setLoadingStats(true);
    setUserTotalHours(null); 
    const reportResult = await apiClient<VolunteerActivityReport>({
        method: 'GET',
        path: '/api/reports/volunteer-activity',
        token: idToken,
    });
    if (!reportResult.ok) {
        console.error('Failed to load volunteer activity stats:', reportResult.error);
        // If stats fail with 401, it's less critical than main data, don't necessarily logout entire page
        // unless this endpoint is vital for dashboard function. For now, just show 0.
        if (reportResult.status === 401) {
            console.warn("DashboardPage: Unauthorized (401) fetching volunteer stats. User might not have permission for this report.");
            // Consider if logout is appropriate or if this is a permissions issue for this specific report
        }
        setUserTotalHours(0); 
    } else if (reportResult.data) {
        const currentUserEntry = reportResult.data.data.find(entry => entry.userId === user.uid);
        setUserTotalHours(currentUserEntry ? currentUserEntry.totalHours : 0);
    } else {
        setUserTotalHours(0); // Default if data is null even if ok
    }
    setLoadingStats(false);

    setLoadingData(false); // All main data loaded or handled
  }, [idToken, user, authContextLoading, authUserProfile, logout]); // Added logout

  useEffect(() => {
    if (!authContextLoading && user) { // Only fetch if user is determined and present
      fetchData();
    } else if (!authContextLoading && !user) { // No user after auth check
      setLoadingData(false); // Stop loading as there's no user to fetch data for
      // Redirect is handled by AuthContext/DashboardLayout
    }
  }, [authContextLoading, user, fetchData]);


  const allQuickLinks: QuickLinkItem[] = [
    { href: '/dashboard/events/new', label: 'Create New Event', icon: 'add_circle_outline', privilege: { resource: 'events', action: 'create' } },
    { href: '/dashboard/admin/users', label: 'Manage Users', icon: 'manage_accounts', privilege: { resource: 'users', action: 'list' } },
    { href: '/dashboard/admin/roles', label: 'Manage Roles', icon: 'admin_panel_settings', privilege: { resource: 'roles', action: 'list' } },
    { href: '/dashboard/admin/invitations/new', label: 'Send Invitation', icon: 'person_add', privilege: { resource: 'invitations', action: 'create' } },
    { href: '/dashboard/donations', label: 'View Donations', icon: 'volunteer_activism', privilege: { resource: 'donations', action: 'list' } },
    { href: '/dashboard/donations/new', label: 'Record Donation', icon: 'savings', privilege: { resource: 'donations', action: 'create' } },
    { href: '/dashboard/admin/working-groups', label: 'Manage Working Groups', icon: 'workspaces', privilege: { resource: 'working_groups', action: 'list' } },
  ];

  const availableQuickLinks = allQuickLinks.filter(link => 
    !link.privilege || hasPrivilege(link.privilege.resource, link.privilege.action)
  );

  // Combined loading state for initial render. AuthContext handles its own loading for redirect.
  // If authContextLoading is true, DashboardLayout shows its own loader.
  // This loader is for when auth is done, but page-specific data is still loading.
  if (!authContextLoading && loadingData && !error) { 
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-10rem)]">
        <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
          <span className="material-icons animate-spin text-xl">sync</span>
          <span>Loading dashboard data...</span>
        </div>
      </div>
    );
  }
  
  // If an error occurred (and it wasn't a 401 that triggered logout)
  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6 mt-8">
        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Error</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-300">{error}</p>
        <button onClick={fetchData} className="mt-4 py-2 px-4 bg-indigo-500 text-white rounded hover:bg-indigo-600">Retry</button>
      </div>
    );
  }
  
  // If auth is done, data loading is done, no user (should be handled by layout redirect, but as a fallback)
  if (!authContextLoading && !user) {
      return null; // Layout should redirect
  }

  const displayProfileToRender = profile || (authUserProfile ? { // Renamed to avoid conflict
      id: authUserProfile.id,  // Use id from UserProfileFromBackend
      firstName: authUserProfile.firstName,
      lastName: authUserProfile.lastName,
      email: authUserProfile.email || undefined,
      assignedRoleNames: authUserProfile.assignedRoleNames || [], 
  } : null);

  const displayName = displayProfileToRender?.firstName ? `${displayProfileToRender.firstName} ${displayProfileToRender.lastName || ''}` : user?.displayName || user?.email;
  const rolesString = Array.isArray(displayProfileToRender?.assignedRoleNames) && displayProfileToRender.assignedRoleNames.length > 0 
                      ? displayProfileToRender.assignedRoleNames.join(', ') 
                      : (authUserProfile?.isSysadmin ? 'System Administrator' : 'User');


  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome, {displayName}!
        </h1>
        {rolesString && (
          <p className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium">
            Roles: {rolesString}
          </p>
        )}
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          This is your central hub for managing your activities and contributions.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 inline-flex items-center">
            <span className="material-icons mr-2 text-indigo-600 dark:text-indigo-400">leaderboard</span>
            My Contributions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Volunteer Hours</h3>
                {loadingStats ? (
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white animate-pulse">Loading...</p>
                ) : (
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {userTotalHours !== null ? userTotalHours.toFixed(1) : 'N/A'}
                    </p>
                )}
            </div>
        </div>
      </div>

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