/**
 * @fileoverview Error handling utilities for Semantic Scholar API
 */

import { LogCategory, logger } from 'agentdock-core';

/**
 * Handle API errors with consistent logging and formatting
 * @param error The error to handle
 * @returns A user-friendly error message
 */
export function handleApiError(error: unknown): string {
  // If the error is a string, return it directly
  if (typeof error === 'string') {
    logger.error(
      LogCategory.NODE,
      '[SemanticScholarAPI]',
      'API Error (string)',
      { error }
    );
    return error;
  }

  // If the error is an Error object, return its message
  if (error instanceof Error) {
    logger.error(
      LogCategory.NODE,
      '[SemanticScholarAPI]',
      'API Error (Error)',
      {
        error: error.message,
        stack: error.stack
      }
    );
    return error.message;
  }

  // If the error is a Response object from fetch
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    'statusText' in error
  ) {
    const response = error as Response;
    const status = response.status;

    // Log the error with appropriate level
    logger.error(
      LogCategory.NODE,
      '[SemanticScholarAPI]',
      'API Error (Response)',
      {
        status,
        statusText: response.statusText
      }
    );

    // Return a user-friendly message based on status code
    if (status === 429) {
      return 'Rate limit exceeded. Please try again later.';
    } else if (status === 401 || status === 403) {
      return 'Authentication error. API key may be invalid or expired.';
    } else if (status === 404) {
      return 'Resource not found. The requested paper or author may not exist.';
    } else if (status >= 500) {
      return 'Semantic Scholar server error. Please try again later.';
    } else {
      return `API request failed with status ${status}`;
    }
  }

  // For any other type of error, convert to string
  const errorString = String(error);
  logger.error(LogCategory.NODE, '[SemanticScholarAPI]', 'Unknown API Error', {
    error: errorString
  });
  return `Unknown error: ${errorString}`;
}
