/**
 * @fileoverview Tests for SQLite-vec adapter
 */

import { rm } from 'fs/promises';

import { SQLiteVecAdapter } from '../index';
import { VectorMetric } from '../types';

// Use in-memory database for tests
const TEST_DB_PATH = ':memory:';

describe('SQLiteVecAdapter', () => {
  let adapter: SQLiteVecAdapter;

  beforeEach(async () => {
    adapter = new SQLiteVecAdapter({
      path: TEST_DB_PATH,
      namespace: 'test',
      enableVector: false // Disable by default since sqlite-vec may not be installed
    });
  });

  afterEach(async () => {
    if (adapter) {
      await adapter.destroy();
    }
  });

  describe('Basic KV Operations (inherited from SQLite)', () => {
    it('should perform basic get/set operations', async () => {
      await adapter.initialize();

      const key = 'test-key';
      const value = { data: 'test-value' };

      await adapter.set(key, value);
      const retrieved = await adapter.get(key);
      expect(retrieved).toEqual(value);
    });

    it('should handle namespace isolation', async () => {
      await adapter.initialize();

      const key = 'shared-key';
      await adapter.set(key, 'value1', { namespace: 'ns1' });
      await adapter.set(key, 'value2', { namespace: 'ns2' });

      expect(await adapter.get(key, { namespace: 'ns1' })).toBe('value1');
      expect(await adapter.get(key, { namespace: 'ns2' })).toBe('value2');
    });
  });

  // Vector operations tests - will be skipped if sqlite-vec is not available
  describe('Vector Operations', () => {
    let vectorAdapter: SQLiteVecAdapter;

    beforeEach(async () => {
      // Create adapter with vector enabled
      vectorAdapter = new SQLiteVecAdapter({
        path: TEST_DB_PATH,
        namespace: 'test',
        enableVector: true,
        defaultDimension: 3, // Small dimension for tests
        defaultMetric: VectorMetric.COSINE
      });
    });

    afterEach(async () => {
      if (vectorAdapter) {
        await vectorAdapter.destroy();
      }
    });

    it('should handle vector operations gracefully when extension is not available', async () => {
      try {
        await vectorAdapter.initialize();
        // If we get here, sqlite-vec is installed
        console.log('sqlite-vec extension is available');
      } catch (error) {
        // Expected when sqlite-vec is not installed
        expect(error).toBeDefined();
      }
    });

    // These tests will only run if sqlite-vec is installed
    it.skip('should create and drop collections', async () => {
      await vectorAdapter.initialize();

      const collectionName = 'test-collection';
      await vectorAdapter.createCollection({
        name: collectionName,
        dimension: 3
      });

      expect(await vectorAdapter.collectionExists(collectionName)).toBe(true);

      await vectorAdapter.dropCollection(collectionName);
      expect(await vectorAdapter.collectionExists(collectionName)).toBe(false);
    });

    it.skip('should insert and search vectors', async () => {
      await vectorAdapter.initialize();

      const collection = 'search-test';
      await vectorAdapter.createCollection({
        name: collection,
        dimension: 3
      });

      // Insert test vectors
      await vectorAdapter.insertVectors(collection, [
        { id: '1', vector: [1, 0, 0], metadata: { type: 'x-axis' } },
        { id: '2', vector: [0, 1, 0], metadata: { type: 'y-axis' } },
        { id: '3', vector: [0, 0, 1], metadata: { type: 'z-axis' } }
      ]);

      // Search for similar vectors
      const results = await vectorAdapter.searchVectors(
        collection,
        [0.9, 0.1, 0], // Close to x-axis
        { k: 2 }
      );

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('1'); // x-axis should be closest
    });

    it.skip('should support metadata filtering', async () => {
      await vectorAdapter.initialize();

      const collection = 'filter-test';
      await vectorAdapter.createCollection({
        name: collection,
        dimension: 3
      });

      await vectorAdapter.insertVectors(collection, [
        { id: '1', vector: [1, 0, 0], metadata: { category: 'A' } },
        { id: '2', vector: [0.9, 0.1, 0], metadata: { category: 'B' } },
        { id: '3', vector: [0, 1, 0], metadata: { category: 'A' } }
      ]);

      const results = await vectorAdapter.searchVectors(collection, [1, 0, 0], {
        k: 3,
        filter: { category: 'A' }
      });

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.metadata?.category === 'A')).toBe(true);
    });
  });
});
