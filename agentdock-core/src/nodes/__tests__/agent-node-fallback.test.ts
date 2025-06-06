/**
 * @fileoverview Tests for the AgentNode fallback functionality.
 */

import { AgentError, ErrorCode } from '../../errors';
import { OrchestrationManager } from '../../orchestration/index';
import { AgentConfig, ValidatedPersonality } from '../../types/agent-config';
import { Message } from '../../types/messages';
import { AgentNode, AgentNodeConfig } from '../agent-node';

// Mock setup - DIRECT mocks, not using jest.doMock
// Create mocks before importing any modules that will use them
const mockCoreLLM = {
  streamText: jest.fn().mockResolvedValue('primary_stream'),
  getProvider: jest.fn().mockReturnValue('anthropic'),
  getModelId: jest.fn().mockReturnValue('claude-mock')
};

const mockFallbackLLM = {
  streamText: jest.fn().mockResolvedValue('fallback_stream'),
  getProvider: jest.fn().mockReturnValue('openai'),
  getModelId: jest.fn().mockReturnValue('gpt-fallback-mock')
};

const mockStreamWithOrchestration = jest.fn().mockImplementation(() => ({
  stream: { asReader: jest.fn(), asResponse: jest.fn() },
  finishReason: 'stop',
  usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
}));

// Mock core dependencies
jest.mock('../../llm', () => ({
  createLLM: jest.fn((config) => {
    if (config?.apiKey === 'mock-fallback-key') return mockFallbackLLM;
    if (config?.apiKey === 'mock-primary-key') return mockCoreLLM;
    throw new Error(
      `Mock createLLM called with unexpected key: ${config?.apiKey}`
    );
  }),
  LLMOrchestrationService: jest.fn().mockImplementation(() => ({
    streamWithOrchestration: mockStreamWithOrchestration
  }))
}));

jest.mock('../../llm/provider-registry', () => ({
  ProviderRegistry: {
    getProvider: jest.fn((provider) => {
      if (provider === 'anthropic') return { defaultModel: 'claude-default' };
      if (provider === 'openai') return { defaultModel: 'gpt-default' };
      return null;
    }),
    getNodeTypeFromProvider: jest.fn(() => 'mock-node-type'),
    getProviderFromNodes: jest.fn((nodes) =>
      nodes?.length > 0 ? nodes[0] : null
    )
  }
}));

jest.mock('../../logging', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn()
  },
  LogCategory: { NODE: 'node', LLM: 'llm' }
}));

jest.mock('../tool-registry', () => ({
  getToolRegistry: jest.fn(() => ({
    getToolsForAgent: jest.fn().mockReturnValue({})
  }))
}));

// Test helpers
const makeValidAgentConfig = (overrides = {}): AgentConfig => ({
  version: '1.0',
  agentId: 'test-agent',
  name: 'Test Agent',
  description: 'Test description',
  personality: 'Test personality' as ValidatedPersonality,
  nodes: ['anthropic'],
  nodeConfigurations: {},
  chatSettings: {},
  ...overrides
});

const makeNodeConfig = (overrides = {}): AgentNodeConfig => ({
  apiKey: 'mock-primary-key',
  provider: 'anthropic',
  fallbackApiKey: 'mock-fallback-key',
  fallbackProvider: 'openai',
  options: { temperature: 0.7 },
  agentConfig: makeValidAgentConfig(),
  ...overrides
});

// Mock orchestration manager
const mockOrchestrationManager = {
  getAllowedTools: jest.fn().mockResolvedValue([]),
  getState: jest.fn().mockResolvedValue({}),
  setState: jest.fn().mockResolvedValue({}),
  updateState: jest.fn().mockResolvedValue({})
} as unknown as OrchestrationManager;

describe('AgentNode Fallback Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStreamWithOrchestration.mockClear();
    mockCoreLLM.streamText.mockClear();
    mockFallbackLLM.streamText.mockClear();
  });

  describe('Constructor Tests', () => {
    it('should initialize primary LLM', () => {
      const config = makeNodeConfig({ fallbackApiKey: undefined });
      const node = new AgentNode('test1', config);

      // Verify internal state via behavior testing
      expect(node).toBeDefined();
      // The createLLM function should have been called once with primary config
      expect(require('../../llm').createLLM).toHaveBeenCalledTimes(1);
      expect(require('../../llm').createLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'anthropic',
          apiKey: 'mock-primary-key'
        })
      );
    });

    it('should initialize both primary and fallback LLMs', () => {
      const config = makeNodeConfig();
      const node = new AgentNode('test2', config);

      expect(node).toBeDefined();
      // createLLM should be called twice - once for primary, once for fallback
      expect(require('../../llm').createLLM).toHaveBeenCalledTimes(2);
      // Check call arguments for primary LLM
      expect(require('../../llm').createLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'anthropic',
          apiKey: 'mock-primary-key'
        })
      );
      // Check call arguments for fallback LLM
      expect(require('../../llm').createLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          apiKey: 'mock-fallback-key'
        })
      );
    });

    it('should not create fallback LLM if configurations are identical', () => {
      const config = makeNodeConfig({
        provider: 'anthropic',
        apiKey: 'mock-primary-key',
        fallbackProvider: 'anthropic',
        fallbackApiKey: 'mock-primary-key',
        fallbackModel: 'claude-mock'
      });

      // Mock to verify identical check
      mockCoreLLM.getModelId.mockReturnValueOnce('claude-mock');

      const node = new AgentNode('test3', config);

      expect(node).toBeDefined();
      // createLLM should be called only once (for primary)
      expect(require('../../llm').createLLM).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleMessage Tests', () => {
    const testMessages: Message[] = [
      {
        id: 'msg1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date()
      }
    ];

    it('should use primary LLM by default', async () => {
      const config = makeNodeConfig();
      const node = new AgentNode('test4', config);

      await node.handleMessage({
        messages: testMessages,
        sessionId: 'test-session',
        orchestrationManager: mockOrchestrationManager
      });

      // LLMOrchestrationService should be initialized with primary LLM
      expect(require('../../llm').LLMOrchestrationService).toHaveBeenCalledWith(
        mockCoreLLM,
        expect.anything(),
        expect.anything()
      );

      // streamWithOrchestration should be called
      expect(mockStreamWithOrchestration).toHaveBeenCalledTimes(1);
    });

    it('should use fallback LLM when useFallback is true', async () => {
      const config = makeNodeConfig();
      const node = new AgentNode('test5', config);

      await node.handleMessage({
        messages: testMessages,
        sessionId: 'test-session',
        orchestrationManager: mockOrchestrationManager,
        useFallback: true
      });

      // LLMOrchestrationService should be initialized with fallback LLM
      expect(require('../../llm').LLMOrchestrationService).toHaveBeenCalledWith(
        mockFallbackLLM,
        expect.anything(),
        expect.anything()
      );

      expect(mockStreamWithOrchestration).toHaveBeenCalledTimes(1);
    });

    it('should use primary LLM when useFallback is true but no fallback exists', async () => {
      const config = makeNodeConfig({ fallbackApiKey: undefined });
      const node = new AgentNode('test6', config);

      await node.handleMessage({
        messages: testMessages,
        sessionId: 'test-session',
        orchestrationManager: mockOrchestrationManager,
        useFallback: true
      });

      // LLMOrchestrationService should be initialized with primary LLM
      expect(require('../../llm').LLMOrchestrationService).toHaveBeenCalledWith(
        mockCoreLLM,
        expect.anything(),
        expect.anything()
      );

      expect(mockStreamWithOrchestration).toHaveBeenCalledTimes(1);
    });

    it('should apply system override to prompt', async () => {
      const config = makeNodeConfig();
      const node = new AgentNode('test7', config);

      await node.handleMessage({
        messages: testMessages,
        sessionId: 'test-session',
        orchestrationManager: mockOrchestrationManager,
        systemOverride: 'Custom system prompt'
      });

      expect(mockStreamWithOrchestration).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('Custom system prompt')
        })
      );
    });

    it('should apply runtime config overrides', async () => {
      const config = makeNodeConfig();
      const node = new AgentNode('test8', config);

      await node.handleMessage({
        messages: testMessages,
        sessionId: 'test-session',
        orchestrationManager: mockOrchestrationManager,
        config: { temperature: 0.2, maxTokens: 500 }
      });

      expect(mockStreamWithOrchestration).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.2,
          maxTokens: 500
        })
      );
    });
  });
});
