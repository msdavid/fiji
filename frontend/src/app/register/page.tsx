'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth'; // Will be removed if backend handles Firebase Auth creation
import { auth } from '@/lib/firebaseConfig'; // Will be removed if backend handles Firebase Auth creation
import { apiClient } from '@/lib/apiClient'; 
import Link from 'next/link';

interface TokenValidationResponse {
  isValid: boolean; // Matches backend InvitationValidateResponse
  message: string;  // Matches backend InvitationValidateResponse
  email?: string;
  assignedRoleIds?: string[]; 
}

// Payload for the new registration endpoint
interface RegistrationPayload {
    email: string;
    password?: string; // Password will be sent to backend
    firstName: string;
    lastName: string;
    invitationToken: string; // Send the token for backend re-validation and processing
    // assignedRoleIds are known by backend via token, no need to resend from client usually
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
  const [preassignedRoleIds, setPreassignedRoleIds] = useState<string[] | undefined>(undefined);
  
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
      if (tokenStatus !== 'not_found') { 
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
        const response = await apiClient.get<TokenValidationResponse>(`/invitations/validate?token=${initialToken}`);
        
        if (response.data.isValid) {
          setTokenStatus('valid');
          if (response.data.email) {
            setEmail(response.data.email); 
          }
          if (response.data.assignedRoleIds) {
            setPreassignedRoleIds(response.data.assignedRoleIds);
          }
          setTokenValidationMessage(response.data.message || 'Token is valid. Please complete your registration.');
        } else {
          setTokenStatus('invalid');
          setTokenValidationMessage(response.data.message || 'This invitation token is not valid or has expired.');
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
      // The backend /auth/register-with-invitation will handle:
      // 1. Re-validating the token.
      // 2. Creating the user in Firebase Auth.
      // 3. Creating the user profile in Firestore (with preassignedRoleIds from token).
      // 4. Updating the invitation status.
      // It should return user info or a success message.
      // For simplicity, let's assume it returns some user data or just success.
      await apiClient.post(`/auth/register-with-invitation`, registrationPayload);

      setSuccessMessage('Registration successful! You can now log in.');
      // Clear form or redirect
      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.detail) {
         setError(`Registration failed: ${err.response.data.detail}`);
      } else if (err.message) {
         setError(`Registration failed: ${err.message}`);
      } else {
        setError('Registration failed. An unexpected error occurred.');
      }
      console.error("Registration submission error:", err);
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
              {tokenValidationMessage} {/* Shows "Token is valid..." message */}
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
              <input id="email" name="email" type="email" autoComplete="email" required value={email} readOnly  // Email is pre-filled and read-only
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
              <button type="submit" disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Registering...' : 'Complete Registration'}
              </button>
            </div>
          </form>
        )}
        {tokenStatus !== 'loading' && tokenStatus !== 'valid' && ( // Show login link if token is invalid/not_found and not loading
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