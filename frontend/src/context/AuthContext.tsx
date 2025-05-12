'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User, getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';

// Define the structure of the user profile fetched from your backend
interface UserProfile {
  uid: string;
  email: string | null;
  firstName?: string;
  lastName?: string;
  assignedRoleIds: string[]; 
  status?: string; 
  phoneNumber?: string;
  skills?: string;
  qualifications?: string;
  preferences?: string;
}

interface AuthContextType {
  user: User | null; 
  idToken: string | null; 
  userProfile: UserProfile | null; 
  loading: boolean;
  error: Error | null;
}

const defaultAuthContextValue: AuthContextType = {
  user: null,
  idToken: null,
  userProfile: null,
  loading: true,
  error: null,
};

const AuthContext = createContext<AuthContextType>(defaultAuthContextValue);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setLoading(true);
        setError(null);
        setUser(null); 
        setIdToken(null); 
        setUserProfile(null); 

        if (currentUser) {
          setUser(currentUser); 
          try {
            const token = await getIdToken(currentUser);
            setIdToken(token); 

            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

            if (backendUrl && token) {
              try {
                const response = await fetch(`${backendUrl}/users/me`, {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                });

                if (!response.ok) {
                  let errorDetails = `HTTP error ${response.status}`;
                  try {
                    const errorData = await response.json();
                    errorDetails += `: ${errorData.detail || errorData.message || response.statusText}`;
                  } catch (e) {
                    // If parsing errorData fails, use the original statusText
                    errorDetails += `: ${response.statusText}`;
                  }
                  throw new Error(`Failed to fetch user profile. ${errorDetails}`);
                }
                
                const profileData = await response.json(); 
                setUserProfile(profileData as UserProfile);

              } catch (profileError: any) {
                console.error("Error fetching user profile:", profileError.message);
                setError(prevError => prevError ? new Error(`${prevError.message}; Profile fetch error: ${profileError.message}`) : new Error(`Profile fetch error: ${profileError.message}`));
              }
            } else if (!backendUrl) {
              const msg = "Backend URL (NEXT_PUBLIC_BACKEND_URL) is not configured. Cannot fetch user profile.";
              console.error(msg);
              setError(prevError => prevError ? new Error(`${prevError.message}; ${msg}`) : new Error(msg));
            } else if (!token) {
                const msg = "ID Token is null. Cannot fetch user profile.";
                console.error(msg);
                setError(prevError => prevError ? new Error(`${prevError.message}; ${msg}`) : new Error(msg));
            }
          } catch (tokenError: any) {
            console.error("Error getting ID token:", tokenError.message);
            setError(tokenError);
          }
        }
        
        setLoading(false);
      },
      (authError) => { 
        console.error("Auth state change error observer:", authError.message);
        setError(authError);
        setUser(null);
        setIdToken(null);
        setUserProfile(null);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, idToken, userProfile, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  // The check for context === defaultAuthContextValue is a heuristic and might not be perfectly reliable
  // for detecting if used outside a provider, especially if initial state matches default.
  // Standard practice is `if (context === undefined)` when no default value is provided to createContext.
  // For now, we rely on correct usage.
  return context;
};