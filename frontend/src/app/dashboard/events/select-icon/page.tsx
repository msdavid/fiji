'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { commonEventIcons, MaterialIconName } from '@/lib/materialIcons'; // Using commonEventIcons for display

export default function SelectEventIconPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const handleIconSelect = (iconName: MaterialIconName) => {
    if (returnTo) {
      const destinationUrl = new URL(returnTo, window.location.origin);
      destinationUrl.searchParams.set('selectedIcon', iconName);
      router.push(destinationUrl.toString());
    } else {
      // Fallback if returnTo is not specified, though it always should be
      console.warn("returnTo URL not specified for icon selection.");
      router.push('/dashboard/events'); // Or some other sensible default
    }
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
      
      {/* TODO: Add a search/input field here to allow users to type any Material Icon name */}
      {/* <div className="mb-6">
        <input 
          type="text" 
          placeholder="Search icons or enter icon name..." 
          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
          // onChange={handleSearchChange} // Implement search logic
        />
      </div> */}

      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-xl p-6 sm:p-8">
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
          {commonEventIcons.map((iconName) => (
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
          {/* TODO: The input field above will allow direct entry of any icon name. */}
        </p>
      </div>
    </div>
  );
}