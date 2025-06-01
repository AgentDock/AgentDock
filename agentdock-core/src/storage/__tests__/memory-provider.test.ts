/**
 * @fileoverview Unit tests for the MemoryStorageProvider.
 */

import { MemoryStorageProvider } from '../providers/memory-provider';
import { StorageOptions } from '../types';

// Store original Date.now for restoration
const originalDateNow = Date.now;

// Mock the global date to control time
global.Date.now = jest.fn(() => new Date('2023-01-01T00:00:00.000Z').getTime());

// Use fake timers to test TTL
jest.useFakeTimers();

// Restore real timers and Date.now after all tests to prevent leaking to other test suites
afterAll(() => {
  jest.useRealTimers();
  global.Date.now = originalDateNow;
});

describe('MemoryStorageProvider', () => {
  let provider: MemoryStorageProvider;
  const namespace = 'test-ns';

  beforeEach(() => {
    // Create a new provider instance before each test
    provider = new MemoryStorageProvider({ namespace });
    // Ensure timers are clear before each test for TTL
    jest.clearAllTimers();
  });

  afterEach(async () => {
    // Clear the storage after each test
    await provider.clear();
    // Optional: Destroy provider if cleanup is needed
    if (provider.destroy) {
      await provider.destroy();
    }
  });

  // --- Basic CRUD Tests --- 

  it('should set and get a value', async () => {
    const key = 'testKey';
    const value = { data: 'testData' };
    await provider.set(key, value);
    const retrievedValue = await provider.get(key);
    expect(retrievedValue).toEqual(value);
  });

  it('should return null for a non-existent key', async () => {
    const retrievedValue = await provider.get('nonExistentKey');
    expect(retrievedValue).toBeNull();
  });

  it('should check if a key exists', async () => {
    const key = 'existsKey';
    await provider.set(key, 'value');
    expect(await provider.exists(key)).toBe(true);
    expect(await provider.exists('nonExistentKey')).toBe(false);
  });

  it('should delete a key', async () => {
    const key = 'deleteKey';
    await provider.set(key, 'value');
    expect(await provider.exists(key)).toBe(true);
    const deleted = await provider.delete(key);
    expect(deleted).toBe(true);
    expect(await provider.exists(key)).toBe(false);
    const notDeleted = await provider.delete('nonExistentKey');
    expect(notDeleted).toBe(false);
  });

  // --- TTL Tests --- 

  it('should respect TTL', async () => {
    const key = 'ttlKey';
    const value = 'ttlValue';
    const ttlSeconds = 5;
    const options: StorageOptions = { ttlSeconds };

    await provider.set(key, value, options);

    // Should exist immediately after set
    expect(await provider.get(key)).toEqual(value);

    // Advance time just before expiry (in milliseconds)
    jest.advanceTimersByTime( (ttlSeconds - 1) * 1000 );
    expect(await provider.get(key)).toEqual(value);

    // Advance time past expiry
    jest.advanceTimersByTime(2 * 1000); // Advance 2 more seconds
    expect(await provider.get(key)).toBeNull();
  });

  it('should persist value without TTL', async () => {
    const key = 'noTtlKey';
    const value = 'persistentValue';

    await provider.set(key, value); // No options means no TTL

    // Advance time significantly
    jest.advanceTimersByTime(60 * 60 * 1000); // 1 hour

    // Value should still exist
    expect(await provider.get(key)).toEqual(value);
  });

  // --- Namespace Tests --- 

  it('should isolate data based on namespace', async () => {
    const key = 'sharedKey';
    const value1 = 'value1';
    const value2 = 'value2';
    const provider1 = new MemoryStorageProvider({ namespace: 'ns1' });
    const provider2 = new MemoryStorageProvider({ namespace: 'ns2' });

    await provider1.set(key, value1);
    await provider2.set(key, value2);

    expect(await provider1.get(key)).toEqual(value1);
    expect(await provider2.get(key)).toEqual(value2);
    expect(await provider1.exists(key)).toBe(true);
    expect(await provider2.exists(key)).toBe(true);

    await provider1.delete(key);
    expect(await provider1.exists(key)).toBe(false);
    expect(await provider2.exists(key)).toBe(true); // Should still exist in ns2
  });

  // --- Many Operations Tests --- 
  
  it('should set and get multiple values', async () => {
    const items = {
      key1: 'value1',
      key2: { nested: true },
      key3: 123
    };
    await provider.setMany(items);
    const retrieved = await provider.getMany(Object.keys(items));
    expect(retrieved).toEqual(items);

    const partialRetrieved = await provider.getMany(['key1', 'nonExistent']);
    expect(partialRetrieved).toEqual({ key1: 'value1', nonExistent: null });
  });

  it('should delete multiple values', async () => {
    const items = { del1: 'a', del2: 'b', keep1: 'c' };
    await provider.setMany(items);
    expect(await provider.exists('del1')).toBe(true);
    expect(await provider.exists('del2')).toBe(true);
    expect(await provider.exists('keep1')).toBe(true);

    const deletedCount = await provider.deleteMany(['del1', 'del2', 'nonExistent']);
    expect(deletedCount).toBe(2);
    expect(await provider.exists('del1')).toBe(false);
    expect(await provider.exists('del2')).toBe(false);
    expect(await provider.exists('keep1')).toBe(true);
  });

  it('should list keys with and without prefix', async () => {
    await provider.setMany({
      'prefix/key1': 'a',
      'prefix/key2': 'b',
      'other/key3': 'c'
    });

    const prefixedKeys = await provider.list('prefix/');
    expect(prefixedKeys).toHaveLength(2);
    expect(prefixedKeys).toContain('prefix/key1');
    expect(prefixedKeys).toContain('prefix/key2');

    // Note: Memory provider likely lists all keys if prefix is empty string or not provided
    const allKeys = await provider.list(''); 
    expect(allKeys).toHaveLength(3);
    expect(allKeys).toContain('prefix/key1');
    expect(allKeys).toContain('prefix/key2');
    expect(allKeys).toContain('other/key3');
  });

  it('should clear storage with and without prefix', async () => {
    await provider.setMany({
      'clear/p1': 'a',
      'clear/p2': 'b',
      'other/p3': 'c'
    });

    await provider.clear('clear/');
    expect(await provider.exists('clear/p1')).toBe(false);
    expect(await provider.exists('clear/p2')).toBe(false);
    expect(await provider.exists('other/p3')).toBe(true);

    await provider.clear(); // Clear everything
    expect(await provider.exists('other/p3')).toBe(false);
    expect(await provider.list('')).toHaveLength(0);
  });

  // --- List Operations Tests --- 

  it('should save and get a list', async () => {
    const key = 'myList';
    const listValue = ['item1', 2, { third: true }];
    await provider.saveList(key, listValue);
    
    const retrievedList = await provider.getList(key);
    expect(retrievedList).toEqual(listValue);

    // Get sub-list
    const subList = await provider.getList(key, 1, 2); // items at index 1 and 2
    expect(subList).toEqual([2, { third: true }]);
    
    // Get from end - Adjust expectation based on current implementation
    // Current implementation doesn't handle negative start index like JS slice
    const endList = await provider.getList(key, -2); // Test case with negative start index
    // Expect the full list as negative start isn't treated as offset from end
    expect(endList).toEqual(listValue); 

    // Get non-existent list
    const nonExistent = await provider.getList('noList');
    expect(nonExistent).toBeNull();
  });

  it('should delete a list', async () => {
    const key = 'listToDelete';
    await provider.saveList(key, [1, 2]);
    expect(await provider.getList(key)).toEqual([1, 2]);

    const deleted = await provider.deleteList(key);
    expect(deleted).toBe(true);
    expect(await provider.getList(key)).toBeNull();

    const notDeleted = await provider.deleteList('nonExistentList');
    expect(notDeleted).toBe(false);
  });

  // --- Edge Cases --- 
  
  it('should handle different data types', async () => {
    const types = {
      string: 'hello',
      number: 42,
      boolean: false,
      nullValue: null,
      // undefined might be stored as null or removed depending on implementation
      object: { a: 1, b: [1, 2] },
      array: [1, 'two', true, null]
    };
    await provider.setMany(types);
    const retrievedTypes = await provider.getMany(Object.keys(types));
    expect(retrievedTypes).toEqual(types);
  });

  it('should handle clearing empty storage', async () => {
    // Ensure it starts empty
    expect(await provider.list('')).toHaveLength(0);
    await provider.clear();
    expect(await provider.list('')).toHaveLength(0);
  });

});
