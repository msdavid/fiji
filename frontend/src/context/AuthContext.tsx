'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User, getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';

interface AuthContextType {
  user: User | null;
  idToken: string | null;
  loading: boolean;
  error: Error | null;
}

// Provide a default value that matches the AuthContextType structure
const defaultAuthContextValue: AuthContextType = {
  user: null,
  idToken: null,
  loading: true, // Start in loading state
  error: null,
};

const AuthContext = createContext<AuthContextType>(defaultAuthContextValue);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setLoading(true); // Set loading true at the start of handling new auth state
        setError(null); // Clear previous errors
        if (currentUser) {
          setUser(currentUser);
          try {
            const token = await getIdToken(currentUser);
            setIdToken(token);
          } catch (tokenError: any) {
            console.error("Error getting ID token:", tokenError);
            setError(tokenError);
            // Optional: Sign out user if token cannot be retrieved, to ensure consistent state
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
      (authError) => { // This is the error observer for onAuthStateChanged itself
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
    <AuthContext.Provider value={{ user, idToken, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  // No longer need to check for undefined if a default value is always provided.
  // However, throwing an error if used outside AuthProvider is still good practice,
  // but the default value means context will never be undefined.
  // This check might become redundant or need adjustment based on how you want to handle it.
  // For now, let's assume if context === defaultAuthContextValue and not loading, it might mean it's used outside.
  // But typically, the hook is expected to be used within a provider that sets its own state.
  if (context === defaultAuthContextValue && context.loading === true && context.user === null) {
      // This condition is a bit weak to detect if outside provider,
      // as initial state inside provider can also be this.
      // The standard check `if (context === undefined)` was for when `undefined` was possible.
      // With a default object, `context` is never undefined.
      // A more robust check might involve a specific flag set by the provider.
      // For simplicity, we'll rely on developers to use it correctly.
  }
  return context;
};