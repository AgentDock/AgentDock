import { Message } from 'agentdock-core';
import fetch, { Headers, Response } from 'node-fetch';

const TEST_SIZES = {
  small: 100, // 100 chars
  medium: 1000, // 1KB
  large: 10000, // 10KB
  huge: 100000, // 100KB
};

const TEST_ITERATIONS = 3;
const TEST_ENDPOINT = 'http://localhost:3000/api/chat/example-agent';
const TEST_API_KEY = process.env.ANTHROPIC_API_KEY || '';

if (!TEST_API_KEY) {
  console.error('Please set ANTHROPIC_API_KEY environment variable');
  process.exit(1);
}

async function measureStreamingResponse(size: number): Promise<{
  firstChunkTime: number;
  totalTime: number;
  chunkCount: number;
  totalSize: number;
}> {
  const message: Message = {
    id: '1',
    role: 'user',
    content: 'A'.repeat(size),
  };

  const start = Date.now();
  let firstChunkTime = 0;
  let chunkCount = 0;
  let totalSize = 0;

  const response = await fetch(TEST_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': TEST_API_KEY,
    },
    body: JSON.stringify({ messages: [message] }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Response details:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: errorText,
    });
    throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
  }

  if (!response.body) {
    throw new Error('No response body received');
  }

  // Handle streaming with node-fetch
  const stream = response.body;
  let buffer = Buffer.from([]);

  stream.on('data', (chunk: Buffer) => {
    if (!firstChunkTime) {
      firstChunkTime = Date.now() - start;
    }
    buffer = Buffer.concat([buffer, chunk]);
    chunkCount++;
    totalSize += chunk.length;
  });

  await new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  return {
    firstChunkTime,
    totalTime: Date.now() - start,
    chunkCount,
    totalSize,
  };
}

async function runTests() {
  console.log('Starting streaming tests...\n');
  console.log('Test configuration:', {
    endpoint: TEST_ENDPOINT,
    apiKeyLength: TEST_API_KEY.length,
    iterations: TEST_ITERATIONS,
  });

  for (const [sizeName, size] of Object.entries(TEST_SIZES)) {
    console.log(`\nTesting ${sizeName} payload (${size} chars):`);

    const results = [];

    for (let i = 0; i < TEST_ITERATIONS; i++) {
      try {
        console.log(`  Iteration ${i + 1}/${TEST_ITERATIONS}...`);
        const result = await measureStreamingResponse(size);
        results.push(result);

        console.log(`    First chunk: ${result.firstChunkTime}ms`);
        console.log(`    Total time: ${result.totalTime}ms`);
        console.log(`    Chunks: ${result.chunkCount}`);
        console.log(`    Total size: ${result.totalSize} bytes\n`);
      } catch (error) {
        console.error(`    Error details:`, error);
      }
    }

    if (results.length > 0) {
      const avgFirstChunk = results.reduce((sum, r) => sum + r.firstChunkTime, 0) / results.length;
      const avgTotalTime = results.reduce((sum, r) => sum + r.totalTime, 0) / results.length;
      const avgChunks = results.reduce((sum, r) => sum + r.chunkCount, 0) / results.length;

      console.log(`  Averages for ${sizeName}:`);
      console.log(`    First chunk: ${avgFirstChunk.toFixed(2)}ms`);
      console.log(`    Total time: ${avgTotalTime.toFixed(2)}ms`);
      console.log(`    Chunks: ${avgChunks.toFixed(2)}\n`);
    }
  }
}

runTests().catch(console.error);
