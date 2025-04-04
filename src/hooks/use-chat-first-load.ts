import { useState, useEffect } from 'react';

// Check if this is the very first load of the chat page in this session
const isVeryFirstLoad = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    return sessionStorage.getItem('chat-first-load-complete') !== 'true';
  } catch (e) {
    return true;
  }
};

// Mark first load as complete
const markFirstLoadComplete = (): void => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem('chat-first-load-complete', 'true');
  } catch (e) {
    // Ignore errors with sessionStorage
  }
};

/**
 * Simple hook to check if this is the first load of the chat interface
 * This is for the global first load, not per agent
 */
export function useChatFirstLoad() {
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    // Check if this is the very first load
    const firstLoad = isVeryFirstLoad();
    setIsFirstLoad(firstLoad);
    
    // If this is the first load, mark it as complete
    if (firstLoad) {
      markFirstLoadComplete();
    }
  }, []);

  return {
    isFirstLoad
  };
} 