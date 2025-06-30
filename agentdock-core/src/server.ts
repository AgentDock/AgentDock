/**
 * @fileoverview AgentDock Core - Server-only exports
 *
 * This module contains Node.js-specific adapters and functionality
 * that should only be used in server environments (API routes, server components).
 *
 * Usage:
 * ```typescript
 * import { SQLiteAdapter, PostgreSQLAdapter } from '@agentdock/core/server';
 * ```
 */

//=============================================================================
// Server-only Storage Adapters
//=============================================================================

/**
 * Node.js storage adapters that require filesystem and native modules
 */
export { SQLiteAdapter } from './storage/adapters/sqlite';
export { SQLiteVecAdapter } from './storage/adapters/sqlite-vec';
export { PostgreSQLAdapter } from './storage/adapters/postgresql';
export { PostgreSQLVectorAdapter } from './storage/adapters/postgresql-vector';

//=============================================================================
// Server-only Registration Functions
//=============================================================================

/**
 * Adapter registration functions for server environments
 */
export {
  registerSQLiteAdapter,
  registerSQLiteVecAdapter,
  registerPostgreSQLAdapter,
  registerPostgreSQLVectorAdapter,
  registerAgentChatAdapters
} from './storage/adapters/registry';

//=============================================================================
// Server-only Types
//=============================================================================

/**
 * Re-export types that are commonly used with server adapters
 */
export type {
  StorageProvider,
  StorageOptions,
  StorageProviderOptions
} from './storage/types';
