/**
 * @fileoverview Central SQL identifier validation and escaping
 * Prevents SQL injection attacks across all database adapters
 */

import { z } from 'zod';

// SQL reserved words that should never be used as identifiers
const SQL_RESERVED_WORDS = new Set([
  'select',
  'insert',
  'update',
  'delete',
  'drop',
  'create',
  'alter',
  'table',
  'index',
  'view',
  'database',
  'schema',
  'user',
  'role',
  'grant',
  'revoke',
  'union',
  'where',
  'having',
  'group',
  'order',
  'by',
  'from',
  'join',
  'inner',
  'outer',
  'left',
  'right',
  'full',
  'cross',
  'on',
  'using',
  'natural',
  'into',
  'values',
  'set',
  'case',
  'when',
  'then',
  'else',
  'end',
  'if',
  'exists',
  'not',
  'null',
  'true',
  'false',
  'and',
  'or',
  'between',
  'in',
  'like',
  'is',
  'distinct',
  'all',
  'any',
  'some'
]);

// PostgreSQL identifier schema (folds to lowercase)
const PostgreSQLIdentifierSchema = z
  .string()
  .min(1, 'Identifier cannot be empty')
  .max(63, 'PostgreSQL identifier too long (max 63 characters)')
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid PostgreSQL identifier format')
  .transform((str) => str.toLowerCase())
  .refine(
    (str) => !SQL_RESERVED_WORDS.has(str),
    'Cannot use SQL reserved word as identifier'
  );

// SQLite identifier schema (case-sensitive)
const SQLiteIdentifierSchema = z
  .string()
  .min(1, 'Identifier cannot be empty')
  .max(63, 'SQLite identifier too long (max 63 characters)')
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid SQLite identifier format')
  .refine(
    (str) => !SQL_RESERVED_WORDS.has(str.toLowerCase()),
    'Cannot use SQL reserved word as identifier'
  );

// Environment-based configuration with secure defaults
const ALLOWED_SCHEMAS = process.env.ALLOWED_DB_SCHEMAS
  ? process.env.ALLOWED_DB_SCHEMAS.split(',').map((s) => s.trim().toLowerCase())
  : ['public', 'agentdock', 'test'];

const ALLOWED_COLLECTIONS = process.env.ALLOWED_VECTOR_COLLECTIONS
  ? process.env.ALLOWED_VECTOR_COLLECTIONS.split(',').map((s) => s.trim())
  : [
      'memory_embeddings',
      'document_embeddings',
      'user_embeddings',
      'agent_memories'
    ];

const ALLOWED_TABLES = process.env.ALLOWED_DB_TABLES
  ? process.env.ALLOWED_DB_TABLES.split(',').map((s) => s.trim().toLowerCase())
  : [
      'memories',
      'memory_connections',
      'procedural_patterns',
      'kv_store',
      'list_store'
    ];

// Branded types for compile-time safety
export type PostgreSQLSchema = string & { __brand: 'PostgreSQLSchema' };
export type SQLiteCollection = string & { __brand: 'SQLiteCollection' };
export type TableName = string & { __brand: 'TableName' };

export class SQLIdentifierValidator {
  /**
   * Validate PostgreSQL schema name with whitelist enforcement
   */
  static validatePostgreSQLSchema(schema: string): PostgreSQLSchema {
    const validated = PostgreSQLIdentifierSchema.parse(schema);

    if (!ALLOWED_SCHEMAS.includes(validated)) {
      throw new Error(
        `Schema '${schema}' not in allowed list: ${ALLOWED_SCHEMAS.join(', ')}`
      );
    }

    return validated as PostgreSQLSchema;
  }

  /**
   * Validate SQLite collection name with whitelist enforcement
   */
  static validateSQLiteCollection(collection: string): SQLiteCollection {
    const validated = SQLiteIdentifierSchema.parse(collection);

    if (!ALLOWED_COLLECTIONS.includes(validated)) {
      throw new Error(
        `Collection '${collection}' not in allowed list: ${ALLOWED_COLLECTIONS.join(', ')}`
      );
    }

    return validated as SQLiteCollection;
  }

  /**
   * Validate table name with whitelist enforcement
   */
  static validateTableName(table: string): TableName {
    const validated = PostgreSQLIdentifierSchema.parse(table);

    if (!ALLOWED_TABLES.includes(validated)) {
      throw new Error(
        `Table '${table}' not in allowed list: ${ALLOWED_TABLES.join(', ')}`
      );
    }

    return validated as TableName;
  }

  /**
   * PostgreSQL identifier escaping (quote_ident behavior)
   * Doubles any quotes and wraps in double quotes
   */
  static escapePostgreSQL(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * SQLite identifier escaping
   * Uses double quotes like PostgreSQL
   */
  static escapeSQLite(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * Validate and escape PostgreSQL schema
   */
  static securePostgreSQLSchema(schema: string): string {
    const validated = this.validatePostgreSQLSchema(schema);
    return this.escapePostgreSQL(validated);
  }

  /**
   * Validate and escape SQLite collection
   */
  static secureSQLiteCollection(collection: string): string {
    const validated = this.validateSQLiteCollection(collection);
    return this.escapeSQLite(validated);
  }

  /**
   * Validate and escape table name
   */
  static secureTableName(table: string): string {
    const validated = this.validateTableName(table);
    return this.escapePostgreSQL(validated);
  }

  /**
   * Check if identifier is in whitelist without throwing
   */
  static isAllowedSchema(schema: string): boolean {
    try {
      this.validatePostgreSQLSchema(schema);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if collection is in whitelist without throwing
   */
  static isAllowedCollection(collection: string): boolean {
    try {
      this.validateSQLiteCollection(collection);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if table is in whitelist without throwing
   */
  static isAllowedTable(table: string): boolean {
    try {
      this.validateTableName(table);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Type-safe branded constructor functions
 */
export function toPostgreSQLSchema(schema: string): PostgreSQLSchema {
  return SQLIdentifierValidator.validatePostgreSQLSchema(schema);
}

export function toSQLiteCollection(collection: string): SQLiteCollection {
  return SQLIdentifierValidator.validateSQLiteCollection(collection);
}

export function toTableName(table: string): TableName {
  return SQLIdentifierValidator.validateTableName(table);
}
