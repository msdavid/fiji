'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, signOut } from 'firebase/auth'; 
import { auth } from '@/lib/firebaseConfig'; 
import { useRouter } from 'next/navigation'; 

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
  sessionToken: string | null; // Added session token
  userProfile: UserProfileFromBackend | null; 
  loading: boolean;
  error: Error | null;
  requires2FA: boolean;
  hasPrivilege: (resource: string, action: string) => boolean;
  logout: (options?: { redirect?: boolean }) => Promise<void>;
  complete2FA: (deviceToken?: string, expiresAt?: Date, sessionToken?: string) => void;
}

const defaultAuthContextValue: AuthContextType = {
  user: null,
  idToken: null,
  sessionToken: null,
  userProfile: null,
  loading: true,
  error: null,
  requires2FA: false,
  hasPrivilege: () => false, 
  logout: async () => {},
  complete2FA: () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthContextValue);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileFromBackend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [requires2FA, setRequires2FA] = useState(false);
  const router = useRouter(); 

  const complete2FA = useCallback(async (deviceToken?: string, expiresAt?: Date, sessionToken?: string) => {
    // Store device token if provided
    if (deviceToken && expiresAt) {
      import('@/lib/deviceFingerprint').then(({ storeDeviceToken }) => {
        storeDeviceToken(deviceToken, expiresAt);
      });
    }
    
    // Store session token if provided
    if (sessionToken) {
      setSessionToken(sessionToken);
      localStorage.setItem('sessionToken', sessionToken);
      
      // Fetch user profile with the new session token
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
        if (backendUrl) {
          const response = await fetch(`${backendUrl}/users/me`, {
            headers: { 'Authorization': `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
          });

          if (response.ok) {
            const profileData = await response.json();
            setUserProfile(profileData);
            setError(null);
          } else {
            console.warn('Failed to fetch user profile after 2FA completion');
          }
        }
      } catch (error) {
        console.warn('Error fetching user profile after 2FA completion:', error);
      }
    }
    
    // Clear 2FA requirement and continue with normal flow
    setRequires2FA(false);
    setLoading(false);
  }, []);

  const performLogout = useCallback(async (options?: { redirect?: boolean }) => {
    const { redirect = true } = options || {};
    setError(null); 

    try {
      await signOut(auth);
    } catch (e) {
      console.error("Error signing out: ", e);
      setError(e instanceof Error ? e : new Error('Failed to sign out')); 
    } finally {
      setUser(null);
      setIdToken(null);
      setSessionToken(null);
      setUserProfile(null);
      setRequires2FA(false);
      setLoading(false);
      
      // Clear stored tokens on logout
      localStorage.removeItem('sessionToken');
      import('@/lib/deviceFingerprint').then(({ clearDeviceToken }) => {
        clearDeviceToken();
      });
      
      if (redirect) {
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            router.push('/login');
        }
      }
    }
  }, [router]);

  useEffect(() => {
    // Load session token from localStorage on mount
    const storedSessionToken = localStorage.getItem('sessionToken');
    if (storedSessionToken) {
      setSessionToken(storedSessionToken);
    }
    const unsubscribe = auth.onIdTokenChanged(
      async (currentUser) => {
        setLoading(true); // Start loading for any auth state change
        // setError(null); // Clear general errors, specific errors handled below

        if (currentUser) {
          // If this is a different user than before, clear any existing session token
          if (user && user.uid !== currentUser.uid) {
            console.log('AuthContext: Different user detected, clearing session token');
            setSessionToken(null);
            localStorage.removeItem('sessionToken');
          }
          
          setUser(currentUser); // Optimistically set user
          setError(null); // Clear previous errors if we have a current user now

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

            // Check if we have a valid session token first
            let currentSessionToken = sessionToken || localStorage.getItem('sessionToken');
            
            // If we have a session token, verify it belongs to the current user
            if (currentSessionToken) {
              try {
                // Decode the JWT token to check if it matches the current user
                const payload = JSON.parse(atob(currentSessionToken.split('.')[1]));
                if (payload.sub !== currentUser.uid) {
                  console.log('AuthContext: Session token belongs to different user, clearing');
                  currentSessionToken = null;
                  setSessionToken(null);
                  localStorage.removeItem('sessionToken');
                }
              } catch (jwtError) {
                console.warn('AuthContext: Invalid session token format, clearing');
                currentSessionToken = null;
                setSessionToken(null);
                localStorage.removeItem('sessionToken');
              }
            }
            
            if (!currentSessionToken) {
              // No session token, need to perform session login
              const { generateDeviceFingerprint, isDeviceTokenValid } = await import('@/lib/deviceFingerprint');
              const deviceFingerprint = generateDeviceFingerprint();
              const hasValidDeviceToken = isDeviceTokenValid();

              if (!hasValidDeviceToken) {
                // Check 2FA requirement with backend
                try {
                  const twoFAResponse = await fetch(`${backendUrl}/auth/2fa/check-requirement`, {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      user_id: currentUser.uid,
                      device_fingerprint: deviceFingerprint
                    })
                  });
                  
                  if (twoFAResponse.ok) {
                    const twoFAData = await twoFAResponse.json();
                    if (twoFAData.requires_2fa && !twoFAData.trusted_device) {
                      // 2FA is required, set state and stop here
                      setRequires2FA(true);
                      setLoading(false);
                      return;
                    }
                  } else {
                    const errorText = await twoFAResponse.text();
                    console.warn("2FA check failed with status:", twoFAResponse.status, "Error:", errorText);
                  }
                } catch (twoFAError: any) {
                  console.warn("Failed to check 2FA requirement:", twoFAError.message);
                  // Continue with normal flow if 2FA check fails
                }
              }

              // Perform session login to get backend session token
              try {
                const sessionLoginResponse = await fetch(`${backendUrl}/auth/session-login`, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    firebase_id_token: token,
                    device_fingerprint: deviceFingerprint
                  })
                });

                if (sessionLoginResponse.ok) {
                  const sessionData = await sessionLoginResponse.json();
                  
                  if (sessionData.requires_2fa) {
                    // 2FA is required, set state and stop here
                    setRequires2FA(true);
                    setLoading(false);
                    return;
                  } else if (sessionData.backend_session_token) {
                    // Got session token, store it
                    currentSessionToken = sessionData.backend_session_token;
                    setSessionToken(currentSessionToken);
                    localStorage.setItem('sessionToken', currentSessionToken);
                  }
                } else {
                  const errorText = await sessionLoginResponse.text();
                  console.warn("AuthContext: Session login failed:", sessionLoginResponse.status, errorText);
                  setError(new Error(`Session login failed: ${errorText}`));
                  setLoading(false);
                  return;
                }
              } catch (sessionError: any) {
                console.error("AuthContext: Session login error:", sessionError.message);
                setError(new Error(`Session login error: ${sessionError.message}`));
                setLoading(false);
                return;
              }
            }

            // If we reach here, either device is trusted or 2FA not required
            setRequires2FA(false);

            try {
              // Use session token if available, otherwise we have a problem since /users/me requires session tokens
              if (!currentSessionToken) {
                console.error('AuthContext: No session token available for /users/me call');
                setError(new Error('Authentication failed: No session token available'));
                setLoading(false);
                return;
              }
              const response = await fetch(`${backendUrl}/users/me`, {
                headers: { 'Authorization': `Bearer ${currentSessionToken}`, 'Content-Type': 'application/json' },
              });

              if (!response.ok) {
                let errorDetails = `HTTP error ${response.status}`;
                try { const errorData = await response.json(); errorDetails += `: ${errorData.detail || errorData.message || response.statusText}`; } 
                catch (e) { errorDetails += `: ${response.statusText}`; }
                
                console.warn(`AuthContext: Profile fetch failed (${errorDetails}).`);
                
                if (response.status === 401) {
                  // Clear invalid session token
                  setSessionToken(null);
                  localStorage.removeItem('sessionToken');
                  console.warn(`AuthContext: Session token invalid (401). Logging out to restart authentication flow.`);
                  
                  setError(null); 
                  setUser(null); setIdToken(null); setUserProfile(null); setLoading(false);
                  router.push('/login');
                  await performLogout({ redirect: false });
                  return; 
                }
                setError(new Error(`Failed to fetch user profile. ${errorDetails}`));
                setUserProfile(null); setLoading(false); 
                return; 
              }
              
              const profileData = await response.json();
              setUserProfile(profileData as UserProfileFromBackend);
              setError(null); // Clear error on successful profile fetch
              setLoading(false); 
            } catch (profileError: any) { 
              console.error("AuthContext: Network/parsing error fetching profile:", profileError.message);
              setError(new Error(`Profile fetch error: ${profileError.message}`)); 
              setUserProfile(null); setLoading(false); 
            }
          } catch (tokenError: any) { 
            console.error("AuthContext: Firebase ID token error. Logging out.", tokenError.message);
            setError(null); 
            setUser(null); setIdToken(null); setUserProfile(null); setLoading(false);
            router.push('/login'); // Attempt redirect immediately
            await performLogout({ redirect: false }); // Ensure signOut and state cleanup
            return;
          }
        } else { // No currentUser
          setError(null); // No user, so no auth error from context
          setUser(null); setIdToken(null); setUserProfile(null); setLoading(false);
          if (typeof window !== 'undefined' && 
              window.location.pathname !== '/login' && 
              window.location.pathname !== '/register' &&
              !window.location.pathname.startsWith('/register?token=')) {
             router.push('/login');
          }
        }
      },
      async (authListenerError) => { 
        console.error("AuthContext: Critical Firebase Auth listener error. Logging out.", authListenerError.message);
        setError(null); 
        setUser(null); setIdToken(null); setUserProfile(null); setLoading(false);
        router.push('/login'); // Attempt redirect immediately
        await performLogout({ redirect: false }); // Ensure signOut and state cleanup
      }
    );
    return () => unsubscribe();
  }, [performLogout, router]); // performLogout and router are stable

  const hasPrivilege = useCallback((resource: string, action: string): boolean => {
    if (loading || !userProfile) return false; 
    if (userProfile.isSysadmin) return true;
    const RPr = userProfile.privileges?.[resource];
    return RPr && Array.isArray(RPr) && RPr.includes(action);
  }, [userProfile, loading]); 

  return (
    <AuthContext.Provider value={{ user, idToken, sessionToken, userProfile, loading, error, requires2FA, hasPrivilege, logout: performLogout, complete2FA }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};