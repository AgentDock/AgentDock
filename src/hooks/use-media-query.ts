'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook for responsive design that detects if a media query matches
 * @param query The media query to check (e.g., "(max-width: 640px)")
 * @returns Boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  // Initialize with the match state, or false if SSR
  const [matches, setMatches] = useState<boolean>(() => {
    // Check if window is defined (for SSR)
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    // Ensure we're in a browser environment
    if (typeof window === 'undefined') return;

    // Create media query list
    const mediaQueryList = window.matchMedia(query);

    // Initial check
    setMatches(mediaQueryList.matches);

    // Define handler
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener for changes
    if (mediaQueryList.addEventListener) {
      // Modern browsers
      mediaQueryList.addEventListener('change', handler);
    } else {
      // Older browsers
      mediaQueryList.addListener(handler);
    }

    // Clean up
    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', handler);
      } else {
        mediaQueryList.removeListener(handler);
      }
    };
  }, [query]); // Re-run effect if query changes

  return matches;
}
