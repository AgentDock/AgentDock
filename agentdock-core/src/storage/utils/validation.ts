/**
 * Validation utilities for storage operations
 */

import { ValidationError } from './error-handling';

/**
 * Validate key format
 */
export function validateKey(
  key: string,
  options?: {
    maxLength?: number;
    minLength?: number;
    pattern?: RegExp;
  }
): void {
  if (!key || typeof key !== 'string') {
    throw new ValidationError('Key must be a non-empty string');
  }

  const { maxLength = 255, minLength = 1, pattern } = options || {};

  if (key.length < minLength) {
    throw new ValidationError(`Key must be at least ${minLength} characters`);
  }

  if (key.length > maxLength) {
    throw new ValidationError(`Key cannot exceed ${maxLength} characters`);
  }

  if (pattern && !pattern.test(key)) {
    throw new ValidationError(
      `Key does not match required pattern: ${pattern}`
    );
  }
}

/**
 * Validate value for storage
 */
export function validateValue(
  value: any,
  options?: {
    maxSize?: number;
    allowNull?: boolean;
    allowUndefined?: boolean;
    allowFunctions?: boolean;
  }
): void {
  const {
    maxSize = 1048576, // 1MB default
    allowNull = false,
    allowUndefined = false,
    allowFunctions = false
  } = options || {};

  if (value === null && !allowNull) {
    throw new ValidationError('Null values are not allowed');
  }

  if (value === undefined && !allowUndefined) {
    throw new ValidationError('Undefined values are not allowed');
  }

  if (typeof value === 'function' && !allowFunctions) {
    throw new ValidationError('Function values are not allowed');
  }

  // Estimate size for objects
  if (typeof value === 'object' && value !== null) {
    const size = estimateObjectSize(value);
    if (size > maxSize) {
      throw new ValidationError(
        `Value size (${size} bytes) exceeds maximum allowed (${maxSize} bytes)`
      );
    }
  }
}

/**
 * Estimate the size of an object in bytes
 */
export function estimateObjectSize(obj: any): number {
  try {
    const str = JSON.stringify(obj);
    return new Blob([str]).size;
  } catch {
    // Fallback for circular references or non-serializable objects
    return roughSizeOfObject(obj);
  }
}

/**
 * Batch validation wrapper
 */
export function validateBatch<T>(
  items: T[],
  validator: (item: T) => void,
  options?: {
    stopOnFirst?: boolean;
    maxErrors?: number;
  }
): Array<{ index: number; error: Error }> {
  const { stopOnFirst = false, maxErrors = 100 } = options || {};
  const errors: Array<{ index: number; error: Error }> = [];

  for (let i = 0; i < items.length; i++) {
    try {
      validator(items[i]);
    } catch (error) {
      errors.push({ index: i, error: error as Error });

      if (stopOnFirst || errors.length >= maxErrors) {
        break;
      }
    }
  }

  return errors;
}

/**
 * Rough size calculation for objects
 */
function roughSizeOfObject(obj: any): number {
  const objectList: any[] = [];
  const stack = [obj];
  let bytes = 0;

  while (stack.length) {
    const value = stack.pop();

    if (typeof value === 'boolean') {
      bytes += 4;
    } else if (typeof value === 'string') {
      bytes += value.length * 2; // JS uses UTF-16
    } else if (typeof value === 'number') {
      bytes += 8;
    } else if (typeof value === 'object' && objectList.indexOf(value) === -1) {
      objectList.push(value);

      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          bytes += key.length * 2;
          stack.push(value[key]);
        }
      }
    }
  }

  return bytes;
}
