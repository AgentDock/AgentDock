/**
 * @fileoverview Tests for the AgentNode fallback functionality.
 */

import { AgentNode } from '../agent-node';
import { logger } from '../../logging';
import { CoreMessage } from 'ai';
import { createError, ErrorCode } from '../../errors';
import { LLMConfig } from '../../llm/types';

// Mock dependencies
const mockStreamText = jest.fn();
const mockFallbackStreamText = jest.fn();
const mockCreateLLM = jest.fn();
let shouldPrimaryFail = true;
let shouldFallbackFail = false;

// Mock the createLLM function
jest.mock('../../llm', () => ({
  createLLM: (config: LLMConfig) => {
    mockCreateLLM(config);
    
    // Return different mock implementations based on the API key
    if (config.apiKey === 'sk-ant-primary-api-key') {
      return {
        streamText: shouldPrimaryFail 
          ? mockStreamText.mockRejectedValueOnce(
              createError('llm', 'Primary LLM failed', ErrorCode.LLM_REQUEST)
            )
          : mockStreamText.mockResolvedValueOnce({
              text: 'Primary response',
              textStream: {
                [Symbol.asyncIterator]: async function* () {
                  yield 'Primary';
                  yield ' ';
                  yield 'response';
                }
              }
            }),
        getLastTokenUsage: jest.fn().mockReturnValue(null)
      };
    } else if (config.apiKey === 'sk-ant-fallback-api-key') {
      return {
        streamText: shouldFallbackFail
          ? mockFallbackStreamText.mockRejectedValueOnce(
              createError('llm', 'Fallback LLM failed', ErrorCode.LLM_RESPONSE)
            )
          : mockFallbackStreamText.mockResolvedValueOnce({
              text: 'Fallback response',
              textStream: {
                [Symbol.asyncIterator]: async function* () {
                  yield 'Fallback';
                  yield ' ';
                  yield 'response';
                }
              }
            }),
        getLastTokenUsage: jest.fn().mockReturnValue({
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150
        })
      };
    }
    
    return {
      streamText: jest.fn().mockRejectedValue(new Error('Unknown API key')),
      getLastTokenUsage: jest.fn().mockReturnValue(null)
    };
  }
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

describe('AgentNode Fallback', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    shouldPrimaryFail = true;
    shouldFallbackFail = false;
    mockStreamText.mockClear();
    mockFallbackStreamText.mockClear();
  });

  it('should use fallback API key when primary fails', async () => {
    // Create a mock config with primary and fallback API keys
    const config = {
      agentConfig: {
        personality: 'I am a helpful assistant',
        options: {
          maxSteps: 3
        }
      },
      apiKey: 'sk-ant-primary-api-key',
      fallbackApiKey: 'sk-ant-fallback-api-key'
    };

    // Create an instance of AgentNode
    const agentNode = new AgentNode('test-agent', config);

    // Create mock messages
    const messages: CoreMessage[] = [
      { role: 'user', content: 'Hello' } as CoreMessage
    ];

    // Call handleMessage
    const result = await agentNode.handleMessage({ messages });

    // Verify that both LLMs were created
    expect(mockCreateLLM).toHaveBeenCalledTimes(2);
    expect(mockCreateLLM).toHaveBeenNthCalledWith(1, expect.objectContaining({
      apiKey: 'sk-ant-primary-api-key'
    }));
    expect(mockCreateLLM).toHaveBeenNthCalledWith(2, expect.objectContaining({
      apiKey: 'sk-ant-fallback-api-key'
    }));

    // Verify that primary LLM was called and failed
    expect(mockStreamText).toHaveBeenCalledTimes(1);
    
    // Verify that fallback LLM was called
    expect(mockFallbackStreamText).toHaveBeenCalledTimes(1);
    
    // Verify that the result is from the fallback LLM
    expect(result).toEqual(expect.objectContaining({
      text: 'Fallback response'
    }));
    
    // Verify that the logger was called with the correct arguments
    expect(logger.info).toHaveBeenCalledWith(
      'node',
      'AgentNode',
      'Using fallback LLM',
      expect.objectContaining({
        nodeId: 'test-agent',
        error: 'Primary LLM failed'
      })
    );
  });

  it('should throw error when both primary and fallback fail', async () => {
    // Set both primary and fallback to fail
    shouldPrimaryFail = true;
    shouldFallbackFail = true;
    
    // Create a mock config with primary and fallback API keys
    const config = {
      agentConfig: {
        personality: 'I am a helpful assistant',
        options: {
          maxSteps: 3
        }
      },
      apiKey: 'sk-ant-primary-api-key',
      fallbackApiKey: 'sk-ant-fallback-api-key'
    };

    // Create an instance of AgentNode
    const agentNode = new AgentNode('test-agent', config);

    // Create mock messages
    const messages: CoreMessage[] = [
      { role: 'user', content: 'Hello' } as CoreMessage
    ];

    // Call handleMessage and expect it to throw
    await expect(agentNode.handleMessage({ messages })).rejects.toThrow('Both LLMs failed');
  });

  it('should use fallback when explicitly requested', async () => {
    // Create a mock config with primary and fallback API keys
    const config = {
      agentConfig: {
        personality: 'I am a helpful assistant',
        options: {
          maxSteps: 3
        }
      },
      apiKey: 'sk-ant-primary-api-key',
      fallbackApiKey: 'sk-ant-fallback-api-key'
    };

    // Create an instance of AgentNode
    const agentNode = new AgentNode('test-agent', config);

    // Create mock messages
    const messages: CoreMessage[] = [
      { role: 'user', content: 'Hello' } as CoreMessage
    ];

    // Call handleMessage with useFallback option
    const result = await agentNode.handleMessage({ 
      messages,
      useFallback: true
    });

    // Verify that only the fallback LLM was called
    expect(mockStreamText).not.toHaveBeenCalled();
    expect(mockFallbackStreamText).toHaveBeenCalledTimes(1);
    
    // Verify that the result is from the fallback LLM
    expect(result).toEqual(expect.objectContaining({
      text: 'Fallback response'
    }));
  });
}); 