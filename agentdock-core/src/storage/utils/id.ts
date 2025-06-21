/**
 * @fileoverview Simple ID generation utility
 */

/**
 * Generate a simple unique ID
 * Uses timestamp + random for uniqueness
 */
export function nanoid(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomPart}`;
}
