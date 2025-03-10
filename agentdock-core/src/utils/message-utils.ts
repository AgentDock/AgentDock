/**
 * Utility functions for message handling
 */

import { CoreMessage } from 'ai';
import { LLMMessage } from '../llm/types';

/**
 * Convert CoreMessage to LLMMessage
 * This is needed because CoreMessage can contain complex content like images,
 * but LLMMessage expects string content.
 */
export function convertCoreToLLMMessage(message: CoreMessage): LLMMessage {
  // Handle user messages with complex content
  if (message.role === 'user' && typeof message.content !== 'string') {
    // Extract text content from user message parts
    const textContent = Array.isArray(message.content) 
      ? message.content
          .filter(part => typeof part === 'object' && 'type' in part && part.type === 'text')
          .map(part => (part as any).text || '')
          .join(' ')
      : '';
    
    return {
      role: message.role,
      content: textContent,
      // id and createdAt are optional in LLMMessage
      id: (message as any).id,
      createdAt: (message as any).createdAt ? new Date((message as any).createdAt).getTime() : undefined
    };
  }
  
  // For tool messages, convert to assistant role (LLMMessage doesn't support tool role)
  const role = message.role === 'tool' ? 'assistant' : message.role;
  
  // Handle assistant and system messages (which should already have string content)
  return {
    role: role as 'user' | 'assistant' | 'system',
    content: message.content as string,
    // id and createdAt are optional in LLMMessage
    id: (message as any).id,
    createdAt: (message as any).createdAt ? new Date((message as any).createdAt).getTime() : undefined
  };
}

/**
 * Convert an array of CoreMessages to LLMMessages
 */
export function convertCoreToLLMMessages(messages: CoreMessage[]): LLMMessage[] {
  return messages.map(convertCoreToLLMMessage);
} 