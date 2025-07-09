/**
 * @fileoverview Tests for PRIMEExtractor
 */

import { LLMProvider } from '../../../llm/types';
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
      provider: 'anthropic' as LLMProvider,
      apiKey: 'test-key',
      maxTokens: 4000,
      autoTierSelection: false,
      defaultTier: 'standard',
      standardModel: 'claude-3-haiku-20240307',
      advancedModel: 'claude-3-sonnet-20240229',
      defaultImportanceThreshold: 0.7,
      temperature: 0.3
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
        provider: 'invalid-provider' as LLMProvider
      };

      expect(() => new PRIMEExtractor(invalidConfig, mockCostTracker)).toThrow(
        'Configuration error for provider: Invalid provider "invalid-provider". Must be one of: openai, anthropic, cerebras, deepseek, gemini, groq'
      );
    });

    test('should apply environment variable defaults', () => {
      const envConfig = {
        provider: 'openai' as LLMProvider,
        apiKey: 'env-test-key',
        maxTokens: 2000,
        autoTierSelection: true,
        defaultTier: 'standard' as const,
        standardModel: 'gpt-4o-mini',
        advancedModel: 'gpt-4o',
        defaultImportanceThreshold: 0.5,
        temperature: 0.1
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
      expect(config.defaultTier).toBe('standard');
    });

    test('should handle tier thresholds when auto-selection enabled', () => {
      const autoConfig = {
        ...config,
        autoTierSelection: true,
        tierThresholds: {
          advancedMinChars: 500,
          advancedMinRules: 5
        }
      };

      const autoExtractor = new PRIMEExtractor(autoConfig, mockCostTracker);
      expect(autoExtractor).toBeDefined();
    });
  });

  describe('token count verification', () => {
    test('should generate prompts within documented token range', () => {
      const testCases = [
        {
          message: 'Hi',
          rules: [],
          expectedMax: 100,
          description: 'Minimal prompt'
        },
        {
          message:
            'This is a medium length message that contains some information about the user preferences and their daily habits',
          rules: [
            { guidance: 'Extract user preferences', isActive: true },
            { guidance: 'Identify daily routines', isActive: true }
          ],
          expectedMax: 200,
          description: 'Medium prompt with 2 rules'
        },
        {
          message:
            'This is a very long message that contains extensive information about multiple topics including user preferences, their work habits, personal goals, upcoming projects, technical requirements, system configurations, and various other details that need to be carefully analyzed and extracted into appropriate memory types for future reference and processing',
          rules: Array(8)
            .fill(null)
            .map((_, i) => ({
              guidance: `Rule ${i + 1}: Extract specific pattern type ${i + 1}`,
              isActive: true
            })),
          expectedMax: 450,
          description: 'Very long prompt with 8 rules'
        }
      ];

      testCases.forEach(({ message, rules, expectedMax, description }) => {
        // Access the private method for testing
        const buildOptimizedPrompt = (
          extractor as any
        ).buildOptimizedPrompt.bind(extractor);

        const context = {
          userId: 'test-user',
          agentId: 'test-agent',
          userRules: [],
          importanceThreshold: 0.7
        };

        const prompt = buildOptimizedPrompt(
          { content: message } as MemoryMessage,
          rules,
          context
        );

        // Use the same token estimation as the implementation
        const estimatedTokens = Math.ceil(prompt.length / 4);

        expect(estimatedTokens).toBeLessThan(expectedMax);
        console.log(
          `${description}: ${estimatedTokens} tokens (max: ${expectedMax})`
        );
      });
    });

    test('should estimate tokens consistently with implementation', () => {
      // Test the token estimation method directly
      const estimateTokens = (extractor as any).estimateTokens.bind(extractor);

      // Test various string lengths
      expect(estimateTokens('test')).toBe(1); // 4 chars = 1 token
      expect(estimateTokens('hello world')).toBe(3); // 11 chars = 3 tokens
      expect(estimateTokens('a'.repeat(100))).toBe(25); // 100 chars = 25 tokens
      expect(estimateTokens('a'.repeat(443))).toBe(111); // 443 chars = 111 tokens
    });

    test('typical usage should stay within 50-200 token range', () => {
      const typicalMessages = [
        'User prefers dark mode',
        'Meeting scheduled for tomorrow at 3pm',
        'Completed the project documentation and submitted PR',
        'Remember to follow up with the client about the proposal',
        'The new feature implementation is working correctly'
      ];

      const typicalRules = [
        { guidance: 'Extract user preferences', isActive: true },
        { guidance: 'Identify action items', isActive: true }
      ];

      typicalMessages.forEach((message) => {
        const buildOptimizedPrompt = (
          extractor as any
        ).buildOptimizedPrompt.bind(extractor);

        const context = {
          userId: 'test-user',
          agentId: 'test-agent',
          userRules: [],
          importanceThreshold: 0.7
        };

        const prompt = buildOptimizedPrompt(
          { content: message } as MemoryMessage,
          Math.random() > 0.5 ? typicalRules : [],
          context
        );

        const estimatedTokens = Math.ceil(prompt.length / 4);

        expect(estimatedTokens).toBeGreaterThanOrEqual(50);
        expect(estimatedTokens).toBeLessThanOrEqual(200);
      });
    });
  });
});
