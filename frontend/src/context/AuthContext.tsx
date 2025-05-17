'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User } from 'firebase/auth'; // Updated import
import { auth } from '@/lib/firebaseConfig'; // Firebase auth instance

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
  profilePictureUrl?: string | null;
  // Consider adding a 'privileges' map here if you want full RBAC on frontend
  // For example: privileges?: Record<string, string[]>; 
}

interface AuthContextType {
  user: User | null; 
  idToken: string | null; 
  userProfile: UserProfile | null; 
  loading: boolean;
  error: Error | null;
  hasPrivilege: (resource: string, action: string) => boolean;
}

// Provide a default no-op hasPrivilege for the default context value
const defaultAuthContextValue: AuthContextType = {
  user: null,
  idToken: null,
  userProfile: null,
  loading: true,
  error: null,
  hasPrivilege: () => false, 
};

const AuthContext = createContext<AuthContextType>(defaultAuthContextValue);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Use onIdTokenChanged to listen for auth state changes and token refreshes
    const unsubscribe = auth.onIdTokenChanged(
      async (currentUser) => {
        setLoading(true);
        setError(null); // Clear previous errors at the start of handling a new auth state or token

        if (currentUser) {
          setUser(currentUser);
          try {
            const token = await currentUser.getIdToken(); // Gets current or refreshed token
            setIdToken(token);

            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
            if (!backendUrl) {
              const msg = "Backend URL (NEXT_PUBLIC_BACKEND_URL) is not configured. Cannot fetch user profile.";
              console.error(msg);
              setError(new Error(msg));
              setUserProfile(null); // Ensure profile is cleared
              setLoading(false);
              return; // Exit early
            }

            // Fetch user profile with the (potentially new) token
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
                  errorDetails += `: ${response.statusText}`; // Fallback if errorData parsing fails
                }
                throw new Error(`Failed to fetch user profile. ${errorDetails}`);
              }
              
              const profileData = await response.json();
              setUserProfile(profileData as UserProfile);
            } catch (profileError: any) {
              console.error("Error fetching user profile:", profileError.message);
              setError(new Error(`Profile fetch error: ${profileError.message}`));
              setUserProfile(null); // Clear profile on fetch error
            }
          } catch (tokenError: any) {
            console.error("Error getting ID token:", tokenError.message);
            setError(tokenError);
            setIdToken(null); // Clear token if retrieval fails
            setUserProfile(null); // Clear profile as well
          }
        } else {
          // User is signed out
          setUser(null);
          setIdToken(null);
          setUserProfile(null);
        }
        setLoading(false);
      },
      (authError) => { // Error observer for onIdTokenChanged itself
        console.error("Auth ID token listener error:", authError.message);
        setError(authError);
        setUser(null);
        setIdToken(null);
        setUserProfile(null);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Empty dependency array ensures this effect runs only once on mount

  const hasPrivilege = useCallback((resource: string, action: string): boolean => {
    if (loading || !userProfile) {
      return false; 
    }
    
    if (userProfile.assignedRoleIds && userProfile.assignedRoleIds.includes('sysadmin')) {
      return true;
    }
    
    // TODO: Implement more granular privilege checking for non-sysadmin users.
    console.warn(`hasPrivilege: Basic implementation. User is not sysadmin. Denying '${action}' on '${resource}'. Full RBAC check for non-sysadmins needs to be implemented by fetching role privileges for roles: ${userProfile.assignedRoleIds.join(', ')}.`);
    return false;
  }, [userProfile, loading]);

  return (
    <AuthContext.Provider value={{ user, idToken, userProfile, loading, error, hasPrivilege }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};