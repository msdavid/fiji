'use client';

import React, { useState, useEffect, useCallback } from 'react'; 
import { useAuth } from '@/context/AuthContext';
import apiClient, { ApiResponse } from '@/lib/apiClient'; 
import Link from 'next/link';
import { format, parseISO, isFuture, isValid } from 'date-fns';

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
  assignableStartDate?: string; 
  assignableEndDate?: string;   
  status: string;
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
  displayName: string; 
  eventCount: number;  
}
interface VolunteerActivityReport {
  data: VolunteerActivityEntry[];
  totalHoursOverall?: number;
  totalVolunteers?: number;
}

interface UserDonation {
  id: string;
  donationType: 'monetary' | 'in_kind' | 'time_contribution';
  amount?: number;
  currency?: string;
  description: string;
  donationDate: string;
  createdAt: string;
}


export default function DashboardPage() {
  const { user, idToken, sessionToken, loading: authContextLoading, userProfile: authUserProfile, hasPrivilege, logout } = useAuth(); 
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<Assignment[]>([]);
  const [activeWorkingGroups, setActiveWorkingGroups] = useState<Assignment[]>([]);
  const [userDonations, setUserDonations] = useState<UserDonation[]>([]);
  const [userTotalHours, setUserTotalHours] = useState<number | null>(null);
  const [statsAvailability, setStatsAvailability] = useState<'loading' | 'available' | 'unavailable' | 'error'>('loading');
  const [loadingData, setLoadingData] = useState(true);
  // loadingStats is now part of statsAvailability
  const [error, setError] = useState<string | null>(null); 

  const fetchData = useCallback(async () => {
    if (!idToken || !sessionToken || !user) {
      if (!authContextLoading) setLoadingData(false);
      return;
    }

    setLoadingData(true);
    setError(null);
    let criticalErrorOccurred = false;

    // 1. Fetch User Profile
    if (authUserProfile && authUserProfile.id === user.uid) { 
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

    // 4. Fetch User Donations/Contributions
    try {
      const donationsResult = await apiClient<UserDonation[]>({
        method: 'GET',
        path: '/donations/my-submissions?limit=5',
        token: sessionToken, // Use sessionToken instead of idToken
      });
      if (!donationsResult.ok) {
        console.error('Failed to load user donations:', donationsResult.error);
        if (donationsResult.status === 401) { 
          await logout(); 
          criticalErrorOccurred = true; 
        } else {
          // Log error but don't fail the dashboard load for donations
          console.warn('User donations unavailable, continuing without them');
          setUserDonations([]);
        }
      } else if (donationsResult.data) {
        console.log('User donations loaded:', donationsResult.data);
        setUserDonations(donationsResult.data);
      } else {
        console.log('No donation data returned');
        setUserDonations([]);
      }
    } catch (donationsError) {
      console.error('Exception fetching user donations:', donationsError);
      setUserDonations([]); // Graceful fallback
    }
    if (criticalErrorOccurred) { setLoadingData(false); return; }

    // 5. Fetch Volunteer Activity Stats (conditionally based on permission)
    setUserTotalHours(null); 
    if (authUserProfile && hasPrivilege && hasPrivilege('admin', 'view_summary')) {
        setStatsAvailability('loading');
        const reportResult = await apiClient<VolunteerActivityReport>({
            method: 'GET',
            path: '/api/reports/volunteer-activity',
            token: idToken,
        });

        if (!reportResult.ok) {
            const uiErrorMessage = reportResult.error?.message || 'Failed to load volunteer activity stats.';
            console.error("--- Volunteer Activity Stats Error Details (Admin View) ---");
            if (reportResult.error) {
                console.error("Full reportResult.error object:", reportResult.error);
                console.error("reportResult.error.message:", reportResult.error.message);
                console.error("reportResult.error.status:", reportResult.error.status);
                console.error("reportResult.error.details (stringified):", JSON.stringify(reportResult.error.details, null, 2));
            } else {
                console.error("reportResult.error was null or undefined. Full reportResult object:", reportResult);
            }
            console.error("UI Error Message:", uiErrorMessage);
            console.error("--- End of Volunteer Activity Stats Error Details (Admin View) ---");

            if (reportResult.status === 401) { // Should ideally not happen if hasPrivilege check is robust
                console.warn("DashboardPage: Unauthorized (401) fetching volunteer stats despite privilege check. Logging out.");
                await logout(); // Critical if an admin suddenly gets 401
                criticalErrorOccurred = true;
            } else {
                 setStatsAvailability('error'); // Specific error for stats
            }
            setUserTotalHours(0); // Default on error
        } else if (reportResult.data && reportResult.data.data) { 
            const currentUserEntry = reportResult.data.data.find(entry => entry.userId === user.uid);
            setUserTotalHours(currentUserEntry ? currentUserEntry.totalHours : 0);
            setStatsAvailability('available');
        } else {
            console.warn("Volunteer activity stats: API call OK but no data or malformed data received.", reportResult.data);
            setUserTotalHours(0); 
            setStatsAvailability('available'); // Data is available, but might be empty or zero
        }
    } else {
        // User does not have permission to view admin summary reports
        console.log("User does not have 'admin:view_summary' privilege. Skipping volunteer activity stats.");
        setStatsAvailability('unavailable'); // Stats are unavailable due to permissions
        setUserTotalHours(null); // Or 0, depending on desired display for non-admins
    }
    if (criticalErrorOccurred) { setLoadingData(false); return; }
    
    setLoadingData(false); 
  }, [idToken, sessionToken, user, authContextLoading, authUserProfile, hasPrivilege, logout]); 

  useEffect(() => {
    if (!authContextLoading && user && authUserProfile) { // Ensure authUserProfile is also available for hasPrivilege check
      fetchData();
    } else if (!authContextLoading && (!user || !authUserProfile)) { 
      setLoadingData(false); 
    }
  }, [authContextLoading, user, authUserProfile, fetchData]);

  const allQuickLinks: QuickLinkItem[] = [
    { href: '/dashboard/donate', label: 'Declare a Donation', icon: 'volunteer_activism' }, // Available to all users
    { href: '/dashboard/events/new', label: 'Create New Event', icon: 'add_circle_outline', privilege: { resource: 'events', action: 'create' } },
    { href: '/dashboard/donations/new', label: 'Record New Donation', icon: 'receipt_long', privilege: { resource: 'donations', action: 'create' } },
    { href: '/dashboard/admin/invitations/new', label: 'Invite New User', icon: 'person_add', privilege: { resource: 'invitations', action: 'create' } },
    { href: '/dashboard/admin/roles/new', label: 'Create New Role', icon: 'admin_panel_settings', privilege: { resource: 'roles', action: 'create' } },
    { href: '/dashboard/admin/working-groups/new', label: 'Create Working Group', icon: 'group_add', privilege: { resource: 'working_groups', action: 'create' } },
  ];

  const availableQuickLinks = allQuickLinks.filter(link => 
    !link.privilege || (authUserProfile && hasPrivilege && hasPrivilege(link.privilege.resource, link.privilege.action))
  );

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
  
  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6 mt-8">
        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Error</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-300">{error}</p>
        <button onClick={fetchData} className="mt-4 py-2 px-4 bg-indigo-500 text-white rounded hover:bg-indigo-600">Retry</button>
      </div>
    );
  }
  
  if (!authContextLoading && !user) {
      return null; 
  }

  const displayProfileToRender = profile || (authUserProfile ? { 
      id: authUserProfile.id,  
      firstName: authUserProfile.firstName,
      lastName: authUserProfile.lastName,
      email: authUserProfile.email || undefined,
      assignedRoleNames: authUserProfile.assignedRoleNames || [], 
  } : null);

  const displayName = displayProfileToRender?.firstName ? `${displayProfileToRender.firstName} ${displayProfileToRender.lastName || ''}` : user?.displayName || user?.email;
  const rolesString = Array.isArray(displayProfileToRender?.assignedRoleNames) && displayProfileToRender.assignedRoleNames.length > 0 
                      ? displayProfileToRender.assignedRoleNames.join(', ') 
                      : (authUserProfile?.isSysadmin ? 'System Administrator' : 'User');

  const renderTotalHours = () => {
    switch (statsAvailability) {
        case 'loading':
            return <span className="material-icons animate-spin text-xs">sync</span>;
        case 'available':
            return userTotalHours !== null ? userTotalHours.toFixed(1) : '0.0';
        case 'unavailable':
            return <span title="Stats not available for your role">N/A</span>;
        case 'error':
            return <span title="Error loading stats">Error</span>;
        default:
            return 'N/A';
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700 text-white p-6 sm:p-8 rounded-xl shadow-xl">
        <h1 className="text-3xl sm:text-4xl font-bold">Welcome back, {displayName || 'User'}!</h1>
        <p className="mt-2 text-indigo-100 dark:text-indigo-200 text-sm sm:text-base">
          You are logged in as: <span className="font-semibold">{rolesString}</span>.
        </p>
      </section>

      {/* Donation Call-to-Action */}
      <div className="bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-700 p-4 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="material-icons text-orange-500 dark:text-orange-400 mr-3">volunteer_activism</span>
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Support Our Mission</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Help us make a positive impact in our community</p>
            </div>
          </div>
          <Link 
            href="/dashboard/donate"
            className="inline-flex items-center px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600 transition-colors duration-200"
          >
            Donate
          </Link>
        </div>
      </div>

      {/* Quick Stats & Links Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Stats Card */}
        <div className="md:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-3 inline-flex items-center">
            <span className="material-icons mr-2 text-indigo-500 dark:text-indigo-400">insights</span>
            Your Activity
          </h2>
          <div className="space-y-2 text-sm">
            <p className="text-gray-600 dark:text-gray-300">
              Total Hours Contributed: 
              <span className="font-bold text-indigo-600 dark:text-indigo-400 ml-1">
                {renderTotalHours()}
              </span>
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              Upcoming Events: 
              <span className="font-bold text-indigo-600 dark:text-indigo-400 ml-1">{upcomingEvents.length}</span>
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              Active Working Groups: 
              <span className="font-bold text-indigo-600 dark:text-indigo-400 ml-1">{activeWorkingGroups.length}</span>
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              My Contributions: 
              <span className="font-bold text-indigo-600 dark:text-indigo-400 ml-1">{userDonations.length}</span>
            </p>
          </div>
          <div className="mt-4 space-y-2">
            <Link href="/dashboard/profile" className="block text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium">
              View My Profile →
            </Link>
            <Link href="/dashboard/my-donations" className="block text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium">
              View My Donations →
            </Link>
          </div>
        </div>

        {/* Quick Links Card */}
        {availableQuickLinks.length > 0 && (
          <div className="md:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 inline-flex items-center">
              <span className="material-icons mr-2 text-purple-500 dark:text-purple-400">bolt</span>
              Quick Links
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableQuickLinks.map(link => (
                <Link key={link.href} href={link.href}
                  className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200 group">
                  <span className="material-icons text-lg mr-3 text-gray-500 dark:text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400">{link.icon}</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Upcoming Events Section */}
      <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 inline-flex items-center">
            <span className="material-icons mr-2 text-green-500 dark:text-green-400">event</span>
            My Upcoming Events
        </h2>
        {upcomingEvents.length > 0 ? (
          <ul className="space-y-3">
            {upcomingEvents.slice(0, 5).map(event => (
              <li key={event.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
                <Link href={`/dashboard/events/${event.assignableId}`} className="block">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700 dark:text-gray-200">{event.assignableName || 'Event Details'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100">{event.status.replace('_', ' ')}</span>
                  </div>
                  {event.assignableStartDate && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {format(parseISO(event.assignableStartDate), 'EEE, MMM d, yyyy \'at\' h:mm a')}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">You have no upcoming event assignments.</p>
        )}
        <Link href="/dashboard/events" className="mt-4 inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium">
          View All Events →
        </Link>
      </section>

      {/* Active Working Groups Section */}
      <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 inline-flex items-center">
            <span className="material-icons mr-2 text-blue-500 dark:text-blue-400">groups</span>
            My Active Working Groups
        </h2>
        {activeWorkingGroups.length > 0 ? (
          <ul className="space-y-3">
            {activeWorkingGroups.map(group => (
              <li key={group.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
                <Link href={`/dashboard/admin/working-groups/${group.assignableId}`} className="block"> {/* Assuming admin path for WG details */}
                  <span className="font-medium text-gray-700 dark:text-gray-200">{group.assignableName || 'Group Details'}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">You are not actively assigned to any working groups.</p>
        )}
         <Link href="/dashboard/admin/working-groups" className="mt-4 inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium">
          View All Working Groups →
        </Link>
      </section>

      {/* My Contributions Section */}
      <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 inline-flex items-center">
            <span className="material-icons mr-2 text-orange-500 dark:text-orange-400">volunteer_activism</span>
            My Contributions
        </h2>
        {userDonations.length > 0 ? (
          <ul className="space-y-3">
            {userDonations.map(donation => {
              const formatAmount = () => {
                if (donation.donationType === 'monetary' && donation.amount && donation.currency) {
                  return `${donation.currency} ${donation.amount.toFixed(2)}`;
                }
                return null;
              };
              
              const getTypeIcon = () => {
                switch (donation.donationType) {
                  case 'monetary': return 'payments';
                  case 'in_kind': return 'inventory';
                  case 'time_contribution': return 'schedule';
                  default: return 'volunteer_activism';
                }
              };

              return (
                <li key={donation.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
                  <Link href={`/dashboard/donations/${donation.id}`} className="block">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          <span className="material-icons text-sm mr-2 text-orange-500">{getTypeIcon()}</span>
                          <span className="font-medium text-gray-700 dark:text-gray-200">{donation.description}</span>
                        </div>
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-3">
                          <span>{format(parseISO(donation.donationDate), 'MMM d, yyyy')}</span>
                          <span className="capitalize">{donation.donationType.replace('_', ' ')}</span>
                          {formatAmount() && <span className="font-medium">{formatAmount()}</span>}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">You haven't made any contributions yet.</p>
        )}
        <Link href="/dashboard/donations" className="mt-4 inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium">
          View All Donations →
        </Link>
      </section>
    </div>
  );
}