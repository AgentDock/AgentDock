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

  /**
   * Create a new database connection
   */
  protected async createConnection(): Promise<PostgreSQLConnection> {
    const {
      connectionString,
      connection,
      pool: poolConfig = {},
      namespace,
      schema = 'public',
      ssl,
      preparedStatements = true
    } = this.config;

    // Create connection pool with improved performance settings
    const poolOptions: any = {
      connectionString,
      max: poolConfig.max || 50, // Increased from 10 to 50 connections
      idleTimeoutMillis: poolConfig.idleTimeoutMillis || 300000, // Increased from 30s to 5 minutes
      connectionTimeoutMillis: poolConfig.connectionTimeoutMillis || 2000,
      ...connection
    };

    if (ssl !== undefined) {
      poolOptions.ssl = ssl;
    }

    const pool = new Pool(poolOptions);

    // Error handling for pool
    pool.on('error', (err) => {
      logger.error(LogCategory.STORAGE, 'PostgreSQLConnection', 'Pool error', {
        error: err.message
      });
    });

    // Create connection object
    const conn: PostgreSQLConnection = {
      pool,
      defaultNamespace: namespace,
      schema,
      preparedStatements,
      initialized: false
    };

    // Initialize schema
    await initializeSchema(pool, schema);
    conn.initialized = true;

    // Start cleanup interval
    this.startCleanupInterval(conn);

    logger.debug(
      LogCategory.STORAGE,
      'PostgreSQLConnection',
      'Connection pool established',
      {
        schema,
        namespace,
        preparedStatements
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
    if (this.connection?.pool) {
      try {
        await this.connection.pool.end();
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
    return !!(this.connection?.pool && !this.connection.pool.ending);
  }

  /**
   * Start cleanup interval for expired items
   */
  private startCleanupInterval(connection: PostgreSQLConnection): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(
      async () => {
        try {
          await cleanupExpired(connection.pool, connection.schema);
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
