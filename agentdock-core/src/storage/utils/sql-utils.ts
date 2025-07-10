/**
 * @fileoverview Simple SQL utilities for safe identifier handling
 * Provides basic validation and escaping for SQL identifiers and field keys
 */

/** Represents a validated SQL identifier (e.g., table or column name). */
type SqlIdentifier = string & { __brand: 'SqlIdentifier' };

/** Represents a validated dot-separated SQL field key. */
type FieldKey = string & { __brand: 'FieldKey' };

const SQL_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Parses and returns a valid SQL identifier (such as a table or column name).
 * The identifier must:
 *   - Start with a letter (a-z, A-Z) or underscore (_)
 *   - Contain only letters, numbers, or underscores
 *   - Be at most 63 characters long
 *
 * @param name - The identifier string to parse.
 * @param kind - Optional label for error messages (e.g., 'table name').
 * @returns The validated identifier as a branded type.
 * @throws {Error} If the identifier does not conform to SQL naming rules.
 *
 * @example
 * const id = parseSqlIdentifier('my_table'); // Ok
 * parseSqlIdentifier('123table'); // Throws error
 */
export function parseSqlIdentifier(
  name: string,
  kind = 'identifier'
): SqlIdentifier {
  if (!SQL_IDENTIFIER_PATTERN.test(name) || name.length > 63) {
    throw new Error(
      `Invalid ${kind}: ${name}. Must start with a letter or underscore, contain only letters, numbers, or underscores, and be at most 63 characters long.`
    );
  }
  return name as SqlIdentifier;
}

/**
 * Parses and returns a valid dot-separated SQL field key (e.g., 'user.profile.name').
 * Each segment must:
 *   - Start with a letter (a-z, A-Z) or underscore (_)
 *   - Contain only letters, numbers, or underscores
 *   - Be at most 63 characters long
 *
 * @param key - The dot-separated field key string to parse.
 * @returns The validated field key as a branded type.
 * @throws {Error} If any segment of the key is invalid.
 *
 * @example
 * const key = parseFieldKey('user_profile.name'); // Ok
 * parseFieldKey('user..name'); // Throws error
 * parseFieldKey('user.123name'); // Throws error
 */
export function parseFieldKey(key: string): FieldKey {
  if (!key) throw new Error('Field key cannot be empty');
  const segments = key.split('.');
  for (const segment of segments) {
    if (!SQL_IDENTIFIER_PATTERN.test(segment) || segment.length > 63) {
      throw new Error(`Invalid field key segment: ${segment} in ${key}`);
    }
  }
  return key as FieldKey;
}

/**
 * Safely quote a SQL identifier for PostgreSQL
 * @param identifier - The identifier to quote
 * @returns The quoted identifier
 */
export function quotePgIdentifier(identifier: string): string {
  // Parse first to ensure it's valid
  const validated = parseSqlIdentifier(identifier);
  // PostgreSQL identifier quoting - escape quotes by doubling them
  return `"${validated.replace(/"/g, '""')}"`;
}

/**
 * Predefined table names used throughout the system
 */
export const TABLE_NAMES = {
  MEMORY_EMBEDDINGS: 'memory_embeddings',
  DOCUMENT_EMBEDDINGS: 'document_embeddings',
  USER_EMBEDDINGS: 'user_embeddings',
  AGENT_MEMORIES: 'agent_memories',
  VEC_COLLECTIONS: 'vec_collections'
} as const;

export type TableName = (typeof TABLE_NAMES)[keyof typeof TABLE_NAMES];
