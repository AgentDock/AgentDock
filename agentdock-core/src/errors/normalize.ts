/**
 * @fileoverview Error normalization utilities
 * Ensures all errors are properly formatted for streaming responses
 */

import { ErrorCode } from './index';

/**
 * Error response format expected by Vercel AI SDK
 */
export interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, any>;
}

/**
 * Normalizes any error into a properly formatted error response object
 * Ensures that error messages are always strings as required by Vercel AI SDK
 */
export function normalizeError(error: unknown): ErrorResponse {
  let errorMessage = 'An unknown error occurred';
  let errorCode: string = ErrorCode.UNKNOWN;
  let errorDetails: Record<string, any> = {};

  // Handle different error types
  if (error instanceof Error) {
    errorMessage = error.message;

    // Handle our custom error types
    if ('code' in error && typeof error.code === 'string') {
      errorCode = error.code;
    }

    // Extract additional details if available
    if ('details' in error && typeof error.details === 'object') {
      errorDetails = error.details as Record<string, any>;
    }
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object') {
    // Handle plain object errors
    if ('message' in error && error.message) {
      errorMessage = String(error.message);
    }

    if ('code' in error && error.code) {
      errorCode = String(error.code);
    }

    // Extract any details
    if ('details' in error) {
      errorDetails = { ...((error.details as Record<string, any>) || {}) };
    }

    // Extract from nested error objects (like Axios errors)
    if ('response' in error && error.response) {
      const response = (error as any).response;

      if (response.data?.error?.message) {
        errorMessage = String(response.data.error.message);
      }

      if (response.data?.error?.type) {
        errorDetails.errorType = String(response.data.error.type);
      }

      errorDetails.status = response.status;
    }
  }

  // Map specific errors to user-friendly messages
  if (errorCode === ErrorCode.LLM_API_KEY) {
    if (
      errorMessage.includes('BYOK') ||
      errorMessage.toLowerCase().includes('bring your own')
    ) {
      errorMessage =
        'API key required. In BYOK mode, you must provide your own API key.';
    } else {
      errorMessage = 'API key required. Please add your API key in settings.';
    }
  } else if (errorCode === ErrorCode.LLM_RATE_LIMIT) {
    errorMessage = 'Rate limit exceeded. Please try again later.';
  } else if (errorCode === ErrorCode.SERVICE_UNAVAILABLE) {
    errorMessage = 'Service currently unavailable. Please try again later.';
  } else if (errorCode === ErrorCode.LLM_OVERLOADED) {
    errorMessage =
      'The AI model is currently overloaded. Please try again shortly.';
  }

  // Always ensure the error is a string to prevent "error parts expect a string value"
  return {
    error: String(errorMessage),
    code: String(errorCode),
    details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
  };
}
