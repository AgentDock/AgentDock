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

  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf-8');
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
