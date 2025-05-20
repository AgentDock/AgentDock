import {
  Message,
  MessageRole,
  createMessage as createCoreMessage,
  createToolMessage as createCoreToolMessage,
} from 'agentdock-core';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new message with the given role and content
 *
 * This is a wrapper around the core createMessage function
 * that adds some additional convenience
 */
export function createMessage(
  role: MessageRole,
  content: string,
  additionalProps: Partial<Message> = {},
): Message {
  return createCoreMessage({
    role,
    content,
    id: additionalProps.id || uuidv4(),
    createdAt: additionalProps.createdAt || new Date(),
    ...additionalProps,
  });
}

/**
 * Create a system message
 */
export function createSystemMessage(content: string): Message {
  return createMessage('system', content);
}

/**
 * Create a user message
 */
export function createUserMessage(content: string): Message {
  return createMessage('user', content);
}

/**
 * Create an assistant message
 */
export function createAssistantMessage(content: string): Message {
  return createMessage('assistant', content);
}

/**
 * Create a tool message (will be represented as 'data' role with isToolMessage=true)
 */
export function createToolMessage(content: string, toolCallId: string, toolName: string): Message {
  return createCoreToolMessage({
    content,
    toolCallId,
    toolName,
    id: uuidv4(),
    createdAt: new Date(),
  });
}
