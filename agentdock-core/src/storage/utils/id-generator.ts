/**
 * Utility functions for generating IDs across the storage system
 */

/**
 * Generates a unique ID for storage operations
 * @param prefix Optional prefix for the ID
 * @returns A unique string ID
 */
export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  const id = `${timestamp}_${random}`;

  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Generates a memory-specific ID
 * @param type Memory type prefix (e.g., 'working', 'episodic', 'semantic', 'procedural')
 * @returns A unique memory ID
 */
export function generateMemoryId(type: string): string {
  return generateId(type);
}

/**
 * Generates a connection ID for memory relationships
 * @returns A unique connection ID
 */
export function generateConnectionId(): string {
  return generateId('conn');
}

/**
 * Generates a batch operation ID
 * @returns A unique batch ID
 */
export function generateBatchId(): string {
  return generateId('batch');
}
