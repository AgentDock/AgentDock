/**
 * @fileoverview Error handling utilities for OpenAlex API
 */

import { logger, LogCategory } from 'agentdock-core';

/**
 * Handle and format API errors for consistent messaging
 */
export function handleApiError(error: unknown): string {
  // If it's already a string, just return it
  if (typeof error === 'string') {
    logger.error(LogCategory.NODE, '[OpenAlexAPI]', 'API error', { error });
    return error;
  }

  // If it's an Error object, extract and return the message
  if (error instanceof Error) {
    logger.error(LogCategory.NODE, '[OpenAlexAPI]', 'API error', {
      error: error.message,
      stack: error.stack,
    });
    return error.message;
  }

  // For fetch errors, try to extract status and statusText
  if (error && typeof error === 'object' && 'status' in error) {
    const fetchError = error as { status: number; statusText?: string; message?: string };

    // Common OpenAlex API errors
    if (fetchError.status === 429) {
      logger.error(LogCategory.NODE, '[OpenAlexAPI]', 'Rate limit exceeded', { error: fetchError });
      return 'OpenAlex API rate limit exceeded. Please try again later.';
    }

    if (fetchError.status === 404) {
      logger.error(LogCategory.NODE, '[OpenAlexAPI]', 'Resource not found', { error: fetchError });
      return 'The requested resource was not found in OpenAlex.';
    }

    if (fetchError.status >= 500) {
      logger.error(LogCategory.NODE, '[OpenAlexAPI]', 'Server error', { error: fetchError });
      return 'OpenAlex API server error. Please try again later.';
    }

    // Generic error with status information
    const statusText = fetchError.statusText || `HTTP error ${fetchError.status}`;
    const message = fetchError.message || statusText;

    logger.error(LogCategory.NODE, '[OpenAlexAPI]', 'API error', {
      status: fetchError.status,
      statusText: fetchError.statusText,
      message,
    });

    return `OpenAlex API error: ${message}`;
  }

  // For any other type of error
  const errorStr = String(error);
  logger.error(LogCategory.NODE, '[OpenAlexAPI]', 'Unknown error type', { error: errorStr });
  return `Unknown error: ${errorStr}`;
}
