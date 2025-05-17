'use client';

import { useState, useEffect } from 'react'; // Added useState and useEffect
import { useRouter, useSearchParams } from 'next/navigation';
import { commonEventIcons, MaterialIconName } from '@/lib/materialIcons'; 

export default function SelectEventIconPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const [searchTerm, setSearchTerm] = useState('');
  const [filteredIcons, setFilteredIcons] = useState<string[]>(commonEventIcons);

  useEffect(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    if (lowerSearchTerm === '') {
      setFilteredIcons(commonEventIcons);
    } else {
      setFilteredIcons(
        commonEventIcons.filter(iconName =>
          iconName.toLowerCase().includes(lowerSearchTerm)
        )
      );
    }
  }, [searchTerm]);

  const handleIconSelect = (iconName: MaterialIconName) => {
    if (returnTo) {
      const destinationUrl = new URL(returnTo, window.location.origin);
      destinationUrl.searchParams.set('selectedIcon', iconName);
      router.push(destinationUrl.toString());
    } else {
      console.warn("returnTo URL not specified for icon selection.");
      router.push('/dashboard/events'); 
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <button
          onClick={() => returnTo ? router.push(returnTo) : router.back()}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          ← Back to Event Form 
        </button>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Select Event Icon</h1>
      
      <div className="mb-6">
        <input 
          type="text" 
          placeholder="Search icons by name..." 
          value={searchTerm}
          onChange={handleSearchChange}
          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-xl p-6 sm:p-8">
        {filteredIcons.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
            {filteredIcons.map((iconName) => (
              <div
                key={iconName}
                onClick={() => handleIconSelect(iconName as MaterialIconName)}
                className="flex flex-col items-center justify-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/60 hover:shadow-md transition-all group"
                title={iconName.replace(/_/g, ' ')}
              >
                <span className="material-icons text-3xl sm:text-4xl text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  {iconName}
                </span>
                <p className="mt-1.5 text-xs text-center text-gray-500 dark:text-gray-400 truncate w-full group-hover:font-medium">
                  {iconName.replace(/_/g, ' ')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-700 dark:text-gray-300 text-center">
            No icons found matching "{searchTerm}".
          </p>
        )}
        <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
          Can't find the perfect icon? You can find more names at the {' '}
          <a 
            href="https://fonts.google.com/icons" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Google Material Icons library
          </a>. 
          {/* TODO: The input field above will allow direct entry of any icon name if we enhance it further. */}
        </p>
      </div>
    </div>
  );
}