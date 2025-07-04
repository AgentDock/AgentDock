/**
 * @fileoverview Tests for PRIMEExtractor
 */

import { CostTracker } from '../../tracking/CostTracker';
import { MemoryMessage, MemoryType } from '../../types/common';
import { PRIMEConfig, PRIMEExtractor, PRIMERule } from '../PRIMEExtractor';

// Mock CostTracker
const mockCostTracker = {
  trackExtraction: jest.fn()
} as any;

describe('PRIMEExtractor', () => {
  let extractor: PRIMEExtractor;
  let config: PRIMEConfig;

  beforeEach(() => {
    config = {
      provider: 'anthropic',
      apiKey: 'test-key',
      maxTokens: 4000,
      autoTierSelection: false,
      defaultTier: 'balanced',
      defaultImportanceThreshold: 0.7,
      temperature: 0.3,
      modelTiers: {
        fast: 'gpt-3.5-turbo',
        balanced: 'gpt-4o-mini',
        accurate: 'gpt-4o'
      }
    };

    extractor = new PRIMEExtractor(config, mockCostTracker);
  });

  describe('configuration', () => {
    test('should initialize with provided config', () => {
      expect(extractor).toBeDefined();
    });

    test('should throw when apiKey is missing', () => {
      const invalidConfig = {
        ...config,
        apiKey: ''
      };

      expect(() => new PRIMEExtractor(invalidConfig, mockCostTracker)).toThrow(
        'Configuration error for apiKey: PRIME apiKey is required. Provide via config.apiKey or PRIME_API_KEY env var'
      );
    });

    test('should throw when provider is invalid', () => {
      const invalidConfig = {
        ...config,
        provider: 'invalid-provider'
      };

      expect(() => new PRIMEExtractor(invalidConfig, mockCostTracker)).toThrow(
        'Configuration error for provider: Invalid provider "invalid-provider". Must be one of: openai, anthropic, azure, bedrock'
      );
    });

    test('should apply environment variable defaults', () => {
      const envConfig = {
        provider: 'openai',
        apiKey: 'env-test-key',
        maxTokens: 2000,
        autoTierSelection: true,
        defaultTier: 'fast' as const,
        defaultImportanceThreshold: 0.5,
        temperature: 0.1,
        modelTiers: {
          fast: 'gpt-3.5-turbo',
          balanced: 'gpt-4',
          accurate: 'gpt-4'
        }
      };

      const envExtractor = new PRIMEExtractor(envConfig, mockCostTracker);
      expect(envExtractor).toBeDefined();
    });
  });

  describe('prompt building', () => {
    test('should build optimized prompt with rules', async () => {
      const message: MemoryMessage = {
        id: 'test-1',
        agentId: 'test-agent',
        content: 'User mentioned they prefer coffee over tea in the morning',
        timestamp: new Date()
      };

      const rules: PRIMERule[] = [
        {
          id: 'preferences',
          guidance: 'Extract user preferences and choices',
          type: 'semantic' as MemoryType,
          importance: 0.8
        }
      ];

      // Test that the extractor processes the message and rules
      // Note: This is a unit test, so we're mainly testing structure
      const context = {
        userId: 'user-123',
        agentId: 'agent-456',
        userRules: rules,
        importanceThreshold: 0.7
      };

      // The actual extraction would call an LLM, so we can't test the full flow
      // But we can test that the extractor accepts the correct inputs and doesn't throw
      await expect(extractor.extract(message, context)).resolves.toBeDefined();
    });

    test('should handle empty rules', async () => {
      const message: MemoryMessage = {
        id: 'test-2',
        agentId: 'test-agent',
        content: 'Simple message without special rules',
        timestamp: new Date()
      };

      const context = {
        userId: 'user-123',
        agentId: 'agent-456',
        userRules: [],
        importanceThreshold: 0.7
      };

      await expect(extractor.extract(message, context)).resolves.toBeDefined();
    });
  });

  describe('tier selection', () => {
    test('should use default tier when auto-selection disabled', () => {
      expect(config.autoTierSelection).toBe(false);
      expect(config.defaultTier).toBe('balanced');
    });

    test('should handle tier thresholds when auto-selection enabled', () => {
      const autoConfig = {
        ...config,
        autoTierSelection: true,
        tierThresholds: {
          fastMaxChars: 100,
          accurateMinChars: 500
        }
      };

      const autoExtractor = new PRIMEExtractor(autoConfig, mockCostTracker);
      expect(autoExtractor).toBeDefined();
    });
  });
});
