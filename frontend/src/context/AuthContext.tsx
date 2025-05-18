'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, signOut } from 'firebase/auth'; // Import signOut
import { auth } from '@/lib/firebaseConfig'; 
import { useRouter } from 'next/navigation'; // Import useRouter

interface UserProfileFromBackend { 
  id: string; 
  email: string | null;
  firstName?: string;
  lastName?: string;
  assignedRoleIds: string[]; 
  assignedRoleNames?: string[]; 
  status?: string; 
  phone?: string;
  emergencyContactDetails?: string;
  skills?: string[]; 
  qualifications?: string[]; 
  preferences?: string;
  profilePictureUrl?: string | null;
  privileges: Record<string, string[]>; 
  isSysadmin: boolean;
}

interface AuthContextType {
  user: User | null; 
  idToken: string | null; 
  userProfile: UserProfileFromBackend | null; 
  loading: boolean;
  error: Error | null;
  hasPrivilege: (resource: string, action: string) => boolean;
  logout: () => Promise<void>; // Add logout function to context type
}

const defaultAuthContextValue: AuthContextType = {
  user: null,
  idToken: null,
  userProfile: null,
  loading: true,
  error: null,
  hasPrivilege: () => false, 
  logout: async () => {}, // Default empty logout function
};

const AuthContext = createContext<AuthContextType>(defaultAuthContextValue);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileFromBackend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter(); // Initialize router

  const performLogout = useCallback(async (shouldRedirect: boolean = true) => {
    try {
      await signOut(auth);
      // State updates (user, idToken, userProfile to null) will be handled by onIdTokenChanged
    } catch (e) {
      console.error("Error signing out: ", e);
      setError(e instanceof Error ? e : new Error('Failed to sign out'));
    } finally {
      // Explicitly clear state here as well, as onIdTokenChanged might not fire immediately
      // or if there's an issue with the listener.
      setUser(null);
      setIdToken(null);
      setUserProfile(null);
      setLoading(false); // Ensure loading is false after logout attempt
      if (shouldRedirect) {
        router.push('/login');
      }
    }
  }, [router]);

  useEffect(() => {
    const unsubscribe = auth.onIdTokenChanged(
      async (currentUser) => {
        setLoading(true);
        setError(null); 

        if (currentUser) {
          setUser(currentUser);
          try {
            const token = await currentUser.getIdToken();
            setIdToken(token);

            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
            if (!backendUrl) {
              const msg = "Backend URL (NEXT_PUBLIC_BACKEND_URL) is not configured.";
              console.error(msg);
              setError(new Error(msg));
              // No user profile, but user might still be "authenticated" with Firebase.
              // Consider if logout is appropriate here or just an error state.
              // For now, we let them stay "logged in" with Firebase but without a profile.
              setUserProfile(null); 
              setLoading(false);
              return; 
            }

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
                
                // If token is invalid/expired (401), logout and redirect
                if (response.status === 401) {
                  console.warn("Unauthorized (401) fetching user profile. Logging out.");
                  await performLogout(); 
                  // performLogout will set loading to false and redirect
                  return; 
                }
                throw new Error(`Failed to fetch user profile. ${errorDetails}`);
              }
              
              const profileData = await response.json();
              setUserProfile(profileData as UserProfileFromBackend);
            } catch (profileError: any) {
              console.error("Error fetching user profile:", profileError.message);
              setError(new Error(`Profile fetch error: ${profileError.message}`));
              setUserProfile(null); 
              // If profile fetch fails for reasons other than 401, user might still be auth'd with Firebase.
              // Decide if this warrants a full logout. For now, keeping Firebase session.
            }
          } catch (tokenError: any) {
            console.error("Error getting ID token:", tokenError.message);
            setError(tokenError);
            // This error means Firebase itself had an issue with the token (e.g., user deleted, disabled mid-session)
            // This is a critical auth issue, so logout.
            await performLogout();
            return;
          }
        } else { // No currentUser
          setUser(null);
          setIdToken(null);
          setUserProfile(null);
          // Only redirect if not already on login/register page to avoid redirect loops
          // This part is tricky because onIdTokenChanged fires on initial load (currentUser is null)
          // and also on explicit logout.
          // The performLogout function handles redirection, so this might be redundant if logout is always explicit.
          // However, if Firebase session expires "naturally" and currentUser becomes null, this redirect is needed.
          if (router && typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
             router.push('/login');
          }
        }
        setLoading(false);
      },
      async (authError) => { // Error callback for onIdTokenChanged
        console.error("Auth ID token listener error:", authError.message);
        setError(authError);
        // This indicates a fundamental issue with Firebase auth state. Logout.
        await performLogout();
      }
    );

    return () => unsubscribe();
  }, [performLogout, router]); // Added performLogout and router to dependency array

  const hasPrivilege = useCallback((resource: string, action: string): boolean => {
    if (loading || !userProfile) { 
      return false; 
    }
    if (userProfile.isSysadmin) {
      return true;
    }
    const resourcePrivileges = userProfile.privileges?.[resource];
    if (resourcePrivileges && Array.isArray(resourcePrivileges) && resourcePrivileges.includes(action)) {
      return true;
    }
    return false;
  }, [userProfile, loading]); 

  return (
    <AuthContext.Provider value={{ user, idToken, userProfile, loading, error, hasPrivilege, logout: performLogout }}>
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