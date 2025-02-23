import { BaseNode } from 'agentdock-core';
import { ChatNode } from './chat-node';

/**
 * Creates a chat node with default settings
 */
export function createChatNode(id: string): ChatNode {
  return new ChatNode(id, {
    model: 'claude-3-opus',
    temperature: 0.7,
    maxTokens: 4096
  });
} 