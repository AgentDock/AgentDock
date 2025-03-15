/**
 * @fileoverview Tests for the AgentNode implementation.
 */

import { AgentNode } from '../agent-node';
import { logger } from '../../logging';
import { CoreMessage } from 'ai';

// Mock streamText function
const mockStreamText = jest.fn().mockResolvedValue({
  text: 'Mock response',
  textStream: {
    [Symbol.asyncIterator]: async function* () {
      yield 'Mock';
      yield ' ';
      yield 'response';
    }
  }
});

// Mock dependencies
jest.mock('../../llm', () => ({
  createLLM: jest.fn(() => ({
    streamText: mockStreamText,
    getLastTokenUsage: jest.fn().mockReturnValue({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150
    })
  }))
}));

jest.mock('../tool-registry', () => ({
  getToolRegistry: jest.fn(() => ({
    getToolsForAgent: jest.fn(() => ({}))
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

describe('AgentNode', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should inject current date and time into system prompt', async () => {
    // Create a mock config
    const config = {
      agentConfig: {
        personality: 'I am a helpful assistant',
        options: {
          maxSteps: 3
        }
      },
      apiKey: 'test-api-key'
    };

    // Create an instance of AgentNode
    const agentNode = new AgentNode('test-agent', config);

    // Create mock messages with proper type
    const messages: CoreMessage[] = [
      { role: 'user', content: 'Hello' } as CoreMessage
    ];

    // Call handleMessage
    await agentNode.handleMessage({ messages });

    // Verify that streamText was called
    expect(mockStreamText).toHaveBeenCalled();
    
    // Get the streamText call arguments
    const streamTextArgs = mockStreamText.mock.calls[0][0];
    
    // Extract the system message
    const systemMessage = streamTextArgs.messages.find((msg: any) => msg.role === 'system');
    
    // Verify that the system message contains date and time information
    expect(systemMessage).toBeDefined();
    expect(systemMessage.content).toContain('I am a helpful assistant');
    expect(systemMessage.content).toContain('Current date and time:');
    expect(systemMessage.content).toContain('Current date:');
    expect(systemMessage.content).toContain('Current time:');
    
    // Verify that the logger was called with the correct arguments
    expect(logger.debug).toHaveBeenCalledWith(
      'node',
      'AgentNode',
      'Injected current date/time into system prompt',
      expect.objectContaining({
        nodeId: 'test-agent',
        currentDate: expect.any(String)
      })
    );
  });

  it('should use a custom system message when provided', async () => {
    // Create a mock config
    const config = {
      agentConfig: {
        personality: 'Default personality',
        options: {
          maxSteps: 3
        }
      },
      apiKey: 'test-api-key'
    };

    // Create an instance of AgentNode
    const agentNode = new AgentNode('test-agent', config);

    // Create mock messages with proper type
    const messages: CoreMessage[] = [
      { role: 'user', content: 'Hello' } as CoreMessage
    ];

    // Custom system message
    const customSystem = 'Custom system message';

    // Call handleMessage with custom system
    await agentNode.handleMessage({ 
      messages,
      system: customSystem
    });

    // Verify that streamText was called
    expect(mockStreamText).toHaveBeenCalled();
    
    // Get the streamText call arguments
    const streamTextArgs = mockStreamText.mock.calls[0][0];
    
    // Extract the system message
    const systemMessage = streamTextArgs.messages.find((msg: any) => msg.role === 'system');
    
    // Verify that the system message contains the custom message and date/time
    expect(systemMessage).toBeDefined();
    expect(systemMessage.content).toContain('Custom system message');
    expect(systemMessage.content).toContain('Current date and time:');
    expect(systemMessage.content).not.toContain('Default personality');
  });
}); 