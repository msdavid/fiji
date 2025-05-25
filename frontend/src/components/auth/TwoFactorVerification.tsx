'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface TwoFactorVerificationProps {
  userEmail: string;
  onVerificationSuccess: (deviceToken?: string, expiresAt?: Date, sessionToken?: string) => void;
  onVerificationError: (error: string) => void;
  onCancel: () => void;
}

interface TwoFactorStatusResponse {
  requires_2fa: boolean;
  code_sent: boolean;
  trusted_device: boolean;
  expires_in_minutes?: number;
}

interface TwoFactorVerifyResponse {
  success: boolean;
  device_token?: string;
  expires_at?: string;
  backend_session_token?: string;
}

export default function TwoFactorVerification({
  userEmail,
  onVerificationSuccess,
  onVerificationError,
  onCancel
}: TwoFactorVerificationProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Send initial code when component mounts
    sendVerificationCode();
  }, []);

  useEffect(() => {
    // Timer for code expiration
    if (timeRemaining && timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(prev => prev ? prev - 1 : 0);
      }, 60000); // Update every minute

      return () => clearTimeout(timer);
    }
  }, [timeRemaining]);

  useEffect(() => {
    // Resend cooldown timer
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const sendVerificationCode = async () => {
    setLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (!backendUrl) {
        throw new Error('Backend URL not configured');
      }

      // Get Firebase ID token
      const { auth } = await import('@/lib/firebaseConfig');
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const idToken = await user.getIdToken();

      const response = await fetch(`${backendUrl}/auth/2fa/send-code`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to send verification code');
      }

      const data: TwoFactorStatusResponse = await response.json();
      
      if (data.trusted_device) {
        // Device is already trusted, no 2FA required
        onVerificationSuccess();
        return;
      }

      setCodeSent(data.code_sent);
      if (data.expires_in_minutes) {
        setTimeRemaining(data.expires_in_minutes);
      }
      setResendCooldown(30); // 30 second cooldown before resend
    } catch (error: any) {
      console.error('Error sending verification code:', error);
      onVerificationError(error.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newCode = [...code];
    newCode[index] = value.slice(-1); // Take only the last digit
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are entered
    if (newCode.every(digit => digit !== '') && !loading) {
      verifyCode(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      // Focus previous input on backspace
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').replace(/\D/g, ''); // Remove non-digits
    
    if (pastedText.length === 6) {
      const newCode = pastedText.split('').slice(0, 6);
      setCode(newCode);
      
      // Verify immediately
      if (!loading) {
        verifyCode(pastedText);
      }
    }
  };

  const verifyCode = async (codeString: string) => {
    setLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (!backendUrl) {
        throw new Error('Backend URL not configured');
      }

      // Get Firebase ID token and user ID
      const { auth } = await import('@/lib/firebaseConfig');
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const idToken = await user.getIdToken();

      // Generate device fingerprint
      const { generateDeviceFingerprint } = await import('@/lib/deviceFingerprint');
      const deviceFingerprint = generateDeviceFingerprint();

      const response = await fetch(`${backendUrl}/auth/2fa/verify-code`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.uid,
          code: codeString,
          device_fingerprint: deviceFingerprint,
          remember_device: rememberDevice,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Invalid verification code');
      }

      const data: TwoFactorVerifyResponse = await response.json();
      
      if (data.success) {
        // Store device token if provided
        if (data.device_token && data.expires_at) {
          const { storeDeviceToken } = await import('@/lib/deviceFingerprint');
          storeDeviceToken(data.device_token, new Date(data.expires_at));
        }
        
        onVerificationSuccess(
          data.device_token,
          data.expires_at ? new Date(data.expires_at) : undefined,
          data.backend_session_token
        );
      } else {
        throw new Error('Verification failed');
      }
    } catch (error: any) {
      console.error('Error verifying code:', error);
      onVerificationError(error.message || 'Invalid verification code');
      
      // Clear the code and focus first input
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = () => {
    if (resendCooldown > 0) return;
    sendVerificationCode();
  };

  const formatTime = (minutes: number) => {
    if (minutes < 1) return 'less than 1 minute';
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Verify Your Identity
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          We've sent a verification code to
        </p>
        <p className="text-center text-sm font-medium text-gray-900 dark:text-white">
          {userEmail}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
                Enter 6-digit verification code
              </label>
              <div className="mt-3 flex justify-center space-x-2" onPaste={handlePaste}>
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => inputRefs.current[index] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleCodeChange(index, e.target.value)}
                    onKeyDown={e => handleKeyDown(index, e)}
                    className="w-12 h-12 text-center text-xl font-bold border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={loading}
                  />
                ))}
              </div>
            </div>

            {timeRemaining && timeRemaining > 0 && (
              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                Code expires in {formatTime(timeRemaining)}
              </div>
            )}

            <div className="flex items-center">
              <input
                id="remember-device"
                type="checkbox"
                checked={rememberDevice}
                onChange={e => setRememberDevice(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
              />
              <label htmlFor="remember-device" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Trust this device for 7 days
              </label>
            </div>

            <div className="flex flex-col space-y-3">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={loading || resendCooldown > 0}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
              </button>

              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-gray-600 dark:text-gray-400 bg-transparent hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}