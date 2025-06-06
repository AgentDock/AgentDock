import { useCallback, useEffect, useState } from 'react';

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
  // Add other potential fields returned by the API if needed
}

/**
 * Custom hook to fetch and manage session information.
 *
 * @param sessionId The ID of the session to fetch data for.
 * @returns An object containing session data, loading state, error state, and a refresh function.
 */
export function useSessionInfo(sessionId: string | null | undefined) {
  const [sessionData, setSessionData] = useState<SessionInfoData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches the session information from the API.
   * Returns the fetched data or null if fetch fails or no sessionId.
   */
  const fetchSessionInfo =
    useCallback(async (): Promise<SessionInfoData | null> => {
      // Return data or null
      // Don't attempt to fetch if sessionId is not valid
      if (!sessionId) {
        setSessionData(null); // Clear any stale data
        setError(null); // Clear any stale error
        setIsLoading(false); // Ensure loading is false
        return null; // Return null if no ID
      }

      setIsLoading(true);
      setError(null);
      // Optionally clear previous data on new fetch:
      // setSessionData(null);

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
            console.warn('Could not parse error response JSON:', jsonError);
          }
          throw new Error(errorMsg);
        }

        const data: SessionInfoData = await response.json();

        // Ensure cumulativeTokenUsage exists, providing defaults if not
        if (!data.cumulativeTokenUsage) {
          console.warn(
            'Cumulative usage data not found in session response, setting defaults.'
          );
          data.cumulativeTokenUsage = {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0
          };
        }

        setSessionData(data); // Still update state for other consumers
        setError(null); // Clear error on successful fetch
        return data; // Return the fetched data
      } catch (err) {
        console.error('Failed to fetch session info:', err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'An unknown error occurred while fetching session info.';
        setError(errorMessage);
        setSessionData(null); // Clear data on error to avoid showing stale info
        return null; // Return null on error
      } finally {
        setIsLoading(false);
      }
    }, [sessionId]); // Re-run fetchSessionInfo if sessionId changes

  // Effect to automatically fetch data when the sessionId becomes available initially
  useEffect(() => {
    // Only fetch if we have a valid sessionId and no data/error yet
    if (sessionId && !sessionData && !error && !isLoading) {
      fetchSessionInfo();
    }
    // We only want this effect to run when the sessionId truly changes from invalid to valid,
    // or specifically when we want an initial load based on a newly available ID.
  }, [sessionId, fetchSessionInfo]); // Removed sessionData, error, isLoading from deps

  // Return the state variables and the fetch function exposed as 'refresh'
  return {
    sessionData, // Current state value
    isLoading,
    error,
    refresh: fetchSessionInfo // The function that now returns data
  };
}
