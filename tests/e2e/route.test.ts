import { NextRequest } from 'next/server';
import { POST } from '../../src/app/api/chat/[agentId]/route';

describe('Chat Route Handler', () => {
  const mockApiKey = 'test-api-key';
  const mockMessages = [
    { role: 'user', content: 'Hello' }
  ];

  beforeEach(() => {
    // Clear mocks between tests
    jest.clearAllMocks();
  });

  it('handles valid requests correctly', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat/chat-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': mockApiKey
      },
      body: JSON.stringify({
        messages: mockMessages,
        system: 'You are a helpful assistant'
      })
    });

    const context = {
      params: Promise.resolve({ agentId: 'chat-agent' })
    };

    const response = await POST(request, context);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
  });

  it('handles missing API key correctly', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat/chat-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: mockMessages
      })
    });

    const context = {
      params: Promise.resolve({ agentId: 'chat-agent' })
    };

    const response = await POST(request, context);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain('API key is required');
  });

  it('handles invalid agent ID correctly', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat/invalid-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': mockApiKey
      },
      body: JSON.stringify({
        messages: mockMessages
      })
    });

    const context = {
      params: Promise.resolve({ agentId: 'invalid-agent' })
    };

    const response = await POST(request, context);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain('Template not found');
  });

  it('validates edge runtime configuration', () => {
    const { runtime } = require('../../src/app/api/chat/[agentId]/route');
    expect(runtime).toBe('edge');
  });
}); 