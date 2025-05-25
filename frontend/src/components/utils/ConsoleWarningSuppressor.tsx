"use client";

import { useEffect } from 'react';

const ConsoleWarningSuppressor = () => {
  useEffect(() => {
    const originalWarn = console.warn;
    const warningToSuppress = "Accessing element.ref was removed in React 19.";

    console.warn = (...args: any[]) => {
      if (typeof args[0] === 'string' && 
          (args[0].includes(warningToSuppress) || 
           args[0].includes("ref is now a regular prop") ||
           args[0].includes("element.ref"))) {
        // Suppress React 19 ref warnings
        return;
      }
      originalWarn.apply(console, args);
    };

    return () => {
      // Restore original console.warn when component unmounts
      console.warn = originalWarn;
    };
  }, []);

  return null; // This component does not render anything
};

export default ConsoleWarningSuppressor;