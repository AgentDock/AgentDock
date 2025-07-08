/**
 * Memory-specific error types for the AgentDock memory system
 *
 * @module memory-errors
 */

/**
 * Error codes for memory storage operations
 */
export type MemoryStorageErrorCode =
  | 'STORAGE_NOT_INITIALIZED'
  | 'STORAGE_DISCONNECTED'
  | 'MEMORY_OPS_UNAVAILABLE';

/**
 * Error codes for general memory operations
 */
export type MemoryErrorCode =
  | 'MEMORY_NOT_FOUND'
  | 'SEARCH_ERROR'
  | 'STORAGE_ERROR'
  | 'VALIDATION_ERROR';

/**
 * Error thrown when memory storage operations fail
 *
 * This error is thrown when the storage provider is unavailable,
 * disconnected, or when memory operations cannot be performed.
 *
 * @example
 * ```typescript
 * throw new MemoryStorageError(
 *   'Memory operations not available - storage may be disconnected',
 *   'MEMORY_OPS_UNAVAILABLE'
 * );
 * ```
 */
export class MemoryStorageError extends Error {
  /**
   * Creates a new MemoryStorageError
   *
   * @param message - Human-readable error message
   * @param code - Error code for programmatic handling
   */
  constructor(
    message: string,
    public code: MemoryStorageErrorCode
  ) {
    super(message);
    this.name = 'MemoryStorageError';

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MemoryStorageError);
    }
  }
}

/**
 * Base error class for memory-related errors
 */
export class MemoryError extends Error {
  constructor(
    message: string,
    public code: MemoryErrorCode | MemoryStorageErrorCode,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MemoryError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MemoryError);
    }
  }
}

/**
 * Error thrown when a memory is not found
 */
export class MemoryNotFoundError extends MemoryError {
  constructor(memoryId: string, context?: Record<string, unknown>) {
    super(`Memory not found: ${memoryId}`, 'MEMORY_NOT_FOUND', context);
    this.name = 'MemoryNotFoundError';
  }
}

/**
 * Error thrown when storage operations fail
 */
export class StorageError extends MemoryError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'STORAGE_ERROR', context);
    this.name = 'StorageError';
  }
}
