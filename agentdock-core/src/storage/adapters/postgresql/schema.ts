/**
 * @fileoverview PostgreSQL schema creation and management
 */

import { Pool } from 'pg';

import { LogCategory, logger } from '../../../logging';
import { parseSqlIdentifier, quotePgIdentifier } from '../../utils/sql-utils';

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

  // Validate and quote schema name safely
  const validatedSchema = parseSqlIdentifier(schema, 'schema name');
  const quotedSchema = quotePgIdentifier(validatedSchema);

  const client = await pool.connect();
  try {
    // Create schema if it doesn't exist
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${quotedSchema}`);

    // Create memories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${quotedSchema}.memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        importance DECIMAL(3,2) NOT NULL DEFAULT 0.5,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        access_count INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Create indexes for efficient queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memories_user_agent 
      ON ${quotedSchema}.memories(user_id, agent_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memories_type 
      ON ${quotedSchema}.memories(type)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memories_importance 
      ON ${quotedSchema}.memories(importance DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memories_created_at 
      ON ${quotedSchema}.memories(created_at DESC)
    `);

    // Create memory connections table for relationship mapping
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${quotedSchema}.memory_connections (
        id SERIAL PRIMARY KEY,
        from_memory_id TEXT NOT NULL,
        to_memory_id TEXT NOT NULL,
        connection_type TEXT NOT NULL,
        strength DECIMAL(3,2) NOT NULL DEFAULT 0.5,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (from_memory_id) REFERENCES ${quotedSchema}.memories(id) ON DELETE CASCADE,
        FOREIGN KEY (to_memory_id) REFERENCES ${quotedSchema}.memories(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for memory connections
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memory_connections_from 
      ON ${quotedSchema}.memory_connections(from_memory_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memory_connections_to 
      ON ${quotedSchema}.memory_connections(to_memory_id)
    `);

    logger.info(
      LogCategory.STORAGE,
      'PostgreSQLSchema',
      'Database schema initialized successfully',
      { schema: validatedSchema }
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'PostgreSQLSchema',
      'Failed to initialize database schema',
      { schema: validatedSchema, error }
    );
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Drop all tables in the schema
 */
export async function dropSchema(pool: Pool, schema: string): Promise<void> {
  // Validate and quote schema name safely
  const validatedSchema = parseSqlIdentifier(schema, 'schema name');
  const quotedSchema = quotePgIdentifier(validatedSchema);

  const client = await pool.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);

    logger.info(
      LogCategory.STORAGE,
      'PostgreSQLSchema',
      'Schema dropped successfully',
      { schema: validatedSchema }
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'PostgreSQLSchema',
      'Failed to drop schema',
      { schema: validatedSchema, error }
    );
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check if schema exists
 */
export async function schemaExists(
  pool: Pool,
  schema: string
): Promise<boolean> {
  // Validate schema name
  const validatedSchema = parseSqlIdentifier(schema, 'schema name');

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)',
      [validatedSchema]
    );

    return result.rows[0]?.exists || false;
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'PostgreSQLSchema',
      'Failed to check schema existence',
      { schema: validatedSchema, error }
    );
    return false;
  } finally {
    client.release();
  }
}
