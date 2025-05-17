'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
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
  hasPrivilege: (resource: string, action: string) => boolean; // Added hasPrivilege
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

  const hasPrivilege = useCallback((resource: string, action: string): boolean => {
    if (loading || !userProfile) {
      // console.log("hasPrivilege: Loading or no userProfile, returning false.");
      return false; 
    }
    
    // Sysadmin override: if user has 'sysadmin' role ID, grant all permissions
    if (userProfile.assignedRoleIds && userProfile.assignedRoleIds.includes('sysadmin')) {
      // console.log(`hasPrivilege: User is sysadmin. Granting ${action} on ${resource}.`);
      return true;
    }
    
    // TODO: Implement more granular privilege checking for non-sysadmin users.
    // This would typically involve:
    // 1. Fetching the detailed privileges for all of the user's assignedRoleIds from the backend.
    //    This could be a map like: { "donations": ["list", "create"], "events": ["view"] }
    // 2. Storing this privilege map in the userProfile or a separate state.
    // 3. Checking against this map here:
    //    const resourcePrivileges = userProfile.privileges?.[resource];
    //    if (resourcePrivileges && resourcePrivileges.includes(action)) {
    //      return true;
    //    }

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
  if (context === undefined) { // Standard check for context usage outside provider
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};