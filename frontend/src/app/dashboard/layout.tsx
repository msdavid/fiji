'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import DashboardNav from '@/components/dashboard/DashboardNav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, error: authError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
        <div>Loading dashboard...</div>
      </div>
    );
  }

  if (authError) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 dark:bg-red-900 p-4">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl text-center">
                <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Authentication Error</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                    {authError.message || "An unexpected authentication error occurred."}
                </p>
                <button
                    onClick={() => router.push('/login')}
                    className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md"
                >
                    Go to Login
                </button>
            </div>
        </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
        <div>Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800">
      <DashboardNav />
      <main>
        {children}
      </main>
    </div>
  );
}