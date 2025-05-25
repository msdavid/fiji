'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation'; 
import { signOut, sendPasswordResetEmail } from 'firebase/auth'; // Added sendPasswordResetEmail
import { auth } from '@/lib/firebaseConfig';
import { useAuth } from '@/context/AuthContext';
import React, { useState, useEffect, useRef } from 'react';

// Simple toast notification state
interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export default function DashboardNav() {
  const router = useRouter(); 
  const pathname = usePathname(); 
  const { user, userProfile, loading: authLoading, hasPrivilege } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDonationsDropdownOpen, setIsDonationsDropdownOpen] = useState(false);
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null); 
  const donationsDropdownRef = useRef<HTMLDivElement>(null);
  const adminDropdownRef = useRef<HTMLDivElement>(null);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToastMessages(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToastMessages(prev => prev.filter(toast => toast.id !== id));
    }, 5000); // Auto-dismiss after 5 seconds
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsDropdownOpen(false); 
      router.push('/login');
    } catch (error) { 
      console.error('Logout Error:', error);
      addToast('Logout failed. Please try again.', 'error');
    }
  };

  const handlePasswordReset = async () => {
    if (!user || !user.email) {
      addToast('Could not identify user email for password reset.', 'error');
      setIsDropdownOpen(false);
      return;
    }
    try {
      await sendPasswordResetEmail(auth, user.email);
      addToast(`Password reset email sent to ${user.email}. Please check your inbox.`, 'success');
    } catch (error: any) {
      console.error('Password Reset Error:', error);
      if (error.code === 'auth/too-many-requests') {
        addToast('Too many password reset requests. Please try again later.', 'error');
      } else {
        addToast('Failed to send password reset email. Please try again.', 'error');
      }
    }
    setIsDropdownOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (donationsDropdownRef.current && !donationsDropdownRef.current.contains(event.target as Node)) {
        setIsDonationsDropdownOpen(false);
      }
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node)) {
        setIsAdminDropdownOpen(false);
      }
    };

    if (isDropdownOpen || isDonationsDropdownOpen || isAdminDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, isDonationsDropdownOpen, isAdminDropdownOpen]);

  if (authLoading && !user) {
    return (
        <nav className="bg-white dark:bg-gray-900 shadow-sm">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Link href="/dashboard" className="flex-shrink-0 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                            Fiji
                        </Link>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Loading navigation...</div>
                </div>
            </div>
        </nav>
    );
  }

  if (!user) {
    return null;
  }

  let calculatedDisplayName = "User";
  if (userProfile) {
    if (userProfile.firstName && userProfile.lastName) {
      calculatedDisplayName = `${userProfile.firstName} ${userProfile.lastName}`;
    } else if (userProfile.firstName) {
      calculatedDisplayName = userProfile.firstName;
    } else if (userProfile.lastName) {
      calculatedDisplayName = userProfile.lastName;
    } else if (user.email) {
      calculatedDisplayName = user.email;
    }
  } else if (user.email) {
    calculatedDisplayName = user.email;
  }

  let avatarInitial = '';
  if (userProfile?.firstName) {
    avatarInitial = userProfile.firstName.charAt(0).toUpperCase();
  } else if (userProfile?.lastName) {
    avatarInitial = userProfile.lastName.charAt(0).toUpperCase();
  } else if (user.email) {
    avatarInitial = user.email.charAt(0).toUpperCase();
  }


  const getLinkClassName = (path: string) => {
    const baseStyle = "text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-150 ease-in-out px-3 py-2 rounded-md";
    const activeStyle = "text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 rounded-md";
    
    if (pathname === path || (path !== "/dashboard" && pathname.startsWith(path))) { 
        return activeStyle;
    }
    return baseStyle;
  };




  const getDropdownLinkClassName = (path: string) => {
    const baseStyle = "flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white";
    const activeStyle = "flex items-center px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30";
    
    if (pathname === path || (path !== "/dashboard" && pathname.startsWith(path))) { 
        return activeStyle;
    }
    return baseStyle;
  };

  const getDonationsClassName = () => {
    const baseStyle = "text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-150 ease-in-out px-3 py-2 rounded-md flex items-center";
    const activeStyle = "text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 rounded-md flex items-center";
    
    const donationPaths = ["/dashboard/donate", "/dashboard/my-donations", "/dashboard/donations"];
    const isActive = donationPaths.some(path => pathname === path || pathname.startsWith(path));
    
    return isActive ? activeStyle : baseStyle;
  };

  const getAdminClassName = () => {
    const baseStyle = "text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-150 ease-in-out px-3 py-2 rounded-md flex items-center";
    const activeStyle = "text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 rounded-md flex items-center";
    
    const isActive = pathname.startsWith("/dashboard/admin/");
    return isActive ? activeStyle : baseStyle;
  };

  // Main navigation items
  const navLinks = [];

  navLinks.push(
    <Link key="dashboard" href="/dashboard" className={getLinkClassName("/dashboard")} onClick={() => setIsDropdownOpen(false)}>
      Dashboard
    </Link>
  );
  
  navLinks.push(
    <Link key="events" href="/dashboard/events" className={getLinkClassName("/dashboard/events")} onClick={() => setIsDropdownOpen(false)}>
      Events
    </Link>
  );

  // Donations dropdown (available to all authenticated users)
  navLinks.push(
    <div key="donations" className="relative" ref={donationsDropdownRef}>
      <button
        onClick={() => setIsDonationsDropdownOpen(!isDonationsDropdownOpen)}
        className={getDonationsClassName()}
      >
        Donations
        <span className="material-icons ml-1 text-sm">
          {isDonationsDropdownOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {isDonationsDropdownOpen && (
        <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 z-50">
          <div className="py-1">
            <Link 
              href="/dashboard/donate" 
              className={getDropdownLinkClassName("/dashboard/donate")}
              onClick={() => { setIsDonationsDropdownOpen(false); setIsDropdownOpen(false); }}
            >
              <span className="material-icons mr-2 text-sm">volunteer_activism</span>
              Declare Donation
            </Link>
            <Link 
              href="/dashboard/my-donations" 
              className={getDropdownLinkClassName("/dashboard/my-donations")}
              onClick={() => { setIsDonationsDropdownOpen(false); setIsDropdownOpen(false); }}
            >
              <span className="material-icons mr-2 text-sm">list_alt</span>
              My Donations
            </Link>
            {hasPrivilege && hasPrivilege('donations', 'list') && (
              <Link 
                href="/dashboard/donations" 
                className={getDropdownLinkClassName("/dashboard/donations")}
                onClick={() => { setIsDonationsDropdownOpen(false); setIsDropdownOpen(false); }}
              >
                <span className="material-icons mr-2 text-sm">admin_panel_settings</span>
                Manage Donations
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Reports (admin only)
  if (hasPrivilege && (hasPrivilege('reports', 'view_volunteer_hours') || hasPrivilege('reports', 'view_event_participation'))) {
    navLinks.push(
      <Link key="reports" href="/dashboard/reports" className={getLinkClassName("/dashboard/reports")} onClick={() => setIsDropdownOpen(false)}>
        Reports
      </Link>
    );
  }
  
  // Admin dropdown (only show if user has any admin privileges)
  const hasAdminPrivileges = hasPrivilege && (
    hasPrivilege('users', 'list') || 
    hasPrivilege('working_groups', 'list') || 
    hasPrivilege('roles', 'list') || 
    hasPrivilege('invitations', 'list')
  );

  if (hasAdminPrivileges) {
    navLinks.push(
      <div key="admin" className="relative" ref={adminDropdownRef}>
        <button
          onClick={() => setIsAdminDropdownOpen(!isAdminDropdownOpen)}
          className={getAdminClassName()}
        >
          Admin
          <span className="material-icons ml-1 text-sm">
            {isAdminDropdownOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>
        {isAdminDropdownOpen && (
          <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 z-50">
            <div className="py-1">
              {hasPrivilege && hasPrivilege('users', 'list') && (
                <Link 
                  href="/dashboard/admin/users" 
                  className={getDropdownLinkClassName("/dashboard/admin/users")}
                  onClick={() => { setIsAdminDropdownOpen(false); setIsDropdownOpen(false); }}
                >
                  <span className="material-icons mr-2 text-sm">people</span>
                  Users
                </Link>
              )}
              {hasPrivilege && hasPrivilege('working_groups', 'list') && (
                <Link 
                  href="/dashboard/admin/working-groups" 
                  className={getDropdownLinkClassName("/dashboard/admin/working-groups")}
                  onClick={() => { setIsAdminDropdownOpen(false); setIsDropdownOpen(false); }}
                >
                  <span className="material-icons mr-2 text-sm">groups</span>
                  Working Groups
                </Link>
              )}
              {hasPrivilege && hasPrivilege('roles', 'list') && (
                <Link 
                  href="/dashboard/admin/roles" 
                  className={getDropdownLinkClassName("/dashboard/admin/roles")}
                  onClick={() => { setIsAdminDropdownOpen(false); setIsDropdownOpen(false); }}
                >
                  <span className="material-icons mr-2 text-sm">security</span>
                  Roles
                </Link>
              )}
              {hasPrivilege && hasPrivilege('invitations', 'list') && (
                <Link 
                  href="/dashboard/admin/invitations" 
                  className={getDropdownLinkClassName("/dashboard/admin/invitations")}
                  onClick={() => { setIsAdminDropdownOpen(false); setIsDropdownOpen(false); }}
                >
                  <span className="material-icons mr-2 text-sm">mail</span>
                  Invitations
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }


  return (
    <>
      {/* Toast Notification Container */}
      <div className="fixed top-4 right-4 z-[100] space-y-2">
        {toastMessages.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-md shadow-lg text-sm font-medium
              ${toast.type === 'success' ? 'bg-green-500 text-white' : ''}
              ${toast.type === 'error' ? 'bg-red-500 text-white' : ''}
            `}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <nav className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex-shrink-0 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  Fiji
              </Link>
            </div>
            <div className="hidden md:flex items-center space-x-1 sm:space-x-2"> 
              {navLinks}
            </div>
            <div className="flex items-center">
              <div className="md:hidden">
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
                  className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
                >
                  <span className="material-icons">menu</span>
                </button>
              </div>
              <div className="relative ml-3" ref={dropdownRef}>
                <button
                  id="user-menu-button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center justify-center w-10 h-10 bg-indigo-100 dark:bg-indigo-800 rounded-full text-indigo-600 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-900 focus:ring-indigo-500 transition-colors duration-150 ease-in-out"
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="true"
                >
                  {avatarInitial ? (
                    <span className="text-lg font-medium">{avatarInitial}</span>
                  ) : (
                    <span className="material-icons text-xl">person</span> 
                  )}
                </button>

                {isDropdownOpen && (
                  <div 
                    className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-xl bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 focus:outline-none z-50"
                    role="menu" 
                    aria-orientation="vertical" 
                    aria-labelledby="user-menu-button"
                  >
                    <div className="py-1 md:hidden"> 
                      {navLinks.map(link => {
                        if (React.isValidElement(link)) {
                          // Handle regular links
                          if (typeof link.props.href === 'string') {
                            return React.cloneElement(link as React.ReactElement<any>, {
                              className: `${getLinkClassName(link.props.href)} w-full block px-4 py-2 text-left !bg-transparent hover:!bg-gray-100 dark:hover:!bg-gray-700`, 
                              onClick: () => setIsDropdownOpen(false)
                            });
                          }
                          // Handle dropdown sections (Donations and Admin)
                          else if (link.key === "donations") {
                            return (
                              <div key="mobile-donations" className="border-b border-gray-200 dark:border-gray-700 pb-1 mb-1">
                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Donations
                                </div>
                                <Link 
                                  href="/dashboard/donate" 
                                  className="flex items-center px-6 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                  onClick={() => setIsDropdownOpen(false)}
                                >
                                  <span className="material-icons mr-2 text-sm">volunteer_activism</span>
                                  Declare Donation
                                </Link>
                                <Link 
                                  href="/dashboard/my-donations" 
                                  className="flex items-center px-6 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                  onClick={() => setIsDropdownOpen(false)}
                                >
                                  <span className="material-icons mr-2 text-sm">list_alt</span>
                                  My Donations
                                </Link>
                                {hasPrivilege && hasPrivilege('donations', 'list') && (
                                  <Link 
                                    href="/dashboard/donations" 
                                    className="flex items-center px-6 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onClick={() => setIsDropdownOpen(false)}
                                  >
                                    <span className="material-icons mr-2 text-sm">admin_panel_settings</span>
                                    Manage Donations
                                  </Link>
                                )}
                              </div>
                            );
                          }
                          else if (link.key === "admin") {
                            return (
                              <div key="mobile-admin" className="border-b border-gray-200 dark:border-gray-700 pb-1 mb-1">
                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Admin
                                </div>
                                {hasPrivilege && hasPrivilege('users', 'list') && (
                                  <Link 
                                    href="/dashboard/admin/users" 
                                    className="flex items-center px-6 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onClick={() => setIsDropdownOpen(false)}
                                  >
                                    <span className="material-icons mr-2 text-sm">people</span>
                                    Users
                                  </Link>
                                )}
                                {hasPrivilege && hasPrivilege('working_groups', 'list') && (
                                  <Link 
                                    href="/dashboard/admin/working-groups" 
                                    className="flex items-center px-6 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onClick={() => setIsDropdownOpen(false)}
                                  >
                                    <span className="material-icons mr-2 text-sm">groups</span>
                                    Working Groups
                                  </Link>
                                )}
                                {hasPrivilege && hasPrivilege('roles', 'list') && (
                                  <Link 
                                    href="/dashboard/admin/roles" 
                                    className="flex items-center px-6 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onClick={() => setIsDropdownOpen(false)}
                                  >
                                    <span className="material-icons mr-2 text-sm">security</span>
                                    Roles
                                  </Link>
                                )}
                                {hasPrivilege && hasPrivilege('invitations', 'list') && (
                                  <Link 
                                    href="/dashboard/admin/invitations" 
                                    className="flex items-center px-6 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onClick={() => setIsDropdownOpen(false)}
                                  >
                                    <span className="material-icons mr-2 text-sm">mail</span>
                                    Invitations
                                  </Link>
                                )}
                              </div>
                            );
                          }
                        }
                        return null;
                      })}
                       <hr className="my-1 border-gray-200 dark:border-gray-700"/>
                    </div>

                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 md:border-b-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={calculatedDisplayName}>{calculatedDisplayName}</p>
                    </div>
                    <div className="py-1" role="none">
                      <Link 
                        href="/dashboard/profile" 
                        className="group flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white" 
                        role="menuitem"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <span className="material-icons text-lg mr-2 text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">account_circle</span>
                        Your Profile
                      </Link>
                      <button
                        onClick={handlePasswordReset}
                        className="group flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                        role="menuitem"
                      >
                        <span className="material-icons text-lg mr-2 text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">lock_reset</span>
                        Reset Password
                      </button>
                    </div>
                    <div className="py-1 border-t border-gray-200 dark:border-gray-700" role="none">
                      <button 
                        onClick={handleLogout}
                        className="group flex items-center w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300" 
                        role="menuitem"
                      >
                        <span className="material-icons text-lg mr-2 group-hover:text-red-700 dark:group-hover:text-red-300">logout</span>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}