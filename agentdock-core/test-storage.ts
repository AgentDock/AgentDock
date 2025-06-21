/**
 * Quick test script for storage adapters
 * Run with: npx tsx test-storage.ts
 */

import { runTests } from './src/storage/__tests__/test-runner';

console.log('Starting storage adapter tests...\n');

runTests().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
