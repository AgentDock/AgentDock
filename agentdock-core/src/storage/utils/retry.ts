/**
 * Retry utilities for handling transient failures
 */

import { isRetryableError } from './error-handling';
import { RetryOptions } from './types';

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 100,
  maxDelay: 5000,
  factor: 2,
  shouldRetry: isRetryableError
};

/**
 * Exponential backoff with jitter
 */
export function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  factor: number
): number {
  const exponentialDelay = baseDelay * Math.pow(factor, attempt - 1);
  const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5);
  return Math.min(jitteredDelay, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === opts.maxAttempts || !opts.shouldRetry(error, attempt)) {
        throw error;
      }

      const delay = calculateDelay(
        attempt,
        opts.baseDelay,
        opts.maxDelay,
        opts.factor
      );
      await sleep(delay);
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Retry decorator for class methods
 */
export function retryable(options: RetryOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return retry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

/**
 * Circuit breaker for preventing cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000, // 1 minute
    private resetTimeout: number = 30000 // 30 seconds
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed';
    }
    this.failures = 0;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }
}

/**
 * Retry with circuit breaker
 */
export async function retryWithBreaker<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  breaker: CircuitBreaker
): Promise<T> {
  return breaker.execute(() => retry(fn, options));
}

/**
 * Batch retry for multiple operations
 */
export async function batchRetry<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
  const results = await Promise.allSettled(
    operations.map((op) => retry(op, options))
  );

  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return { success: true, result: result.value };
    } else {
      return { success: false, error: result.reason };
    }
  });
}
