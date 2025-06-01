/**
 * @fileoverview Unit tests for the VercelKVProvider.
 */

import { kv } from '@vercel/kv';
import { VercelKVProvider } from '../providers/vercel-kv-provider';
import { StorageOptions, ListOptions } from '../types';

// Mock the @vercel/kv client
jest.mock('@vercel/kv', () => ({
  kv: {
    get: jest.fn(),
    set: jest.fn(),
    mset: jest.fn(),
    mget: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    scan: jest.fn(), // Mock scan initially
    lrange: jest.fn(),
    multi: jest.fn(() => ({
      del: jest.fn().mockReturnThis(),
      lpush: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([1, 1, 1]), // Mock exec resolution
    })),
  },
}));

// Use fake timers for TTL tests if needed
jest.useFakeTimers();

// Restore real timers after all tests to prevent leaking to other test suites
afterAll(() => {
  jest.useRealTimers();
});

describe('VercelKVProvider', () => {
  let provider: VercelKVProvider;
  const namespace = 'test-kv-ns';
  const mockKvClient = kv as jest.Mocked<typeof kv>;

  // Define mocks for multi pipeline methods here to be accessible in tests
  let mockMultiDel: jest.Mock;
  let mockMultiLpush: jest.Mock;
  let mockMultiExpire: jest.Mock;
  let mockMultiExec: jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    // Reset mocks, including the chained ones for multi
    Object.values(mockKvClient).forEach(mockFn => {
      if (jest.isMockFunction(mockFn)) {
        mockFn.mockClear();
      }
    });
    // Need to reset the mocks on the object returned by multi() as well
    // Ensure multi() has been called at least once before trying to access its results
    if (mockKvClient.multi.mock.results.length > 0 && mockKvClient.multi.mock.results[0]?.value) {
      Object.values(mockKvClient.multi.mock.results[0].value).forEach(mockFn => {
        if (jest.isMockFunction(mockFn)) {
          mockFn.mockClear();
        }
      });
    }

    // Default mock implementations (can be overridden in specific tests)
    mockKvClient.get.mockResolvedValue(null);
    mockKvClient.set.mockResolvedValue('OK');
    mockKvClient.mset.mockResolvedValue('OK');
    mockKvClient.mget.mockResolvedValue([]);
    mockKvClient.del.mockResolvedValue(0);
    mockKvClient.exists.mockResolvedValue(0);
    mockKvClient.scan.mockResolvedValue([0, []]); // Default scan returns empty
    mockKvClient.lrange.mockResolvedValue([]);
    // Initialize/reset mocks for multi pipeline methods
    mockMultiDel = jest.fn().mockReturnThis();
    mockMultiLpush = jest.fn().mockReturnThis();
    mockMultiExpire = jest.fn().mockReturnThis();
    mockMultiExec = jest.fn().mockResolvedValue([1, 1, 1]); // Default exec result

    mockKvClient.multi.mockReturnValue({
      del: mockMultiDel,
      lpush: mockMultiLpush,
      expire: mockMultiExpire,
      exec: mockMultiExec,
    } as any); // Cast to any to satisfy TS for Pipeline type

    // Create a new provider instance
    provider = new VercelKVProvider({ namespace });
  });

  it('should initialize correctly', () => {
    expect(provider).toBeInstanceOf(VercelKVProvider);
    // Add any specific initialization checks if needed
  });

  // --- Test Suites Placeholder ---
  describe('Basic Operations', () => {
    const key = 'testKey';
    const namespacedKey = `${namespace}:${key}`;
    const value = { data: 'testValue' };

    it('should set a value', async () => {
      await provider.set(key, value);
      expect(mockKvClient.set).toHaveBeenCalledTimes(1);
      expect(mockKvClient.set).toHaveBeenCalledWith(namespacedKey, value);
    });

    it('should get an existing value', async () => {
      mockKvClient.get.mockResolvedValue(value);
      const retrievedValue = await provider.get<typeof value>(key);
      expect(mockKvClient.get).toHaveBeenCalledTimes(1);
      expect(mockKvClient.get).toHaveBeenCalledWith(namespacedKey);
      expect(retrievedValue).toEqual(value);
    });

    it('should return null for a non-existent value', async () => {
      mockKvClient.get.mockResolvedValue(null);
      const retrievedValue = await provider.get('nonExistentKey');
      expect(mockKvClient.get).toHaveBeenCalledTimes(1);
      expect(mockKvClient.get).toHaveBeenCalledWith(`${namespace}:nonExistentKey`);
      expect(retrievedValue).toBeNull();
    });

    it('should delete an existing value', async () => {
      mockKvClient.del.mockResolvedValue(1); // Vercel KV del returns number of keys deleted
      const deleted = await provider.delete(key);
      expect(mockKvClient.del).toHaveBeenCalledTimes(1);
      expect(mockKvClient.del).toHaveBeenCalledWith(namespacedKey);
      expect(deleted).toBe(true);
    });

    it('should return false when deleting a non-existent value', async () => {
      mockKvClient.del.mockResolvedValue(0);
      const deleted = await provider.delete('nonExistentKey');
      expect(mockKvClient.del).toHaveBeenCalledTimes(1);
      expect(mockKvClient.del).toHaveBeenCalledWith(`${namespace}:nonExistentKey`);
      expect(deleted).toBe(false);
    });

    it('should check if a key exists', async () => {
      mockKvClient.exists.mockResolvedValue(1);
      let exists = await provider.exists(key);
      expect(mockKvClient.exists).toHaveBeenCalledTimes(1);
      expect(mockKvClient.exists).toHaveBeenCalledWith(namespacedKey);
      expect(exists).toBe(true);

      // Test non-existent key
      mockKvClient.exists.mockResolvedValue(0);
      exists = await provider.exists('nonExistentKey');
      expect(mockKvClient.exists).toHaveBeenCalledTimes(2); // Called again
      expect(mockKvClient.exists).toHaveBeenCalledWith(`${namespace}:nonExistentKey`);
      expect(exists).toBe(false);
    });
  });

  describe('TTL Operations', () => {
    const key = 'ttlKey';
    const namespacedKey = `${namespace}:${key}`;
    const value = 'ttlValue';
    const ttlSeconds = 3600; // 1 hour
    const options: StorageOptions = { ttlSeconds };

    it('should call kv.set with expiry option when ttlSeconds is provided', async () => {
      await provider.set(key, value, options);
      expect(mockKvClient.set).toHaveBeenCalledTimes(1);
      expect(mockKvClient.set).toHaveBeenCalledWith(namespacedKey, value, { ex: ttlSeconds });
    });

    it('should call kv.set without expiry option when ttlSeconds is not provided', async () => {
      await provider.set(key, value); // No options
      expect(mockKvClient.set).toHaveBeenCalledTimes(1);
      // Ensure it's called WITHOUT the expiry option object
      expect(mockKvClient.set).toHaveBeenCalledWith(namespacedKey, value);
      expect(mockKvClient.set).not.toHaveBeenCalledWith(namespacedKey, value, expect.anything());
    });

    it('should call kv.set without expiry option when ttlSeconds is 0 or negative', async () => {
      await provider.set(key, value, { ttlSeconds: 0 });
      expect(mockKvClient.set).toHaveBeenCalledTimes(1);
      expect(mockKvClient.set).toHaveBeenCalledWith(namespacedKey, value);

      await provider.set(key, value, { ttlSeconds: -100 });
      expect(mockKvClient.set).toHaveBeenCalledTimes(2);
      expect(mockKvClient.set).toHaveBeenCalledWith(namespacedKey, value);
    });
    
    // Note: We don't need jest.advanceTimersByTime here because Vercel KV handles the expiry.
    // We are only testing that our provider passes the option correctly.
  });

  describe('Batch Operations', () => {
    const items = {
      key1: 'value1',
      key2: { nested: true },
      key3: 123,
    };
    const keys = Object.keys(items);
    const namespacedKeys = keys.map(k => `${namespace}:${k}`);

    describe('getMany', () => {
      it('should get multiple existing values using mget', async () => {
        const values = [items.key1, items.key2, items.key3];
        mockKvClient.mget.mockResolvedValue(values);

        const retrieved = await provider.getMany<any>(keys);

        expect(mockKvClient.mget).toHaveBeenCalledTimes(1);
        expect(mockKvClient.mget).toHaveBeenCalledWith(...namespacedKeys);
        expect(retrieved).toEqual(items);
      });

      it('should handle a mix of existing and non-existent values for getMany', async () => {
        const mixedKeys = ['key1', 'nonExistent', 'key3'];
        const mixedNamespacedKeys = mixedKeys.map(k => `${namespace}:${k}`);
        const mixedValues = [items.key1, null, items.key3];
        mockKvClient.mget.mockResolvedValue(mixedValues);

        const retrieved = await provider.getMany<any>(mixedKeys);

        expect(mockKvClient.mget).toHaveBeenCalledTimes(1);
        expect(mockKvClient.mget).toHaveBeenCalledWith(...mixedNamespacedKeys);
        expect(retrieved).toEqual({ key1: items.key1, nonExistent: null, key3: items.key3 });
      });

      it('should return an empty object for getMany with no keys', async () => {
        const result = await provider.getMany([]);
        expect(mockKvClient.mget).not.toHaveBeenCalled(); // mget shouldn't be called for empty keys array
        expect(result).toEqual({});
      });
    });

    describe('setMany', () => {
      it('should set multiple values using mset when no TTL', async () => {
        const expectedMsetArg: Record<string, unknown> = {};
        namespacedKeys.forEach((nk, i) => { expectedMsetArg[nk] = items[keys[i] as keyof typeof items]; });

        await provider.setMany(items);

        expect(mockKvClient.mset).toHaveBeenCalledTimes(1);
        expect(mockKvClient.mset).toHaveBeenCalledWith(expectedMsetArg);
        expect(mockKvClient.set).not.toHaveBeenCalled(); // Should use mset, not set
      });

      it('should set multiple values using individual set calls when TTL is provided', async () => {
        const ttlSeconds = 60;
        await provider.setMany(items, { ttlSeconds });

        expect(mockKvClient.mset).not.toHaveBeenCalled();
        expect(mockKvClient.set).toHaveBeenCalledTimes(keys.length);
        keys.forEach((key, i) => {
          expect(mockKvClient.set).toHaveBeenCalledWith(namespacedKeys[i], items[key as keyof typeof items], { ex: ttlSeconds });
        });
      });
      
      it('should not call mset or set for setMany with empty object', async () => {
        await provider.setMany({});
        expect(mockKvClient.mset).not.toHaveBeenCalled();
        expect(mockKvClient.set).not.toHaveBeenCalled();
      });
    });

    describe('deleteMany', () => {
      it('should delete multiple existing keys using individual del calls', async () => {
        const keysToDelete = ['key1', 'key3'];
        const namespacedKeysToDelete = keysToDelete.map(k => `${namespace}:${k}`);
        // Mock individual del calls to return 1 (success)
        mockKvClient.del.mockResolvedValue(1);

        const deletedCount = await provider.deleteMany(keysToDelete);

        expect(mockKvClient.del).toHaveBeenCalledTimes(keysToDelete.length);
        namespacedKeysToDelete.forEach(nk => {
          expect(mockKvClient.del).toHaveBeenCalledWith(nk);
        });
        expect(deletedCount).toBe(keysToDelete.length); // Sum of results from individual del calls
      });

      it('should handle deleting a mix of existing/non-existing keys', async () => {
        const keysToDelete = ['key1', 'nonExistent', 'key3'];
        const namespacedKeysToDelete = keysToDelete.map(k => `${namespace}:${k}`);
        // Mock del to return 1 for existing, 0 for non-existing
        mockKvClient.del
          .mockResolvedValueOnce(1) // key1
          .mockResolvedValueOnce(0) // nonExistent
          .mockResolvedValueOnce(1); // key3
          
        const deletedCount = await provider.deleteMany(keysToDelete);

        expect(mockKvClient.del).toHaveBeenCalledTimes(keysToDelete.length);
        namespacedKeysToDelete.forEach(nk => {
          expect(mockKvClient.del).toHaveBeenCalledWith(nk);
        });
        expect(deletedCount).toBe(2); // Only key1 and key3 were 'deleted'
      });

      it('should return 0 if no keys are provided for deleteMany', async () => {
        const deletedCount = await provider.deleteMany([]);
        expect(mockKvClient.del).not.toHaveBeenCalled();
        expect(deletedCount).toBe(0);
      });
    });
  });

  describe('List/Clear Operations', () => {
    const prefix = 'items/';
    const keysToReturn = ['items/item1', 'items/item2', 'other/item3'];
    const namespacedKeys = keysToReturn.map(k => `${namespace}:${k}`);
    const listPattern = `${namespace}:${prefix}*`;
    const clearPattern = `${namespace}:*`; // Pattern when no prefix is given

    it('list() should return keys matching a prefix using scan', async () => {
      const expectedKeys = ['items/item1', 'items/item2'];
      const namespacedPrefixedKeys = expectedKeys.map(k => `${namespace}:${k}`);
      // Mock scan to return only prefixed keys, with cursor 0 indicating end
      mockKvClient.scan.mockResolvedValueOnce([0, namespacedPrefixedKeys]);

      const result = await provider.list(prefix);

      expect(mockKvClient.scan).toHaveBeenCalledTimes(1);
      // Check scan called with cursor 0, matching pattern
      expect(mockKvClient.scan).toHaveBeenCalledWith(0, { match: listPattern }); // Count defaults if not provided
      expect(result).toEqual(expectedKeys); // Should return keys without namespace
      expect(result).not.toContain('other/item3');
    });

    it('list() should return all keys in namespace if no prefix', async () => {
      mockKvClient.scan.mockResolvedValueOnce([0, namespacedKeys]);
      const result = await provider.list(); // No prefix

      expect(mockKvClient.scan).toHaveBeenCalledTimes(1);
      expect(mockKvClient.scan).toHaveBeenCalledWith(0, { match: clearPattern });
      expect(result).toEqual(keysToReturn);
    });

    it('list() should handle multiple scan iterations', async () => {
      const part1 = namespacedKeys.slice(0, 2);
      const part2 = namespacedKeys.slice(2);
      // First call returns some keys and a next cursor
      mockKvClient.scan.mockResolvedValueOnce([123, part1]); 
      // Second call returns remaining keys and cursor 0
      mockKvClient.scan.mockResolvedValueOnce([0, part2]);

      const result = await provider.list(); // List all

      expect(mockKvClient.scan).toHaveBeenCalledTimes(2);
      expect(mockKvClient.scan).toHaveBeenNthCalledWith(1, 0, { match: clearPattern });
      expect(mockKvClient.scan).toHaveBeenNthCalledWith(2, 123, { match: clearPattern });
      expect(result).toEqual(keysToReturn); 
    });

    it('list() should return empty array if scan finds no keys', async () => {
      mockKvClient.scan.mockResolvedValueOnce([0, []]);
      const result = await provider.list(prefix);
      expect(result).toEqual([]);
      expect(mockKvClient.scan).toHaveBeenCalledTimes(1);
    });

    it('clear() should delete keys matching a prefix using scan and del', async () => {
      const keysToDelete = ['items/item1', 'items/item2'];
      const namespacedKeysToDelete = keysToDelete.map(k => `${namespace}:${k}`);
      mockKvClient.scan.mockResolvedValueOnce([0, namespacedKeysToDelete]);
      mockKvClient.del.mockResolvedValue(1); // Mock del returning success

      await provider.clear(prefix);

      expect(mockKvClient.scan).toHaveBeenCalledTimes(1);
      expect(mockKvClient.scan).toHaveBeenCalledWith(0, { match: listPattern });
      // clear uses deleteMany internally, which calls del individually
      // We rely on deleteMany tests to verify internal del calls
      // Check that deleteMany was called with the correct *un-namespaced* keys
      // Note: We don't have a direct mock for deleteMany, so we check del calls
      expect(mockKvClient.del).toHaveBeenCalledTimes(keysToDelete.length); 
      namespacedKeysToDelete.forEach(nk => {
        expect(mockKvClient.del).toHaveBeenCalledWith(nk);
      });
    });

    it('clear() should delete all keys in namespace if no prefix', async () => {
      mockKvClient.scan.mockResolvedValueOnce([0, namespacedKeys]);
      mockKvClient.del.mockResolvedValue(1);

      await provider.clear(); // No prefix

      expect(mockKvClient.scan).toHaveBeenCalledTimes(1);
      expect(mockKvClient.scan).toHaveBeenCalledWith(0, { match: clearPattern });
      // Check del calls via deleteMany
      expect(mockKvClient.del).toHaveBeenCalledTimes(keysToReturn.length);
      namespacedKeys.forEach(nk => {
        expect(mockKvClient.del).toHaveBeenCalledWith(nk);
      });
    });

    it('clear() should handle multiple scan/del iterations', async () => {
      const part1 = namespacedKeys.slice(0, 2);
      const part2 = namespacedKeys.slice(2);
      mockKvClient.scan.mockResolvedValueOnce([123, part1]);
      mockKvClient.scan.mockResolvedValueOnce([0, part2]);
      mockKvClient.del.mockResolvedValue(1); // Mock success for all dels

      await provider.clear(); // Clear all

      expect(mockKvClient.scan).toHaveBeenCalledTimes(2);
      expect(mockKvClient.scan).toHaveBeenNthCalledWith(1, 0, { match: clearPattern });
      expect(mockKvClient.scan).toHaveBeenNthCalledWith(2, 123, { match: clearPattern });
      expect(mockKvClient.del).toHaveBeenCalledTimes(namespacedKeys.length); // Total keys deleted
      // Verify del was called for each namespaced key
      for (const nk of namespacedKeys) {
        expect(mockKvClient.del).toHaveBeenCalledWith(nk);
      }
    });

    it('clear() should not call del if scan finds no keys', async () => {
      mockKvClient.scan.mockResolvedValueOnce([0, []]);
      await provider.clear(prefix);
      expect(mockKvClient.scan).toHaveBeenCalledTimes(1);
      expect(mockKvClient.del).not.toHaveBeenCalled();
    });

    it('clear() should handle del error gracefully and return count of successful deletes', async () => {
      const keysToClear = ['key1', 'key2'];
      const namespacedKeysToClear = keysToClear.map(k => `${namespace}:${k}`);
      mockKvClient.scan.mockResolvedValueOnce([0, namespacedKeysToClear]);

      // First del fails, second succeeds
      mockKvClient.del
        .mockImplementationOnce(async (key) => { 
          if (key === namespacedKeysToClear[0]) throw new Error('KV del error'); 
          return 0; // Should be 0 if not deleted, or mock it as if it was not found
        })
        .mockResolvedValueOnce(1); // Second key is deleted

      // clear calls deleteMany internally. deleteMany will attempt all and count successes.
      // clear itself should just resolve gracefully.
      await expect(provider.clear()).resolves.toBeUndefined();

      expect(mockKvClient.scan).toHaveBeenCalledTimes(1);
      // Ensure del was attempted for all keys found by scan
      expect(mockKvClient.del).toHaveBeenCalledTimes(keysToClear.length);
      expect(mockKvClient.del).toHaveBeenNthCalledWith(1, namespacedKeysToClear[0]);
      expect(mockKvClient.del).toHaveBeenNthCalledWith(2, namespacedKeysToClear[1]);
    });
  });

  describe('List Type Operations', () => {
    const listKey = 'myList';
    const namespacedListKey = `${namespace}:${listKey}`;
    const listValues = [{ id: 1, text: 'a' }, { id: 2, text: 'b' }, { id: 3, text: 'c' }];

    it('getList() should retrieve a range of values using lrange', async () => {
      mockKvClient.lrange.mockResolvedValue(listValues);
      const result = await provider.getList<any>(listKey); // Default range 0 to -1

      expect(mockKvClient.lrange).toHaveBeenCalledTimes(1);
      expect(mockKvClient.lrange).toHaveBeenCalledWith(namespacedListKey, 0, -1);
      expect(result).toEqual(listValues);
    });

    it('getList() should retrieve a specific range', async () => {
      const expectedSlice = listValues.slice(1, 3);
      mockKvClient.lrange.mockResolvedValue(expectedSlice);
      const result = await provider.getList<any>(listKey, 1, 2);

      expect(mockKvClient.lrange).toHaveBeenCalledTimes(1);
      expect(mockKvClient.lrange).toHaveBeenCalledWith(namespacedListKey, 1, 2);
      expect(result).toEqual(expectedSlice);
    });

    it('getList() should return empty array for non-existent list', async () => {
      mockKvClient.lrange.mockResolvedValue([]); // lrange returns empty array for non-existent key
      const result = await provider.getList<any>('nonExistentList');
      expect(mockKvClient.lrange).toHaveBeenCalledTimes(1);
      expect(mockKvClient.lrange).toHaveBeenCalledWith(`${namespace}:nonExistentList`, 0, -1);
      expect(result).toEqual([]);
    });

    it('saveList() should use multi pipeline to del, lpush, and exec', async () => {
      // Clear any previous calls to multi and its chain from other tests or beforeEach setup
      mockKvClient.multi.mockClear(); // Clear calls to multi itself
      mockMultiDel.mockClear();
      mockMultiLpush.mockClear();
      mockMultiExpire.mockClear();
      mockMultiExec.mockClear();

      await provider.saveList(listKey, listValues);

      expect(mockKvClient.multi).toHaveBeenCalledTimes(1);
      const namespacedListKey = `${namespace}:${listKey}`;
      expect(mockMultiDel).toHaveBeenCalledWith(namespacedListKey);
      expect(mockMultiLpush).toHaveBeenCalledWith(namespacedListKey, ...listValues);
      expect(mockMultiExpire).not.toHaveBeenCalled();
      expect(mockMultiExec).toHaveBeenCalledTimes(1);
    });

    it('saveList() should use multi pipeline with expire if TTL is provided', async () => {
      const ttlSeconds = 300;
      mockKvClient.multi.mockClear(); // Clear calls to multi itself
      mockMultiDel.mockClear();
      mockMultiLpush.mockClear();
      mockMultiExpire.mockClear();
      mockMultiExec.mockClear();

      const namespacedListKey = `${namespace}:${listKey}`;
      await provider.saveList(listKey, listValues, { ttlSeconds });

      expect(mockKvClient.multi).toHaveBeenCalledTimes(1);
      expect(mockMultiDel).toHaveBeenCalledWith(namespacedListKey);
      expect(mockMultiLpush).toHaveBeenCalledWith(namespacedListKey, ...listValues);
      expect(mockMultiExpire).toHaveBeenCalledWith(namespacedListKey, ttlSeconds);
      expect(mockMultiExec).toHaveBeenCalledTimes(1);
    });

    it('saveList() should handle empty list (del only in pipeline)', async () => {
      mockKvClient.multi.mockClear(); // Clear calls to multi itself
      mockMultiDel.mockClear();
      mockMultiLpush.mockClear();
      mockMultiExpire.mockClear();
      mockMultiExec.mockClear();

      await provider.saveList(listKey, []);

      expect(mockKvClient.multi).toHaveBeenCalledTimes(1);
      const namespacedListKey = `${namespace}:${listKey}`;
      expect(mockMultiDel).toHaveBeenCalledWith(namespacedListKey);
      expect(mockMultiLpush).not.toHaveBeenCalled(); // Should not lpush if list is empty
      expect(mockMultiExpire).not.toHaveBeenCalled();
      expect(mockMultiExec).toHaveBeenCalledTimes(1);
    });

    it('deleteList() should call the standard delete method', async () => {
      mockKvClient.del.mockResolvedValue(1);
      const result = await provider.deleteList(listKey);

      expect(mockKvClient.del).toHaveBeenCalledTimes(1);
      expect(mockKvClient.del).toHaveBeenCalledWith(namespacedListKey);
      expect(result).toBe(true);
    });
  });

  // --- NEW: Error Handling ---
  describe('Error Handling', () => {
    const key = 'errorKey';
    const namespacedKey = `${namespace}:${key}`;
    const listKey = 'errorListKey'; 
    const namespacedListKey = `${namespace}:${listKey}`; 
    const listValues = ['v1']; 
    const error = new Error('KV Error');

    beforeEach(() => {
      // Reset specific multi mocks if needed, though they are redefined in saveList test
    });

    it('get() should return null on error', async () => {
      mockKvClient.get.mockRejectedValue(error);
      const result = await provider.get(key);
      expect(result).toBeNull();
      expect(mockKvClient.get).toHaveBeenCalledWith(namespacedKey);
    });

    it('set() should complete without throwing on error', async () => {
      mockKvClient.set.mockRejectedValue(error);
      // We expect the provider's set method to potentially log but not throw
      await expect(provider.set(key, 'value')).resolves.toBeUndefined();
      expect(mockKvClient.set).toHaveBeenCalledWith(namespacedKey, 'value');
    });

    it('delete() should return false on error', async () => {
      mockKvClient.del.mockRejectedValue(error);
      const result = await provider.delete(key);
      expect(result).toBe(false);
      expect(mockKvClient.del).toHaveBeenCalledWith(namespacedKey);
    });

    it('exists() should return false on error', async () => {
      mockKvClient.exists.mockRejectedValue(error);
      const result = await provider.exists(key);
      expect(result).toBe(false);
      expect(mockKvClient.exists).toHaveBeenCalledWith(namespacedKey);
    });

    it('getMany() should return an empty object on mget error', async () => {
      const keys = ['key1', 'key2'];
      const namespacedKeys = keys.map(k => `${namespace}:${k}`);
      mockKvClient.mget.mockRejectedValue(error);
      const result = await provider.getMany(keys);
      // Expect an empty object as no keys could be retrieved
      expect(result).toEqual({});
      expect(mockKvClient.mget).toHaveBeenCalledWith(...namespacedKeys);
    });
    
    it('setMany() using mset should complete without throwing on error', async () => {
      const items = { key1: 'v1', key2: 'v2' };
      const expectedMsetArg: Record<string, unknown> = {};
      Object.keys(items).forEach(k => { expectedMsetArg[`${namespace}:${k}`] = items[k as keyof typeof items]; });
      mockKvClient.mset.mockRejectedValue(error);
      await expect(provider.setMany(items)).resolves.toBeUndefined();
      expect(mockKvClient.mset).toHaveBeenCalledWith(expectedMsetArg);
    });

    it('setMany() using individual set should complete without throwing on error', async () => {
        const items = { key1: 'v1', key2: 'v2' };
        const ttlSeconds = 60;
        // Mock only the first set call to fail
        mockKvClient.set.mockRejectedValueOnce(error).mockResolvedValue('OK'); 
        // The provider should still attempt all sets, but complete gracefully
        await expect(provider.setMany(items, { ttlSeconds })).resolves.toBeUndefined();
        expect(mockKvClient.set).toHaveBeenCalledTimes(Object.keys(items).length); 
    });

    it('deleteMany() should return count of successful deletes on error', async () => {
      const keys = ['key1', 'key2'];
      const namespacedKeys = keys.map(k => `${namespace}:${k}`);
      // Mock the first del call to fail, second to succeed
      mockKvClient.del.mockRejectedValueOnce(error).mockResolvedValue(1);
      // The provider's deleteMany calls del individually and sums results
      // If one call fails, it should ideally log and continue, returning count of successful deletes
      const result = await provider.deleteMany(keys);
      // Expecting 1 because the second call succeeded
      expect(result).toBe(1); 
      expect(mockKvClient.del).toHaveBeenCalledTimes(keys.length);
      expect(mockKvClient.del).toHaveBeenNthCalledWith(1, namespacedKeys[0]);
      expect(mockKvClient.del).toHaveBeenNthCalledWith(2, namespacedKeys[1]);
    });

    it('list() should return empty array on scan error', async () => {
      mockKvClient.scan.mockRejectedValue(error);
      const result = await provider.list();
      expect(result).toEqual([]);
      expect(mockKvClient.scan).toHaveBeenCalledWith(0, { match: `${namespace}:*` });
    });
    
    it('clear() should handle scan error gracefully', async () => {
        mockKvClient.scan.mockRejectedValue(error);
        // clear uses list internally first, if scan fails, del shouldn't be called
        await expect(provider.clear()).resolves.toBeUndefined();
        expect(mockKvClient.scan).toHaveBeenCalledTimes(1);
        expect(mockKvClient.del).not.toHaveBeenCalled();
    });

    it('clear() should handle del error gracefully and return count of successful deletes', async () => {
        const keysToClear = ['keyA', 'keyB'];
        const namespacedKeys = keysToClear.map(k => `${namespace}:${k}`);
        mockKvClient.scan.mockResolvedValueOnce([0, namespacedKeys]);
        // Mock the first del call to fail, second to succeed
        mockKvClient.del.mockRejectedValueOnce(error).mockResolvedValue(1);
        
        // clear calls deleteMany internally. deleteMany will attempt all and count successes.
        // clear itself should just resolve gracefully.
        await expect(provider.clear()).resolves.toBeUndefined();

        expect(mockKvClient.scan).toHaveBeenCalledTimes(1);
        expect(mockKvClient.del).toHaveBeenCalledTimes(keysToClear.length);
        expect(mockKvClient.del).toHaveBeenNthCalledWith(1, namespacedKeys[0]);
        expect(mockKvClient.del).toHaveBeenNthCalledWith(2, namespacedKeys[1]);
    });

    it('getList() should return null on lrange error', async () => {
      mockKvClient.lrange.mockRejectedValue(error);
      const result = await provider.getList(listKey);
      expect(result).toBeNull();
      expect(mockKvClient.lrange).toHaveBeenCalledWith(namespacedListKey, 0, -1);
    });

    it('saveList() should handle pipeline exec error gracefully', async () => {
      // Ensure multi mocks are fresh for this test
      const mockMultiDelError = jest.fn().mockReturnThis();
      const mockMultiLpushError = jest.fn().mockReturnThis();
      const mockMultiExpireError = jest.fn().mockReturnThis();
      const mockMultiExecError = jest.fn().mockRejectedValue(error); // Mock exec to fail

      mockKvClient.multi.mockReturnValue({
          del: mockMultiDelError,
          lpush: mockMultiLpushError,
          expire: mockMultiExpireError,
          exec: mockMultiExecError,
      } as any);

      await expect(provider.saveList(listKey, listValues)).resolves.toBeUndefined();
      expect(mockKvClient.multi).toHaveBeenCalledTimes(1);
      expect(mockMultiDelError).toHaveBeenCalledWith(namespacedListKey)
      expect(mockMultiLpushError).toHaveBeenCalledWith(namespacedListKey, ...listValues)
      expect(mockMultiExpireError).not.toHaveBeenCalled(); // Assuming no TTL
      expect(mockMultiExecError).toHaveBeenCalledTimes(1);
    });
  });
});
