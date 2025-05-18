'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import apiClient, { ApiResponse } from '@/lib/apiClient'; // Import ApiResponse
import Link from 'next/link';

interface TokenValidationResponse {
  isValid: boolean; 
  message: string;  
  email?: string;
  assignedRoleIds?: string[]; 
}

interface RegistrationPayload {
    email: string;
    password?: string; 
    firstName: string;
    lastName: string;
    invitationToken: string; 
}


function RegistrationFormComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [initialToken, setInitialToken] = useState<string | null>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); 
  
  const [tokenStatus, setTokenStatus] = useState<'loading' | 'valid' | 'invalid' | 'not_found'>('loading');
  const [tokenValidationMessage, setTokenValidationMessage] = useState<string | null>('Validating invitation token...');

  const backendConfigured = !!process.env.NEXT_PUBLIC_BACKEND_URL;

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setInitialToken(tokenFromUrl);
    } else {
      setTokenStatus('not_found');
      setTokenValidationMessage('Invalid or missing registration token. Please use the link provided in your invitation.');
      setError(null); 
    }
  }, [searchParams]);

  useEffect(() => {
    if (!initialToken) {
      if (tokenStatus !== 'not_found' && !searchParams.get('token')) { 
        setTokenStatus('not_found');
        setTokenValidationMessage('Invalid or missing registration token.');
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
        const result: ApiResponse<TokenValidationResponse> = await apiClient<TokenValidationResponse>({
          path: `/invitations/validate?token=${initialToken}`,
          method: 'GET',
        });

        if (result.ok && result.data && result.data.isValid) {
          setTokenStatus('valid');
          setEmail(result.data.email || ''); 
          setTokenValidationMessage(result.data.message || 'Token is valid. Please complete your registration.');
        } else {
          setTokenStatus('invalid');
          let message = 'This invitation token is not valid or has expired.';
          if (result.data && result.data.message && !result.data.isValid) {
            message = result.data.message;
          } else if (result.error && result.error.message) {
            message = result.error.message;
          }
          setTokenValidationMessage(message);
          if (result.error) console.error("Token validation API client error details:", result.error);
        }
      } catch (unexpectedError: any) {
        setTokenStatus('invalid');
        setTokenValidationMessage('An unexpected error occurred during token validation. Please contact support.');
        console.error("Unexpected error in validateToken:", unexpectedError);
      }
    };

    validateToken();
  }, [initialToken, backendConfigured, searchParams]);


  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null); 
    setSuccessMessage(null);

    if (tokenStatus !== 'valid' || !initialToken) {
      setError('The invitation token is not valid. Cannot proceed with registration.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!firstName || !lastName || !email || !password) {
      setError('Please fill in all required fields: First Name, Last Name, Email, and Password.');
      return;
    }
    if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
    }

    setLoading(true);

    const registrationPayload: RegistrationPayload = {
        email,
        password,
        firstName,
        lastName,
        invitationToken: initialToken,
    };

    try {
      const result: ApiResponse<any> = await apiClient({
        path: `/auth/register-with-invitation`, 
        method: 'POST',
        data: registrationPayload 
      });

      if (result.ok) {
        setSuccessMessage('Registration successful! You can now log in.');
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        const uiErrorMessage = result.error?.message || 'Registration failed. An unexpected error occurred.';
        setError(`Registration failed: ${uiErrorMessage}`);
        
        console.error("--- Registration Submission Error Details ---");
        if (result.error) {
            console.error("Full result.error object:", result.error);
            console.error("result.error.message:", result.error.message);
            console.error("result.error.status:", result.error.status);
            console.error("result.error.details (stringified):", JSON.stringify(result.error.details, null, 2));
        } else {
            console.error("result.error was null or undefined. Full result object:", result);
        }
        console.error("--- End of Registration Submission Error Details ---");
      }
    } catch (unexpectedError: any) { 
      setError('Registration failed. An unexpected critical error occurred.');
      console.error("Critical registration submission error (exception caught):", unexpectedError);
    } finally {
      setLoading(false);
    }
  };
  
  const showForm = tokenStatus === 'valid' && backendConfigured;
  const showValidationMessageContainer = tokenStatus === 'loading' || tokenStatus === 'invalid' || tokenStatus === 'not_found' || !backendConfigured;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Complete Your Registration
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {showValidationMessageContainer && (
          <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
            <p className={`text-lg mb-4 ${tokenStatus === 'invalid' || tokenStatus === 'not_found' ? "text-red-500 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}`}>
              {tokenStatus === 'loading' && <span className="material-icons animate-spin mr-2">sync</span>}
              {tokenValidationMessage}
            </p>
            {(tokenStatus === 'invalid' || tokenStatus === 'not_found') && (
                 <button
                 onClick={() => router.push('/login')} 
                 className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
               >
                 Go to Login
               </button>
            )}
          </div>
        )}

        {showForm && (
          <form className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 space-y-6" onSubmit={handleRegister}>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {tokenStatus === 'valid' && tokenValidationMessage ? tokenValidationMessage : 'Please complete the form below.'}
            </p>
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">First Name <span className="text-red-500">*</span></label>
              <input id="firstName" name="firstName" type="text" autoComplete="given-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="First Name" />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name <span className="text-red-500">*</span></label>
              <input id="lastName" name="lastName" type="text" autoComplete="family-name" required value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Last Name" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
              <input id="email" name="email" type="email" autoComplete="email" required value={email} readOnly  
                className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700/50 cursor-not-allowed focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Email address" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password <span className="text-red-500">*</span></label>
              <input id="password" name="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Password (min. 6 characters)" />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password <span className="text-red-500">*</span></label>
              <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Confirm Password" />
            </div>

            {error && (
              <div className="text-red-500 dark:text-red-400 text-sm text-center p-2 bg-red-50 dark:bg-red-900/30 rounded-md">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="text-green-600 dark:text-green-400 text-sm text-center p-2 bg-green-50 dark:bg-green-900/30 rounded-md">
                {successMessage}
              </div>
            )}

            <div>
              <button type="submit" disabled={loading || !!successMessage}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Registering...' : (successMessage ? 'Redirecting...' : 'Complete Registration')}
              </button>
            </div>
          </form>
        )}
        {tokenStatus !== 'loading' && tokenStatus !== 'valid' && ( 
          <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
            Or{' '}
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
              login to your existing account
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span className="material-icons text-4xl text-indigo-500 animate-spin">sync</span><p className="ml-2">Loading registration...</p></div>}>
      <RegistrationFormComponent />
    </Suspense>
  );
}