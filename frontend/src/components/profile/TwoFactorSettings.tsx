'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

interface TrustedDevice {
  id: string;
  device_name?: string;
  ip_address?: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  is_active: boolean;
}

export default function TwoFactorSettings() {
  const { user, idToken } = useAuth();
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    fetchTrustedDevices();
  }, []);

  const fetchTrustedDevices = async () => {
    if (!idToken) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (!backendUrl) {
        throw new Error('Backend URL not configured');
      }

      const response = await fetch(`${backendUrl}/auth/2fa/trusted-devices`, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch trusted devices');
      }

      const devices: TrustedDevice[] = await response.json();
      setTrustedDevices(devices);
    } catch (err: any) {
      console.error('Error fetching trusted devices:', err);
      setError(err.message || 'Failed to load trusted devices');
    } finally {
      setLoading(false);
    }
  };

  const revokeDevice = async (deviceId: string) => {
    if (!idToken) return;
    
    setRevoking(deviceId);
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (!backendUrl) {
        throw new Error('Backend URL not configured');
      }

      const response = await fetch(`${backendUrl}/auth/2fa/trusted-devices/${deviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to revoke device trust');
      }

      // Remove the device from the list
      setTrustedDevices(devices => devices.filter(device => device.id !== deviceId));
      
      // Clear session token to force re-authentication on next page load
      localStorage.removeItem('sessionToken');
      
      // Clear device token as well since the device is no longer trusted
      import('@/lib/deviceFingerprint').then(({ clearDeviceToken }) => {
        clearDeviceToken();
      });
    } catch (err: any) {
      console.error('Error revoking device:', err);
      setError(err.message || 'Failed to revoke device trust');
    } finally {
      setRevoking(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDeviceName = (device: TrustedDevice) => {
    if (device.device_name) {
      return device.device_name;
    }
    return 'Unknown Device';
  };

  const isCurrentDevice = (device: TrustedDevice) => {
    // Check if this might be the current device by comparing last used time
    const deviceLastUsed = new Date(device.last_used_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - deviceLastUsed.getTime()) / (1000 * 60);
    return diffMinutes < 5; // If used within last 5 minutes, likely current device
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Two-Factor Authentication
        </h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Two-Factor Authentication
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Manage your trusted devices. You'll need to verify your identity with a code sent to your email 
          when signing in from a new device or after 7 days on a trusted device.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-medium text-gray-900 dark:text-white">
            Trusted Devices ({trustedDevices.length})
          </h4>
          <button
            onClick={fetchTrustedDevices}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
          >
            Refresh
          </button>
        </div>

        {trustedDevices.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 dark:text-gray-500 mb-2">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No trusted devices found. When you verify your identity, you can choose to trust a device for 7 days.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {trustedDevices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDeviceName(device)}
                    </h5>
                    {isCurrentDevice(device) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        Current Device
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    {device.ip_address && (
                      <div>IP: {device.ip_address}</div>
                    )}
                    <div>Added: {formatDate(device.created_at)}</div>
                    <div>Last used: {formatDate(device.last_used_at)}</div>
                    <div>Expires: {formatDate(device.expires_at)}</div>
                  </div>
                </div>
                <div className="ml-4">
                  <button
                    onClick={() => revokeDevice(device.id)}
                    disabled={revoking === device.id}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {revoking === device.id ? 'Revoking...' : 'Revoke'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Security Information
              </h3>
              <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                <ul className="list-disc list-inside space-y-1">
                  <li>Trusted devices are remembered for 7 days</li>
                  <li>You can revoke trust for any device at any time</li>
                  <li>Revoking a device will require 2FA on next login from that device</li>
                  <li>For security, regularly review and remove unused devices</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}