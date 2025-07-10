/**
 * @fileoverview PostgreSQL connection management
 */

import { Pool, PoolConfig } from 'pg';

import { LogCategory, logger } from '../../../logging';
import { BaseConnectionManager } from '../../utils';
import { initializeSchema } from './schema';
import { PostgreSQLAdapterOptions, PostgreSQLConnection } from './types';

export class PostgreSQLConnectionManager extends BaseConnectionManager<
  PostgreSQLAdapterOptions,
  PostgreSQLConnection
> {
  /**
   * Create a new database connection
   */
  protected async createConnection(): Promise<PostgreSQLConnection> {
    const poolConfig: PoolConfig = {
      host: this.config.connection?.host || 'localhost',
      port: this.config.connection?.port || 5432,
      database: this.config.connection?.database || 'agentdock',
      user: this.config.connection?.user || 'postgres',
      password: this.config.connection?.password || '',
      ssl: this.config.ssl,
      // Connection pool settings
      max: this.config.pool?.max || 10,
      idleTimeoutMillis: this.config.pool?.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: this.config.pool?.connectionTimeoutMillis || 2000
    };

    // Use connection string if provided
    if (this.config.connectionString) {
      const pool = new Pool({ connectionString: this.config.connectionString });
    } else {
      const pool = new Pool(poolConfig);
    }

    const pool = new Pool(
      this.config.connectionString
        ? {
            connectionString: this.config.connectionString,
            ssl: this.config.ssl
          }
        : poolConfig
    );

    // Test the connection
    try {
      const client = await pool.connect();
      client.release();
      logger.info(LogCategory.STORAGE, 'PostgreSQL', 'Connection established');
    } catch (error) {
      await pool.end();
      throw new Error(`Failed to connect to PostgreSQL: ${error}`);
    }

    // Initialize schema
    const schema = this.config.schema || 'public';
    await initializeSchema(pool, schema);

    return {
      pool,
      schema,
      preparedStatements: this.config.preparedStatements ?? true,
      initialized: true
    };
  }

  /**
   * Close a database connection
   */
  protected async closeConnection(): Promise<void> {
    // This method signature is inherited from BaseConnectionManager
    const connection = await this.getConnection();
    await connection.pool.end();
    logger.info(LogCategory.STORAGE, 'PostgreSQL', 'Connection closed');
  }

  /**
   * Test a database connection
   */
  protected async testConnection(
    connection: PostgreSQLConnection
  ): Promise<boolean> {
    try {
      const client = await connection.pool.connect();
      client.release();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    try {
      // Check if we have an active connection
      const connection = this.connection;
      return !!(connection && !connection.pool.ending);
    } catch {
      return false;
    }
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
