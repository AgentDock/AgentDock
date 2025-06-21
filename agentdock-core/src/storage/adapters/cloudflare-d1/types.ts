/**
 * @fileoverview Cloudflare D1-specific types and interfaces
 */

/**
 * Cloudflare D1 database interface
 * This matches the D1 API from Cloudflare Workers
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
  dump(): Promise<ArrayBuffer>;
}

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[][]>;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: any;
}

/**
 * Configuration options for Cloudflare D1 adapter
 */
export interface CloudflareD1AdapterOptions {
  /**
   * D1 database binding
   * In Workers: env.MY_D1_DATABASE
   */
  d1Database: D1Database;

  /**
   * Default namespace for this adapter instance
   */
  namespace?: string;

  /**
   * Table name for key-value storage
   * Default: 'agentdock_kv'
   */
  kvTableName?: string;

  /**
   * Table name for list storage
   * Default: 'agentdock_lists'
   */
  listTableName?: string;

  /**
   * Enable automatic cleanup of expired items
   * Default: true
   */
  enableCleanup?: boolean;

  /**
   * Cleanup interval in seconds
   * Default: 3600 (1 hour)
   */
  cleanupInterval?: number;
}

/**
 * Internal row structure for key-value storage
 */
export interface D1KVRow {
  id: string;
  namespace: string;
  key: string;
  value: string;
  expires_at?: number;
  metadata?: string;
  created_at: number;
  updated_at: number;
}

/**
 * Internal row structure for list storage
 */
export interface D1ListRow {
  id: string;
  namespace: string;
  key: string;
  position: number;
  value: string;
  expires_at?: number;
  created_at: number;
}

/**
 * Connection wrapper for Cloudflare D1
 */
export interface CloudflareD1Connection {
  db: D1Database;
  kvTableName: string;
  listTableName: string;
  defaultNamespace?: string;
  enableCleanup: boolean;
  cleanupInterval: number;
}
