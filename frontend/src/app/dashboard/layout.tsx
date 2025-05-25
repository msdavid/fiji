'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import DashboardNav from '@/components/dashboard/DashboardNav';
import TwoFactorVerification from '@/components/auth/TwoFactorVerification';
import { Toaster } from 'react-hot-toast'; 

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, error: authError, requires2FA, complete2FA, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If finished loading and there's no user, redirect to login.
    if (!loading && !user) {
      // Check if not already on login to prevent loops, though router.push should handle this.
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-gray-800 dark:text-gray-200">Loading dashboard...</div>
      </div>
    );
  }

  // If, after loading, there is still no user, return null.
  // The useEffect above is responsible for the navigation.
  // Returning null here prevents any rendering of the dashboard structure or children
  // while the redirect is in progress or if the user state is definitively null.
  if (!user) {
    return null; 
  }

  // If we have a user, but there's an authError from AuthContext.
  // These errors should be ones that don't automatically trigger a logout by AuthContext
  // (e.g., backend URL misconfiguration, or a failure during the signOut process itself).
  if (authError) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 dark:bg-red-900 p-4">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl text-center">
                <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Application Error</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                    {authError.message || "An unexpected application error occurred."}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    Try logging out and back in. If the issue persists, please contact support.
                </p>
                <button
                    onClick={() => {
                        // Attempt to use the logout function from context if available,
                        // otherwise, just navigate.
                        // This assumes 'logout' is part of useAuth() and handles redirect.
                        // For now, direct navigation is simpler if logout isn't easily callable here.
                        router.push('/login'); 
                    }}
                    className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md"
                >
                    Go to Login
                </button>
            </div>
        </div>
    );
  }

  // If 2FA is required, show the 2FA verification component
  if (requires2FA) {
    return (
      <TwoFactorVerification
        userEmail={user.email || ''}
        onVerificationSuccess={(deviceToken, expiresAt) => {
          complete2FA(deviceToken, expiresAt);
        }}
        onVerificationError={(error) => {
          console.error('2FA verification error:', error);
          // Could show a toast or error message here
        }}
        onCancel={async () => {
          await logout();
        }}
      />
    );
  }

  // If loading is false, user exists, and there's no critical authError, render the dashboard.
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800">
      <DashboardNav />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: { background: '#333', color: '#fff' },
          success: { style: { background: '#28a745' }, iconTheme: { primary: '#fff', secondary: '#28a745'} },
          error: { style: { background: '#dc3545' }, iconTheme: { primary: '#fff', secondary: '#dc3545'} },
        }}
      />
    </div>
  );
}