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
  const dropdownRef = useRef<HTMLDivElement>(null); 
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
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

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

  if (hasPrivilege && hasPrivilege('donations', 'list')) {
    navLinks.push(
      <Link key="donations" href="/dashboard/donations" className={getLinkClassName("/dashboard/donations")} onClick={() => setIsDropdownOpen(false)}>
        Donations
      </Link>
    );
  }

  if (hasPrivilege && (hasPrivilege('reports', 'view_volunteer_hours') || hasPrivilege('reports', 'view_event_participation'))) {
    navLinks.push(
      <Link key="reports" href="/dashboard/reports" className={getLinkClassName("/dashboard/reports")} onClick={() => setIsDropdownOpen(false)}>
        Reports
      </Link>
    );
  }
  
  const adminLinks = [];
  if (hasPrivilege && hasPrivilege('users', 'list')) { 
    adminLinks.push(
      <Link key="admin-users" href="/dashboard/admin/users" className={getLinkClassName("/dashboard/admin/users")} onClick={() => setIsDropdownOpen(false)}>
        Users
      </Link>
    );
  }
  if (hasPrivilege && hasPrivilege('working_groups', 'list')) { 
    adminLinks.push(
      <Link key="admin-wg" href="/dashboard/admin/working-groups" className={getLinkClassName("/dashboard/admin/working-groups")} onClick={() => setIsDropdownOpen(false)}>
        Working Groups
      </Link>
    );
  }
  if (hasPrivilege && hasPrivilege('roles', 'list')) { 
    adminLinks.push(
      <Link key="admin-roles" href="/dashboard/admin/roles" className={getLinkClassName("/dashboard/admin/roles")} onClick={() => setIsDropdownOpen(false)}>
        Roles
      </Link>
    );
  }
  if (hasPrivilege && hasPrivilege('invitations', 'list')) { 
    adminLinks.push(
      <Link key="admin-invitations" href="/dashboard/admin/invitations" className={getLinkClassName("/dashboard/admin/invitations")} onClick={() => setIsDropdownOpen(false)}>
        Invitations
      </Link>
    );
  }

  if (adminLinks.length > 0) {
    navLinks.push(
      <span key="admin-separator" className="text-gray-300 dark:text-gray-700 hidden md:inline">|</span>
    );
    navLinks.push(...adminLinks);
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
                        if (React.isValidElement(link) && typeof link.props.href === 'string') {
                          if (link.key === "admin-separator") return null;
                          return React.cloneElement(link as React.ReactElement<any>, {
                            className: `${getLinkClassName(link.props.href)} w-full block px-4 py-2 text-left !bg-transparent hover:!bg-gray-100 dark:hover:!bg-gray-700`, 
                            onClick: () => setIsDropdownOpen(false)
                          });
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