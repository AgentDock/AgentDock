/**
 * @fileoverview Tests for DeepSeek LLM integration.
 * 
 * Note: DeepSeek's API is compatible with OpenAI's format, so we use the OpenAI client
 * with a custom baseURL to access DeepSeek's API.
 */

import { createLLM } from '../create-llm';
import { LLMConfig } from '../types';

// Mock the @ai-sdk/openai module
jest.mock('@ai-sdk/openai', () => {
  // Create a factory function to generate mock models with different modelIds
  const createMockModel = (modelId: string) => ({
    provider: 'openai.chat',
    modelId,
    specificationVersion: 'v1',
    defaultObjectGenerationMode: 'json',
    doGenerate: jest.fn().mockResolvedValue({
      text: 'Mocked DeepSeek response',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      }
    }),
    doStream: jest.fn()
  });

  return {
    createOpenAI: jest.fn().mockImplementation(() => {
      return jest.fn().mockImplementation((modelId) => {
        return createMockModel(modelId);
      });
    })
  };
});

// These tests are skipped by default because they make real API calls
// and can slow down the test suite significantly.
// To run these tests, change test.skip to test and provide a valid API key.
describe('DeepSeek LLM Integration', () => {
  // Use a mock API key for tests
  const apiKey = 'mock-api-key';

  // Test creating a DeepSeek LLM instance
  test('should create a DeepSeek LLM instance', () => {
    // Create config
    const config: LLMConfig = {
      provider: 'deepseek',
      apiKey: apiKey,
      model: 'deepseek-chat'
    };

    // Create LLM
    const llm = createLLM(config);

    // Verify LLM was created
    expect(llm).toBeDefined();
  });

  // Test generating text with DeepSeek
  test('should generate text with DeepSeek', async () => {
    // Create config
    const config: LLMConfig = {
      provider: 'deepseek',
      apiKey: apiKey,
      model: 'deepseek-chat'
    };

    // Create LLM
    const llm = createLLM(config);

    // Generate text
    const result = await llm.generateText({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello!' }
      ]
    });

    // Verify result
    expect(result.text).toBeDefined();
    expect(result.text).toBe('Mocked DeepSeek response');
    expect(result.usage).toBeDefined();
    expect(result.usage?.promptTokens).toBe(10);
    expect(result.usage?.completionTokens).toBe(20);
    expect(result.usage?.totalTokens).toBe(30);
  });

  // Test generating text with DeepSeek-R1 (reasoning model)
  test('should generate text with DeepSeek-R1', async () => {
    // Create config
    const config: LLMConfig = {
      provider: 'deepseek',
      apiKey: apiKey,
      model: 'deepseek-reasoner'
    };

    // Create LLM
    const llm = createLLM(config);

    // Generate text
    const result = await llm.generateText({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is 2+2?' }
      ]
    });

    // Verify result
    expect(result.text).toBeDefined();
    expect(result.text).toBe('Mocked DeepSeek response');
    expect(result.usage).toBeDefined();
    expect(result.usage?.promptTokens).toBe(10);
    expect(result.usage?.completionTokens).toBe(20);
    expect(result.usage?.totalTokens).toBe(30);
  });
}); 