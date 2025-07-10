/**
 * @fileoverview Tests for SQL utilities
 */

import { describe, expect, it } from '@jest/globals';

import {
  parseFieldKey,
  parseSqlIdentifier,
  quotePgIdentifier,
  TABLE_NAMES
} from '../sql-utils';

describe('SQL Utils', () => {
  describe('parseSqlIdentifier', () => {
    it('should validate correct identifiers', () => {
      expect(parseSqlIdentifier('memory_embeddings')).toBe('memory_embeddings');
      expect(parseSqlIdentifier('valid_name')).toBe('valid_name');
      expect(parseSqlIdentifier('_underscore')).toBe('_underscore');
      expect(parseSqlIdentifier('table123')).toBe('table123');
    });

    it('should reject invalid identifiers', () => {
      expect(() => parseSqlIdentifier('')).toThrow('Invalid identifier:');
      expect(() => parseSqlIdentifier('123invalid')).toThrow(
        'Invalid identifier:'
      );
      expect(() => parseSqlIdentifier('invalid-name')).toThrow(
        'Invalid identifier:'
      );
      expect(() => parseSqlIdentifier('a'.repeat(64))).toThrow(
        'Invalid identifier:'
      );
    });
  });

  describe('parseFieldKey', () => {
    it('should validate correct field keys', () => {
      expect(parseFieldKey('simple')).toBe('simple');
      expect(parseFieldKey('user.profile')).toBe('user.profile');
      expect(parseFieldKey('user.profile.name')).toBe('user.profile.name');
    });

    it('should reject invalid field keys', () => {
      expect(() => parseFieldKey('')).toThrow('Field key cannot be empty');
      expect(() => parseFieldKey('user..name')).toThrow(
        'Invalid field key segment:'
      );
      expect(() => parseFieldKey('user.123name')).toThrow(
        'Invalid field key segment:'
      );
    });
  });

  describe('quotePgIdentifier', () => {
    it('should quote PostgreSQL identifiers correctly', () => {
      expect(quotePgIdentifier('simple')).toBe('"simple"');
      expect(quotePgIdentifier('complex_name')).toBe('"complex_name"');
      expect(quotePgIdentifier('table123')).toBe('"table123"');
    });

    it('should handle valid identifiers only', () => {
      // quotePgIdentifier validates input first, so only valid identifiers work
      expect(quotePgIdentifier('valid_identifier')).toBe('"valid_identifier"');
      expect(() => quotePgIdentifier('invalid-name')).toThrow(
        'Invalid identifier:'
      );
    });
  });

  describe('TABLE_NAMES', () => {
    it('should have predefined table names', () => {
      expect(TABLE_NAMES.MEMORY_EMBEDDINGS).toBe('memory_embeddings');
      expect(TABLE_NAMES.DOCUMENT_EMBEDDINGS).toBe('document_embeddings');
      expect(TABLE_NAMES.USER_EMBEDDINGS).toBe('user_embeddings');
      expect(TABLE_NAMES.AGENT_MEMORIES).toBe('agent_memories');
      expect(TABLE_NAMES.VEC_COLLECTIONS).toBe('vec_collections');
    });
  });
});
