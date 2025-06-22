/**
 * @fileoverview Storage abstraction layer exports.
 *
 * This file exports all public APIs for the storage abstraction layer.
 *
 * NOTE: Node.js-dependent adapters (SQLite, PostgreSQL, MongoDB, etc.) are NOT exported here
 * to prevent client-side bundling issues. Use registerNodeAdapters() server-side instead.
 */

// Export types
export * from './types';

// Export migration tools
export { StorageMigrator, createMigrator } from './migration';
export type {
  MigrationOptions,
  MigrationProgress,
  MigrationResult
} from './migration';

// Export base adapter
export { BaseStorageAdapter } from './base-adapter';

// Export factory functions
export {
  StorageFactory,
  getStorageFactory,
  createStorageProvider,
  getDefaultStorageProvider
} from './factory';

// Export Edge-compatible providers only
export { MemoryStorageProvider } from './providers/memory-provider';
export { RedisStorageProvider } from './providers/redis-provider';
export { VercelKVProvider } from './providers/vercel-kv-provider';

// NOTE: Node.js adapters are NOT exported here. They must be registered server-side.
// In the future, this could be done using:
// import { registerNodeAdapters } from 'agentdock-core/storage/register-node-adapters';
// await registerNodeAdapters();

// Export adapter registry functions (for server-side use only)
export {
  registerSQLiteAdapter,
  registerPostgreSQLAdapter,
  registerPostgreSQLVectorAdapter,
  registerMongoDBAdapter,
  registerCloudAdapters,
  registerVectorAdapters,
  registerAgentChatAdapters,
  isAdapterRegistered
} from './adapters/registry';
