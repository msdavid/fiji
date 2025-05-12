'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { fetchWithAuth, apiClient } from '@/lib/apiClient'; // Assuming apiClient can make unauthenticated GET requests
import Link from 'next/link';

// Define a type for the token validation response from the backend
interface TokenValidationResponse {
  valid: boolean;
  reason?: string;
  email?: string;
}

function RegistrationFormComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [initialToken, setInitialToken] = useState<string | null>(null);
  const [invitationTokenForForm, setInvitationTokenForForm] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); // For form submission
  
  const [tokenStatus, setTokenStatus] = useState<'loading' | 'valid' | 'invalid' | 'not_found'>('loading');
  const [tokenValidationMessage, setTokenValidationMessage] = useState<string | null>('Validating invitation token...');

  const backendConfigured = !!process.env.NEXT_PUBLIC_BACKEND_URL;

  // Effect 1: Get token from URL
  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setInitialToken(tokenFromUrl);
    } else {
      setTokenStatus('not_found');
      setTokenValidationMessage('Invalid or missing registration token. Please use the link provided in your invitation.');
      setError(null); // Clear other errors
    }
  }, [searchParams]);

  // Effect 2: Validate token with backend once initialToken is set
  useEffect(() => {
    if (!initialToken) {
      if (tokenStatus !== 'not_found') { // Only set loading if not already in 'not_found' state
        setTokenStatus('loading');
        setTokenValidationMessage('Validating invitation token...');
      }
      return;
    }

    if (!backendConfigured) {
      setTokenStatus('invalid');
      setTokenValidationMessage('Critical setup error: Backend service URL is not configured. Please contact support.');
      setError(null);
      return;
    }
    
    setTokenStatus('loading');
    setTokenValidationMessage('Validating invitation token...');
    setError(null);

    const validateToken = async () => {
      try {
        // apiClient should be an instance of axios or a fetch wrapper configured for base URL
        // Ensure apiClient can make unauthenticated requests or use a direct fetch
        const response = await apiClient.get<TokenValidationResponse>(`/invitations/validate?token=${initialToken}`);
        
        if (response.data.valid) {
          setTokenStatus('valid');
          setInvitationTokenForForm(initialToken); // Token is valid, set it for form submission
          if (response.data.email) {
            setEmail(response.data.email); // Pre-fill email if backend provides it
          }
          setTokenValidationMessage(null); // Clear validation message
        } else {
          setTokenStatus('invalid');
          setTokenValidationMessage(response.data.reason || 'This invitation token is not valid.');
        }
      } catch (err: any) {
        setTokenStatus('invalid');
        if (err.response && err.response.data && err.response.data.detail) {
          setTokenValidationMessage(`Error validating token: ${err.response.data.detail}`);
        } else {
          setTokenValidationMessage('Error validating token. Please try again or contact support.');
        }
        console.error("Token validation error:", err);
      }
    };

    validateToken();
  }, [initialToken, backendConfigured]);


  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null); 
    setSuccessMessage(null);

    if (!invitationTokenForForm) { // Should be set if tokenStatus is 'valid'
      setError('Critical error: Invitation token is not available for submission. Please refresh.');
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
      const response = await fetchWithAuth(`/users/register`, {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          lastName,
          invitationToken: invitationTokenForForm,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Registration failed. Please try again.' }));
        if (auth.currentUser) {
            try { await auth.currentUser.delete(); } catch (deleteError) { /* ignore */ }
        }
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      setSuccessMessage('Registration successful! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 2000);

    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Registration failed: This email address is already in use by Firebase Authentication.');
      } else if (err.code === 'auth/weak-password') {
        setError('Registration failed: Password is too weak (min. 6 characters).');
      } else if (err.code === 'auth/invalid-email') {
        setError('Registration failed: Invalid email format for Firebase Authentication.');
      } else if (err.message) {
         setError(`Registration failed: ${err.message}`);
      } else {
        setError('Registration failed. An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Determine if the main form should be rendered or if a message/error should be shown
  const showForm = tokenStatus === 'valid' && backendConfigured;
  const showValidationMessage = tokenStatus === 'loading' || tokenStatus === 'invalid' || tokenStatus === 'not_found' || !backendConfigured;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Create Your Account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {showValidationMessage && (
          <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
            <p className={tokenStatus === 'invalid' || tokenStatus === 'not_found' ? "text-red-500 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}>
              {tokenValidationMessage}
            </p>
            {(tokenStatus === 'invalid' || tokenStatus === 'not_found') && (
                 <button
                 onClick={() => router.push('/login')} // Or to a support page
                 className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
               >
                 Go to Login
               </button>
            )}
          </div>
        )}

        {showForm && (
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
              <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} readOnly={tokenStatus === 'valid' && !!email} // Make email read-only if pre-filled
                className={`appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm ${tokenStatus === 'valid' && !!email ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`} placeholder="Email address" />
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

            {error && (
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
        {showForm && (
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
    // Suspense is good for route-level code splitting, but for this page, 
    // the main component handles its own loading states.
    // Consider if Suspense is strictly needed here or if a simple loading div is enough.
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading registration page...</div>}>
      <RegistrationFormComponent />
    </Suspense>
  );
}