import { CoreLLM, createLLM } from '..';
import { LLMConfig } from '../types';
import { createAnthropicModel, createGeminiModel, createOpenAIModel } from '../model-utils';

// Mock the model creation functions
jest.mock('../model-utils', () => ({
  createAnthropicModel: jest.fn(),
  createOpenAIModel: jest.fn(),
  createGeminiModel: jest.fn(),
}));

// Mock the AI SDK functions
jest.mock('ai', () => ({
  generateText: jest.fn(),
  streamText: jest.fn(),
  generateObject: jest.fn(),
  streamObject: jest.fn(),
}));

describe('CoreLLM', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createLLM', () => {
    it('should create an OpenAI LLM instance', () => {
      // Mock implementation
      const mockModel = {
        provider: 'openai',
        modelId: 'gpt-3.5-turbo',
      };
      (createOpenAIModel as jest.Mock).mockReturnValue(mockModel);

      // Test configuration
      const config: LLMConfig = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key',
      };

      // Create the LLM
      const llm = createLLM(config);

      // Verify the result
      expect(createOpenAIModel).toHaveBeenCalledWith(config);
      expect(llm).toBeInstanceOf(CoreLLM);
      expect(llm.getProvider()).toBe('openai');
      expect(llm.getModelId()).toBe('gpt-3.5-turbo');
    });

    it('should create an Anthropic LLM instance', () => {
      // Mock implementation
      const mockModel = {
        provider: 'anthropic',
        modelId: 'claude-3-haiku-20240307',
      };
      (createAnthropicModel as jest.Mock).mockReturnValue(mockModel);

      // Test configuration
      const config: LLMConfig = {
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        apiKey: 'sk-ant-test-key',
      };

      // Create the LLM
      const llm = createLLM(config);

      // Verify the result
      expect(createAnthropicModel).toHaveBeenCalledWith(config);
      expect(llm).toBeInstanceOf(CoreLLM);
      expect(llm.getProvider()).toBe('anthropic');
      expect(llm.getModelId()).toBe('claude-3-haiku-20240307');
    });

    it('should create a Gemini LLM instance', () => {
      // Mock implementation
      const mockModel = {
        provider: 'google',
        modelId: 'gemini-1.5-pro-latest',
      };
      (createGeminiModel as jest.Mock).mockReturnValue(mockModel);

      // Test configuration
      const config: LLMConfig = {
        provider: 'gemini',
        model: 'gemini-1.5-pro-latest',
        apiKey: 'test-key',
        useSearchGrounding: false,
      };

      // Create the LLM
      const llm = createLLM(config);

      // Verify the result
      expect(createGeminiModel).toHaveBeenCalledWith(config);
      expect(llm).toBeInstanceOf(CoreLLM);
      expect(llm.getProvider()).toBe('google');
      expect(llm.getModelId()).toBe('gemini-1.5-pro-latest');
    });

    it('should create a Gemini LLM instance with search grounding', () => {
      // Mock implementation
      const mockModel = {
        provider: 'google',
        modelId: 'gemini-1.5-pro-latest',
      };
      (createGeminiModel as jest.Mock).mockReturnValue(mockModel);

      // Test configuration
      const config: LLMConfig = {
        provider: 'gemini',
        model: 'gemini-1.5-pro-latest',
        apiKey: 'test-key',
        useSearchGrounding: true,
      };

      // Create the LLM
      const llm = createLLM(config);

      // Verify the result
      expect(createGeminiModel).toHaveBeenCalledWith(config);
      expect(llm).toBeInstanceOf(CoreLLM);
      expect(llm.getProvider()).toBe('google');
      expect(llm.getModelId()).toBe('gemini-1.5-pro-latest');
    });

    it('should throw an error for unsupported providers', () => {
      // Test configuration with an unsupported provider
      const config = {
        provider: 'unsupported' as any,
        model: 'model',
        apiKey: 'test-key',
      };

      // Verify that it throws an error
      expect(() => createLLM(config)).toThrow('Unsupported provider: unsupported');
    });
  });

  describe('CoreLLM methods', () => {
    let llm: CoreLLM;
    const mockModel = {
      provider: 'openai',
      modelId: 'gpt-3.5-turbo',
    };

    beforeEach(() => {
      (createOpenAIModel as jest.Mock).mockReturnValue(mockModel);
      const config: LLMConfig = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key',
      };
      llm = createLLM(config);
    });

    it('should return the correct provider', () => {
      expect(llm.getProvider()).toBe('openai');
    });

    it('should return the correct model ID', () => {
      expect(llm.getModelId()).toBe('gpt-3.5-turbo');
    });

    it('should return the model instance', () => {
      expect(llm.getModel()).toBe(mockModel);
    });

    it('should return null for token usage initially', () => {
      expect(llm.getLastTokenUsage()).toBeNull();
    });
  });
});
