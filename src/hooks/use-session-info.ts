import { useState, useCallback, useEffect } from 'react';

// Define the structure of the session data we expect from the API
// Includes cumulative usage and potentially other fields like activeStep
export interface SessionInfoData {
  sessionId: string;
  activeStep?: string;
  recentlyUsedTools?: string[];
  cumulativeTokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  lastUpdateTime?: number;
  // Add other potential fields returned by the API if needed
}

/**
 * Custom hook to fetch and manage session information.
 * Now also checks localStorage for cached usage data before making API requests.
 * 
 * @param sessionId The ID of the session to fetch data for.
 * @returns An object containing session data, loading state, error state, and a refresh function.
 */
export function useSessionInfo(sessionId: string | null | undefined) {
  const [sessionData, setSessionData] = useState<SessionInfoData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Checks localStorage for cached session information.
   * @returns The cached session data or null if not found/stale
   */
  const getLocalSessionData = useCallback((): SessionInfoData | null => {
    if (!sessionId) return null;
    
    try {
      const storageKey = `session-info-${sessionId}`;
      const cachedDataStr = localStorage.getItem(storageKey);
      
      if (!cachedDataStr) return null;
      
      const cachedData = JSON.parse(cachedDataStr) as SessionInfoData;
      
      // Add session ID to the data for consistency
      cachedData.sessionId = sessionId;
      
      // If data has no lastUpdateTime or is missing cumulativeTokenUsage, don't use it
      if (!cachedData.lastUpdateTime || !cachedData.cumulativeTokenUsage) {
        return null;
      }
      
      // Check if the data is very recent (within last 5 seconds)
      const isRecent = cachedData.lastUpdateTime && 
                      (Date.now() - cachedData.lastUpdateTime < 5000);
      
      return isRecent ? cachedData : null;
    } catch (err) {
      console.warn('Error reading session info from localStorage:', err);
      return null;
    }
  }, [sessionId]);

  /**
   * Fetches the session information from the API.
   * Returns the fetched data or null if fetch fails or no sessionId.
   * Now first checks localStorage for recent data before making API call.
   */
  const fetchSessionInfo = useCallback(async (): Promise<SessionInfoData | null> => { 
    // Don't attempt to fetch if sessionId is not valid
    if (!sessionId) {
      setSessionData(null); // Clear any stale data
      setError(null);       // Clear any stale error
      setIsLoading(false);  // Ensure loading is false
      return null; // Return null if no ID
    }

    // First check if we have recent data in localStorage
    const localData = getLocalSessionData();
    if (localData) {
      console.debug('[SESSION INFO] Using recent data from localStorage', localData);
      setSessionData(localData);
      setError(null);
      setIsLoading(false);
      return localData;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/session/${sessionId}`);
      if (!response.ok) {
        let errorMsg = `HTTP error fetching session info! Status: ${response.status}`;
        try {
          // Try to parse a more specific error message from the response body
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (jsonError) {
          // Ignore if the error response wasn't valid JSON
          console.warn("Could not parse error response JSON:", jsonError);
        }
        throw new Error(errorMsg);
      }

      const data: SessionInfoData = await response.json();
      
      // Ensure cumulativeTokenUsage exists, providing defaults if not
      if (!data.cumulativeTokenUsage) {
          console.warn('Cumulative usage data not found in session response, setting defaults.');
          data.cumulativeTokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      }
      
      // Add lastUpdateTime to track freshness
      data.lastUpdateTime = Date.now();
      
      // Cache the data in localStorage for future use
      try {
        const storageKey = `session-info-${sessionId}`;
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch (storageErr) {
        console.warn('Failed to cache session data in localStorage:', storageErr);
      }

      setSessionData(data); // Still update state for other consumers
      setError(null); // Clear error on successful fetch
      return data; // Return the fetched data

    } catch (err) {
      console.error("Failed to fetch session info:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred while fetching session info.";
      setError(errorMessage);
      
      // Try to use cached data even if it's stale rather than showing nothing
      const fallbackData = getLocalSessionData();
      if (fallbackData) {
        console.debug('[SESSION INFO] Using cached data as fallback after API error');
        setSessionData(fallbackData);
        return fallbackData;
      } else {
        setSessionData(null); // Clear data on error to avoid showing stale info
        return null; // Return null on error
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, getLocalSessionData]); // Add getLocalSessionData to dependencies

  // Effect to automatically fetch data when the sessionId becomes available initially
  useEffect(() => {
    // Only fetch if we have a valid sessionId and no data/error yet
    if (sessionId && !sessionData && !error && !isLoading) {
      // First check if we can use cached data from localStorage
      const localData = getLocalSessionData();
      if (localData) {
        console.debug('[SESSION INFO] Using cached data for initial load');
        setSessionData(localData);
      } else {
        // Otherwise fetch from API
        fetchSessionInfo();
      }
    }
  }, [sessionId, sessionData, error, isLoading, fetchSessionInfo, getLocalSessionData]);

  // Return the state variables and the fetch function exposed as 'refresh'
  return {
    sessionData, // Current state value
    isLoading,
    error,
    refresh: fetchSessionInfo, // The function that now returns data
  };
}
