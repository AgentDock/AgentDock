import { LLMOrchestrationService } from '../llm-orchestration-service';
import { CoreMessage } from 'ai';
import { logger } from '../../logging';
import { createMockCoreLLM, createMockOrchestrationManager } from '../../test/setup';
import { SessionId } from '../../types/session';

// Mock logger
jest.mock('../../logging', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  },
  LogCategory: {
    LLM: 'llm'
  }
}));

describe('LLMOrchestrationService', () => {
  let service: LLMOrchestrationService;
  const sessionId: SessionId = 'test-session-id';
  let mockCoreLLM: ReturnType<typeof createMockCoreLLM>;
  let mockOrchestrationManager: ReturnType<typeof createMockOrchestrationManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCoreLLM = createMockCoreLLM({
      streamText: jest.fn().mockImplementation(async (options) => {
        // Simulate invoking onFinish callback for testing
        if (options.onFinish) {
          await options.onFinish({
            finishReason: 'stop',
            usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
            response: { messages: [] }
          });
        }
        // Return a dummy StreamTextResult
        return { 
          usage: Promise.resolve({ promptTokens: 100, completionTokens: 50, totalTokens: 150 }),
          response: Promise.resolve({ provider: 'dummy', id:'', timestamp: new Date(), modelId:'', messages:[]}),
          finishReason: Promise.resolve('stop'),
          text: Promise.resolve(''),
          toolCalls: Promise.resolve([]),
          toolResults: Promise.resolve([]),
        };
      })
    });
    
    mockOrchestrationManager = createMockOrchestrationManager({
      getState: jest.fn().mockResolvedValue({ 
        cumulativeTokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, 
        recentlyUsedTools: [] 
      })
    });
    
    service = new LLMOrchestrationService(mockCoreLLM, mockOrchestrationManager, sessionId);
  });

  it('should call CoreLLM.streamText with provided options', async () => {
    const options = {
      messages: [{ role: 'user', content: 'Hello' }] as CoreMessage[],
      system: 'Test system prompt'
    };
    await service.streamWithOrchestration(options);

    expect(mockCoreLLM.streamText).toHaveBeenCalledTimes(1);
    expect(mockCoreLLM.streamText).toHaveBeenCalledWith(expect.objectContaining({
      messages: options.messages,
      system: options.system,
      onFinish: expect.any(Function), // Check that callbacks were passed
      onStepFinish: expect.any(Function),
    }));
  });

  it('should update token usage via OrchestrationManager onFinish', async () => {
    await service.streamWithOrchestration({ messages: [] });

    // Verify getState was called (to get current usage)
    expect(mockOrchestrationManager.getState).toHaveBeenCalledWith(sessionId);
    // Verify updateState was called with cumulative usage
    expect(mockOrchestrationManager.updateState).toHaveBeenCalledWith(sessionId, {
      cumulativeTokenUsage: {
        promptTokens: 110, // 10 (initial) + 100 (from mock finish event)
        completionTokens: 55, // 5 (initial) + 50 (from mock finish event)
        totalTokens: 165 // 15 (initial) + 150 (from mock finish event)
      }
    });
  });

  it('should track executed tools via OrchestrationManager onFinish', async () => {
    mockOrchestrationManager.updateState = jest.fn().mockResolvedValue({});
    
    const testMockCoreLLM = createMockCoreLLM({
      streamText: jest.fn().mockImplementation(async (options) => {
        if (options.onStepFinish) {
          options.onStepFinish({
            type: 'tool-calls',
            stepType: 'continue',
            finishReason: 'continue',
            usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75 },
            text: 'Using testTool',
            toolCalls: [{ name: 'testTool', input: {} }],
            toolNames: ['testTool']
          });
        }
        
        if (options.onFinish) {
          await options.onFinish({
            finishReason: 'stop',
            usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
            response: { 
              messages: [
                { role: 'assistant', content: 'Using tool' },
                { role: 'function', name: 'testTool', content: 'Tool result' }
              ] 
            }
          });
        }
        
        return { 
          usage: Promise.resolve({ promptTokens: 100, completionTokens: 50, totalTokens: 150 }),
          response: Promise.resolve({ provider: 'dummy', id:'', timestamp: new Date(), modelId:'', messages:[]}),
          finishReason: Promise.resolve('stop'),
          text: Promise.resolve(''),
          toolCalls: Promise.resolve([{ name: 'testTool' }]),
          toolResults: Promise.resolve([]),
        };
      })
    });
    
    const testService = new LLMOrchestrationService(testMockCoreLLM, mockOrchestrationManager, sessionId);

    await testService.streamWithOrchestration({ messages: [] });

    // Verify updateState was called with recentlyUsedTools
    expect(mockOrchestrationManager.updateState).toHaveBeenCalledWith(
      sessionId,
      expect.objectContaining({
        recentlyUsedTools: ['testTool']
      })
    );
  });
  
  it('should call original onFinish callback if provided', async () => {
    const originalOnFinish = jest.fn();
    await service.streamWithOrchestration({ messages: [], onFinish: originalOnFinish });
    
    expect(originalOnFinish).toHaveBeenCalledTimes(1);
    // Check if it received the correct event structure
    expect(originalOnFinish).toHaveBeenCalledWith(expect.objectContaining({
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    }));
  });

  it('should call original onStepFinish callback if provided', async () => {
    const originalOnStepFinish = jest.fn();
    
    const testMockCoreLLM = createMockCoreLLM({
      streamText: jest.fn().mockImplementation(async (options) => {
        if (options.onStepFinish) {
          options.onStepFinish({ 
            type: 'tool-calls',
            toolCalls: [{ name: 'testTool', input: {} }]
          });
        }
        return { 
          usage: Promise.resolve({ promptTokens: 100, completionTokens: 50, totalTokens: 150 }),
          response: Promise.resolve({ provider: 'dummy', id:'', timestamp: new Date(), modelId:'', messages:[]}),
          finishReason: Promise.resolve('stop'),
          text: Promise.resolve(''),
          toolCalls: Promise.resolve([]),
          toolResults: Promise.resolve([]),
        };
      })
    });
    
    const testService = new LLMOrchestrationService(testMockCoreLLM, mockOrchestrationManager, sessionId);
    
    await testService.streamWithOrchestration({ 
      messages: [], 
      onStepFinish: originalOnStepFinish 
    });
    
    expect(originalOnStepFinish).toHaveBeenCalledTimes(1);
    expect(originalOnStepFinish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-calls',
        toolCalls: expect.arrayContaining([
          expect.objectContaining({ name: 'testTool' })
        ])
      })
    );
  });
});       