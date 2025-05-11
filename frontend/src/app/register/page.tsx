```typescript
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth'; // getIdToken is no longer needed here
import { auth } from '@/lib/firebaseConfig';
import { fetchWithAuth } from '@/lib/apiClient'; // Import the new utility

// It's good practice to wrap useSearchParams in Suspense
function RegistrationFormComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invitationToken, setInvitationToken] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // NEXT_PUBLIC_BACKEND_URL will be used by fetchWithAuth
  const backendConfigured = !!process.env.NEXT_PUBLIC_BACKEND_URL;

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setInvitationToken(token);
    } else {
      setError('Invitation token is missing. Please use the link provided in your invitation.');
    }
    if (!backendConfigured) {
        setError(prevError => prevError ? `${prevError} Also, backend service URL is not configured.` : 'Backend service URL is not configured. Please contact support.');
    }
  }, [searchParams, router, backendConfigured]);

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!backendConfigured) {
      setError('Backend service URL is not configured. Please contact support.');
      return;
    }
    if (!invitationToken) {
      setError('Invitation token is missing or invalid.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!firstName || !lastName || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);

    try {
      // 1. Create user in Firebase Authentication
      // This also signs the user in, making auth.currentUser available for fetchWithAuth
      await createUserWithEmailAndPassword(auth, email, password);
      
      // 2. Call backend /register endpoint using fetchWithAuth
      // fetchWithAuth will handle getting the ID token and setting headers
      const response = await fetchWithAuth(`/register`, { // Relative path to backend endpoint
        method: 'POST',
        body: JSON.stringify({
          firstName,
          lastName,
          invitationToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Registration failed. Please try again.' }));
        // If Firebase user was created but backend registration failed, consider deleting the Firebase user
        // or providing guidance to the user. For now, just show error.
        // await auth.currentUser?.delete(); // Example: cleanup Firebase user
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      // Registration successful
      alert('Registration successful! Please login.'); // Replace with a better notification
      router.push('/login');

    } catch (err: any) {
      console.error("Registration Error:", err);
      // Handle Firebase specific errors
      if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already in use.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. It should be at least 6 characters long.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email format.');
      } 
      // Handle errors from fetchWithAuth or backend
      else if (err.message) {
         setError(err.message);
      }
      else {
        setError('Registration failed. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const initialError = (!invitationToken && "Invitation token is missing.") || (!backendConfigured && "Backend URL not configured.");

  if (initialError && error === null) { // If an initial error condition exists and no other error has been set yet
    setError(initialError);
  }
  
  if (!invitationToken || !backendConfigured) {
    // Display error if token is missing or backend is not configured
    // This check is simplified; the useEffect and error state handle detailed messages.
    return (
        

Registration Problem
{error || "Verifying setup..."}
                { (error && error.includes("token")) &&
                  Please use the link provided in your invitation.
                }
                 router.push('/login')} // Or a more appropriate page
                    className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    Go to Login
                


    );
  }


  return (
    


          Create Your Account
        



              First Name
            
 setFirstName(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          


              Last Name
            
 setLastName(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          


              Email Address
            
 setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          


              Password
            
 setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          


              Confirm Password
            
 setConfirmPassword(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          
          {error && (
            
              {error}
            
          )}
          
            {loading ? 'Registering...' : 'Register'}
          


          Already have an account?{' '}
          
            Login here
          



  );
}

// Wrap the component that uses useSearchParams with Suspense
export default function RegisterPage() {
  return (
    Loading...