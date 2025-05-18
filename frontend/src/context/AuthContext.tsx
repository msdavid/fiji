'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User } from 'firebase/auth'; 
import { auth } from '@/lib/firebaseConfig'; 

interface UserProfileFromBackend { // Renamed to avoid confusion with internal UserProfile
  id: string; // Changed from uid to id
  email: string | null;
  firstName?: string;
  lastName?: string;
  assignedRoleIds: string[]; 
  assignedRoleNames?: string[]; // Added this as it's in UserResponse
  status?: string; 
  // Fields from UserBase
  phone?: string;
  emergencyContactDetails?: string;
  skills?: string[]; // Assuming backend sends as array now
  qualifications?: string[]; // Assuming backend sends as array
  preferences?: string;
  profilePictureUrl?: string | null;
  // availability?: UserAvailability; // Not strictly needed in AuthContext profile, but could be added

  // New fields for RBAC
  privileges: Record<string, string[]>; // e.g., {"events": ["create", "view"]}
  isSysadmin: boolean;
}

interface AuthContextType {
  user: User | null; 
  idToken: string | null; 
  userProfile: UserProfileFromBackend | null; // Use the more detailed profile
  loading: boolean;
  error: Error | null;
  hasPrivilege: (resource: string, action: string) => boolean;
}

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
  const [userProfile, setUserProfile] = useState<UserProfileFromBackend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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
                throw new Error(`Failed to fetch user profile. ${errorDetails}`);
              }
              
              const profileData = await response.json();
              setUserProfile(profileData as UserProfileFromBackend); // Cast to the new detailed interface
            } catch (profileError: any) {
              console.error("Error fetching user profile:", profileError.message);
              setError(new Error(`Profile fetch error: ${profileError.message}`));
              setUserProfile(null); 
            }
          } catch (tokenError: any) {
            console.error("Error getting ID token:", tokenError.message);
            setError(tokenError);
            setIdToken(null); 
            setUserProfile(null); 
          }
        } else {
          setUser(null);
          setIdToken(null);
          setUserProfile(null);
        }
        setLoading(false);
      },
      (authError) => { 
        console.error("Auth ID token listener error:", authError.message);
        setError(authError);
        setUser(null);
        setIdToken(null);
        setUserProfile(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []); 

  const hasPrivilege = useCallback((resource: string, action: string): boolean => {
    if (loading || !userProfile) { // Check against loading state of AuthContext
      return false; 
    }
    
    // Sysadmin has all privileges
    if (userProfile.isSysadmin) {
      return true;
    }
    
    // Check against the fetched privileges map
    const resourcePrivileges = userProfile.privileges?.[resource];
    if (resourcePrivileges && Array.isArray(resourcePrivileges) && resourcePrivileges.includes(action)) {
      return true;
    }
    
    return false;
  }, [userProfile, loading]); // Depend on userProfile and loading state

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