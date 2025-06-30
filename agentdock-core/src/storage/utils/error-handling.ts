/**
 * Error handling utilities for storage adapters
 */

/**
 * Consistent storage error class for all adapters
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public adapter?: string,
    public operation?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'StorageError';
  }

  /**
   * Create a storage error with full context
   */
  static create(params: {
    message: string;
    code: string;
    adapter: string;
    operation: string;
    cause?: Error;
  }): StorageError {
    return new StorageError(
      params.message,
      params.code,
      params.adapter,
      params.operation,
      params.cause
    );
  }
}

/**
 * Specific error types
 */
export class ConnectionError extends StorageError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONNECTION_ERROR', undefined, undefined, cause);
    this.name = 'ConnectionError';
  }
}

export class TimeoutError extends StorageError {
  constructor(message: string, cause?: Error) {
    super(message, 'TIMEOUT_ERROR', undefined, undefined, cause);
    this.name = 'TimeoutError';
  }
}

export class ValidationError extends StorageError {
  constructor(message: string, cause?: Error) {
    super(message, 'VALIDATION_ERROR', undefined, undefined, cause);
    this.name = 'ValidationError';
  }
}

export class SerializationError extends StorageError {
  constructor(message: string, cause?: Error) {
    super(message, 'SERIALIZATION_ERROR', undefined, undefined, cause);
    this.name = 'SerializationError';
  }
}

export class NotFoundError extends StorageError {
  constructor(message: string, cause?: Error) {
    super(message, 'NOT_FOUND', undefined, undefined, cause);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends StorageError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFLICT', undefined, undefined, cause);
    this.name = 'ConflictError';
  }
}

export class QuotaExceededError extends StorageError {
  constructor(message: string, cause?: Error) {
    super(message, 'QUOTA_EXCEEDED', undefined, undefined, cause);
    this.name = 'QuotaExceededError';
  }
}

/**
 * Error code mapping for different storage backends
 */
export const ERROR_CODES = {
  // SQLite errors
  SQLITE_BUSY: 'SQLITE_BUSY',
  SQLITE_LOCKED: 'SQLITE_LOCKED',
  SQLITE_READONLY: 'SQLITE_READONLY',
  SQLITE_IOERR: 'SQLITE_IOERR',
  SQLITE_CORRUPT: 'SQLITE_CORRUPT',
  SQLITE_FULL: 'SQLITE_FULL',

  // PostgreSQL errors
  PG_CONNECTION_REFUSED: '08001',
  PG_UNIQUE_VIOLATION: '23505',
  PG_DEADLOCK_DETECTED: '40P01',
  PG_LOCK_NOT_AVAILABLE: '55P03',
  PG_INSUFFICIENT_RESOURCES: '53000',

  // Redis errors
  REDIS_CONNECTION_TIMEOUT: 'ETIMEDOUT',
  REDIS_CONNECTION_REFUSED: 'ECONNREFUSED',
  REDIS_NO_AUTH: 'NOAUTH',
  REDIS_COMMAND_TIMEOUT: 'COMMAND_TIMEOUT'
} as const;

/**
 * Error mapper for converting backend-specific errors to storage errors
 */
export class ErrorMapper {
  /**
   * Map SQLite errors to storage errors
   */
  static mapSQLiteError(error: any): StorageError {
    const code = error.code || error.errno;
    const message = error.message || 'SQLite error';

    switch (code) {
      case ERROR_CODES.SQLITE_BUSY:
      case ERROR_CODES.SQLITE_LOCKED:
        return new ConflictError(`Database locked: ${message}`, error);

      case ERROR_CODES.SQLITE_READONLY:
        return new StorageError(
          'Database is read-only',
          'READ_ONLY',
          undefined,
          undefined,
          error
        );

      case ERROR_CODES.SQLITE_IOERR:
        return new StorageError(
          'I/O error',
          'IO_ERROR',
          undefined,
          undefined,
          error
        );

      case ERROR_CODES.SQLITE_CORRUPT:
        return new StorageError(
          'Database corrupted',
          'CORRUPTED',
          undefined,
          undefined,
          error
        );

      case ERROR_CODES.SQLITE_FULL:
        return new QuotaExceededError('Database full', error);

      default:
        return new StorageError(
          message,
          'SQLITE_ERROR',
          undefined,
          undefined,
          error
        );
    }
  }

  /**
   * Map PostgreSQL errors to storage errors
   */
  static mapPostgreSQLError(error: any): StorageError {
    const code = error.code;
    const message = error.message || 'PostgreSQL error';

    switch (code) {
      case ERROR_CODES.PG_CONNECTION_REFUSED:
        return new ConnectionError(`Connection refused: ${message}`, error);

      case ERROR_CODES.PG_UNIQUE_VIOLATION:
        return new ConflictError(
          `Unique constraint violation: ${message}`,
          error
        );

      case ERROR_CODES.PG_DEADLOCK_DETECTED:
        return new ConflictError(`Deadlock detected: ${message}`, error);

      case ERROR_CODES.PG_LOCK_NOT_AVAILABLE:
        return new TimeoutError(`Lock timeout: ${message}`, error);

      case ERROR_CODES.PG_INSUFFICIENT_RESOURCES:
        return new StorageError(
          'Insufficient resources',
          'RESOURCE_ERROR',
          undefined,
          undefined,
          error
        );

      default:
        return new StorageError(
          message,
          'PG_ERROR',
          undefined,
          undefined,
          error
        );
    }
  }

  /**
   * Map Redis errors to storage errors
   */
  static mapRedisError(error: any): StorageError {
    const code = error.code || error.name;
    const message = error.message || 'Redis error';

    if (
      code === ERROR_CODES.REDIS_CONNECTION_TIMEOUT ||
      code === ERROR_CODES.REDIS_CONNECTION_REFUSED
    ) {
      return new ConnectionError(`Connection error: ${message}`, error);
    }

    if (code === ERROR_CODES.REDIS_NO_AUTH) {
      return new StorageError(
        'Authentication required',
        'AUTH_ERROR',
        undefined,
        undefined,
        error
      );
    }

    if (code === ERROR_CODES.REDIS_COMMAND_TIMEOUT) {
      return new TimeoutError(`Command timeout: ${message}`, error);
    }

    return new StorageError(
      message,
      'REDIS_ERROR',
      undefined,
      undefined,
      error
    );
  }

  /**
   * Generic error mapper
   */
  static mapError(
    error: any,
    backend: 'sqlite' | 'postgresql' | 'redis' | 'generic' = 'generic'
  ): StorageError {
    // Already a StorageError
    if (error instanceof StorageError) {
      return error;
    }

    switch (backend) {
      case 'sqlite':
        return this.mapSQLiteError(error);
      case 'postgresql':
        return this.mapPostgreSQLError(error);
      case 'redis':
        return this.mapRedisError(error);
      default:
        return new StorageError(
          error.message || 'Unknown error',
          'UNKNOWN_ERROR',
          undefined,
          undefined,
          error
        );
    }
  }
}

/**
 * Error handler decorator for async methods
 */
export function handleStorageError(
  backend: 'sqlite' | 'postgresql' | 'redis' | 'generic' = 'generic'
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        throw ErrorMapper.mapError(error, backend);
      }
    };

    return descriptor;
  };
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof StorageError) {
    // Retryable error codes
    const retryableCodes = [
      'CONNECTION_ERROR',
      'TIMEOUT_ERROR',
      'CONFLICT',
      'IO_ERROR',
      'RESOURCE_ERROR'
    ];
    return retryableCodes.includes(error.code);
  }

  // Check for common retryable error patterns
  const message = error.message.toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('temporary') ||
    message.includes('lock') ||
    message.includes('busy')
  );
}
