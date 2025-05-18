/**
 * @fileoverview Error handling utilities for arXiv API
 */

import { logger, LogCategory } from 'agentdock-core';

/**
 * Handle and format API errors for consistent messaging
 */
export function handleApiError(error: unknown): string {
  // If it's already a string, just return it
  if (typeof error === 'string') {
    logger.error(LogCategory.NODE, '[ArxivAPI]', 'API error', { error });
    return error;
  }

  // If it's an Error object, extract and return the message
  if (error instanceof Error) {
    logger.error(LogCategory.NODE, '[ArxivAPI]', 'API error', {
      error: error.message,
      stack: error.stack,
    });
    return error.message;
  }

  // For fetch errors, try to extract status and statusText
  if (error && typeof error === 'object' && 'status' in error) {
    const fetchError = error as { status: number; statusText?: string; message?: string };

    // Common arXiv API errors
    if (fetchError.status === 429) {
      logger.error(LogCategory.NODE, '[ArxivAPI]', 'Rate limit exceeded', { error: fetchError });
      return 'arXiv API rate limit exceeded. Please try again later.';
    }

    if (fetchError.status === 404) {
      logger.error(LogCategory.NODE, '[ArxivAPI]', 'Resource not found', { error: fetchError });
      return 'The requested resource was not found in arXiv.';
    }

    if (fetchError.status >= 500) {
      logger.error(LogCategory.NODE, '[ArxivAPI]', 'Server error', { error: fetchError });
      return 'arXiv API server error. Please try again later.';
    }

    // Generic error with status information
    const statusText = fetchError.statusText || `HTTP error ${fetchError.status}`;
    const message = fetchError.message || statusText;

    logger.error(LogCategory.NODE, '[ArxivAPI]', 'API error', {
      status: fetchError.status,
      statusText: fetchError.statusText,
      message,
    });

    return `arXiv API error: ${message}`;
  }

  // For XML parsing errors
  if (error && typeof error === 'object' && 'xmlCode' in error) {
    const xmlError = error as { xmlCode: string; message?: string };
    logger.error(LogCategory.NODE, '[ArxivAPI]', 'XML parsing error', { error: xmlError });
    return `Error parsing arXiv response: ${xmlError.message || 'Invalid XML format'}`;
  }

  // For any other type of error
  const errorStr = String(error);
  logger.error(LogCategory.NODE, '[ArxivAPI]', 'Unknown error type', { error: errorStr });
  return `Unknown error: ${errorStr}`;
}
