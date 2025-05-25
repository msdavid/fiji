'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { debounce } from 'lodash'; // Using lodash for debounce

interface UserSearchResult {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

interface UserSearchInputProps {
  onUserSelected: (user: UserSearchResult) => void;
  label?: string;
  placeholder?: string;
  initialSearchTerm?: string; // Optional: if you want to pre-fill and possibly pre-search
}

const UserSearchInput: React.FC<UserSearchInputProps> = ({
  onUserSelected,
  label = "Search User",
  placeholder = "Search by name or email...",
  initialSearchTerm = "",
}) => {
  const { user, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchUsers = async (query: string) => {
    if (!user || query.length < 2) { // Minimum 2 chars to search, matching backend
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const authToken = localStorage.getItem('sessionToken') || idToken;
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await fetch(`${backendUrl}/users/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to search users');
      }
      const data: UserSearchResult[] = await response.json();
      setResults(data);
      setShowDropdown(data.length > 0);
    } catch (err: any) {
      setError(err.message);
      setResults([]);
      setShowDropdown(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce the fetchUsers function
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedFetchUsers = useCallback(debounce(fetchUsers, 500), [user]);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      debouncedFetchUsers(searchTerm);
    } else {
      setResults([]);
      setShowDropdown(false);
      debouncedFetchUsers.cancel(); // Cancel any pending debounced calls
    }
    return () => {
      debouncedFetchUsers.cancel(); // Cleanup on unmount
    };
  }, [searchTerm, debouncedFetchUsers]);

  const handleSelectUser = (selectedUser: UserSearchResult) => {
    onUserSelected(selectedUser);
    setSearchTerm(`${selectedUser.firstName || ''} ${selectedUser.lastName || ''} (${selectedUser.email})`.trim());
    setShowDropdown(false);
    setResults([]); // Clear results after selection
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (e.target.value.length >=2) {
        setShowDropdown(true); // Show dropdown as user types (if results are expected)
    } else {
        setShowDropdown(false);
    }
  };
  
  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-search-container')) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  if (authLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading search component...</p>;
  }
  if (!user) {
    return <p className="text-sm text-red-500 dark:text-red-400">User not authenticated. Cannot search.</p>;
  }

  return (
    <div className="relative user-search-container">
      {label && <label htmlFor="user-search-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
      <input
        id="user-search-input"
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => searchTerm.length >=2 && results.length > 0 && setShowDropdown(true)} // Show dropdown on focus if there are results/term
        placeholder={placeholder}
        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-white"
      />
      {isLoading && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Searching...</p>}
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{error}</p>}
      
      {showDropdown && results.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
          {results.map((u) => (
            <li
              key={u.id}
              onClick={() => handleSelectUser(u)}
              className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-900 dark:text-gray-100"
            >
              {u.firstName || ''} {u.lastName || ''} ({u.email})
            </li>
          ))}
        </ul>
      )}
      {showDropdown && !isLoading && results.length === 0 && searchTerm.length >= 2 && (
         <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg p-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">No users found matching "{searchTerm}".</p>
         </div>
      )}
    </div>
  );
};

export default UserSearchInput;