/**
 * @fileoverview PostgreSQL-specific types and interfaces
 */

import { Pool, PoolClient } from 'pg';

/**
 * Configuration options for PostgreSQL adapter
 */
export interface PostgreSQLAdapterOptions {
  /**
   * PostgreSQL connection string
   * Example: postgresql://user:password@localhost:5432/database
   */
  connectionString?: string;

  /**
   * Alternative to connection string - individual connection options
   */
  connection?: {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
  };

  /**
   * Connection pool configuration
   */
  pool?: {
    max?: number; // Maximum number of clients in pool (default: 10)
    idleTimeoutMillis?: number; // How long a client can sit idle (default: 30000)
    connectionTimeoutMillis?: number; // How long to wait for connection (default: 2000)
  };

  /**
   * Default namespace for this adapter instance
   */
  namespace?: string;

  /**
   * Schema name (default: 'public')
   */
  schema?: string;

  /**
   * Enable SSL connection
   */
  ssl?: boolean | any;

  /**
   * Enable prepared statements for better performance
   * Default: true
   */
  preparedStatements?: boolean;
}

/**
 * Internal connection wrapper for PostgreSQL
 */
export interface PostgreSQLConnection {
  pool: Pool;
  defaultNamespace?: string;
  schema: string;
  cleanupInterval?: NodeJS.Timeout;
  preparedStatements: boolean;
  initialized: boolean;
}

/**
 * Row type for key-value store
 */
export interface KVRow {
  key: string;
  value: any; // JSONB type in PostgreSQL
  expires_at?: bigint | null;
  namespace?: string | null;
  metadata?: any | null; // JSONB type
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Row type for list store
 */
export interface ListRow {
  key: string;
  position: number;
  value: any; // JSONB type
  namespace?: string | null;
  created_at?: Date;
}
