/**
 * @fileoverview LLM-specific error handling utilities
 * Provides standardized error patterns for different LLM providers
 */

import { AgentError, createError } from './index';
import { LLMProvider } from '../llm/types';
import { logger, LogCategory } from '../logging';

/**
 * Error codes used in this module
 * These must match the ErrorCode enum values in index.ts
 */
const ErrorCodes = {
  LLM_RATE_LIMIT: 'LLM_RATE_LIMIT_ERROR',
  LLM_EXECUTION: 'LLM_EXECUTION_ERROR',
  LLM_API_KEY: 'LLM_API_KEY_ERROR',
  LLM_OVERLOADED: 'LLM_OVERLOADED_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  UNKNOWN: 'UNKNOWN_ERROR',
};

/**
 * Interface for mapping provider-specific error patterns to standardized error codes
 */
interface ProviderErrorPattern {
  pattern: RegExp | string;
  errorCode: string;
  statusCode?: number;
  userMessage?: string;
}

/**
 * Map of provider-specific error patterns
 * Each provider has a map of patterns that identify specific error types
 */
const ERROR_PATTERNS: Record<LLMProvider | 'byok', ProviderErrorPattern[]> = {
  // Anthropic error patterns
  anthropic: [
    {
      pattern: /rate\s*limit|would\s*exceed\s*the\s*rate\s*limit/i,
      errorCode: ErrorCodes.LLM_RATE_LIMIT,
      statusCode: 429,
      userMessage: "You've reached the rate limit for Anthropic API. Please try again later.",
    },
    {
      pattern: 'Overloaded',
      errorCode: ErrorCodes.LLM_OVERLOADED,
      statusCode: 529,
      userMessage: 'Anthropic service is temporarily overloaded. Please try again shortly.',
    },
    {
      pattern: /context\s*window|token\s*limit/i,
      errorCode: ErrorCodes.LLM_EXECUTION,
      statusCode: 400,
      userMessage:
        "The prompt exceeds Anthropic's maximum context length. Please reduce your input.",
    },
    {
      pattern: /invalid\s*api\s*key|api\s*key\s*invalid|authentication/i,
      errorCode: ErrorCodes.LLM_API_KEY,
      statusCode: 401,
      userMessage: 'Invalid Anthropic API key. Please check your credentials.',
    },
    {
      pattern: /service\s*unavailable|server\s*error|5\d\d/i,
      errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
      statusCode: 503,
      userMessage: 'Anthropic service is currently unavailable. Please try again later.',
    },
  ],

  // OpenAI error patterns
  openai: [
    {
      pattern: /rate\s*limit/i,
      errorCode: ErrorCodes.LLM_RATE_LIMIT,
      statusCode: 429,
      userMessage: "You've reached the rate limit for OpenAI API. Please try again later.",
    },
    {
      pattern: /context\s*length|maximum\s*context\s*length|token\s*limit/i,
      errorCode: ErrorCodes.LLM_EXECUTION,
      statusCode: 400,
      userMessage: "The prompt exceeds OpenAI's maximum context length. Please reduce your input.",
    },
    {
      pattern: /invalid\s*api\s*key|api\s*key\s*invalid|authentication/i,
      errorCode: ErrorCodes.LLM_API_KEY,
      statusCode: 401,
      userMessage: 'Invalid OpenAI API key. Please check your credentials.',
    },
    {
      pattern: /service\s*unavailable|server\s*error|5\d\d/i,
      errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
      statusCode: 503,
      userMessage: 'OpenAI service is currently unavailable. Please try again later.',
    },
  ],

  // Google (Gemini) error patterns
  gemini: [
    {
      pattern: /rate\s*limit/i,
      errorCode: ErrorCodes.LLM_RATE_LIMIT,
      statusCode: 429,
      userMessage: "You've reached the rate limit for Google Gemini API. Please try again later.",
    },
    {
      pattern: /content\s*filter|blocked\s*content/i,
      errorCode: ErrorCodes.LLM_EXECUTION,
      statusCode: 400,
      userMessage: "Your request was blocked by Google's content filter. Please modify your input.",
    },
    {
      pattern: /invalid\s*api\s*key|api\s*key\s*invalid|authentication/i,
      errorCode: ErrorCodes.LLM_API_KEY,
      statusCode: 401,
      userMessage: 'Invalid Google API key. Please check your credentials.',
    },
    {
      pattern: /service\s*unavailable|server\s*error|5\d\d/i,
      errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
      statusCode: 503,
      userMessage: 'Google Gemini service is currently unavailable. Please try again later.',
    },
  ],

  // DeepSeek error patterns
  deepseek: [
    {
      pattern: /rate\s*limit/i,
      errorCode: ErrorCodes.LLM_RATE_LIMIT,
      statusCode: 429,
      userMessage: "You've reached the rate limit for DeepSeek API. Please try again later.",
    },
    {
      pattern: /context\s*length|maximum\s*context\s*length|token\s*limit/i,
      errorCode: ErrorCodes.LLM_EXECUTION,
      statusCode: 400,
      userMessage:
        "The prompt exceeds DeepSeek's maximum context length. Please reduce your input.",
    },
    {
      pattern: /invalid\s*api\s*key|api\s*key\s*invalid|authentication/i,
      errorCode: ErrorCodes.LLM_API_KEY,
      statusCode: 401,
      userMessage: 'Invalid DeepSeek API key. Please check your credentials.',
    },
  ],

  // Groq error patterns
  groq: [
    {
      pattern: /rate\s*limit/i,
      errorCode: ErrorCodes.LLM_RATE_LIMIT,
      statusCode: 429,
      userMessage: "You've reached the rate limit for Groq API. Please try again later.",
    },
    {
      pattern: /context\s*length|maximum\s*context\s*length|token\s*limit/i,
      errorCode: ErrorCodes.LLM_EXECUTION,
      statusCode: 400,
      userMessage: "The prompt exceeds Groq's maximum context length. Please reduce your input.",
    },
    {
      pattern: /invalid\s*api\s*key|api\s*key\s*invalid|authentication/i,
      errorCode: ErrorCodes.LLM_API_KEY,
      statusCode: 401,
      userMessage: 'Invalid Groq API key. Please check your credentials.',
    },
  ],

  // BYOK mode error patterns
  byok: [
    {
      pattern: /api\s*key\s*required|no\s*api\s*key/i,
      errorCode: ErrorCodes.LLM_API_KEY,
      statusCode: 401,
      userMessage: 'API key required. In BYOK mode, you must provide your own API key.',
    },
  ],
};

/**
 * Parse provider-specific errors and convert them to standardized AgentError objects
 * @param error The original error from the provider
 * @param provider The LLM provider (anthropic, openai, etc.)
 * @param isByokMode Whether the system is in BYOK mode (bring your own key)
 * @returns An AgentError with standardized error code and message
 */
export function parseProviderError(
  error: unknown,
  provider: LLMProvider,
  isByokMode: boolean = false,
): AgentError {
  // === START DEBUG LOGGING ===
  logger.debug(LogCategory.LLM, 'parseProviderError', 'Raw error object received', {
    rawError: JSON.stringify(error, Object.getOwnPropertyNames(error)), // Log all properties
    errorType: typeof error,
    isErrorInstance: error instanceof Error,
  });
  // === END DEBUG LOGGING ===

  // Get error message as string - REVISED EXTRACTION LOGIC
  let errorMessage = 'Unknown error';
  let parsedErrorObj: any = null;

  try {
    if (error instanceof Error) {
      errorMessage = error.message;
      parsedErrorObj = error; // Keep the original error object
    } else if (typeof error === 'string') {
      // Try to parse if it looks like JSON
      if (error.trim().startsWith('{') && error.trim().endsWith('}')) {
        try {
          parsedErrorObj = JSON.parse(error);
          if (parsedErrorObj && typeof parsedErrorObj === 'object' && parsedErrorObj.message) {
            errorMessage = String(parsedErrorObj.message);
          } else {
            errorMessage = error; // Fallback to original string if parse/extraction fails
          }
        } catch (e) {
          errorMessage = error; // Fallback if JSON parsing fails
        }
      } else {
        errorMessage = error; // It's just a plain string
        parsedErrorObj = { message: error };
      }
    } else if (error && typeof error === 'object') {
      // Handle plain objects or nested errors
      parsedErrorObj = error;
      // Check if message property exists and is string-like before accessing
      if (
        'message' in error &&
        typeof (error as any).message === 'string' &&
        (error as any).message
      ) {
        errorMessage = String((error as any).message);
      } else if ('error' in error && error.error) {
        // Handle cases where error is nested like { error: { message: ... } } or { error: "..." }
        const nestedError = error.error;
        // Check if nested message exists and is string-like
        if (
          nestedError &&
          typeof nestedError === 'object' &&
          'message' in nestedError &&
          typeof (nestedError as any).message === 'string' &&
          (nestedError as any).message
        ) {
          errorMessage = String((nestedError as any).message);
        } else if (typeof nestedError === 'string') {
          errorMessage = nestedError;
        } else {
          errorMessage = JSON.stringify(error); // Fallback for complex objects
        }
      } else if ('response' in error && error.response) {
        // Axios-like errors
        const response = (error as any).response;
        if (response.data?.error?.message) {
          errorMessage = String(response.data.error.message);
        } else if (response.data?.error) {
          errorMessage = String(response.data.error);
        } else if (response.data) {
          errorMessage =
            typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        } else {
          errorMessage = `HTTP Error ${response.status}`;
        }
      } else {
        errorMessage = JSON.stringify(error); // Fallback stringify
      }
    }
  } catch (extractionError) {
    // Fallback in case the extraction logic itself throws an error
    errorMessage = 'Failed to process error details.';
    logger.warn(LogCategory.LLM, 'parseProviderError', 'Error during error message extraction', {
      extractionError,
    });
  }

  // Handle missing API key in BYOK mode first
  if (isByokMode && /no\s*api\s*key|api\s*key\s*required|api\s*key\s*missing/i.test(errorMessage)) {
    const byokPatterns = ERROR_PATTERNS.byok;
    const matchingPattern = byokPatterns.find((pattern) =>
      pattern.pattern instanceof RegExp
        ? pattern.pattern.test(errorMessage)
        : errorMessage.includes(pattern.pattern),
    );

    if (matchingPattern) {
      return createError(
        'llm',
        matchingPattern.userMessage || 'API key required in BYOK mode',
        matchingPattern.errorCode as any,
        { provider, originalError: error },
        matchingPattern.statusCode || 401,
      );
    }
  }

  // Check provider-specific patterns
  const providerPatterns = ERROR_PATTERNS[provider] || [];

  // Trim the errorMessage before matching to handle potential hidden whitespace/characters
  const trimmedErrorMessage = errorMessage.trim();

  const matchingPattern = providerPatterns.find((pattern) =>
    pattern.pattern instanceof RegExp
      ? pattern.pattern.test(trimmedErrorMessage)
      : trimmedErrorMessage.includes(pattern.pattern),
  );

  // Log the error for debugging
  logger.debug(LogCategory.LLM, 'parseProviderError', 'Parsing provider error', {
    provider,
    originalErrorMessage: errorMessage,
    trimmedErrorMessage: trimmedErrorMessage,
    matchedPattern: matchingPattern?.pattern.toString() || 'none',
  });

  // Return structured error
  if (matchingPattern) {
    return createError(
      'llm',
      matchingPattern.userMessage || errorMessage,
      matchingPattern.errorCode as any,
      { provider, originalError: error },
      matchingPattern.statusCode || 500,
    );
  }

  // Default case - unknown LLM error
  return createError(
    'llm',
    `Error from ${provider}: ${errorMessage}`,
    ErrorCodes.LLM_EXECUTION as any,
    { provider, originalError: error },
    500,
  );
}

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
  let errorCode: string = ErrorCodes.UNKNOWN;
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
    if ('response' in error && (error as any).response) {
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
  if (errorCode === ErrorCodes.LLM_API_KEY) {
    if (errorMessage.includes('BYOK') || errorMessage.toLowerCase().includes('bring your own')) {
      errorMessage = 'API key required. In BYOK mode, you must provide your own API key.';
    } else {
      errorMessage = 'API key required. Please add your API key in settings.';
    }
  } else if (errorCode === ErrorCodes.LLM_RATE_LIMIT) {
    errorMessage = 'Rate limit exceeded. Please try again later.';
  } else if (errorCode === ErrorCodes.SERVICE_UNAVAILABLE) {
    errorMessage = 'Service currently unavailable. Please try again later.';
  }

  // Always ensure the error is a string to prevent "error parts expect a string value"
  return {
    error: String(errorMessage),
    code: String(errorCode),
    details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
  };
}
