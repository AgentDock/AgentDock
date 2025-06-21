/**
 * Array utilities for storage operations
 */

/**
 * Chunk an array into smaller arrays of specified size
 * @param array - The array to chunk
 * @param size - The size of each chunk
 * @returns Array of chunks
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error('Chunk size must be greater than 0');
  }

  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Batch process an array with a callback function
 * @param items - Items to process
 * @param batchSize - Number of items to process at once
 * @param callback - Function to process each batch
 * @returns Results from all batches
 */
export async function batchProcess<T, R>(
  items: T[],
  batchSize: number,
  callback: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const batches = chunkArray(items, batchSize);
  const results: R[] = [];

  for (const batch of batches) {
    const batchResults = await callback(batch);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Process array items in parallel with concurrency limit
 * @param items - Items to process
 * @param concurrency - Maximum parallel operations
 * @param callback - Function to process each item
 * @returns Results from all items
 */
export async function parallelProcess<T, R>(
  items: T[],
  concurrency: number,
  callback: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const promise = callback(items[i]).then((result) => {
      results[i] = result;
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}
