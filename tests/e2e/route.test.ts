import { NextRequest } from 'next/server';
import { POST } from '@/app/api/chat/[agentId]/route';
import { Message } from 'ai';

describe.skip('Chat Route E2E', () => {
  const mockMessages: Message[] = [
    { id: '1', role: 'user', content: 'Hello' }
  ];

  const mockAgentId = 'test-agent';

  it('should handle missing API key', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat/test-agent', {
      method: 'POST',
      body: JSON.stringify({ messages: mockMessages })
    });

    const response = await POST(request, { params: Promise.resolve({ agentId: mockAgentId }) });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('API key is required');
  });

  it('should handle invalid agent ID', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat/invalid-agent', {
      method: 'POST',
      headers: {
        'x-api-key': 'test-key'
      },
      body: JSON.stringify({ messages: mockMessages })
    });

    const response = await POST(request, { params: Promise.resolve({ agentId: 'invalid-agent' }) });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Template not found');
  });

  // Add more test cases as needed
}); 