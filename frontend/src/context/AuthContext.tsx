'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User, getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig'; // Adjust path if your firebaseConfig is elsewhere

interface AuthContextType {
  user: User | null;
  idToken: string | null;
  loading: boolean;
  error: Error | null;
}

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setLoading(true);
        setError(null);
        if (currentUser) {
          setUser(currentUser);
          try {
            const token = await getIdToken(currentUser);
            setIdToken(token);
          } catch (tokenError: any) {
            console.error("Error getting ID token:", tokenError);
            setError(tokenError);
            // Potentially sign out user if token cannot be retrieved
            // await auth.signOut(); 
            // setUser(null);
            // setIdToken(null);
          }
        } else {
          setUser(null);
          setIdToken(null);
        }
        setLoading(false);
      },
      (authError) => {
        console.error("Auth state change error:", authError);
        setError(authError);
        setUser(null);
        setIdToken(null);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  return (
    
      {children}
    
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};