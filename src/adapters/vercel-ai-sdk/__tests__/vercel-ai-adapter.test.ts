import { VercelAIAdapter } from '../vercel-ai-adapter';
import { Message } from 'ai';
import { 
  Tool, 
  createError, 
  ErrorCode,
  logger,
  LogCategory,
  ToolResult,
  BaseNode
} from 'agentdock-core';

// Mock dependencies
jest.mock('agentdock-core', () => ({
  createError: jest.fn(),
  logger: {
    debug: jest.fn(),
    error: jest.fn()
  },
  LogCategory: {
    LLM: 'llm'
  },
  ErrorCode: {
    LLM_REQUEST: 'LLM_REQUEST_ERROR',
    LLM_RATE_LIMIT: 'LLM_RATE_LIMIT_ERROR',
    LLM_EXECUTION: 'LLM_EXECUTION_ERROR'
  }
}));

describe('VercelAIAdapter', () => {
  let adapter: VercelAIAdapter;
  const mockConfig = {
    model: 'claude-3-sonnet',
    temperature: 0.7,
    maxTokens: 4096
  };

  const mockMessages: Message[] = [
    { id: '1', role: 'user', content: 'Hello' }
  ];

  class MockTool extends BaseNode implements Tool {
    readonly type = 'function';
    readonly name = 'test-tool';
    readonly description = 'A test tool';
    readonly parameters = {
      type: 'object',
      properties: {
        input: { type: 'string' }
      }
    };

    protected getCategory() { return 'custom' as const; }
    protected getLabel() { return 'Test Tool'; }
    protected getDescription() { return 'A test tool'; }
    protected getVersion() { return '1.0.0'; }
    protected getCompatibility() {
      return {
        core: true,
        pro: true,
        custom: true
      };
    }
    protected getInputs() { return []; }
    protected getOutputs() { return []; }

    async execute(): Promise<ToolResult<string>> {
      return {
        result: 'result',
        toolCallId: 'test-call-id'
      };
    }
  }

  const mockTool = new MockTool('test-tool-id', {});

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new VercelAIAdapter({ apiKey: 'test-key' }, [mockTool]);
  });

  describe('generateStream', () => {
    it('should generate a stream successfully', async () => {
      // Mock successful stream
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(Buffer.from('data: Test response\n\n')));
          controller.enqueue(new Uint8Array(Buffer.from('data: [DONE]\n\n')));
          controller.close();
        }
      });

      const mockAnthropicStream = {
        [Symbol.asyncIterator]: async function*() {
          yield { type: 'content_block_delta', delta: { text: 'Test response' } };
        }
      };

      // Mock the private anthropic client
      Object.defineProperty(adapter, 'anthropic', {
        value: {
          messages: {
            create: jest.fn().mockResolvedValue(mockAnthropicStream)
          }
        }
      });

      const result = await adapter.generateStream(mockConfig, mockMessages);

      // Verify stream
      expect(result).toBeInstanceOf(ReadableStream);

      // Verify Anthropic SDK call
      const anthropicClient = (adapter as any).anthropic;
      expect(anthropicClient.messages.create).toHaveBeenCalledWith({
        model: mockConfig.model,
        temperature: mockConfig.temperature,
        max_tokens: mockConfig.maxTokens,
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true
      });
    });

    it('should handle stream generation errors', async () => {
      const mockError = new Error('Stream generation failed');
      Object.defineProperty(adapter, 'anthropic', {
        value: {
          messages: {
            create: jest.fn().mockRejectedValue(mockError)
          }
        }
      });
      (createError as jest.Mock).mockReturnValueOnce(mockError);

      await expect(adapter.generateStream(mockConfig, mockMessages))
        .rejects.toThrow('Stream generation failed');

      expect(logger.error).toHaveBeenCalledWith(
        LogCategory.LLM,
        'VercelAIAdapter',
        'Failed to generate stream',
        { error: 'Stream generation failed' }
      );
    });

    it('should handle rate limit errors', async () => {
      const mockError = new Error('rate limit exceeded');
      Object.defineProperty(adapter, 'anthropic', {
        value: {
          messages: {
            create: jest.fn().mockRejectedValue(mockError)
          }
        }
      });

      await expect(adapter.generateStream(mockConfig, mockMessages))
        .rejects.toThrow();

      expect(createError).toHaveBeenCalledWith(
        'llm',
        'Rate limit exceeded',
        ErrorCode.LLM_RATE_LIMIT,
        { originalError: mockError }
      );
    });

    it('should handle abort errors', async () => {
      const mockError = new Error('Request aborted');
      mockError.name = 'AbortError';
      Object.defineProperty(adapter, 'anthropic', {
        value: {
          messages: {
            create: jest.fn().mockRejectedValue(mockError)
          }
        }
      });

      await expect(adapter.generateStream(mockConfig, mockMessages))
        .rejects.toThrow();

      expect(createError).toHaveBeenCalledWith(
        'llm',
        'Request aborted',
        ErrorCode.LLM_REQUEST,
        { originalError: mockError }
      );
    });
  });

  describe('mapError', () => {
    it('should map known error types', () => {
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';
      
      const rateLimitError = new Error('rate limit exceeded');
      
      const genericError = new Error('Generic error');

      adapter.mapError(abortError);
      expect(createError).toHaveBeenCalledWith(
        'llm',
        'Request aborted',
        ErrorCode.LLM_REQUEST,
        { originalError: abortError }
      );

      adapter.mapError(rateLimitError);
      expect(createError).toHaveBeenCalledWith(
        'llm',
        'Rate limit exceeded',
        ErrorCode.LLM_RATE_LIMIT,
        { originalError: rateLimitError }
      );

      adapter.mapError(genericError);
      expect(createError).toHaveBeenCalledWith(
        'llm',
        'Generic error',
        ErrorCode.LLM_EXECUTION,
        { originalError: genericError }
      );
    });

    it('should handle unknown error types', () => {
      const unknownError = { foo: 'bar' };

      adapter.mapError(unknownError);
      expect(createError).toHaveBeenCalledWith(
        'llm',
        'Unknown error occurred',
        ErrorCode.LLM_EXECUTION,
        { originalError: unknownError }
      );
    });
  });
}); 