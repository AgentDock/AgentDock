/**
 * Stream utilities for storage operations
 */

/**
 * Convert a stream to string
 * Handles both Web Streams API and Node.js streams
 */
export async function streamToString(
  stream: ReadableStream | NodeJS.ReadableStream | undefined
): Promise<string> {
  if (!stream) return '';

  // Check if it's a Web Streams API ReadableStream
  if ('getReader' in stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let result = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
      }
      // Decode any remaining bytes
      result += decoder.decode();
      return result;
    } finally {
      reader.releaseLock();
    }
  }

  // Handle Node.js streams
  const chunks: (string | Buffer)[] = [];
  for await (const chunk of stream as AsyncIterable<string | Buffer>) {
    chunks.push(chunk);
  }

  // Join chunks based on their type
  if (chunks.length === 0) return '';

  // If all chunks are strings, just join them
  if (chunks.every((chunk) => typeof chunk === 'string')) {
    return chunks.join('');
  }

  // Convert to Uint8Array for consistent handling
  const uint8Arrays = chunks.map((chunk) => {
    if (typeof chunk === 'string') {
      return new TextEncoder().encode(chunk);
    } else if (chunk instanceof Uint8Array) {
      return chunk;
    } else {
      // Buffer or other types
      return new Uint8Array(chunk);
    }
  });

  // Concatenate all arrays
  const totalLength = uint8Arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of uint8Arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return new TextDecoder().decode(result);
}

/**
 * Convert a string to stream
 * Returns a readable stream from string content
 */
export function stringToStream(content: string): ReadableStream {
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(content);

  return new ReadableStream({
    start(controller) {
      controller.enqueue(uint8Array);
      controller.close();
    }
  });
}
