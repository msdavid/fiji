'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { useAuth } from '@/context/AuthContext'; // Import useAuth

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, error: authError } = useAuth(); // Use the AuthContext

  useEffect(() => {
    if (!loading && !user) {
      // If not loading and no user, redirect to login
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // AuthProvider will detect the state change and update the context.
      // The useEffect above will then trigger redirection.
      // Optionally, can still push to /login immediately for faster UI feedback.
      router.push('/login');
    } catch (error) {
      console.error('Logout Error:', error);
      // Handle logout error (e.g., display a message to the user)
    }
  };

  if (loading) {
    return (
      
Loading dashboard...

    );
  }

  if (authError) {
    // Handle critical auth errors from context, e.g., token refresh failure
    return (
        

Authentication Error
{authError.message || "An unexpected authentication error occurred."}
 router.push('/login')}
                    className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md"
                >
                    Go to Login
                


    );
  }

  if (!user) {
    // This state should ideally be brief as useEffect handles redirection.
    // It acts as a fallback or if redirection is in progress.
    return (
      
Redirecting to login...

    );
  }

  // User is authenticated and data is available
  return (
    





                Fiji Platform
              



                {user.email}
              

                Logout
              









                Welcome to your Dashboard, {user.displayName || user.email}!
              

                This is a placeholder for your dashboard content. More features will be added soon.
              
              {/* Dashboard content will go here */}
            




  );
}