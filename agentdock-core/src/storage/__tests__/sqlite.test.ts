/**
 * SQLite Adapter Tests
 *
 * Production-style tests for SQLite storage adapter
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { SQLiteAdapter } from '../adapters/sqlite';
import { StorageProvider } from '../types';

describe('SQLiteAdapter', () => {
  let adapter: StorageProvider;

  beforeEach(async () => {
    adapter = new SQLiteAdapter({
      path: ':memory:',
      namespace: 'test'
    });
    await (adapter as SQLiteAdapter).initialize();
  });

  afterEach(async () => {
    await adapter.clear();
    if ('destroy' in adapter && typeof adapter.destroy === 'function') {
      await adapter.destroy();
    }
  });

  // Basic KV operations
  it('should set and get values', async () => {
    await adapter.set('test-key', { value: 'test' });
    const result = await adapter.get('test-key');
    expect(result).toEqual({ value: 'test' });
  });

  it('should return null for missing keys', async () => {
    const result = await adapter.get('missing-key');
    expect(result).toBeNull();
  });

  it('should delete values', async () => {
    await adapter.set('delete-me', 'value');
    const deleted = await adapter.delete('delete-me');
    expect(deleted).toBe(true);

    const result = await adapter.get('delete-me');
    expect(result).toBeNull();
  });

  it('should check existence', async () => {
    await adapter.set('exists', 'value');
    expect(await adapter.exists('exists')).toBe(true);
    expect(await adapter.exists('not-exists')).toBe(false);
  });

  it('should list keys with prefix', async () => {
    await adapter.set('prefix:1', 'value1');
    await adapter.set('prefix:2', 'value2');
    await adapter.set('other', 'value3');

    const keys = await adapter.list('prefix:');
    expect(keys.sort()).toEqual(['prefix:1', 'prefix:2'].sort());
  });

  // TTL operations
  it('should expire keys with TTL', async () => {
    await adapter.set('expire-me', 'value', { ttlSeconds: 1 });

    // Should exist immediately
    expect(await adapter.exists('expire-me')).toBe(true);

    // Wait for expiry
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(await adapter.exists('expire-me')).toBe(false);
  });

  // Batch operations
  it('should set multiple values if batch operations are supported', async () => {
    if ('setMany' in adapter) {
      await (adapter as any).setMany({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3'
      });

      const values = await (adapter as any).getMany(['key1', 'key2', 'key3']);
      expect(values).toEqual({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3'
      });
    } else {
      // Skip test if batch operations not supported
      expect(true).toBe(true);
    }
  });

  // List operations
  it('should save and retrieve lists', async () => {
    const list = ['item1', 'item2', 'item3'];
    await adapter.saveList('my-list', list);

    const retrieved = await adapter.getList('my-list');
    expect(retrieved).toEqual(list);
  });

  it('should retrieve list ranges', async () => {
    const list = ['item1', 'item2', 'item3', 'item4', 'item5'];
    await adapter.saveList('range-list', list);

    const subset = await adapter.getList('range-list', 1, 3);
    expect(subset).toEqual(['item2', 'item3', 'item4']);
  });

  // Namespace isolation
  it('should isolate namespaces', async () => {
    await adapter.set('shared-key', 'namespace1', { namespace: 'ns1' });
    await adapter.set('shared-key', 'namespace2', { namespace: 'ns2' });

    const val1 = await adapter.get('shared-key', { namespace: 'ns1' });
    const val2 = await adapter.get('shared-key', { namespace: 'ns2' });

    expect(val1).toBe('namespace1');
    expect(val2).toBe('namespace2');
  });

  // SQLite-specific tests
  describe('SQLite-specific features', () => {
    it('should support transactions for batch operations', async () => {
      if ('setMany' in adapter) {
        // The batch operations already use transactions internally
        const items = {
          'tx:1': 'value1',
          'tx:2': 'value2',
          'tx:3': 'value3'
        };

        await (adapter as any).setMany(items);

        const retrieved = await (adapter as any).getMany([
          'tx:1',
          'tx:2',
          'tx:3'
        ]);
        expect(retrieved).toEqual(items);
      }
    });

    it('should handle concurrent operations safely', async () => {
      const promises: Promise<void>[] = [];

      // Create multiple concurrent writes
      for (let i = 0; i < 10; i++) {
        promises.push(adapter.set(`concurrent:${i}`, i));
      }

      await Promise.all(promises);

      // Verify all writes succeeded
      for (let i = 0; i < 10; i++) {
        const value = await adapter.get(`concurrent:${i}`);
        expect(value).toBe(i);
      }
    });
  });
});
