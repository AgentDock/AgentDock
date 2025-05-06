/**
 * @fileoverview Unit tests for RedisStorageProvider.
 */

import { RedisStorageProvider, UpstashRedisStorageProviderConfig } from '../providers/redis-provider'; 
import { Redis } from '@upstash/redis';

// --- Mock Setup ---
 
// Define the mock pipeline structure first
const mockPipeline = {
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  lpush: jest.fn(),  
  exec: jest.fn().mockResolvedValue([1]), 
};
// Make chainable methods return the mock pipeline itself
mockPipeline.set.mockReturnThis();
mockPipeline.setex.mockReturnThis();
mockPipeline.del.mockReturnThis();
mockPipeline.expire.mockReturnThis();
mockPipeline.lpush.mockReturnThis(); 

// Define the mock Redis client instance structure
const mockRedisClientInstance = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  mget: jest.fn(),
  pipeline: jest.fn(() => mockPipeline),
  scan: jest.fn(),    
  keys: jest.fn(),   
  lrange: jest.fn(), 
  lpush: jest.fn(),  
  llen: jest.fn(),   
};

// The actual mock factory
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => mockRedisClientInstance),
}));

// Access the mocked constructor
const MockRedisClient = Redis as jest.MockedClass<typeof Redis>;

// --- Test Suite ---
 
describe('RedisStorageProvider', () => {
  let provider: RedisStorageProvider;
  const namespace = 'test-ns';
  const defaultOptions: UpstashRedisStorageProviderConfig = {
    url: 'redis://mock-url', 
    token: 'mock-token', 
    namespace 
  };

  beforeEach(() => {
    jest.clearAllMocks();

    provider = new RedisStorageProvider(defaultOptions);
  });

  it('should construct with correct configuration', () => {
    expect(MockRedisClient).toHaveBeenCalledTimes(1);
    expect(MockRedisClient).toHaveBeenCalledWith({
        url: defaultOptions.url,
        token: defaultOptions.token,
    });
    expect(provider).toBeInstanceOf(RedisStorageProvider);
  });

  describe('Key-Value Operations', () => {
    const testKey = 'myKey';
    const testValue = { data: 'some value' };
    const namespacedKey = `${namespace}:${testKey}`;

    it('should set a value', async () => {
      await provider.set(testKey, testValue);
      expect(mockRedisClientInstance.set).toHaveBeenCalledTimes(1);
      expect(mockRedisClientInstance.set).toHaveBeenCalledWith(namespacedKey, testValue);
    });

    it('should set a value with TTL', async () => {
      const ttlSeconds = 60;
      await provider.set(testKey, testValue, { ttlSeconds });
      expect(mockRedisClientInstance.set).toHaveBeenCalledTimes(1);
      expect(mockRedisClientInstance.set).toHaveBeenCalledWith(namespacedKey, testValue, { ex: ttlSeconds });
      expect(mockRedisClientInstance.pipeline).not.toHaveBeenCalled(); 
    });

    it('should get an existing value', async () => {
      mockRedisClientInstance.get.mockResolvedValue(testValue);
      const value = await provider.get(testKey);
      expect(mockRedisClientInstance.get).toHaveBeenCalledTimes(1);
      expect(mockRedisClientInstance.get).toHaveBeenCalledWith(namespacedKey);
      expect(value).toEqual(testValue);
    });

    it('should return null for a non-existent value', async () => {
      mockRedisClientInstance.get.mockResolvedValue(null);
      const value = await provider.get('nonExistentKey');
      expect(mockRedisClientInstance.get).toHaveBeenCalledTimes(1);
      expect(mockRedisClientInstance.get).toHaveBeenCalledWith(`${namespace}:nonExistentKey`);
      expect(value).toBeNull();
    });

    it('should delete an existing value', async () => {
      mockRedisClientInstance.del.mockResolvedValue(1); 
      const result = await provider.delete(testKey);
      expect(mockRedisClientInstance.del).toHaveBeenCalledTimes(1);
      expect(mockRedisClientInstance.del).toHaveBeenCalledWith(namespacedKey);
      expect(result).toBe(true);
    });

    it('should return false when deleting a non-existent value', async () => {
      mockRedisClientInstance.del.mockResolvedValue(0); 
      const result = await provider.delete('nonExistentKey');
      expect(mockRedisClientInstance.del).toHaveBeenCalledTimes(1);
      expect(mockRedisClientInstance.del).toHaveBeenCalledWith(`${namespace}:nonExistentKey`);
      expect(result).toBe(false);
    });

    it('should check if a key exists', async () => {
      mockRedisClientInstance.exists.mockResolvedValue(1);
      const result = await provider.exists(testKey);
      expect(mockRedisClientInstance.exists).toHaveBeenCalledTimes(1);
      expect(mockRedisClientInstance.exists).toHaveBeenCalledWith(namespacedKey);
      expect(result).toBe(true);
    });

    it('should check if a key does not exist', async () => {
      mockRedisClientInstance.exists.mockResolvedValue(0);
      const result = await provider.exists('nonExistentKey');
      expect(mockRedisClientInstance.exists).toHaveBeenCalledTimes(1);
      expect(mockRedisClientInstance.exists).toHaveBeenCalledWith(`${namespace}:nonExistentKey`);
      expect(result).toBe(false);
    });
  });

  describe('Batch Operations', () => {
    const testItems: Record<string, any> = { key1: { data: 'value1' }, key2: { data: 'value2' }, key3: { data: 'value3' } };
    const testKeys = Object.keys(testItems);
    const namespacedKeys = testKeys.map(k => `${namespace}:${k}`);

    describe('getMany', () => {
      it('should get multiple existing values', async () => {
        const mockReturnValues = testKeys.map(k => testItems[k]);
        mockRedisClientInstance.mget.mockResolvedValue(mockReturnValues);
        const result = await provider.getMany(testKeys);
        expect(mockRedisClientInstance.mget).toHaveBeenCalledTimes(1);
        expect(mockRedisClientInstance.mget).toHaveBeenCalledWith(...namespacedKeys);
        expect(result).toEqual(testItems);
      });

      it('should handle a mix of existing and non-existent values for getMany', async () => {
        const mockReturnValues = [testItems.key1, null, testItems.key3];
        mockRedisClientInstance.mget.mockResolvedValue(mockReturnValues);
        const result = await provider.getMany(testKeys);
        expect(mockRedisClientInstance.mget).toHaveBeenCalledTimes(1);
        expect(mockRedisClientInstance.mget).toHaveBeenCalledWith(...namespacedKeys);
        expect(result).toEqual({ key1: testItems.key1, key2: null, key3: testItems.key3 });
      });

      it('should return an empty object for getMany with no keys', async () => {
        const result = await provider.getMany([]);
        expect(mockRedisClientInstance.mget).not.toHaveBeenCalled();
        expect(result).toEqual({});
      });
    });

    describe('setMany', () => {
      it('should set multiple values using pipeline', async () => {
        await provider.setMany(testItems);
        expect(mockRedisClientInstance.pipeline).toHaveBeenCalledTimes(1);
        expect(mockPipeline.set).toHaveBeenCalledTimes(testKeys.length);
        for (const key of testKeys) {
          expect(mockPipeline.set).toHaveBeenCalledWith(`${namespace}:${key}`, testItems[key], undefined);
        }
        expect(mockPipeline.exec).toHaveBeenCalledTimes(1);
      });

      it('should set multiple values with TTL using pipeline', async () => {
        const ttlSeconds = 120;

        await provider.setMany(testItems, { ttlSeconds });

        expect(mockRedisClientInstance.pipeline).toHaveBeenCalledTimes(1);
        expect(mockPipeline.set).toHaveBeenCalledTimes(testKeys.length);
        expect(mockPipeline.setex).not.toHaveBeenCalled(); 
        for (const key of testKeys) {
          expect(mockPipeline.set).toHaveBeenCalledWith(`${namespace}:${key}`, testItems[key], { ex: ttlSeconds });
        }
        expect(mockPipeline.exec).toHaveBeenCalledTimes(1);
      });
    });

    describe('deleteMany', () => {
      it('should delete multiple existing keys using client.del and return count', async () => {
        mockRedisClientInstance.del.mockResolvedValue(namespacedKeys.length);

        const result = await provider.deleteMany(testKeys);

        expect(mockRedisClientInstance.pipeline).not.toHaveBeenCalled(); 
        expect(mockRedisClientInstance.del).toHaveBeenCalledTimes(1);
        expect(mockRedisClientInstance.del).toHaveBeenCalledWith(...namespacedKeys);
        expect(mockPipeline.exec).not.toHaveBeenCalled(); 
        expect(result).toBe(testKeys.length);
      });

      it('should handle deleting a mix of existing/non-existing keys and return correct count', async () => {
        mockRedisClientInstance.del.mockResolvedValue(2); 

        const result = await provider.deleteMany(testKeys);

        expect(mockRedisClientInstance.pipeline).not.toHaveBeenCalled();
        expect(mockRedisClientInstance.del).toHaveBeenCalledTimes(1);
        expect(mockRedisClientInstance.del).toHaveBeenCalledWith(...namespacedKeys);
        expect(mockPipeline.exec).not.toHaveBeenCalled();
        expect(result).toBe(2); 
      });

      it('should return 0 if no keys are deleted', async () => {
        mockRedisClientInstance.del.mockResolvedValue(0);
        const result = await provider.deleteMany(testKeys);
        expect(mockRedisClientInstance.del).toHaveBeenCalledTimes(1);
        expect(mockRedisClientInstance.del).toHaveBeenCalledWith(...namespacedKeys);
        expect(result).toBe(0);
      });

      it('should return 0 for deleteMany with no keys', async () => {
        const result = await provider.deleteMany([]);
        expect(mockRedisClientInstance.pipeline).not.toHaveBeenCalled();
        expect(mockRedisClientInstance.del).not.toHaveBeenCalled();
        expect(result).toBe(0);
      });
    });
  });

  // --- NEW: List/Clear Operations --- 
  describe('List/Clear Operations', () => {
    const prefix = 'items';
    const keysToReturn = ['item1', 'item2', 'item3'];
    const namespacedKeys = keysToReturn.map(k => `${namespace}:${k}`);
    const listPattern = `${namespace}:${prefix}*`;
    const clearPattern = `${namespace}:*`;

    it('list() should return keys matching a prefix using scan', async () => {
      // Mock scan to return keys in one go (cursor '0' indicates end)
      mockRedisClientInstance.scan.mockResolvedValueOnce(['0', namespacedKeys]);

      const result = await provider.list(prefix);

      expect(mockRedisClientInstance.scan).toHaveBeenCalledTimes(1);
      // Check scan called with cursor 0, matching pattern, and default count
      expect(mockRedisClientInstance.scan).toHaveBeenCalledWith(0, { match: listPattern, count: 100 });
      expect(result).toEqual(keysToReturn); // Should return keys without namespace
    });

    it('list() should return all keys in namespace if no prefix', async () => {
      mockRedisClientInstance.scan.mockResolvedValueOnce(['0', namespacedKeys]);
      const result = await provider.list(); // No prefix
      expect(mockRedisClientInstance.scan).toHaveBeenCalledTimes(1);
      expect(mockRedisClientInstance.scan).toHaveBeenCalledWith(0, { match: clearPattern, count: 100 });
      expect(result).toEqual(keysToReturn);
    });
     
    it('list() should handle multiple scan iterations', async () => {
      const part1 = namespacedKeys.slice(0, 2);
      const part2 = namespacedKeys.slice(2);
      // First call returns some keys and a next cursor
      mockRedisClientInstance.scan.mockResolvedValueOnce(['123', part1]); 
      // Second call returns remaining keys and cursor '0'
      mockRedisClientInstance.scan.mockResolvedValueOnce(['0', part2]);

      const result = await provider.list(prefix);

      expect(mockRedisClientInstance.scan).toHaveBeenCalledTimes(2);
      expect(mockRedisClientInstance.scan).toHaveBeenNthCalledWith(1, 0, { match: listPattern, count: 100 });
      expect(mockRedisClientInstance.scan).toHaveBeenNthCalledWith(2, '123', { match: listPattern, count: 100 });
      expect(result).toEqual(keysToReturn); 
    });

    it('list() should return empty array on error or no keys', async () => {
      mockRedisClientInstance.scan.mockResolvedValueOnce(['0', []]); // No keys found
      let result = await provider.list(prefix);
      expect(result).toEqual([]);
      expect(mockRedisClientInstance.scan).toHaveBeenCalledTimes(1);

      jest.clearAllMocks(); // Reset mocks

      mockRedisClientInstance.scan.mockRejectedValueOnce(new Error('Scan failed')); // Simulate error
      result = await provider.list(prefix);
      expect(result).toEqual([]);
      expect(mockRedisClientInstance.scan).toHaveBeenCalledTimes(1);
    });

    it('clear() should delete keys matching a prefix using scan and del', async () => {
      mockRedisClientInstance.scan.mockResolvedValueOnce(['0', namespacedKeys]);
      mockRedisClientInstance.del.mockResolvedValue(namespacedKeys.length);

      await provider.clear(prefix);

      expect(mockRedisClientInstance.scan).toHaveBeenCalledTimes(1);
      expect(mockRedisClientInstance.scan).toHaveBeenCalledWith(0, { match: listPattern, count: 100 });
      expect(mockRedisClientInstance.del).toHaveBeenCalledTimes(1);
      expect(mockRedisClientInstance.del).toHaveBeenCalledWith(...namespacedKeys);
    });

    it('clear() should delete all keys in namespace if no prefix', async () => {
      mockRedisClientInstance.scan.mockResolvedValueOnce(['0', namespacedKeys]);
      mockRedisClientInstance.del.mockResolvedValue(namespacedKeys.length);

      await provider.clear(); // No prefix

      expect(mockRedisClientInstance.scan).toHaveBeenCalledTimes(1);
      expect(mockRedisClientInstance.scan).toHaveBeenCalledWith(0, { match: clearPattern, count: 100 });
      expect(mockRedisClientInstance.del).toHaveBeenCalledTimes(1);
      expect(mockRedisClientInstance.del).toHaveBeenCalledWith(...namespacedKeys);
    });

      it('clear() should handle multiple scan/del iterations', async () => {
        const part1 = namespacedKeys.slice(0, 2);
        const part2 = namespacedKeys.slice(2);
        mockRedisClientInstance.scan.mockResolvedValueOnce(['123', part1]);
        mockRedisClientInstance.scan.mockResolvedValueOnce(['0', part2]);
        mockRedisClientInstance.del.mockResolvedValueOnce(part1.length);
        mockRedisClientInstance.del.mockResolvedValueOnce(part2.length);

        await provider.clear(prefix);

        expect(mockRedisClientInstance.scan).toHaveBeenCalledTimes(2);
        expect(mockRedisClientInstance.scan).toHaveBeenNthCalledWith(1, 0, { match: listPattern, count: 100 });
        expect(mockRedisClientInstance.scan).toHaveBeenNthCalledWith(2, '123', { match: listPattern, count: 100 });
        expect(mockRedisClientInstance.del).toHaveBeenCalledTimes(2);
        expect(mockRedisClientInstance.del).toHaveBeenNthCalledWith(1, ...part1);
        expect(mockRedisClientInstance.del).toHaveBeenNthCalledWith(2, ...part2);
      });

     it('clear() should not call del if scan finds no keys', async () => {
       mockRedisClientInstance.scan.mockResolvedValueOnce(['0', []]);
       await provider.clear(prefix);
       expect(mockRedisClientInstance.scan).toHaveBeenCalledTimes(1);
       expect(mockRedisClientInstance.del).not.toHaveBeenCalled();
     });
   });

   // --- NEW: List Type Operations ---
   describe('List Type Operations', () => {
     const listKey = 'myList';
     const namespacedListKey = `${namespace}:${listKey}`;
     const listValues = [{ id: 1, text: 'a' }, { id: 2, text: 'b' }, { id: 3, text: 'c' }];

     it('getList() should retrieve a range of values using lrange', async () => {
       mockRedisClientInstance.lrange.mockResolvedValue(listValues);
       const result = await provider.getList<any>(listKey); // Default range 0 to -1

       expect(mockRedisClientInstance.lrange).toHaveBeenCalledTimes(1);
       expect(mockRedisClientInstance.lrange).toHaveBeenCalledWith(namespacedListKey, 0, -1);
       expect(result).toEqual(listValues);
     });

     it('getList() should retrieve a specific range', async () => {
       const expectedSlice = listValues.slice(1, 3);
       mockRedisClientInstance.lrange.mockResolvedValue(expectedSlice);
       const result = await provider.getList<any>(listKey, 1, 2);

       expect(mockRedisClientInstance.lrange).toHaveBeenCalledTimes(1);
       expect(mockRedisClientInstance.lrange).toHaveBeenCalledWith(namespacedListKey, 1, 2);
       expect(result).toEqual(expectedSlice);
     });
     
     it('getList() should return empty array for non-existent list (based on lrange behavior)', async () => {
        mockRedisClientInstance.lrange.mockResolvedValue([]); // lrange returns empty array for non-existent key
        const result = await provider.getList<any>('nonExistentList');
        expect(mockRedisClientInstance.lrange).toHaveBeenCalledTimes(1);
        expect(mockRedisClientInstance.lrange).toHaveBeenCalledWith(`${namespace}:nonExistentList`, 0, -1);
        expect(result).toEqual([]); // Matches Upstash client behavior
     });

     it('getList() should return null on error', async () => {
        mockRedisClientInstance.lrange.mockRejectedValue(new Error('LRANGE failed'));
        const result = await provider.getList<any>(listKey);
        expect(result).toBeNull();
     });

     it('saveList() should use pipeline to del, lpush, and exec', async () => {
       await provider.saveList(listKey, listValues);

       expect(mockRedisClientInstance.pipeline).toHaveBeenCalledTimes(1);
       expect(mockPipeline.del).toHaveBeenCalledTimes(1);
       expect(mockPipeline.del).toHaveBeenCalledWith(namespacedListKey);
       expect(mockPipeline.lpush).toHaveBeenCalledTimes(1);
       expect(mockPipeline.lpush).toHaveBeenCalledWith(namespacedListKey, ...listValues);
       expect(mockPipeline.expire).not.toHaveBeenCalled();
       expect(mockPipeline.exec).toHaveBeenCalledTimes(1);
     });

     it('saveList() should use pipeline with expire if TTL is provided', async () => {
       const ttlSeconds = 300;
       await provider.saveList(listKey, listValues, { ttlSeconds });

       expect(mockRedisClientInstance.pipeline).toHaveBeenCalledTimes(1);
       expect(mockPipeline.del).toHaveBeenCalledTimes(1);
       expect(mockPipeline.del).toHaveBeenCalledWith(namespacedListKey);
       expect(mockPipeline.lpush).toHaveBeenCalledTimes(1);
       expect(mockPipeline.lpush).toHaveBeenCalledWith(namespacedListKey, ...listValues);
       expect(mockPipeline.expire).toHaveBeenCalledTimes(1);
       expect(mockPipeline.expire).toHaveBeenCalledWith(namespacedListKey, ttlSeconds);
       expect(mockPipeline.exec).toHaveBeenCalledTimes(1);
     });
     
     it('saveList() should handle empty list (del only)', async () => {
        await provider.saveList(listKey, []);
        
        expect(mockRedisClientInstance.pipeline).toHaveBeenCalledTimes(1);
        expect(mockPipeline.del).toHaveBeenCalledTimes(1);
        expect(mockPipeline.del).toHaveBeenCalledWith(namespacedListKey);
        expect(mockPipeline.lpush).not.toHaveBeenCalled();
        expect(mockPipeline.expire).not.toHaveBeenCalled();
        expect(mockPipeline.exec).toHaveBeenCalledTimes(1);
      });

     it('deleteList() should call the standard delete method', async () => {
       mockRedisClientInstance.del.mockResolvedValue(1);
       const result = await provider.deleteList(listKey);
       expect(mockRedisClientInstance.del).toHaveBeenCalledTimes(1);
       expect(mockRedisClientInstance.del).toHaveBeenCalledWith(namespacedListKey);
       expect(result).toBe(true);
     });
   });

   // TODO: Add tests for error handling (e.g., Redis connection errors)
 });
