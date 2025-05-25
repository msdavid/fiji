'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { NextPage } from 'next';
import Head from 'next/head';
import VolunteerActivitySection from '@/components/reports/VolunteerActivitySection';
import EventPerformanceSection from '@/components/reports/EventPerformanceSection';
import DonationInsightsSection from '@/components/reports/DonationInsightsSection';
import UsersReportSection from '@/components/reports/UsersReportSection'; 

// --- Data Interfaces ---
interface AdminSummaryStats {
  totalUsers: number;
  activeEvents: number;
}

interface VolunteerActivityEntry {
  userId: string;
  displayName: string;
  totalHours: number;
  eventCount: number;
}
interface VolunteerActivityReport {
  data: VolunteerActivityEntry[];
  totalVolunteers: number;
  totalHoursOverall: number;
}

interface EventPerformanceEntry {
  eventId: string;
  eventName: string;
  eventDate: string; 
  eventType?: string | null;
  registeredVolunteers: number;
  attendedVolunteers: number;
  attendanceRate: number;
}
interface EventPerformanceReport {
  data: EventPerformanceEntry[];
  totalEventsProcessed: number;
}

interface DonationTypeSummary {
  type: string;
  count: number;
  totalAmount?: number | null;
}

interface MonetaryDonationTrendEntry {
  period: string;
  totalAmount: number;
  count: number; 
}

interface ReportDonationEntry {
  id: string;
  donorDisplayName?: string | null;
  type: string;
  amount?: number | null;
  description?: string | null;
  dateReceived: string;
}

interface DonationInsightsReport {
  breakdownByType: DonationTypeSummary[];
  monetaryTrend: MonetaryDonationTrendEntry[];
  recentDonations: ReportDonationEntry[];
  totalMonetaryAmountOverall: number;
  totalDonationsCountOverall: number;
}

// Updated Interface for Users Report
interface UserReportEntry {
  id: string;
  firstName?: string | null; // Added
  lastName?: string | null;  // Added
  displayName?: string | null; // Kept for flexibility
  email?: string | null;
  assignedRoleNames: string[];
  status?: string | null;
  createdAt?: string | null; 
}

interface UsersReport {
  data: UserReportEntry[];
  totalUsers: number;
}


const ReportsPage: NextPage = () => {
  const { idToken, hasPrivilege, loading: authLoading } = useAuth();
  
  const [summaryStats, setSummaryStats] = useState<AdminSummaryStats | null>(null);
  const [volunteerActivityReport, setVolunteerActivityReport] = useState<VolunteerActivityReport | null>(null);
  const [eventPerformanceReport, setEventPerformanceReport] = useState<EventPerformanceReport | null>(null);
  const [donationInsightsReport, setDonationInsightsReport] = useState<DonationInsightsReport | null>(null);
  const [usersReport, setUsersReport] = useState<UsersReport | null>(null); 

  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
  const [loadingVolunteerActivity, setLoadingVolunteerActivity] = useState<boolean>(true);
  const [loadingEventPerformance, setLoadingEventPerformance] = useState<boolean>(true);
  const [loadingDonationInsights, setLoadingDonationInsights] = useState<boolean>(true);
  const [loadingUsersReport, setLoadingUsersReport] = useState<boolean>(true); 
  
  const [currentError, setCurrentError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  const canViewReports = hasPrivilege('admin', 'view_summary');

  useEffect(() => {
    setCurrentError(null);
    const allLoadersFalse = () => {
        setLoadingSummary(false);
        setLoadingVolunteerActivity(false);
        setLoadingEventPerformance(false);
        setLoadingDonationInsights(false);
        setLoadingUsersReport(false);
    };

    const allLoadersTrue = () => {
        setLoadingSummary(true);
        setLoadingVolunteerActivity(true);
        setLoadingEventPerformance(true);
        setLoadingDonationInsights(true);
        setLoadingUsersReport(true);
    };

    if (!idToken || !canViewReports) {
      if (!authLoading && !canViewReports) {
        setCurrentError("You do not have permission to view these reports.");
        allLoadersFalse();
      } else if (authLoading) {
        allLoadersTrue();
      }
      return;
    }

    const fetchApiData = async (endpoint: string, setter: Function, loaderSetter: Function, errorPrefix: string) => {
      loaderSetter(true);
      try {
        // Get session token from localStorage or fall back to idToken
        const authToken = localStorage.getItem('sessionToken') || idToken;
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        const response = await fetch(`${backendUrl}${endpoint}`, {
          headers,
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: response.statusText }));
          throw new Error(`${errorPrefix}: ${errorData.detail || `HTTP error ${response.status}`}`);
        }
        setter(await response.json());
      } catch (err: any) {
        console.error(`Failed to fetch ${errorPrefix}:`, err);
        setCurrentError(prev => prev ? `${prev}\n${err.message}` : err.message);
      } finally {
        loaderSetter(false);
      }
    };
    
    if (canViewReports) {
        fetchApiData("/api/reports/admin-summary", setSummaryStats, setLoadingSummary, "Summary");
        fetchApiData("/api/reports/volunteer-activity?period=all_time", setVolunteerActivityReport, setLoadingVolunteerActivity, "Volunteer Activity");
        fetchApiData("/api/reports/event-performance?date_range=all", setEventPerformanceReport, setLoadingEventPerformance, "Event Performance");
        fetchApiData("/api/reports/donation-insights?period=all_time", setDonationInsightsReport, setLoadingDonationInsights, "Donation Insights");
        fetchApiData("/api/reports/users-list", setUsersReport, setLoadingUsersReport, "Users List"); 
    } else if (!authLoading) {
        setCurrentError("You do not have permission to view these reports.");
        allLoadersFalse();
    }

  }, [idToken, backendUrl, canViewReports, authLoading]);

  const overallLoading = authLoading || loadingSummary || loadingVolunteerActivity || loadingEventPerformance || loadingDonationInsights || loadingUsersReport;

  if (overallLoading && !currentError && !(!canViewReports && !authLoading) ) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100 dark:bg-gray-800">
        <div className="text-center">
          <span className="material-icons text-indigo-600 dark:text-indigo-400 text-5xl animate-spin">sync</span>
          <p className="text-gray-700 dark:text-gray-300 mt-2">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (!authLoading && !canViewReports) {
     return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-yellow-100 dark:bg-yellow-700 dark:text-yellow-100 p-4 rounded-lg shadow-md mt-8">
          <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-50 mb-2">Access Denied</h3>
          <p className="text-yellow-700 dark:text-yellow-100 text-sm">
            You do not have the necessary permissions to view this page.
          </p>
        </div>
      </div>
    );
  }

  if (currentError) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg shadow-md mt-8">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">Error Loading Reports</h3>
          {currentError.split('\n').map((msg, idx) => (
            <p key={idx} className="text-red-700 dark:text-red-300 text-sm">{msg}</p>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <>
      <Head>
        <title>Reports Dashboard - Fiji</title>
      </Head>
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8"> 
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Reports Dashboard
        </h1>

        {/* Overall Summary Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
            Overall Summary
          </h2>
          {(loadingSummary || loadingDonationInsights) && !(summaryStats && donationInsightsReport) && <p className="text-gray-600 dark:text-gray-400">Loading summary...</p>}
          {(summaryStats || donationInsightsReport) && ( 
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {summaryStats && (
                <>
                  <div className="bg-white dark:bg-gray-900 shadow-lg rounded-xl p-6 flex items-center space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center">
                      <span className="material-icons text-2xl text-indigo-600 dark:text-indigo-300">group</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {summaryStats.totalUsers}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-900 shadow-lg rounded-xl p-6 flex items-center space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-800 flex items-center justify-center">
                      <span className="material-icons text-2xl text-teal-600 dark:text-teal-300">event_available</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Active Events</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {summaryStats.activeEvents}
                      </p>
                    </div>
                  </div>
                </>
              )}
              {donationInsightsReport && (
                <div className="bg-white dark:bg-gray-900 shadow-lg rounded-xl p-6 flex items-center space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center">
                    <span className="material-icons text-2xl text-green-600 dark:text-green-300">paid</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Monetary Donations</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${donationInsightsReport.totalMonetaryAmountOverall.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Users Report Section */}
        <section className="mb-12 p-6 bg-white dark:bg-gray-900 shadow-lg rounded-xl">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
            Users Overview
          </h2>
          <UsersReportSection 
            report={usersReport} 
            isLoading={loadingUsersReport}
          />
        </section>

        {/* Volunteer Activity Section */}
        <section className="mb-12 p-6 bg-white dark:bg-gray-900 shadow-lg rounded-xl">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
            Volunteer Activity
          </h2>
          <VolunteerActivitySection 
            report={volunteerActivityReport} 
            isLoading={loadingVolunteerActivity}
          />
        </section>

        {/* Event Performance Section */}
        <section className="mb-12 p-6 bg-white dark:bg-gray-900 shadow-lg rounded-xl">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
            Event Performance
          </h2>
          <EventPerformanceSection 
            report={eventPerformanceReport} 
            isLoading={loadingEventPerformance} 
          />
        </section>

        {/* Donation Insights Section */}
        <section className="p-6 bg-white dark:bg-gray-900 shadow-lg rounded-xl"> 
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
            Donation Insights
          </h2>
          <DonationInsightsSection 
            report={donationInsightsReport} 
            isLoading={loadingDonationInsights} 
          />
        </section>
      </main>
    </>
  );
};

export default ReportsPage;