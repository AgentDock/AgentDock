/**
 * @fileoverview Tests for SQL identifier validation and escaping
 */

import { describe, expect, it } from '@jest/globals';

import { SQLIdentifierValidator } from '../sql-identifier-validator';

describe('SQLIdentifierValidator', () => {
  describe('PostgreSQL Schema Validation', () => {
    it('should validate valid schema names', () => {
      expect(SQLIdentifierValidator.validatePostgreSQLSchema('public')).toBe(
        'public'
      );
      expect(SQLIdentifierValidator.validatePostgreSQLSchema('agentdock')).toBe(
        'agentdock'
      );
      expect(SQLIdentifierValidator.validatePostgreSQLSchema('test')).toBe(
        'test'
      );
    });

    it('should reject invalid schema names', () => {
      expect(() => SQLIdentifierValidator.validatePostgreSQLSchema('')).toThrow(
        'Identifier cannot be empty'
      );
      expect(() =>
        SQLIdentifierValidator.validatePostgreSQLSchema('123invalid')
      ).toThrow('Invalid PostgreSQL identifier format');
      expect(() =>
        SQLIdentifierValidator.validatePostgreSQLSchema('invalid-name')
      ).toThrow('Invalid PostgreSQL identifier format');
      expect(() =>
        SQLIdentifierValidator.validatePostgreSQLSchema('invalid.name')
      ).toThrow('Invalid PostgreSQL identifier format');
      expect(() =>
        SQLIdentifierValidator.validatePostgreSQLSchema('a'.repeat(64))
      ).toThrow('PostgreSQL identifier too long');
    });

    it('should reject SQL reserved words', () => {
      expect(() =>
        SQLIdentifierValidator.validatePostgreSQLSchema('select')
      ).toThrow('Cannot use SQL reserved word');
      expect(() =>
        SQLIdentifierValidator.validatePostgreSQLSchema('table')
      ).toThrow('Cannot use SQL reserved word');
      expect(() =>
        SQLIdentifierValidator.validatePostgreSQLSchema('DROP')
      ).toThrow('Cannot use SQL reserved word');
    });

    it('should reject schemas not in whitelist', () => {
      expect(() =>
        SQLIdentifierValidator.validatePostgreSQLSchema('hacker_schema')
      ).toThrow('not in allowed list');
      expect(() =>
        SQLIdentifierValidator.validatePostgreSQLSchema('MySchema')
      ).toThrow('not in allowed list'); // myschema not in whitelist
    });

    it('should normalize case and validate against whitelist', () => {
      // These should work because they normalize to whitelisted values
      expect(SQLIdentifierValidator.validatePostgreSQLSchema('PUBLIC')).toBe(
        'public'
      );
      expect(SQLIdentifierValidator.validatePostgreSQLSchema('AgentDock')).toBe(
        'agentdock'
      );
      expect(SQLIdentifierValidator.validatePostgreSQLSchema('TEST')).toBe(
        'test'
      );
    });
  });

  describe('SQLite Collection Validation', () => {
    it('should validate valid collection names', () => {
      expect(
        SQLIdentifierValidator.validateSQLiteCollection('memory_embeddings')
      ).toBe('memory_embeddings');
      expect(
        SQLIdentifierValidator.validateSQLiteCollection('document_embeddings')
      ).toBe('document_embeddings');
      expect(
        SQLIdentifierValidator.validateSQLiteCollection('user_embeddings')
      ).toBe('user_embeddings');
    });

    it('should reject invalid collection names', () => {
      expect(() => SQLIdentifierValidator.validateSQLiteCollection('')).toThrow(
        'Identifier cannot be empty'
      );
      expect(() =>
        SQLIdentifierValidator.validateSQLiteCollection('123invalid')
      ).toThrow('Invalid SQLite identifier format');
      expect(() =>
        SQLIdentifierValidator.validateSQLiteCollection('invalid-name')
      ).toThrow('Invalid SQLite identifier format');
    });

    it('should reject collections not in whitelist', () => {
      expect(() =>
        SQLIdentifierValidator.validateSQLiteCollection('malicious_collection')
      ).toThrow('not in allowed list');
    });
  });

  describe('Table Name Validation', () => {
    it('should validate valid table names', () => {
      expect(SQLIdentifierValidator.validateTableName('memories')).toBe(
        'memories'
      );
      expect(
        SQLIdentifierValidator.validateTableName('memory_connections')
      ).toBe('memory_connections');
      expect(SQLIdentifierValidator.validateTableName('kv_store')).toBe(
        'kv_store'
      );
    });

    it('should reject tables not in whitelist', () => {
      expect(() =>
        SQLIdentifierValidator.validateTableName('sensitive_data')
      ).toThrow('not in allowed list');
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should reject malicious schema names', () => {
      const maliciousInputs = [
        'public; DROP TABLE users; --',
        "'; DROP TABLE users; --",
        'public/*comment*/; DROP TABLE users',
        'public UNION SELECT * FROM users',
        'public OR 1=1',
        "public'; DROP TABLE users; --"
      ];

      maliciousInputs.forEach((input) => {
        expect(() =>
          SQLIdentifierValidator.validatePostgreSQLSchema(input)
        ).toThrow();
      });
    });

    it('should reject malicious collection names', () => {
      const maliciousInputs = [
        'users; DROP TABLE memories; --',
        "collection'; DROP DATABASE agentdock; --",
        'collection UNION SELECT password FROM users',
        'collection/**/OR/**/1=1'
      ];

      maliciousInputs.forEach((input) => {
        expect(() =>
          SQLIdentifierValidator.validateSQLiteCollection(input)
        ).toThrow();
      });
    });
  });

  describe('SQL Escaping', () => {
    it('should properly escape PostgreSQL identifiers', () => {
      expect(SQLIdentifierValidator.escapePostgreSQL('simple')).toBe(
        '"simple"'
      );
      expect(SQLIdentifierValidator.escapePostgreSQL('with"quote')).toBe(
        '"with""quote"'
      );
      expect(SQLIdentifierValidator.escapePostgreSQL('multi"quote"test')).toBe(
        '"multi""quote""test"'
      );
    });

    it('should properly escape SQLite identifiers', () => {
      expect(SQLIdentifierValidator.escapeSQLite('simple')).toBe('"simple"');
      expect(SQLIdentifierValidator.escapeSQLite('with"quote')).toBe(
        '"with""quote"'
      );
    });
  });

  describe('Secure Combined Operations', () => {
    it('should validate and escape PostgreSQL schema', () => {
      expect(SQLIdentifierValidator.securePostgreSQLSchema('public')).toBe(
        '"public"'
      );
      expect(SQLIdentifierValidator.securePostgreSQLSchema('AgentDock')).toBe(
        '"agentdock"'
      );
    });

    it('should validate and escape SQLite collection', () => {
      expect(
        SQLIdentifierValidator.secureSQLiteCollection('memory_embeddings')
      ).toBe('"memory_embeddings"');
    });

    it('should validate and escape table name', () => {
      expect(SQLIdentifierValidator.secureTableName('memories')).toBe(
        '"memories"'
      );
    });
  });

  describe('Whitelist Checking', () => {
    it('should correctly identify allowed schemas', () => {
      expect(SQLIdentifierValidator.isAllowedSchema('public')).toBe(true);
      expect(SQLIdentifierValidator.isAllowedSchema('agentdock')).toBe(true);
      expect(SQLIdentifierValidator.isAllowedSchema('test')).toBe(true);
      expect(SQLIdentifierValidator.isAllowedSchema('malicious')).toBe(false);
    });

    it('should correctly identify allowed collections', () => {
      expect(
        SQLIdentifierValidator.isAllowedCollection('memory_embeddings')
      ).toBe(true);
      expect(
        SQLIdentifierValidator.isAllowedCollection('document_embeddings')
      ).toBe(true);
      expect(
        SQLIdentifierValidator.isAllowedCollection('malicious_collection')
      ).toBe(false);
    });

    it('should correctly identify allowed tables', () => {
      expect(SQLIdentifierValidator.isAllowedTable('memories')).toBe(true);
      expect(SQLIdentifierValidator.isAllowedTable('kv_store')).toBe(true);
      expect(SQLIdentifierValidator.isAllowedTable('malicious_table')).toBe(
        false
      );
    });
  });

  describe('Type Safety', () => {
    it('should create branded types', () => {
      const schema = SQLIdentifierValidator.validatePostgreSQLSchema('public');
      const collection =
        SQLIdentifierValidator.validateSQLiteCollection('memory_embeddings');
      const table = SQLIdentifierValidator.validateTableName('memories');

      // TypeScript should recognize these as branded types
      expect(typeof schema).toBe('string');
      expect(typeof collection).toBe('string');
      expect(typeof table).toBe('string');
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum length identifiers', () => {
      expect(() =>
        SQLIdentifierValidator.validatePostgreSQLSchema('a')
      ).toThrow('not in allowed list');
      expect(() =>
        SQLIdentifierValidator.validateSQLiteCollection('a')
      ).toThrow('not in allowed list');
    });

    it('should handle maximum length identifiers', () => {
      const maxLength = 'a'.repeat(63);
      expect(() =>
        SQLIdentifierValidator.validatePostgreSQLSchema(maxLength)
      ).toThrow('not in allowed list');
    });

    it('should handle underscore prefixed identifiers', () => {
      expect(() =>
        SQLIdentifierValidator.validatePostgreSQLSchema('_test')
      ).toThrow('not in allowed list');
    });

    it('should handle mixed case properly', () => {
      // PostgreSQL should fold to lowercase and validate against whitelist
      expect(SQLIdentifierValidator.validatePostgreSQLSchema('PUBLIC')).toBe(
        'public'
      );
      expect(SQLIdentifierValidator.validatePostgreSQLSchema('AgentDock')).toBe(
        'agentdock'
      );

      // SQLite should preserve case but still validate against whitelist
      expect(() =>
        SQLIdentifierValidator.validateSQLiteCollection('Memory_Embeddings')
      ).toThrow('not in allowed list');
    });
  });

  describe('Error Messages', () => {
    it('should provide clear error messages for validation failures', () => {
      expect(() => SQLIdentifierValidator.validatePostgreSQLSchema('')).toThrow(
        'Identifier cannot be empty'
      );
      expect(() =>
        SQLIdentifierValidator.validatePostgreSQLSchema('123')
      ).toThrow('Invalid PostgreSQL identifier format');
      expect(() =>
        SQLIdentifierValidator.validatePostgreSQLSchema('malicious')
      ).toThrow(
        "Schema 'malicious' not in allowed list: public, agentdock, test"
      );
    });
  });
});
