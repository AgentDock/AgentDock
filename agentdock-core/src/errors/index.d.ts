/**
 * @fileoverview Type declarations for the errors module
 */

export type ErrorCategory = 'node' | 'config' | 'llm' | 'api' | 'storage' | 'generic';

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
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED'
}

export class AgentError extends Error {
  constructor(
    message: string,
    code: ErrorCode,
    details?: Record<string, unknown>,
    httpStatus?: number
  );

  code: ErrorCode;
  details: Record<string, unknown>;
  httpStatus?: number;

  toJSON(): {
    name: string;
    message: string;
    code: ErrorCode;
    details: Record<string, unknown>;
    stack?: string;
  };

  toResponse(): Response;
}

export function createError(
  type: 'node' | 'config' | 'llm' | 'api' | 'storage' | 'generic',
  message: string,
  code: ErrorCode,
  details?: Record<string, unknown>
): AgentError;

export function wrapError(
  category: ErrorCategory | 'node' | 'config' | 'llm' | 'api' | 'storage' | 'generic',
  operation: string,
  error: unknown,
  defaultCode?: ErrorCode,
  details?: Record<string, unknown>
): AgentError; 