/**
 * Storage Adapter Test Runner
 *
 * Unified test suite for all storage adapters to ensure
 * consistent behavior across different implementations.
 */

import { PostgreSQLAdapter } from '../adapters/postgresql';
import { SQLiteAdapter } from '../adapters/sqlite';
import { MemoryStorageProvider } from '../providers';
import { StorageProvider } from '../types';

interface TestAdapter {
  name: string;
  skip?: boolean;
  create: () => Promise<StorageProvider>;
  cleanup?: () => Promise<void>;
}

// Color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

/**
 * Test adapters configuration
 */
const TEST_ADAPTERS: TestAdapter[] = [
  {
    name: 'Memory',
    create: async () => new MemoryStorageProvider({ namespace: 'test' })
  },
  {
    name: 'SQLite (In-Memory)',
    create: async () => {
      const adapter = new SQLiteAdapter({
        path: ':memory:',
        namespace: 'test'
      });
      await adapter.initialize();
      return adapter;
    }
  },
  {
    name: 'SQLite (File)',
    create: async () => {
      const adapter = new SQLiteAdapter({
        path: './test-storage.db',
        namespace: 'test'
      });
      await adapter.initialize();
      return adapter;
    },
    cleanup: async () => {
      // Clean up test database file
      const fs = await import('fs/promises');
      try {
        await fs.unlink('./test-storage.db');
        await fs.unlink('./test-storage.db-wal');
        await fs.unlink('./test-storage.db-shm');
      } catch (e) {
        // Files might not exist
      }
    }
  },
  {
    name: 'PostgreSQL',
    skip: !process.env.DATABASE_URL,
    create: async () => {
      const adapter = new PostgreSQLAdapter({
        connectionString: process.env.DATABASE_URL,
        namespace: 'test'
      });
      await adapter.initialize();
      return adapter;
    }
  }
];

/**
 * Test suite for storage operations
 */
async function runTests() {
  console.log(`${colors.blue}🧪 AgentDock Storage Tests${colors.reset}\n`);
  console.log('Testing storage adapters for your AI agent use cases...\n');

  const results: {
    adapter: string;
    passed: number;
    failed: number;
    skipped: number;
  }[] = [];

  for (const testAdapter of TEST_ADAPTERS) {
    if (testAdapter.skip) {
      console.log(
        `${colors.yellow}⏭️  Skipping ${testAdapter.name} (not configured)${colors.reset}`
      );
      continue;
    }

    console.log(`${colors.blue}📦 Testing ${testAdapter.name}${colors.reset}`);

    let adapter: StorageProvider | null = null;
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    try {
      adapter = await testAdapter.create();

      // Test 1: Basic KV Operations
      await test(
        'Basic set/get operations',
        async () => {
          const testData = {
            message: 'Hello from agent',
            timestamp: Date.now(),
            metadata: { userId: 'user123', threadId: 'thread456' }
          };

          await adapter!.set('agent:response', testData);
          const retrieved = await adapter!.get('agent:response');

          if (JSON.stringify(retrieved) !== JSON.stringify(testData)) {
            throw new Error('Retrieved data does not match');
          }
        },
        () => passed++,
        () => failed++
      );

      // Test 2: Character AI-like Thread Storage
      await test(
        'Thread/conversation storage',
        async () => {
          const thread = {
            id: 'thread-123',
            userId: 'user-456',
            messages: [
              { role: 'user', content: 'Hello AI!' },
              { role: 'assistant', content: 'Hello! How can I help?' }
            ],
            created: new Date().toISOString()
          };

          await adapter!.set(`thread:${thread.id}`, thread);
          const retrieved = await adapter!.get(`thread:${thread.id}`);

          if (!retrieved || (retrieved as any).id !== thread.id) {
            throw new Error('Thread not properly stored');
          }
        },
        () => passed++,
        () => failed++
      );

      // Test 3: Namespace Isolation (Multi-tenant)
      await test(
        'Namespace isolation for multi-tenant',
        async () => {
          await adapter!.set('shared-key', 'tenant1-data', {
            namespace: 'tenant1'
          });
          await adapter!.set('shared-key', 'tenant2-data', {
            namespace: 'tenant2'
          });

          const t1 = await adapter!.get('shared-key', { namespace: 'tenant1' });
          const t2 = await adapter!.get('shared-key', { namespace: 'tenant2' });

          if (t1 !== 'tenant1-data' || t2 !== 'tenant2-data') {
            throw new Error('Namespace isolation failed');
          }
        },
        () => passed++,
        () => failed++
      );

      // Test 4: TTL Support (Session Management)
      await test(
        'TTL for session expiry',
        async () => {
          await adapter!.set(
            'session:123',
            { token: 'abc' },
            { ttlSeconds: 1 }
          );

          // Should exist immediately
          const exists = await adapter!.exists('session:123');
          if (!exists) throw new Error('Session should exist');

          // Wait for expiry
          await new Promise((resolve) => setTimeout(resolve, 1500));

          const expired = await adapter!.get('session:123');
          if (expired !== null) {
            throw new Error('Session should have expired');
          }
        },
        () => passed++,
        () => failed++
      );

      // Test 5: List Operations (User's Characters/Agents)
      await test(
        'List user agents/characters',
        async () => {
          // Store multiple agents for a user
          await adapter!.set('agent:user123:bot1', { name: 'Helper Bot' });
          await adapter!.set('agent:user123:bot2', { name: 'Chat Bot' });
          await adapter!.set('agent:user456:bot1', { name: 'Other User Bot' });

          // List only user123's agents
          const userAgents = await adapter!.list('agent:user123:');

          if (userAgents.length !== 2) {
            throw new Error(`Expected 2 agents, got ${userAgents.length}`);
          }
        },
        () => passed++,
        () => failed++
      );

      // Test 6: Batch Operations (Bulk Import/Export)
      if ('setMany' in adapter && 'getMany' in adapter) {
        await test(
          'Batch operations for bulk data',
          async () => {
            const characters = {
              'char:1': { name: 'Alice', personality: 'Helpful' },
              'char:2': { name: 'Bob', personality: 'Funny' },
              'char:3': { name: 'Charlie', personality: 'Serious' }
            };

            await (adapter as any).setMany(characters);
            const retrieved = await (adapter as any).getMany([
              'char:1',
              'char:2',
              'char:3'
            ]);

            if (Object.keys(retrieved).length !== 3) {
              throw new Error('Batch operations failed');
            }
          },
          () => passed++,
          () => failed++
        );
      } else {
        skipped++;
      }

      // Test 7: Concurrent Operations
      await test(
        'Concurrent operations (multiple users)',
        async () => {
          const promises = [];

          // Simulate 10 concurrent users
          for (let i = 0; i < 10; i++) {
            promises.push(adapter!.set(`user:${i}:active`, true));
          }

          await Promise.all(promises);

          // Verify all were set
          for (let i = 0; i < 10; i++) {
            const active = await adapter!.get(`user:${i}:active`);
            if (active !== true) {
              throw new Error(`User ${i} not properly set`);
            }
          }
        },
        () => passed++,
        () => failed++
      );
    } catch (error) {
      console.error(
        `${colors.red}Failed to initialize ${testAdapter.name}:${colors.reset}`,
        error
      );
      failed++;
    } finally {
      // Cleanup
      if (adapter) {
        await adapter.clear();
        if ('destroy' in adapter && typeof adapter.destroy === 'function') {
          await adapter.destroy();
        }
      }

      if (testAdapter.cleanup) {
        await testAdapter.cleanup();
      }
    }

    results.push({ adapter: testAdapter.name, passed, failed, skipped });
    console.log(
      `  ${colors.green}✓ ${passed} passed${colors.reset}, ${colors.red}✗ ${failed} failed${colors.reset}, ${colors.yellow}○ ${skipped} skipped${colors.reset}\n`
    );
  }

  // Summary
  console.log(`${colors.blue}📊 Test Summary${colors.reset}`);
  console.log('='.repeat(50));

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const result of results) {
    totalPassed += result.passed;
    totalFailed += result.failed;
    totalSkipped += result.skipped;

    const status =
      result.failed === 0
        ? `${colors.green}PASS${colors.reset}`
        : `${colors.red}FAIL${colors.reset}`;
    console.log(`${result.adapter.padEnd(20)} ${status}`);
  }

  console.log('='.repeat(50));
  console.log(
    `Total: ${colors.green}${totalPassed} passed${colors.reset}, ${colors.red}${totalFailed} failed${colors.reset}, ${colors.yellow}${totalSkipped} skipped${colors.reset}`
  );

  process.exit(totalFailed > 0 ? 1 : 0);
}

/**
 * Simple test helper
 */
async function test(
  name: string,
  fn: () => Promise<void>,
  onPass: () => void,
  onFail: () => void
): Promise<void> {
  try {
    await fn();
    console.log(`  ${colors.green}✓${colors.reset} ${name}`);
    onPass();
  } catch (error) {
    console.log(`  ${colors.red}✗${colors.reset} ${name}`);
    console.log(
      `    ${colors.red}${error instanceof Error ? error.message : String(error)}${colors.reset}`
    );
    onFail();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };
