/**
 * @fileoverview PostgreSQL schema creation and management
 */

import { Pool } from 'pg';

import { LogCategory, logger } from '../../../logging';
import { SQLIdentifierValidator } from '../shared/sql-identifier-validator';

/**
 * Initialize database tables and indexes
 */
export async function initializeSchema(
  pool: Pool,
  schema: string
): Promise<void> {
  logger.debug(
    LogCategory.STORAGE,
    'PostgreSQLSchema',
    'Initializing database schema',
    { schema }
  );

  // Validate and escape schema name to prevent SQL injection
  const secureSchema = SQLIdentifierValidator.securePostgreSQLSchema(schema);

  const client = await pool.connect();
  try {
    // Create schema if it doesn't exist
    if (schema !== 'public') {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${secureSchema}`);
    }

    // Create tables with validated schema name
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${secureSchema}.kv_store (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        expires_at BIGINT,
        namespace TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${schema}_kv_namespace 
      ON ${secureSchema}.kv_store(namespace)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${schema}_kv_expires_at 
      ON ${secureSchema}.kv_store(expires_at)
      WHERE expires_at IS NOT NULL
    `);

    // List table with validated schema name
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${secureSchema}.list_store (
        key TEXT NOT NULL,
        position INTEGER NOT NULL,
        value JSONB NOT NULL,
        namespace TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (key, position)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${schema}_list_namespace 
      ON ${secureSchema}.list_store(namespace)
    `);

    logger.debug(
      LogCategory.STORAGE,
      'PostgreSQLSchema',
      'Schema initialization complete'
    );
  } finally {
    client.release();
  }
}

/**
 * Clean up expired items from the database
 */
export async function cleanupExpired(
  pool: Pool,
  schema: string
): Promise<number> {
  // Validate and escape schema name to prevent SQL injection
  const secureSchema = SQLIdentifierValidator.securePostgreSQLSchema(schema);

  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      DELETE FROM ${secureSchema}.kv_store 
      WHERE expires_at IS NOT NULL 
      AND expires_at < $1
    `,
      [Date.now()]
    );

    if (result.rowCount && result.rowCount > 0) {
      logger.debug(
        LogCategory.STORAGE,
        'PostgreSQLSchema',
        'Cleaned up expired items',
        {
          count: result.rowCount
        }
      );
    }

    return result.rowCount || 0;
  } catch (error) {
    logger.warn(LogCategory.STORAGE, 'PostgreSQLSchema', 'Cleanup failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    return 0;
  } finally {
    client.release();
  }
}
