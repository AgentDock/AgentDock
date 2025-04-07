/**
 * @fileoverview Core error handling system for AgentDock.
 * Provides structured error handling with error codes and types.
 */

/**
 * Error categories
 */
export type ErrorCategory = 
  | 'node'
  | 'config'
  | 'llm'
  | 'api'
  | 'storage'
  | 'service'  // Added for service provider errors
  | 'generic';

/**
 * Error codes
 */
export enum ErrorCode {
  // Node-related errors
  NODE_INITIALIZATION = 'NODE_INITIALIZATION_ERROR',
  NODE_EXECUTION = 'NODE_EXECUTION_ERROR',
  NODE_CLEANUP = 'NODE_CLEANUP_ERROR',
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  NODE_VALIDATION = 'NODE_VALIDATION_ERROR',
  
  // Configuration errors
  CONFIG_VALIDATION = 'CONFIG_VALIDATION_ERROR',
  CONFIG_LOADING = 'CONFIG_LOADING_ERROR',
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  
  // Message handling errors
  MESSAGE_VALIDATION = 'MESSAGE_VALIDATION_ERROR',
  MESSAGE_PROCESSING = 'MESSAGE_PROCESSING_ERROR',
  MESSAGE_STREAMING = 'MESSAGE_STREAMING_ERROR',
  
  // API errors
  API_REQUEST = 'API_REQUEST_ERROR',
  API_RESPONSE = 'API_RESPONSE_ERROR',
  API_VALIDATION = 'API_VALIDATION_ERROR',
  
  // LLM-related errors
  LLM_API_KEY = 'LLM_API_KEY_ERROR',
  LLM_REQUEST = 'LLM_REQUEST_ERROR',
  LLM_RESPONSE = 'LLM_RESPONSE_ERROR',
  LLM_RATE_LIMIT = 'LLM_RATE_LIMIT_ERROR',
  LLM_EXECUTION = 'LLM_EXECUTION_ERROR',
  LLM_SERVICE_KEY_FETCH = 'LLM_SERVICE_KEY_FETCH_ERROR',
  LLM_SERVICE_KEY_INVALID = 'LLM_SERVICE_KEY_INVALID_ERROR',
  
  // Storage errors
  STORAGE_READ = 'STORAGE_READ_ERROR',
  STORAGE_WRITE = 'STORAGE_WRITE_ERROR',
  STORAGE_DELETE = 'STORAGE_DELETE_ERROR',
  
  // Security errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  TAMPERING_DETECTED = 'TAMPERING_DETECTED',
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
  
  // Generic errors
  UNKNOWN = 'UNKNOWN_ERROR',
  INTERNAL = 'INTERNAL_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  
  // Service errors
  SERVICE_KEY_MISSING = 'SERVICE_KEY_MISSING',
  SERVICE_KEY_INVALID = 'SERVICE_KEY_INVALID',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  SERVICE_RATE_LIMIT = 'SERVICE_RATE_LIMIT'
}

/**
 * Base error class for AgentDock errors
 */
export class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly details: Record<string, unknown> = {},
    public readonly httpStatus: number = 500
  ) {
    super(message);
    this.name = 'AgentError';
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
    };
  }

  /**
   * Convert error to HTTP response
   */
  toResponse() {
    return new Response(
      JSON.stringify(this.toJSON()),
      {
        status: this.httpStatus,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export class APIError extends AgentError {
  constructor(
    message: string,
    code: ErrorCode,
    public readonly path: string,
    public readonly method: string,
    details: Record<string, unknown> = {},
    httpStatus: number = 500
  ) {
    super(message, code, {
      path,
      method,
      ...details
    }, httpStatus);
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * Create an error instance with category and code
 */
export function createError(
  category: ErrorCategory | 'node' | 'config' | 'llm' | 'api' | 'storage' | 'generic',
  message: string,
  code: ErrorCode,
  details: Record<string, unknown> = {},
  httpStatus: number = 500
): AgentError {
  // Handle API errors
  if (category === 'api' && 'path' in details && 'method' in details) {
    return new APIError(
      message,
      code,
      details.path as string,
      details.method as string,
      details,
      httpStatus
    );
  }

  // Handle all other errors
  return new AgentError(message, code, {
    category,
    ...details
  }, httpStatus);
}

/**
 * Wrap an error with consistent formatting and logging
 */
export function wrapError(
  category: ErrorCategory | 'node' | 'config' | 'llm' | 'api' | 'storage' | 'generic',
  operation: string,
  error: unknown,
  defaultCode: ErrorCode = ErrorCode.INTERNAL,
  details: Record<string, unknown> = {}
): AgentError {
  // If it's already our error type, just return it
  if (error instanceof AgentError) {
    return error;
  }

  // Create a standardized error message
  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  
  // Create error with consistent format
  return createError(
    category,
    `${operation}: ${message}`,
    defaultCode,
    {
      ...details,
      originalError: error
    }
  );
}

// Note: LLM error utilities are imported in the main index.ts file to avoid circular dependencies 