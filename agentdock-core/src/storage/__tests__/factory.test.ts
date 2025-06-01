/**
 * @fileoverview Unit tests for the StorageFactory.
 */

import { StorageFactory } from '../factory';
import { StorageProviderOptions, StorageProvider } from '../types';
import { MemoryStorageProvider } from '../providers/memory-provider';
import { RedisStorageProvider } from '../providers/redis-provider';
import { VercelKVProvider } from '../providers/vercel-kv-provider';

// Mock the provider classes - Now returns a NEW mock instance each time
jest.mock('../providers/memory-provider');
jest.mock('../providers/redis-provider');
jest.mock('../providers/vercel-kv-provider');

const MockMemoryStorageProvider = MemoryStorageProvider as jest.MockedClass<typeof MemoryStorageProvider>;
const MockRedisStorageProvider = RedisStorageProvider as jest.MockedClass<typeof RedisStorageProvider>;
const MockVercelKvStorageProvider = VercelKVProvider as jest.MockedClass<typeof VercelKVProvider>;

describe('StorageFactory', () => {
  let factory: StorageFactory;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    // Ensure singleton instance is managed cleanly across test runs if needed
    // (May require resetting the singleton instance if tests interfere)
  });

  beforeEach(() => {
    // Reset mocks for each test
    jest.clearAllMocks();

    // Mock environment variables for Redis
    originalEnv = process.env;
    process.env = {
      ...originalEnv,
      REDIS_URL: 'mock-redis-url',
      REDIS_TOKEN: 'mock-redis-token',
    };

    // Instantiate providers to return NEW mocks
    // Return unique simple objects to test factory logic (caching, arg passing)
    // Cast as any to satisfy specific type requirements minimally
    let memoryInstanceCounter = 0;
    MockMemoryStorageProvider.mockImplementation(() => ({
      _instanceId: `memory-${++memoryInstanceCounter}`,
      // Add minimal properties if TS complains further, but keep it simple
    } as any));

    let redisInstanceCounter = 0;
    MockRedisStorageProvider.mockImplementation(() => ({
      _instanceId: `redis-${++redisInstanceCounter}`,
    } as any));

    let vercelInstanceCounter = 0;
    MockVercelKvStorageProvider.mockImplementation(() => ({
      _instanceId: `vercel-${++vercelInstanceCounter}`,
    } as any));

    // Reset factory singleton or create new instance if needed
    // For simplicity assuming we get a clean factory state, might need adjustment
    // if factory state persists across tests in Jest environment.
    // Re-get instance for safety, assuming it resets internal cache or is fresh.
    StorageFactory['instance'] = undefined as any; // Force reset singleton for test isolation
    factory = StorageFactory.getInstance();
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  it('should return a MemoryStorageProvider', () => {
    const config: StorageProviderOptions = { type: 'memory', namespace: 'mem-test' };
    const provider = factory.getProvider(config);
    expect(provider).toBeDefined();
    expect(MockMemoryStorageProvider).toHaveBeenCalledTimes(1);
    // The memory factory function passes the full options object
    expect(MockMemoryStorageProvider).toHaveBeenCalledWith({ 
      type: 'memory', 
      namespace: 'mem-test',
      config: {}
    });
    expect(MockRedisStorageProvider).not.toHaveBeenCalled();
    expect(MockVercelKvStorageProvider).not.toHaveBeenCalled();
  });

  it('should return a RedisStorageProvider', () => {
    const redisConfig = { host: 'localhost', port: 6379 }; // This config is ignored by factory
    const config: StorageProviderOptions = {
      type: 'redis',
      namespace: 'redis-test',
      config: redisConfig
    };
    const provider = factory.getProvider(config);
    expect(provider).toBeDefined();
    expect(MockRedisStorageProvider).toHaveBeenCalledTimes(1);
    // Factory constructs options internally using namespace and process.env
    expect(MockRedisStorageProvider).toHaveBeenCalledWith({
      namespace: 'redis-test',
      url: 'mock-redis-url',
      token: 'mock-redis-token',
    });
    expect(MockMemoryStorageProvider).not.toHaveBeenCalled();
    expect(MockVercelKvStorageProvider).not.toHaveBeenCalled();
  });

  it('should return a VercelKvStorageProvider', () => {
    const kvConfig = { url: 'kv-url', token: 'kv-token' }; // This config is ignored by factory
    const config: StorageProviderOptions = {
      type: 'vercel-kv',
      namespace: 'kv-test',
      config: kvConfig
    };
    const provider = factory.getProvider(config);
    expect(provider).toBeDefined();
    expect(MockVercelKvStorageProvider).toHaveBeenCalledTimes(1);
    // Factory constructs options internally using only namespace
    expect(MockVercelKvStorageProvider).toHaveBeenCalledWith({ namespace: 'kv-test' });
    expect(MockMemoryStorageProvider).not.toHaveBeenCalled();
    expect(MockRedisStorageProvider).not.toHaveBeenCalled();
  });

  it('should throw an error for an unknown provider type', () => {
    const config: StorageProviderOptions = { type: 'unknown' as any };
    expect(() => factory.getProvider(config)).toThrowError("Provider type 'unknown' is not registered");
    expect(MockMemoryStorageProvider).not.toHaveBeenCalled();
    expect(MockRedisStorageProvider).not.toHaveBeenCalled();
    expect(MockVercelKvStorageProvider).not.toHaveBeenCalled();
  });

  it('should return the same instance for the same config (singleton behavior per config)', () => {
    const config: StorageProviderOptions = { type: 'memory', namespace: 'singleton-test' };
    const provider1 = factory.getProvider(config);
    const provider2 = factory.getProvider(config); // Should retrieve from cache
    expect(provider1).toBe(provider2); // Factory cache ensures identity
    // Constructor should only be called once for the first instantiation
    expect(MockMemoryStorageProvider).toHaveBeenCalledTimes(1);
    // Check constructor was called with the full options object
    expect(MockMemoryStorageProvider).toHaveBeenCalledWith({
      type: 'memory',
      namespace: 'singleton-test',
      config: {}
    });
  });

  it('should return different instances for different configs', () => {
    const config1: StorageProviderOptions = { type: 'memory', namespace: 'diff-test-1' };
    const config2: StorageProviderOptions = { type: 'memory', namespace: 'diff-test-2' };
    const provider1 = factory.getProvider(config1);
    const provider2 = factory.getProvider(config2); // Different namespace -> different cache key
    expect(provider1).not.toBe(provider2);
    expect(MockMemoryStorageProvider).toHaveBeenCalledTimes(2); // Called once for each config
    // Check constructor calls with the full options objects
    expect(MockMemoryStorageProvider).toHaveBeenNthCalledWith(1, {
      type: 'memory',
      namespace: 'diff-test-1',
      config: {}
    });
    expect(MockMemoryStorageProvider).toHaveBeenNthCalledWith(2, {
      type: 'memory',
      namespace: 'diff-test-2',
      config: {}
    });
  });

  describe('createProvider', () => {
    it('should return a new MemoryStorageProvider instance each time', () => {
      const config: StorageProviderOptions = { type: 'memory', namespace: 'create-mem-test' };
      const provider1 = factory.createProvider(config);
      const provider2 = factory.createProvider(config);

      expect(provider1).toBeDefined();
      expect(provider2).toBeDefined();
      expect(provider1).not.toBe(provider2); // Should be different instances
      expect(MockMemoryStorageProvider).toHaveBeenCalledTimes(2);
      expect(MockMemoryStorageProvider).toHaveBeenNthCalledWith(1, {
        type: 'memory',
        namespace: 'create-mem-test'
      });
      expect(MockMemoryStorageProvider).toHaveBeenNthCalledWith(2, {
        type: 'memory',
        namespace: 'create-mem-test'
      });
    });

    it('should return a new RedisStorageProvider instance each time', () => {
      const config: StorageProviderOptions = { type: 'redis', namespace: 'create-redis-test' };
      const provider1 = factory.createProvider(config);
      const provider2 = factory.createProvider(config);

      expect(provider1).toBeDefined();
      expect(provider2).toBeDefined();
      expect(provider1).not.toBe(provider2);
      expect(MockRedisStorageProvider).toHaveBeenCalledTimes(2);
      const expectedRedisOpts = {
        namespace: 'create-redis-test',
        url: 'mock-redis-url',
        token: 'mock-redis-token',
      };
      expect(MockRedisStorageProvider).toHaveBeenNthCalledWith(1, expectedRedisOpts);
      expect(MockRedisStorageProvider).toHaveBeenNthCalledWith(2, expectedRedisOpts);
    });

    it('should return a new VercelKvStorageProvider instance each time', () => {
      const config: StorageProviderOptions = { type: 'vercel-kv', namespace: 'create-kv-test' };
      const provider1 = factory.createProvider(config);
      const provider2 = factory.createProvider(config);

      expect(provider1).toBeDefined();
      expect(provider2).toBeDefined();
      expect(provider1).not.toBe(provider2);
      expect(MockVercelKvStorageProvider).toHaveBeenCalledTimes(2);
      const expectedVercelOpts = { namespace: 'create-kv-test' };
      expect(MockVercelKvStorageProvider).toHaveBeenNthCalledWith(1, expectedVercelOpts);
      expect(MockVercelKvStorageProvider).toHaveBeenNthCalledWith(2, expectedVercelOpts);
    });

    it('should throw an error for an unknown provider type', () => {
      const config: StorageProviderOptions = { type: 'unknown-create' as any, namespace: 'test' };
      expect(() => factory.createProvider(config)).toThrowError(
        "Provider type 'unknown-create' is not registered"
      );
      expect(MockMemoryStorageProvider).not.toHaveBeenCalled();
      expect(MockRedisStorageProvider).not.toHaveBeenCalled();
      expect(MockVercelKvStorageProvider).not.toHaveBeenCalled();
    });

    it('should use default type if type is not specified', () => {
      const config: Partial<StorageProviderOptions> = { namespace: 'create-default-test' }; // No type specified
      const provider = factory.createProvider(config as StorageProviderOptions);
      expect(provider).toBeDefined();
      // Default is 'memory' as per factory constructor
      expect(MockMemoryStorageProvider).toHaveBeenCalledTimes(1);
      // The factory uses the type to find the factory fn, but passes the original options obj
      expect(MockMemoryStorageProvider).toHaveBeenCalledWith({ namespace: 'create-default-test' });
    });
  });

  describe('Custom Provider Registration', () => {
    // Simple mock for a custom provider
    const mockCustomProviderInstance = { _instanceId: 'custom-1', type: 'custom' };
    const mockCustomProviderConstructor = jest.fn().mockReturnValue(mockCustomProviderInstance);
    const customFactoryFn = jest.fn((options) => {
      // Simulate factory passing options to constructor
      return mockCustomProviderConstructor(options);
    });

    beforeEach(() => {
      // Clear mocks for the custom provider before each test in this suite
      mockCustomProviderConstructor.mockClear();
      customFactoryFn.mockClear();
      // Reregister the custom provider for each test in this describe block
      // Note: This assumes the factory instance is reset by the outer beforeEach
      factory.registerProvider('custom', customFactoryFn);
    });

    it('should allow registering a new provider type', () => {
      // Registration happens in beforeEach, just check if factory knows it
      // (Implicit check: getProvider won't throw 'not registered' error)
      expect(() => factory.getProvider({ type: 'custom', namespace: 'custom-test-1' })).not.toThrow();
    });

    it('getProvider should create an instance using the registered custom factory', () => {
      const options = { type: 'custom' as const, namespace: 'custom-test-2', config: { foo: 'bar' } };
      const provider = factory.getProvider(options);

      expect(provider).toBe(mockCustomProviderInstance); // Should be the instance returned by the mock constructor
      expect(customFactoryFn).toHaveBeenCalledTimes(1);
      expect(customFactoryFn).toHaveBeenCalledWith(options); // Factory function receives full options
      expect(mockCustomProviderConstructor).toHaveBeenCalledTimes(1);
      expect(mockCustomProviderConstructor).toHaveBeenCalledWith(options); // Constructor receives options from factory fn
    });

    it('should cache custom provider instances', () => {
      const options = { type: 'custom' as const, namespace: 'custom-test-cache' };
      const provider1 = factory.getProvider(options);
      const provider2 = factory.getProvider(options);

      expect(provider1).toBe(provider2); // Should return cached instance
      expect(customFactoryFn).toHaveBeenCalledTimes(1); // Factory fn only called once
      expect(mockCustomProviderConstructor).toHaveBeenCalledTimes(1); // Constructor only called once
    });

    it('should allow setting a custom provider as the default', () => {
      factory.setDefaultType('custom');
      expect(factory.getDefaultType()).toBe('custom');
    });

    it('getDefaultProvider should return custom provider instance when set as default', () => {
      factory.setDefaultType('custom');
      const provider = factory.getDefaultProvider();

      expect(provider).toBe(mockCustomProviderInstance);
      expect(customFactoryFn).toHaveBeenCalledTimes(1);
      // Called with default namespace and the default type derived internally
      expect(customFactoryFn).toHaveBeenCalledWith({ type: 'custom', namespace: 'default', config: {} });
      expect(mockCustomProviderConstructor).toHaveBeenCalledTimes(1);
      expect(mockCustomProviderConstructor).toHaveBeenCalledWith({ type: 'custom', namespace: 'default', config: {} });
    });
  });

  describe('Default Provider Logic', () => {
    it('should have "memory" as the initial default type', () => {
      expect(factory.getDefaultType()).toBe('memory');
    });

    it('getDefaultProvider should initially return a memory provider', () => {
      const provider = factory.getDefaultProvider();
      expect(provider).toBeDefined();
      expect(MockMemoryStorageProvider).toHaveBeenCalledTimes(1);
      // Default provider uses 'default' namespace
      expect(MockMemoryStorageProvider).toHaveBeenCalledWith({ 
        type: 'memory', 
        namespace: 'default',
        config: {}
      });
      expect(MockRedisStorageProvider).not.toHaveBeenCalled();
      expect(MockVercelKvStorageProvider).not.toHaveBeenCalled();
      // Check caching - getting default provider again should not call constructor
      const provider2 = factory.getDefaultProvider();
      expect(provider2).toBe(provider);
      expect(MockMemoryStorageProvider).toHaveBeenCalledTimes(1); 
    });

    it('setDefaultType should change the default type', () => {
      factory.setDefaultType('redis');
      expect(factory.getDefaultType()).toBe('redis');
    });

    it('getDefaultProvider should return the new default provider after change', () => {
      factory.setDefaultType('redis');
      const provider = factory.getDefaultProvider();
      expect(provider).toBeDefined();
      expect(MockRedisStorageProvider).toHaveBeenCalledTimes(1);
      expect(MockRedisStorageProvider).toHaveBeenCalledWith({ 
        namespace: 'default', // Default namespace
        url: 'mock-redis-url',
        token: 'mock-redis-token'
      });
      expect(MockMemoryStorageProvider).not.toHaveBeenCalled();
      // Check caching for the new default type
      const provider2 = factory.getDefaultProvider();
      expect(provider2).toBe(provider);
      expect(MockRedisStorageProvider).toHaveBeenCalledTimes(1);
    });

    it('setDefaultType should throw error for unregistered type', () => {
      expect(() => factory.setDefaultType('unknown-default')).toThrowError(
        "Provider type 'unknown-default' is not registered"
      );
    });

    it('getProvider without type should use the current default type', () => {
      // Initial default is memory
      const providerMem = factory.getProvider({ namespace: 'no-type-test-mem' });
      expect(MockMemoryStorageProvider).toHaveBeenCalledTimes(1);
      expect(MockMemoryStorageProvider).toHaveBeenCalledWith({ 
        type: 'memory', // Default type used
        namespace: 'no-type-test-mem',
        config: {}
      });

      // Change default to redis
      factory.setDefaultType('redis');
      const providerRedis = factory.getProvider({ namespace: 'no-type-test-redis' });
      expect(MockRedisStorageProvider).toHaveBeenCalledTimes(1);
      expect(MockRedisStorageProvider).toHaveBeenCalledWith({ 
        namespace: 'no-type-test-redis', 
        url: 'mock-redis-url',
        token: 'mock-redis-token'
      });
      // Ensure memory mock was not called again
      expect(MockMemoryStorageProvider).toHaveBeenCalledTimes(1);
    });
  });

  it('should return different instances for different configs', () => {
    const config1: StorageProviderOptions = { type: 'memory', namespace: 'diff-test-1' };
    const config2: StorageProviderOptions = { type: 'memory', namespace: 'diff-test-2' };
    const provider1 = factory.getProvider(config1);
    const provider2 = factory.getProvider(config2); // Different namespace -> different cache key
    expect(provider1).not.toBe(provider2);
    expect(MockMemoryStorageProvider).toHaveBeenCalledTimes(2); // Called once for each config
    // Check constructor calls with the full options objects
    expect(MockMemoryStorageProvider).toHaveBeenNthCalledWith(1, {
      type: 'memory',
      namespace: 'diff-test-1',
      config: {}
    });
    expect(MockMemoryStorageProvider).toHaveBeenNthCalledWith(2, {
      type: 'memory',
      namespace: 'diff-test-2',
      config: {}
    });
  });

  it('should throw an error for Redis provider if REDIS_URL is not set', () => {
    // Temporarily unset the environment variable
    const originalRedisUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = undefined;

    const config: StorageProviderOptions = { type: 'redis', namespace: 'redis-no-url-test' };
    
    // Need to reset the factory instance because the factory function 
    // for 'redis' captured the env var existence during initial registration.
    // By resetting the singleton, the factory function will be re-evaluated when needed.
    StorageFactory['instance'] = undefined as any; 
    const freshFactory = StorageFactory.getInstance();

    expect(() => freshFactory.getProvider(config)).toThrowError(
      'REDIS_URL environment variable is required for Redis provider'
    );

    // Restore env var for other tests
    process.env.REDIS_URL = originalRedisUrl; 
    // Restore the original factory instance state if necessary, though beforeEach resets anyway
    // StorageFactory['instance'] = factory; // Revert if needed, but beforeEach resets anyway
  });

  it('should return a RedisStorageProvider', () => {
    const redisConfig = { host: 'localhost', port: 6379 }; // This config is ignored by factory
    const config: StorageProviderOptions = {
      type: 'redis',
      namespace: 'redis-test',
      config: redisConfig
    };
    const provider = factory.getProvider(config);
    expect(provider).toBeDefined();
    expect(MockRedisStorageProvider).toHaveBeenCalledTimes(1);
    // Factory constructs options internally using namespace and process.env
    expect(MockRedisStorageProvider).toHaveBeenCalledWith({
      namespace: 'redis-test',
      url: 'mock-redis-url',
      token: 'mock-redis-token',
    });
    expect(MockMemoryStorageProvider).not.toHaveBeenCalled();
    expect(MockVercelKvStorageProvider).not.toHaveBeenCalled();
  });
});
