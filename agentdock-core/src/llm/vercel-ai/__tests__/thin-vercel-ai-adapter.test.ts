/**
 * @fileoverview Tests for the ThinVercelAIAdapter
 */

import { ThinVercelAIAdapter } from '../thin-vercel-ai-adapter';
import { Message, UserMessage } from '../../../types/messages';
import { v4 as uuidv4 } from 'uuid';
import { ReadableStream } from 'stream/web';
import { AIStream, StreamingTextResponse } from 'ai';

// Mock the fetch function
global.fetch = jest.fn();

// Mock the AIStream function
jest.mock('ai', () => ({
  AIStream: jest.fn(),
  StreamingTextResponse: jest.fn()
}));

describe('ThinVercelAIAdapter', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test data
  const testMessages: Message[] = [
    {
      id: uuidv4(),
      role: 'system',
      content: 'You are a helpful assistant.',
      createdAt: new Date()
    },
    {
      id: uuidv4(),
      role: 'user',
      content: 'Hello, how are you?',
      createdAt: new Date()
    }
  ];

  const mockResponse = {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    created: 1677858242,
    model: 'gpt-3.5-turbo-0613',
    usage: {
      prompt_tokens: 13,
      completion_tokens: 7,
      total_tokens: 20
    },
    choices: [
      {
        message: {
          role: 'assistant',
          content: 'I am doing well, thank you for asking!'
        },
        finish_reason: 'stop',
        index: 0
      }
    ]
  };

  describe('constructor', () => {
    it('should create a new instance with the provided options', () => {
      const adapter = new ThinVercelAIAdapter({
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
        apiKey: 'test-api-key',
        baseUrl: 'https://api.example.com'
      });

      expect(adapter).toBeInstanceOf(ThinVercelAIAdapter);
    });
  });

  describe('generateCompletion', () => {
    it('should generate a completion for the given messages', async () => {
      // Mock the fetch response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });

      const adapter = new ThinVercelAIAdapter({
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
        apiKey: 'test-api-key'
      });

      const result = await adapter.generateCompletion(testMessages);

      // Check that fetch was called with the correct arguments
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          }),
          body: expect.any(String)
        })
      );

      // Parse the request body
      const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      
      // Check that the request body contains the correct data
      expect(requestBody).toEqual({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: 'You are a helpful assistant.'
          }),
          expect.objectContaining({
            role: 'user',
            content: 'Hello, how are you?'
          })
        ]),
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 1000,
        stream: false
      });

      // Check the result
      expect(result).toEqual({
        message: expect.objectContaining({
          role: 'assistant',
          content: 'I am doing well, thank you for asking!'
        }),
        usage: mockResponse.usage
      });
    });

    it('should throw an error if the API request fails', async () => {
      // Mock the fetch response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValueOnce({ error: 'Invalid request' })
      });

      const adapter = new ThinVercelAIAdapter({
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
        apiKey: 'test-api-key'
      });

      await expect(adapter.generateCompletion(testMessages)).rejects.toThrow(
        'API request failed: 400 Bad Request - {"error":"Invalid request"}'
      );
    });
  });

  describe('generateCompletionStream', () => {
    it('should generate a streaming completion for the given messages', async () => {
      // Create a mock readable stream
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('I am doing well'));
          controller.close();
        }
      });

      // Mock the AIStream function
      (AIStream as jest.Mock).mockReturnValueOnce(mockStream);

      // Mock the fetch response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });

      const adapter = new ThinVercelAIAdapter({
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
        apiKey: 'test-api-key'
      });

      const result = await adapter.generateCompletionStream(testMessages);

      // Check that fetch was called with the correct arguments
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          }),
          body: expect.any(String)
        })
      );

      // Parse the request body
      const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      
      // Check that the request body contains the correct data
      expect(requestBody).toEqual({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: 'You are a helpful assistant.'
          }),
          expect.objectContaining({
            role: 'user',
            content: 'Hello, how are you?'
          })
        ]),
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 1000,
        stream: true
      });

      // Check that AIStream was called with the response
      expect(AIStream).toHaveBeenCalledWith(expect.objectContaining({
        ok: true,
        body: mockStream
      }));

      // Check the result
      expect(result).toBe(mockStream);
    });

    it('should throw an error if the API request fails', async () => {
      // Mock the fetch response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValueOnce('Invalid request')
      });

      const adapter = new ThinVercelAIAdapter({
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
        apiKey: 'test-api-key'
      });

      await expect(adapter.generateCompletionStream(testMessages)).rejects.toThrow(
        'API request failed: 400 Bad Request - Invalid request'
      );
    });
  });

  describe('createStreamingResponse', () => {
    it('should create a StreamingTextResponse from a ReadableStream', () => {
      // Create a mock readable stream
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('I am doing well'));
          controller.close();
        }
      });

      // Mock the StreamingTextResponse constructor
      (StreamingTextResponse as unknown as jest.Mock).mockImplementationOnce((stream) => ({
        stream
      }));

      const adapter = new ThinVercelAIAdapter({
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
        apiKey: 'test-api-key'
      });

      const result = adapter.createStreamingResponse(mockStream);

      // Check that StreamingTextResponse was called with the stream
      expect(StreamingTextResponse).toHaveBeenCalledWith(mockStream);

      // Check the result
      expect(result).toEqual({ stream: mockStream });
    });
  });
}); 