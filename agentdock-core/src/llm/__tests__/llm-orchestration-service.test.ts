import { LLMOrchestrationService } from '../llm-orchestration-service';
import { CoreLLM } from '../core-llm';
import { OrchestrationManager } from '../../orchestration';
import { SessionId } from '../../types/session';
import { CoreMessage, StreamTextResult } from 'ai';
import { logger } from '../../logging';

// Mock CoreLLM
const mockCoreLLMStreamText = jest.fn();
const mockCoreLLM = {
  streamText: mockCoreLLMStreamText
} as unknown as CoreLLM;

// Mock OrchestrationManager
const mockUpdateState = jest.fn();
const mockGetState = jest.fn();
const mockOrchestrationManager = {
  updateState: mockUpdateState,
  getState: mockGetState
} as unknown as OrchestrationManager;

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

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations before each test
    mockCoreLLMStreamText.mockImplementation(async (options) => {
      // Simulate invoking onFinish callback for testing
      if (options.onFinish) {
        await options.onFinish({
          finishReason: 'stop',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          response: { messages: [/* dummy messages if needed for tool tracking test */] }
        });
      }
      // Return a dummy StreamTextResult
      return { /* dummy result matching type */ 
        usage: Promise.resolve({ promptTokens: 100, completionTokens: 50, totalTokens: 150 }),
        response: Promise.resolve({ provider: 'dummy', id:'', timestamp: new Date(), modelId:'', messages:[]}),
        finishReason: Promise.resolve('stop'),
        text: Promise.resolve(''),
        toolCalls: Promise.resolve([]),
        toolResults: Promise.resolve<never[]>([]),
      };
    });
    mockGetState.mockResolvedValue({ cumulativeTokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, recentlyUsedTools: [] });
    
    service = new LLMOrchestrationService(mockCoreLLM, mockOrchestrationManager, sessionId);
  });

  it('should call CoreLLM.streamText with provided options', async () => {
    const options = {
      messages: [{ role: 'user', content: 'Hello' }] as CoreMessage[],
      system: 'Test system prompt'
    };
    await service.streamWithOrchestration(options);

    expect(mockCoreLLMStreamText).toHaveBeenCalledTimes(1);
    expect(mockCoreLLMStreamText).toHaveBeenCalledWith(expect.objectContaining({
      messages: options.messages,
      system: options.system,
      onFinish: expect.any(Function), // Check that callbacks were passed
      onStepFinish: expect.any(Function),
    }));
  });

  it('should update token usage via OrchestrationManager onFinish', async () => {
    await service.streamWithOrchestration({ messages: [] });

    // Verify getState was called (to get current usage)
    expect(mockGetState).toHaveBeenCalledWith(sessionId);
    // Verify updateState was called with cumulative usage
    expect(mockUpdateState).toHaveBeenCalledWith(sessionId, {
      cumulativeTokenUsage: {
        promptTokens: 110, // 10 (initial) + 100 (from mock finish event)
        completionTokens: 55, // 5 (initial) + 50 (from mock finish event)
        totalTokens: 165 // 15 (initial) + 150 (from mock finish event)
      }
    });
  });

  // TODO: Add test for trackExecutedTools - requires mocking messages in onFinish
  it.todo('should track executed tools via OrchestrationManager onFinish');
  
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

  // TODO: Add test for onStepFinish callback pass-through
  it.todo('should call original onStepFinish callback if provided');
}); 