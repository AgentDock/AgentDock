/**
 * @fileoverview Core utilities for Snowtrace API client
 */

/**
 * Base API URL for Snowtrace
 */
export const BASE_URL = 'https://api.snowtrace.io/api';

/**
 * Common response interface for Snowtrace API
 */
export interface SnowtraceResponse<T> {
  status: string;
  message: string;
  result: T;
}

/**
 * Error response from Snowtrace API
 */
export interface SnowtraceErrorResponse {
  status: string;
  message: string;
  result: string;
}

/**
 * Check if response is an error response
 * @param data Response data from Snowtrace API
 * @returns Boolean indicating if response is an error
 */
export function isErrorResponse(data: any): data is SnowtraceErrorResponse {
  return data && typeof data.status === 'string' && data.status === '0';
}

/**
 * Sanitize error messages to remove sensitive information like API keys
 * @param message Error message that might contain sensitive information
 * @returns Sanitized error message
 */
export function sanitizeErrorMessage(message: string): string {
  // Remove API keys (alphanumeric strings of 16+ characters)
  return message.replace(/[A-Za-z0-9]{16,}/g, '[API_KEY_REDACTED]');
}

/**
 * Make a request to the Snowtrace API
 * @param module API module to use
 * @param action API action to perform
 * @param params Additional parameters for the request
 * @param apiKey Snowtrace API key (optional, uses environment variable if not provided)
 * @returns Promise with the API response
 */
export async function makeRequest<T>(
  module: string,
  action: string,
  params: Record<string, string> = {},
  apiKey?: string
): Promise<T> {
  // Use provided API key or fall back to environment variable
  const key = apiKey || process.env.SNOWTRACE_API_KEY || 'YourApiKeyToken';

  // Build query parameters
  const queryParams = new URLSearchParams({
    module,
    action,
    apikey: key,
    ...params
  });

  // Build API URL
  const url = `${BASE_URL}?${queryParams.toString()}`;

  try {
    // Fetch data from API
    const response = await fetch(url);

    // Check if response is OK
    if (!response.ok) {
      throw new Error(
        `Snowtrace API error: ${response.status} ${response.statusText}`
      );
    }

    // Parse response as JSON
    const data = await response.json();

    // Check for API error responses
    if (isErrorResponse(data)) {
      throw new Error(
        `API error: ${sanitizeErrorMessage(data.message || 'Unknown error')}`
      );
    }

    return data as T;
  } catch (error) {
    // Handle fetch errors
    if (error instanceof Error) {
      throw new Error(
        `Failed to fetch data from Snowtrace: ${sanitizeErrorMessage(error.message)}`
      );
    }
    throw new Error('Failed to fetch data from Snowtrace: Unknown error');
  }
}
