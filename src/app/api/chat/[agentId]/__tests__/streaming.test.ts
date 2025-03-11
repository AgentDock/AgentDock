import { NextRequest } from 'next/server';
import { Message } from 'ai';
import { POST } from '../route';
import { ConfigCache } from '@/lib/services/config-cache';

// Mock dependencies
jest.mock('@/generated/templates', () => ({
  templates: {
    'test-agent': {
      version: '1.0',
      name: 'Test Agent',
      description: 'Test agent for streaming',
      personality: 'Helpful test assistant',
      nodes: ['llm.anthropic'],
      nodeConfigurations: {
        'llm.anthropic': {
          model: 'claude-3-opus-20240229',
          temperature: 0.7,
          maxTokens: 4096
        }
      }
    }
  }
}));

jest.mock('@/lib/services/config-cache');

describe('Chat API Streaming', () => {
  const mockApiKey = 'test-api-key';
  const mockAgentId = 'test-agent';
  const mockMessages: Message[] = [
    { id: '1', role: 'user', content: 'Hello' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock ConfigCache
    (ConfigCache.getInstance as jest.Mock).mockReturnValue({
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined)
    });
  });

  describe('Streaming Setup', () => {
    it('should set up edge runtime', () => {
      expect(process.env.NEXT_RUNTIME).toBe('edge');
    });

    it('should require API key', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat/test-agent', {
        method: 'POST',
        body: JSON.stringify({ messages: mockMessages })
      });

      const response = await POST(request, { params: Promise.resolve({ agentId: mockAgentId }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('API key is required');
    });
  });

  describe('Streaming Response', () => {
    it('should stream response with correct headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat/test-agent', {
        method: 'POST',
        headers: {
          'x-api-key': mockApiKey
        },
        body: JSON.stringify({ messages: mockMessages })
      });

      const response = await POST(request, { params: Promise.resolve({ agentId: mockAgentId }) });

      expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
      expect(response.headers.get('x-accel-buffering')).toBe('no');
      expect(response.headers.get('cache-control')).toBe('no-cache');
    });

    it('should handle large messages', async () => {
      const largeMessages = Array(10).fill(null).map((_, i) => ({
        id: String(i),
        role: 'user' as const,
        content: 'A'.repeat(1000)
      }));

      const request = new NextRequest('http://localhost:3000/api/chat/test-agent', {
        method: 'POST',
        headers: {
          'x-api-key': mockApiKey
        },
        body: JSON.stringify({ messages: largeMessages })
      });

      const response = await POST(request, { params: Promise.resolve({ agentId: mockAgentId }) });
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors with retry', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat/test-agent', {
        method: 'POST',
        headers: {
          'x-api-key': mockApiKey
        },
        body: JSON.stringify({ 
          messages: mockMessages,
          experimental_forceError: 'ECONNRESET'  // Test flag
        })
      });

      const response = await POST(request, { params: Promise.resolve({ agentId: mockAgentId }) });
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.code).toBe('ECONNRESET');
      expect(data.retryable).toBe(true);
    });

    it('should handle invalid templates', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat/invalid-agent', {
        method: 'POST',
        headers: {
          'x-api-key': mockApiKey
        },
        body: JSON.stringify({ messages: mockMessages })
      });

      const response = await POST(request, { params: Promise.resolve({ agentId: 'invalid-agent' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Template not found');
    });
  });

  describe('Configuration Management', () => {
    it('should use cached config when available', async () => {
      const mockConfig = {
        name: 'Test Agent',
        model: 'claude-3-opus-20240229',
        temperature: 0.7,
        maxTokens: 4096
      };

      (ConfigCache.getInstance as jest.Mock).mockReturnValue({
        get: jest.fn().mockResolvedValue(mockConfig),
        set: jest.fn()
      });

      const request = new NextRequest('http://localhost:3000/api/chat/test-agent', {
        method: 'POST',
        headers: {
          'x-api-key': mockApiKey
        },
        body: JSON.stringify({ messages: mockMessages })
      });

      await POST(request, { params: Promise.resolve({ agentId: mockAgentId }) });

      const cache = ConfigCache.getInstance();
      expect(cache.get).toHaveBeenCalledWith(mockAgentId, '1.0');
      expect(cache.set).not.toHaveBeenCalled();
    });
  });
}); 