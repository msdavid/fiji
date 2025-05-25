'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import apiClient from '@/lib/apiClient';

interface OrganizationConfig {
  id: string;
  name?: string;
  logo_url?: string;
  email_sender_name?: string;
  email_sender_address?: string;
  primary_color?: string;
  secondary_color?: string;
  contact_email?: string;
  website_url?: string;
  donations_url?: string;
  address?: string;
  phone?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export default function OrganizationSettingsPage() {
  const { user, userProfile, hasPrivilege } = useAuth();
  const router = useRouter();
  const [config, setConfig] = useState<OrganizationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<OrganizationConfig>>({});
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !userProfile) return;
    
    const isSysadmin = userProfile.assignedRoleIds?.includes('sysadmin');
    if (!isSysadmin) {
      toast.error('Access denied. Only system administrators can access this page.');
      router.push('/dashboard');
      return;
    }

    fetchOrganizationConfig();
  }, [user, userProfile, router]);

  const fetchOrganizationConfig = async () => {
    try {
      const token = await user?.getIdToken();
      const result = await apiClient<OrganizationConfig>({
        method: 'GET',
        path: '/organization/',
        token: token,
      });

      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to fetch organization settings');
      }

      setConfig(result.data);
      setFormData(result.data);
    } catch (error) {
      console.error('Error fetching organization config:', error);
      toast.error('Failed to load organization settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const token = await user.getIdToken();
      
      // Clean the data: convert empty strings to null for URL fields and exclude id
      const cleanedData = { ...formData };
      delete cleanedData.id; // Remove id field as it's not updatable
      delete cleanedData.created_at; // Remove timestamp fields
      delete cleanedData.updated_at;
      
      const urlFields = ['logo_url', 'website_url', 'donations_url'];
      urlFields.forEach(field => {
        if (cleanedData[field] === '') {
          cleanedData[field] = undefined;
        }
      });
      
      const result = await apiClient<OrganizationConfig>({
        method: 'PUT',
        path: '/organization/',
        token: token,
        data: cleanedData,
      });

      if (!result.ok) {
        console.error('API Error Details:', result.error);
        throw new Error(result.error?.message || 'Failed to update organization settings');
      }

      setConfig(result.data);
      toast.success('Organization settings updated successfully');
    } catch (error) {
      console.error('Error updating organization config:', error);
      toast.error('Failed to update organization settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value || undefined
    }));
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Please select a valid image file (JPEG, PNG, or WebP)');
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError('Image file size must be less than 5MB');
      return;
    }

    setIsUploadingLogo(true);
    setUploadError(null);

    try {
      const token = await user.getIdToken();
      const authToken = localStorage.getItem('sessionToken') || token;
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/uploads/organization-logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: uploadFormData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to upload logo');
      }

      const result = await response.json();
      
      // Update the form data with the new logo URL
      setFormData(prev => ({ ...prev, logo_url: result.logo_url }));
      
      // Update the config state to reflect the change immediately
      setConfig(prev => prev ? { ...prev, logo_url: result.logo_url } : null);
      
      // Clear the file input
      event.target.value = '';
      
      toast.success('Logo uploaded successfully');
      
    } catch (err: any) {
      setUploadError(err.message);
      console.error('Logo upload error:', err);
      toast.error('Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    // Clear the logo URL from form data
    setFormData(prev => ({ ...prev, logo_url: undefined }));
    
    // Clear the logo URL from config state to update preview immediately
    setConfig(prev => prev ? { ...prev, logo_url: undefined } : null);
    
    // Clear any upload errors
    setUploadError(null);
    
    toast.success('Logo removed. Save settings to apply changes.');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-300">Loading organization settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Organization Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Configure global settings for your organization
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Organization Name
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter organization name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Organization Logo
              </label>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  {formData.logo_url ? (
                    <img 
                      src={formData.logo_url} 
                      alt="Organization Logo" 
                      className="w-16 h-16 object-contain border border-gray-300 dark:border-gray-600 rounded-md bg-white"
                    />
                  ) : (
                    <div className="w-16 h-16 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                      <span className="material-icons text-gray-400 dark:text-gray-500">business</span>
                    </div>
                  )}
                </div>
                <div className="flex-grow">
                  <div className="flex flex-col space-y-2">
                    <div className="flex space-x-2">
                      <label htmlFor="logo-upload" className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                        <span className="material-icons text-sm mr-2">{isUploadingLogo ? 'sync' : 'upload'}</span>
                        {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleLogoUpload}
                          disabled={isUploadingLogo}
                          className="sr-only"
                        />
                      </label>
                      {formData.logo_url && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          disabled={isUploadingLogo}
                          className="inline-flex items-center px-3 py-2 border border-red-300 dark:border-red-600 rounded-md shadow-sm text-sm font-medium text-red-700 dark:text-red-300 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                        >
                          <span className="material-icons text-sm mr-2">delete</span>
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Max 5MB, JPEG/PNG/WebP</p>
                    {uploadError && (
                      <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
                    )}
                  </div>
                  <div className="mt-2">
                    <input
                      type="url"
                      value={formData.logo_url || ''}
                      onChange={(e) => handleInputChange('logo_url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white text-xs"
                      placeholder="Or enter logo URL manually"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Contact Email
              </label>
              <input
                type="email"
                value={formData.contact_email || ''}
                onChange={(e) => handleInputChange('contact_email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                placeholder="contact@organization.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                placeholder="+65 9123 4567"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Website URL
            </label>
            <input
              type="url"
              value={formData.website_url || ''}
              onChange={(e) => handleInputChange('website_url', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
              placeholder="https://www.organization.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Donations URL
            </label>
            <input
              type="url"
              value={formData.donations_url || ''}
              onChange={(e) => handleInputChange('donations_url', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
              placeholder="https://www.organization.com/donate"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Address
            </label>
            <textarea
              value={formData.address || ''}
              onChange={(e) => handleInputChange('address', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
              placeholder="Organization address"
            />
          </div>

          {/* Email Settings */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Email Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sender Name
                </label>
                <input
                  type="text"
                  value={formData.email_sender_name || ''}
                  onChange={(e) => handleInputChange('email_sender_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Organization Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sender Email
                </label>
                <input
                  type="email"
                  value={formData.email_sender_address || ''}
                  onChange={(e) => handleInputChange('email_sender_address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="noreply@organization.com"
                />
              </div>
            </div>
          </div>

          {/* Brand Colors */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Brand Colors
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Primary Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={formData.primary_color || '#6366f1'}
                    onChange={(e) => handleInputChange('primary_color', e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300 dark:border-gray-600"
                  />
                  <input
                    type="text"
                    value={formData.primary_color || ''}
                    onChange={(e) => handleInputChange('primary_color', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                    placeholder="#6366f1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Secondary Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={formData.secondary_color || '#6b7280'}
                    onChange={(e) => handleInputChange('secondary_color', e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300 dark:border-gray-600"
                  />
                  <input
                    type="text"
                    value={formData.secondary_color || ''}
                    onChange={(e) => handleInputChange('secondary_color', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                    placeholder="#6b7280"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Organization Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
              placeholder="Brief description of your organization..."
            />
          </div>

          {/* Save Button */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}