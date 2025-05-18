/**
 * @fileoverview Error normalization utilities
 * Ensures all errors are properly formatted for streaming responses
 */

import { ErrorCode } from 'agentdock-core';

/**
 * Error response format expected by Vercel AI SDK
 */
export interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, any>;
}

/**
 * Enhanced StreamTextResult interface from agentdock-core
 * This allows direct access to streaming error flags
 */
export interface StreamTextResultWithError {
  /** Flag indicating if there was an error during streaming */
  _hasStreamingError?: boolean;
  /** Error message if there was a streaming error */
  _streamingErrorMessage?: string;
  /** Error code if available */
  _streamingErrorCode?: string;
}

/**
 * Normalizes any error into a properly formatted error response object
 * Ensures that error messages are always strings as required by Vercel AI SDK
 */
export function normalizeError(error: unknown): ErrorResponse {
  let errorMessage = 'An unknown error occurred';
  let errorCode: string = ErrorCode.UNKNOWN || 'UNKNOWN_ERROR';
  let errorDetails: Record<string, any> = {};

  // Handle streaming errors directly from agentdock-core
  if (error && typeof error === 'object' && '_hasStreamingError' in error) {
    const streamingError = error as StreamTextResultWithError;
    if (streamingError._hasStreamingError && streamingError._streamingErrorMessage) {
      return {
        error: String(streamingError._streamingErrorMessage),
        code: streamingError._streamingErrorCode || 'LLM_EXECUTION_ERROR',
        details: process.env.NODE_ENV === 'development' ? { streaming: true } : undefined,
      };
    }
  }

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
  if (errorCode === (ErrorCode.LLM_API_KEY || 'LLM_API_KEY_ERROR')) {
    if (errorMessage.includes('BYOK') || errorMessage.toLowerCase().includes('bring your own')) {
      errorMessage = 'API key required. In BYOK mode, you must provide your own API key.';
    } else {
      errorMessage = 'API key required. Please add your API key in settings.';
    }
  } else if (errorCode === (ErrorCode.LLM_RATE_LIMIT || 'LLM_RATE_LIMIT_ERROR')) {
    errorMessage = 'Rate limit exceeded. Please try again later.';
  } else if (errorCode === (ErrorCode.LLM_EXECUTION || 'LLM_EXECUTION_ERROR')) {
    // Keep original message for LLM execution errors as they can be varied
    errorMessage = errorMessage || 'Error executing LLM request. Please try again.';
  } else if (errorCode === (ErrorCode.SERVICE_UNAVAILABLE || 'SERVICE_UNAVAILABLE')) {
    errorMessage = 'Service currently unavailable. Please try again later.';
  }

  // Always ensure the error is a string to prevent "error parts expect a string value"
  return {
    error: String(errorMessage),
    code: String(errorCode),
    details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
  };
}

/**
 * Check if a streaming response contains an error
 * This is used to detect errors directly from the result object
 */
export function hasStreamingError(result: unknown): boolean {
  if (result && typeof result === 'object' && '_hasStreamingError' in result) {
    return !!(result as StreamTextResultWithError)._hasStreamingError;
  }
  return false;
}

/**
 * Get streaming error message if present
 */
export function getStreamingErrorMessage(result: unknown): string | null {
  if (result && typeof result === 'object' && '_hasStreamingError' in result) {
    const streamingError = result as StreamTextResultWithError;
    if (streamingError._hasStreamingError && streamingError._streamingErrorMessage) {
      return streamingError._streamingErrorMessage;
    }
  }
  return null;
}
