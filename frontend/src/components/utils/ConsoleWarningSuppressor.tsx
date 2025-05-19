"use client";

import { useEffect } from 'react';

const ConsoleWarningSuppressor = () => {
  useEffect(() => {
    const originalWarn = console.warn;
    const warningToSuppress = "Accessing element.ref was removed in React 19.";

    console.warn = (...args: any[]) => {
      if (typeof args[0] === 'string' && args[0].includes(warningToSuppress)) {
        // Suppress this specific warning
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