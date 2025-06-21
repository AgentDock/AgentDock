/**
 * @fileoverview Storage abstraction layer exports.
 *
 * This file exports all public APIs for the storage abstraction layer.
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

// Export providers
export { MemoryStorageProvider } from './providers/memory-provider';
export { RedisStorageProvider } from './providers/redis-provider';
export { VercelKVProvider } from './providers/vercel-kv-provider';

// Export adapters
export { SQLiteAdapter } from './adapters/sqlite';
export { PostgreSQLAdapter } from './adapters/postgresql';
export { MongoDBAdapter } from './adapters/mongodb';
export { S3Adapter } from './adapters/s3';
export { DynamoDBAdapter } from './adapters/dynamodb';

// Export adapter configurations
export type { SQLiteAdapterOptions } from './adapters/sqlite/types';
export type { PostgreSQLAdapterOptions } from './adapters/postgresql/types';
export type { MongoDBConfig } from './adapters/mongodb/types';
export type { S3Config } from './adapters/s3/types';
export type { DynamoDBConfig } from './adapters/dynamodb/types';
