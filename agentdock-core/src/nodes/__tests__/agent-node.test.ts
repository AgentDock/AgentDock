/**
 * @fileoverview Tests for the AgentNode implementation.
 */

import { AgentNode } from '../agent-node';
import { logger } from '../../logging';
import { CoreMessage } from 'ai';
import { Message } from '../../types/messages';
import { OrchestrationManager } from '../../orchestration/index';
import { createAgentConfig, ValidatedPersonality } from '../../types/agent-config';

// Define mock variables first
let mockCoreLLMInstance: any;
let mockCreateLLMInternal: jest.Mock;
let mockStreamWithOrchestration: jest.Mock;

// Mock the service implementation
jest.mock('../../llm/llm-orchestration-service', () => ({
  LLMOrchestrationService: jest.fn().mockImplementation(() => ({
    streamWithOrchestration: mockStreamWithOrchestration,
  }))
}));

// Mock logger
jest.mock('../../logging', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  },
  LogCategory: {
    NODE: 'node'
  }
}));

// Mock OrchestrationManager
const mockOrchestrationManager = {
  getState: jest.fn().mockResolvedValue({}),
  setState: jest.fn().mockResolvedValue({}),
  updateState: jest.fn().mockResolvedValue({}),
  clearState: jest.fn().mockResolvedValue({}),
  ensureStateExists: jest.fn().mockResolvedValue({}),
  stateManager: { get: jest.fn(), set: jest.fn(), update: jest.fn(), delete: jest.fn() },
  sequencer: { getStepId: jest.fn() },
  getActiveStep: jest.fn(),
  checkCondition: jest.fn(),
  registerTools: jest.fn(),
  switchFlow: jest.fn(),
  switchStep: jest.fn(),
  startOrchestration: jest.fn(),
  stopOrchestration: jest.fn(),
} as unknown as OrchestrationManager;

describe('AgentNode', () => {

  // Configure mocks inside beforeEach using doMock
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Re-initialize mock functions/instances for isolation
    mockCoreLLMInstance = {
      getProvider: jest.fn().mockReturnValue('anthropic'),
      getModelId: jest.fn().mockReturnValue('claude-3-opus-20240229'),
      getModel: jest.fn().mockReturnValue({ provider: 'anthropic', modelId: 'claude-3-opus-20240229' }),
      streamText: jest.fn().mockResolvedValue({ /* ... */ })
    };
    mockCreateLLMInternal = jest.fn(() => mockCoreLLMInstance);
    mockStreamWithOrchestration = jest.fn().mockResolvedValue({ /* ... */ });

    // Use doMock to ensure it runs after variables are defined
    jest.doMock('../../llm', () => ({
      createLLM: mockCreateLLMInternal,
      // Ensure the actual service is exported alongside the mock createLLM
      LLMOrchestrationService: jest.requireActual('../../llm/llm-orchestration-service').LLMOrchestrationService,
    }));

  // Refresh the OrchestrationService mock implementation to use the new mockStreamWithOrchestration
  jest.mock('../../llm/llm-orchestration-service', () => ({
    LLMOrchestrationService: jest.fn().mockImplementation(() => ({
      streamWithOrchestration: mockStreamWithOrchestration,
    }))
  }));
});

it('should inject current date and time into system prompt', async () => {
  // Create a mock config
  const config = {
    agentConfig: createAgentConfig({
      version: '1',
      agentId: 'test-agent',
      name: 'Test Agent',
      description: 'A test agent',
      personality: 'I am a helpful assistant' as ValidatedPersonality,
      nodes: [],
      nodeConfigurations: {},
      chatSettings: {},
      options: {
        maxSteps: 3
      }
    }),
    apiKey: 'sk-ant-test-api-key'
  };

    // Create an instance of AgentNode
    const agentNode = new AgentNode('test-agent', config);
  
    // Create mock messages with proper type
    const messages: Message[] = [
      { 
        id: 'test-message-id',
        role: 'user', 
        content: 'Hello',
        createdAt: new Date()
      }
    ];

    // Call handleMessage
    await agentNode.handleMessage({
      messages,
      sessionId: 'test-session-123',
      orchestrationManager: mockOrchestrationManager 
    });

    // Verify that streamText was called
    expect(mockStreamWithOrchestration).toHaveBeenCalled();

    // Get the streamText call arguments
    const streamTextArgs = mockStreamWithOrchestration.mock.calls[0][0];

    // Check if system is passed directly as an option
    if (streamTextArgs.system) {
      // Verify system option contains the expected content
      expect(streamTextArgs.system).toContain('I am a helpful assistant');
      expect(streamTextArgs.system).toContain('Current date:');
      expect(streamTextArgs.system).toContain('Current time:');
      expect(streamTextArgs.system).toContain('Current timezone:');
      expect(streamTextArgs.system).toContain('ISO timestamp:');
    } else {
      // Extract the system message from messages array if present
      const systemMessage = streamTextArgs.messages.find((msg: any) => msg.role === 'system');
      
      // Verify that the system message contains date and time information
      expect(systemMessage).toBeDefined();
      expect(systemMessage.content).toContain('I am a helpful assistant');
      expect(systemMessage.content).toContain('Current date:');
      expect(systemMessage.content).toContain('Current time:');
      expect(systemMessage.content).toContain('Current timezone:');
      expect(systemMessage.content).toContain('ISO timestamp:');
    }
  });

  it('should use a custom system message when provided', async () => {
    // Create a mock config
    const config = {
      agentConfig: createAgentConfig({
        version: '1',
        agentId: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        personality: 'Default personality' as ValidatedPersonality,
        nodes: [],
        nodeConfigurations: {},
        chatSettings: {},
        options: {
          maxSteps: 3
        }
      }),
      apiKey: 'sk-ant-test-api-key'
    };

    // Create an instance of AgentNode
    const agentNode = new AgentNode('test-agent', config);

    // Create mock messages with proper type
    const messages: Message[] = [
      { 
        id: 'test-message-id',
        role: 'user', 
        content: 'Hello',
        createdAt: new Date()
      }
    ];

    // Custom system message
    const customSystem = 'Custom system message';

    // Call handleMessage with custom system
    await agentNode.handleMessage({
      messages,
      systemOverride: customSystem,
      sessionId: 'test-session-123',
      orchestrationManager: mockOrchestrationManager
    });

    // Verify that streamText was called
    expect(mockStreamWithOrchestration).toHaveBeenCalled();

    // Get the streamText call arguments
    const streamTextArgs = mockStreamWithOrchestration.mock.calls[0][0];

    // Check if system is passed directly as an option
    if (streamTextArgs.system) {
      // Verify system option contains the expected content
      expect(streamTextArgs.system).toContain('Custom system message');
      expect(streamTextArgs.system).toContain('Current date:');
      expect(streamTextArgs.system).toContain('Current time:');
      expect(streamTextArgs.system).not.toContain('Default personality');
    } else {
      // Extract the system message from messages array if present
      const systemMessage = streamTextArgs.messages.find((msg: any) => msg.role === 'system');

      // Verify that the system message contains the custom message and date/time
      expect(systemMessage).toBeDefined();
      expect(systemMessage.content).toContain('Custom system message');
      expect(systemMessage.content).toContain('Current date:');
      expect(systemMessage.content).toContain('Current time:');
      expect(systemMessage.content).not.toContain('Default personality');
   }
  });
});