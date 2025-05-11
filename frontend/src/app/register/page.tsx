'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { fetchWithAuth } from '@/lib/apiClient';
import Link from 'next/link'; // Added Link import

function RegistrationFormComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invitationToken, setInvitationToken] = useState<string | null>(null); // Typed state

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null); // Typed state
  const [successMessage, setSuccessMessage] = useState<string | null>(null); // Typed state
  const [loading, setLoading] = useState(false);

  const backendConfigured = !!process.env.NEXT_PUBLIC_BACKEND_URL;

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setInvitationToken(token);
    } else {
      setError('Invalid or missing registration token. Please use the link provided in your invitation.');
    }
    if (!backendConfigured) {
        setError(prevError => prevError ? `${prevError} Also, backend service URL is not configured.` : 'Backend service URL is not configured. Please contact support.');
    }
  }, [searchParams, backendConfigured]);

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!backendConfigured) {
      setError('Critical setup error: Backend service URL is not configured. Please contact support.');
      return;
    }
    if (!invitationToken) {
      setError('Critical setup error: Invitation token is missing or invalid.');
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
      await createUserWithEmailAndPassword(auth, email, password);

      const response = await fetchWithAuth(`/register`, { // Ensure this path is correct, e.g., /api/register
        method: 'POST',
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          token: invitationToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Registration failed. Please try again.' }));
        if (auth.currentUser) {
            try {
                await auth.currentUser.delete();
            } catch (deleteError) {
                console.error("Failed to delete Firebase user after backend error:", deleteError);
            }
        }
        throw new Error(errorData.error || errorData.detail || `Server error: ${response.status}`);
      }

      setSuccessMessage('Registration successful! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 2000);

    } catch (err: any) {
      console.error("Registration Error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Registration failed: This email address is already in use.');
      } else if (err.code === 'auth/weak-password') {
        setError('Registration failed: Password is too weak. It should be at least 6 characters long.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Registration failed: Invalid email format.');
      } else if (err.message && err.message.includes('Failed to get ID token')) {
        setError('Registration failed: Could not obtain authentication token.');
      }
      else if (err.message) {
         setError(`Registration failed: ${err.message}`);
      }
      else {
        setError('Registration failed. An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const formDisabled = !invitationToken || !backendConfigured;

  // This useEffect might be better for setting initial error based on formDisabled
  useEffect(() => {
    if (formDisabled && !error) { // Only set if no other error (like token missing) is already set
        if (!invitationToken && backendConfigured) { // Token is the primary issue if backend is fine
            setError('Invalid or missing registration token. Please use the link provided in your invitation.');
        } else if (!backendConfigured) { // Backend config is an issue regardless of token
            setError('Backend service URL is not configured. Please contact support.');
        }
    }
  }, [invitationToken, backendConfigured, formDisabled, error]);


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Create Your Account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {formDisabled && error && (
          <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
            <p className="text-red-500 dark:text-red-400">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Go to Login
            </button>
          </div>
        )}

        {!formDisabled && (
          <form className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 space-y-6" onSubmit={handleRegister}>
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
              <input id="firstName" name="firstName" type="text" autoComplete="given-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="First Name" />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
              <input id="lastName" name="lastName" type="text" autoComplete="family-name" required value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Last Name" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
              <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Email address" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <input id="password" name="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Password (min. 6 characters)" />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Confirm Password" />
            </div>

            {error && ( // Only show general form error if not in disabled state (which has its own error display)
              <div className="text-red-500 dark:text-red-400 text-sm text-center p-2 bg-red-50 dark:bg-red-900 rounded-md">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="text-green-500 dark:text-green-400 text-sm text-center p-2 bg-green-50 dark:bg-green-900 rounded-md">
                {successMessage}
              </div>
            )}

            <div>
              <button type="submit" disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Registering...' : 'Register'}
              </button>
            </div>
          </form>
        )}
        {!formDisabled && (
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
              Login here
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Loading registration form...</div>}>
      <RegistrationFormComponent />
    </Suspense>
  );
}