/**
 * @fileoverview PostgreSQL connection management
 */

import { Pool } from 'pg';

import { LogCategory, logger } from '../../../logging';
import { BaseConnectionManager } from '../../utils';
import { cleanupExpired, initializeSchema } from './schema';
import { PostgreSQLAdapterOptions, PostgreSQLConnection } from './types';

export class PostgreSQLConnectionManager extends BaseConnectionManager<
  PostgreSQLAdapterOptions,
  PostgreSQLConnection
> {
  private cleanupInterval?: NodeJS.Timeout;
  private options: PostgreSQLAdapterOptions;
  private pool?: Pool;

  constructor(options: PostgreSQLAdapterOptions = {}) {
    super(options);
    this.options = {
      connectionString: options.connectionString || undefined,
      connection: {
        host:
          process.env.POSTGRES_HOST || options.connection?.host || 'localhost',
        port: process.env.POSTGRES_PORT
          ? parseInt(process.env.POSTGRES_PORT)
          : options.connection?.port || 5432,
        database:
          process.env.POSTGRES_DB ||
          options.connection?.database ||
          'agentdock',
        user:
          process.env.POSTGRES_USER || options.connection?.user || 'postgres',
        password:
          process.env.POSTGRES_PASSWORD || options.connection?.password || ''
      },
      pool: {
        max: options.pool?.max || 20, // Maximum pool size (prevent resource exhaustion)
        idleTimeoutMillis: options.pool?.idleTimeoutMillis || 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: options.pool?.connectionTimeoutMillis || 2000 // 2 second timeout for acquiring connections
      },
      namespace: options.namespace || undefined,
      schema: process.env.POSTGRES_SCHEMA || options.schema || 'public',
      ssl:
        options.ssl !== undefined
          ? options.ssl
          : process.env.NODE_ENV === 'production',
      preparedStatements: options.preparedStatements ?? true,
      ...options
    };
  }

  /**
   * Create a new database connection
   */
  protected async createConnection(): Promise<PostgreSQLConnection> {
    if (!this.pool) {
      // Use connection string if provided, otherwise use individual connection options
      const poolConfig = this.options.connectionString
        ? { connectionString: this.options.connectionString }
        : {
            host: this.options.connection?.host,
            port: this.options.connection?.port,
            database: this.options.connection?.database,
            user: this.options.connection?.user,
            password: this.options.connection?.password
          };

      this.pool = new Pool({
        ...poolConfig,
        ssl: this.options.ssl,
        max: this.options.pool?.max,
        idleTimeoutMillis: this.options.pool?.idleTimeoutMillis,
        connectionTimeoutMillis: this.options.pool?.connectionTimeoutMillis,
        // Additional security and performance settings
        application_name: 'agentdock-core',
        lock_timeout: 5000, // 5 second lock timeout
        idle_in_transaction_session_timeout: 60000 // 1 minute idle transaction timeout
      });

      // Handle pool events for monitoring
      this.pool.on('connect', () => {
        logger.debug(
          LogCategory.STORAGE,
          'PostgreSQLConnection',
          'New client connected'
        );
      });

      this.pool.on('remove', () => {
        logger.debug(
          LogCategory.STORAGE,
          'PostgreSQLConnection',
          'Client removed'
        );
      });

      this.pool.on('error', (err) => {
        logger.error(
          LogCategory.STORAGE,
          'PostgreSQLConnection',
          'Pool error',
          {
            error: err.message
          }
        );
      });
    }

    // Create connection object
    const conn: PostgreSQLConnection = {
      pool: this.pool,
      schema: this.options.schema || 'public',
      preparedStatements: this.options.preparedStatements ?? true,
      initialized: false
    };

    // Initialize schema
    await initializeSchema(this.pool, this.options.schema || 'public');
    conn.initialized = true;

    // Start cleanup interval
    this.startCleanupInterval(conn);

    logger.debug(
      LogCategory.STORAGE,
      'PostgreSQLConnection',
      'Connection pool established',
      {
        schema: this.options.schema
      }
    );

    return conn;
  }

  /**
   * Close the actual connection
   */
  protected async closeConnection(): Promise<void> {
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Close pool
    if (this.pool) {
      try {
        await this.pool.end();
        logger.debug(
          LogCategory.STORAGE,
          'PostgreSQLConnection',
          'Connection pool closed'
        );
      } catch (error) {
        logger.warn(
          LogCategory.STORAGE,
          'PostgreSQLConnection',
          'Pool close failed',
          {
            error: error instanceof Error ? error.message : String(error)
          }
        );
      }
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return !!(this.pool && !this.pool.ending);
  }

  /**
   * Start cleanup interval for expired items
   */
  private startCleanupInterval(connection: PostgreSQLConnection): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(
      async () => {
        try {
          if (this.pool) {
            await cleanupExpired(this.pool, connection.schema);
          }
        } catch (error) {
          logger.warn(
            LogCategory.STORAGE,
            'PostgreSQLConnection',
            'Cleanup failed',
            {
              error: error instanceof Error ? error.message : String(error)
            }
          );
        }
      },
      5 * 60 * 1000
    );
  }
}

// Export convenience functions for backward compatibility
export async function createConnection(
  options: PostgreSQLAdapterOptions = {}
): Promise<PostgreSQLConnection> {
  const manager = new PostgreSQLConnectionManager(options);
  return manager.getConnection();
}

export async function closeConnection(
  connection: PostgreSQLConnection
): Promise<void> {
  // This is a legacy function - new code should use PostgreSQLConnectionManager
  if (connection.pool) {
    await connection.pool.end();
  }
}
