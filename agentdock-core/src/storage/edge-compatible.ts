/**
 * @fileoverview Edge Runtime compatible storage exports.
 *
 * This file exports only the storage components that are compatible with
 * Edge Runtime (no Node.js dependencies like fs, path, etc.)
 */

// Export types (these are always safe)
export * from './types';

// Export base adapter (type-only, safe)
export { BaseStorageAdapter } from './base-adapter';

// Export Edge-compatible providers only
export { MemoryStorageProvider } from './providers/memory-provider';
export { VercelKVProvider } from './providers/vercel-kv-provider';

// Export Edge-compatible factory functions
export {
  EdgeStorageFactory,
  getEdgeStorageFactory,
  createEdgeStorageProvider
} from './edge-factory';

// Export factory type for compatibility
export type { StorageFactory } from './factory';

// Note: We intentionally exclude:
// - SQLiteAdapter (uses better-sqlite3 which needs fs/path)
// - PostgreSQLAdapter (uses pg which needs fs for SSL)
// - MongoDBAdapter (uses mongodb driver)
// - RedisStorageProvider (uses ioredis which has Node.js deps)
// - S3Adapter, DynamoDBAdapter, etc. (AWS SDK has Node.js deps)
// - Regular factory functions that import Node.js adapters
