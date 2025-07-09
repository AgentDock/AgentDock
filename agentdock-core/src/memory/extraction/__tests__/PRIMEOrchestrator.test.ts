/**
 * @fileoverview Tests for PRIMEOrchestrator
 */

import { StorageProvider } from '../../../storage/types';
import {
  PRIMEOrchestrator,
  PRIMEOrchestratorConfig
} from '../PRIMEOrchestrator';

// Mock storage with memory operations
const mockValidStorage = {
  get: jest.fn(),
  set: jest.fn(),
  memory: {
    store: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
} as any;

// Mock storage without memory operations
const mockInvalidStorage = {
  get: jest.fn(),
  set: jest.fn()
  // No memory property
} as any;

describe('PRIMEOrchestrator', () => {
  let config: PRIMEOrchestratorConfig;

  beforeEach(() => {
    config = {
      primeConfig: {
        provider: 'anthropic',
        apiKey: 'test-key',
        maxTokens: 4000,
        autoTierSelection: false,
        defaultTier: 'standard',
        standardModel: 'claude-3-haiku-20240307',
        advancedModel: 'claude-3-sonnet-20240229',
        defaultImportanceThreshold: 0.7,
        temperature: 0.3
      },
      batchSize: 10,
      enableMetrics: true
    };
  });

  describe('constructor validation', () => {
    test('should initialize with valid storage provider', () => {
      expect(
        () => new PRIMEOrchestrator(mockValidStorage, config)
      ).not.toThrow();
    });

    test('should throw when storage lacks memory operations', () => {
      expect(() => new PRIMEOrchestrator(mockInvalidStorage, config)).toThrow(
        'Storage provider must support memory operations. Ensure your storage provider implements the memory interface.'
      );
    });

    test('should throw with clear error message for missing memory interface', () => {
      const incompleteStorage = {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn()
        // Missing memory property
      } as any;

      expect(() => new PRIMEOrchestrator(incompleteStorage, config)).toThrow(
        'Storage provider must support memory operations'
      );
    });
  });

  describe('configuration validation', () => {
    test('should apply default values correctly', () => {
      const minimalConfig = {
        primeConfig: {
          provider: 'openai' as const,
          apiKey: 'test-key',
          maxTokens: 2000,
          autoTierSelection: false,
          defaultTier: 'standard' as const,
          standardModel: 'gpt-4o-mini',
          advancedModel: 'gpt-4o',
          defaultImportanceThreshold: 0.5,
          temperature: 0.2
        }
      };

      const orchestrator = new PRIMEOrchestrator(
        mockValidStorage,
        minimalConfig
      );
      expect(orchestrator).toBeDefined();
    });
  });
});
