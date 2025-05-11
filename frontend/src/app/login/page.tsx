'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig'; // Assuming firebaseConfig.ts is in src/lib

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError('Please enter both email and password.');
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // On successful login, Firebase automatically handles session persistence.
      // You might want to store the ID token or user info in a global state/context later.
      router.push('/dashboard'); // Redirect to dashboard
    } catch (err: any) {
      console.error("Firebase Authentication Error:", err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email format.');
      } else {
        setError('Login failed. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    


          Login
        



              Email Address
            
 setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="you@example.com"
            />
          


              Password
            
 setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="••••••••"
            />
          
          {error && (
            
              {error}
            
          )}
          
            {loading ? 'Logging in...' : 'Login'}
          

        {/* Optional: Link to registration page */}
        {/* 
          Don't have an account?{' '}
          
            Register here
          
 */}
      

  );
}