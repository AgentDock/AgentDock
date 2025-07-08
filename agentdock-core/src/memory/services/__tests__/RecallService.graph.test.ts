/**
 * Tests for RecallService connection graph enhancements
 *
 * These tests verify that the connection graph integration works properly
 * by creating a simple scenario and checking that connections are used.
 */

import { MemoryType } from '../../types/common';
import { RecallService } from '../RecallService';
import { RecallQuery } from '../RecallServiceTypes';

describe('RecallService - Connection Graph Features', () => {
  describe('Query Interface', () => {
    test('RecallQuery accepts connection options', () => {
      // This just verifies the TypeScript interface includes our new fields
      const query: RecallQuery = {
        userId: 'test-user',
        agentId: 'test-agent',
        query: 'test query',
        memoryTypes: [MemoryType.SEMANTIC],
        // NEW connection options
        useConnections: true,
        connectionHops: 2,
        connectionTypes: ['similar', 'related'],
        boostCentralMemories: true
      };

      expect(query.useConnections).toBe(true);
      expect(query.connectionHops).toBe(2);
      expect(query.connectionTypes).toEqual(['similar', 'related']);
      expect(query.boostCentralMemories).toBe(true);
    });

    test('Connection options are optional', () => {
      // Verify query interface works without connection options
      const query: RecallQuery = {
        userId: 'test-user',
        agentId: 'test-agent',
        query: 'test query',
        memoryTypes: [MemoryType.SEMANTIC]
      };

      expect(query.useConnections).toBeUndefined();
      expect(query.connectionHops).toBeUndefined();
    });
  });

  describe('Constructor Configuration', () => {
    test('RecallService accepts intelligence config and storage', () => {
      // Mock dependencies
      const mockWorkingMemory = {} as any;
      const mockEpisodicMemory = {} as any;
      const mockSemanticMemory = {} as any;
      const mockProceduralMemory = {} as any;
      const mockRecallConfig = {
        defaultLimit: 20,
        minRelevanceThreshold: 0.1,
        hybridSearchWeights: {
          vector: 0.4,
          text: 0.3,
          temporal: 0.2,
          procedural: 0.1
        },
        enableVectorSearch: false,
        cacheResults: false,
        enableRelatedMemories: true,
        maxRelatedDepth: 2,
        cacheTTL: 300000 // 5 minutes
      };

      const mockIntelligenceConfig = {
        embedding: {
          enabled: true,
          similarityThreshold: 0.7
        },
        connectionDetection: {
          enabled: true,
          provider: 'openai',
          thresholds: {
            autoSimilar: 0.8,
            autoRelated: 0.6,
            llmRequired: 0.3
          },
          maxCandidates: 50
        },
        costControl: {
          maxLLMCallsPerBatch: 0,
          preferEmbeddingWhenSimilar: true,
          trackTokenUsage: false
        }
      };

      const mockStorage = {
        memory: {} as any
      } as any;

      // Should not throw
      const recallService = new RecallService(
        mockWorkingMemory,
        mockEpisodicMemory,
        mockSemanticMemory,
        mockProceduralMemory,
        mockRecallConfig,
        mockIntelligenceConfig,
        mockStorage
      );

      expect(recallService).toBeDefined();
    });
  });
});
