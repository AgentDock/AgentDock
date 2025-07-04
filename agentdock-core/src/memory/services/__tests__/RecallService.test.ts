/**
 * RecallService Tests - Validation of Bug Fixes
 *
 * These tests specifically validate the fixes for the identified bugs,
 * particularly the minRelevance: 0 validation issue.
 */

import { MemoryType } from '../../types';
import { RecallService } from '../RecallService';
import { validateRecallQuery } from '../RecallServiceUtils';

describe('RecallService - Bug Fixes Validation', () => {
  describe('Bug 1: Query Validation Fixes', () => {
    test('validateRecallQuery handles minRelevance: 0 correctly', () => {
      // minRelevance: 0 should be valid (show all results)
      const queryWithZeroRelevance = {
        userId: 'user-123',
        agentId: 'agent-456',
        query: 'test query',
        minRelevance: 0,
        limit: 10
      };

      expect(validateRecallQuery(queryWithZeroRelevance)).toBe(true);
    });

    test('validateRecallQuery handles minRelevance: 1 correctly', () => {
      // minRelevance: 1 should be valid (only perfect matches)
      const queryWithMaxRelevance = {
        userId: 'user-123',
        agentId: 'agent-456',
        query: 'test query',
        minRelevance: 1.0,
        limit: 10
      };

      expect(validateRecallQuery(queryWithMaxRelevance)).toBe(true);
    });

    test('validateRecallQuery rejects invalid minRelevance values', () => {
      // minRelevance > 1 should be invalid
      const queryWithInvalidHigh = {
        userId: 'user-123',
        agentId: 'agent-456',
        query: 'test query',
        minRelevance: 1.5,
        limit: 10
      };

      expect(validateRecallQuery(queryWithInvalidHigh)).toBe(false);

      // minRelevance < 0 should be invalid
      const queryWithInvalidLow = {
        userId: 'user-123',
        agentId: 'agent-456',
        query: 'test query',
        minRelevance: -0.1,
        limit: 10
      };

      expect(validateRecallQuery(queryWithInvalidLow)).toBe(false);
    });

    test('validateRecallQuery handles undefined minRelevance correctly', () => {
      // undefined minRelevance should be valid (use defaults)
      const queryWithoutRelevance = {
        userId: 'user-123',
        agentId: 'agent-456',
        query: 'test query',
        limit: 10
      };

      expect(validateRecallQuery(queryWithoutRelevance)).toBe(true);
    });

    test('validateRecallQuery validates limit parameter with nullish coalescing', () => {
      // undefined limit should default to 10 and be valid
      const queryWithoutLimit = {
        userId: 'user-123',
        agentId: 'agent-456',
        query: 'test query'
      };

      expect(validateRecallQuery(queryWithoutLimit)).toBe(true);

      // limit: 0 should be valid
      const queryWithZeroLimit = {
        userId: 'user-123',
        agentId: 'agent-456',
        query: 'test query',
        limit: 0
      };

      expect(validateRecallQuery(queryWithZeroLimit)).toBe(true);

      // limit > 1000 should be invalid
      const queryWithHighLimit = {
        userId: 'user-123',
        agentId: 'agent-456',
        query: 'test query',
        limit: 1001
      };

      expect(validateRecallQuery(queryWithHighLimit)).toBe(false);
    });
  });
});
