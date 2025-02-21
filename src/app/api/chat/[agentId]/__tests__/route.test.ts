import { NextRequest } from 'next/server';
import { AgentNode } from 'agentdock-core/src/nodes/agent-node';
import { loadAgentConfig } from 'agentdock-core/src/utils/load-agent-config';
import { logger } from 'agentdock-core/src/logging';
import { APIError } from 'agentdock-core/src/errors';
import { POST } from '../route';

// Mock dependencies
jest.mock('agentdock-core/src/nodes/agent-node');
jest.mock('agentdock-core/src/utils/load-agent-config');
jest.mock('agentdock-core/src/logging');

describe('Chat API Route', () => {
  const mockAgentId = 'test-agent';
  const mockUrl = `http://localhost:3000/api/chat/${mockAgentId}`;
  const mockMessage = { role: 'user', content: 'Hello' };
  const mockConfig = {
    version: '1.0',
    agentId: mockAgentId,
    name: 'Test Agent',
    description: 'Test agent for integration tests',
    personality: 'Helpful test assistant',
    modules: ['llm.test'],
    nodeConfigurations: {},
    chatSettings: {}
  };

  let mockAgentNode: jest.Mocked<AgentNode>;
  let mockLoadConfig: jest.MockedFunction<typeof loadAgentConfig>;
  let mockLogger: jest.Mocked<typeof logger>;

  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks();

    // Setup AgentNode mock
    mockAgentNode = {
      initialize: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn().mockResolvedValue(new ReadableStream()),
      cleanup: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<AgentNode>;
    (AgentNode as jest.Mock).mockImplementation(() => mockAgentNode);

    // Setup loadAgentConfig mock
    mockLoadConfig = loadAgentConfig as jest.MockedFunction<typeof loadAgentConfig>;
    mockLoadConfig.mockResolvedValue(mockConfig);

    // Setup logger mock
    mockLogger = logger as jest.Mocked<typeof logger>;
    Object.values(mockLogger).forEach(method => {
      if (typeof method === 'function') {
        (method as jest.Mock).mockResolvedValue(undefined);
      }
    });
  });

  describe('Following Sequence Diagram Flow', () => {
    it('should process a chat request successfully', async () => {
      // Create request following sequence diagram
      const request = new NextRequest(mockUrl, {
        method: 'POST',
        body: JSON.stringify({ messages: [mockMessage] })
      });

      // Execute request
      const response = await POST(request, { params: { agentId: mockAgentId } });

      // Verify the sequence of operations
      expect(mockLoadConfig).toHaveBeenCalledWith(mockAgentId);
      expect(AgentNode).toHaveBeenCalledWith(mockAgentId, expect.objectContaining({
        agentConfig: mockConfig,
        autoStart: true
      }));
      expect(mockAgentNode.initialize).toHaveBeenCalled();
      expect(mockAgentNode.execute).toHaveBeenCalledWith(mockMessage.content);
      expect(mockAgentNode.cleanup).toHaveBeenCalled();

      // Verify response
      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it('should handle streaming response correctly', async () => {
      // Setup streaming mock
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue('Test response');
          controller.close();
        }
      });
      mockAgentNode.execute.mockResolvedValue(mockStream);

      // Create request
      const request = new NextRequest(mockUrl, {
        method: 'POST',
        body: JSON.stringify({ messages: [mockMessage] })
      });

      // Execute request
      const response = await POST(request, { params: { agentId: mockAgentId } });
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      }

      // Verify streaming response
      expect(chunks.length).toBeGreaterThan(0);
      const text = new TextDecoder().decode(chunks[0]);
      expect(text).toBe('Test response');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing agentId', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat/', {
        method: 'POST',
        body: JSON.stringify({ messages: [mockMessage] })
      });

      const response = await POST(request, { params: { agentId: '' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid agentId');
    });

    it('should handle missing messages', async () => {
      const request = new NextRequest(mockUrl, {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request, { params: { agentId: mockAgentId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing messages');
    });

    it('should handle non-user last message', async () => {
      const request = new NextRequest(mockUrl, {
        method: 'POST',
        body: JSON.stringify({ messages: [{ role: 'assistant', content: 'Hello' }] })
      });

      const response = await POST(request, { params: { agentId: mockAgentId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Last message must be from user');
    });

    it('should handle AgentNode initialization errors', async () => {
      mockAgentNode.initialize.mockRejectedValue(new Error('Initialization failed'));

      const request = new NextRequest(mockUrl, {
        method: 'POST',
        body: JSON.stringify({ messages: [mockMessage] })
      });

      const response = await POST(request, { params: { agentId: mockAgentId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal Server Error');
      expect(mockAgentNode.cleanup).toHaveBeenCalled();
    });

    it('should handle execution errors', async () => {
      mockAgentNode.execute.mockRejectedValue(new Error('Execution failed'));

      const request = new NextRequest(mockUrl, {
        method: 'POST',
        body: JSON.stringify({ messages: [mockMessage] })
      });

      const response = await POST(request, { params: { agentId: mockAgentId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal Server Error');
      expect(mockAgentNode.cleanup).toHaveBeenCalled();
    });
  });

  describe('Logging', () => {
    it('should log request processing steps', async () => {
      const request = new NextRequest(mockUrl, {
        method: 'POST',
        body: JSON.stringify({ messages: [mockMessage] })
      });

      await POST(request, { params: { agentId: mockAgentId } });

      // Verify logging sequence
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.any(String),
        'ChatRoute',
        expect.stringContaining(mockAgentId)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.any(String),
        'ChatRoute',
        expect.stringContaining('Creating agent node')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.any(String),
        'ChatRoute',
        expect.stringContaining('Initializing agent node')
      );
    });

    it('should log errors properly', async () => {
      mockAgentNode.execute.mockRejectedValue(new Error('Test error'));

      const request = new NextRequest(mockUrl, {
        method: 'POST',
        body: JSON.stringify({ messages: [mockMessage] })
      });

      await POST(request, { params: { agentId: mockAgentId } });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        'ChatRoute',
        'Error processing chat request',
        expect.objectContaining({
          error: 'Test error'
        })
      );
    });
  });
}); 