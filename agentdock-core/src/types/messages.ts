/**
 * @fileoverview Core message type definitions for AgentDock
 * 
 * This module defines a unified message type that extends the Vercel AI SDK
 * message type while adding our rendering properties. This eliminates the need
 * for conversion functions that could cause property loss.
 */

// Import AI SDK types for proper alignment
import type { Message as AIMessage } from 'ai';

// Re-export AI SDK message roles for consistent usage
export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
  DATA: 'data',
} as const;

// The role type must match AI SDK exactly for type compatibility
export type MessageRole = 'user' | 'assistant' | 'system' | 'data';

// Message content types - these map to AI SDK 4.2.0 part types
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  url: string;
  alt?: string;
}

export interface ToolCallContent {
  type: 'tool_call';
  toolName: string;
  toolCallId: string;
  args: Record<string, any>;
}

export interface ToolResultContent {
  type: 'tool_result';
  toolCallId: string;
  result: any;
}

// Union type for all content types
export type MessageContent = TextContent | ImageContent | ToolCallContent | ToolResultContent;

// Additional rendering properties that extend the AI SDK message
export interface MessageRenderingProps {
  // UI-specific properties for rendering
  isStreaming?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  isTyping?: boolean;
  isPending?: boolean;
  isComplete?: boolean;
  showToolCall?: boolean;
  // Custom content storage - preserves multipart content when sending to AI SDK
  contentParts?: MessageContent[];
  // For marking tool messages internally (since we'll store as 'data' in AI SDK)
  isToolMessage?: boolean;
}

/**
 * Unified Message type that extends AI SDK Message while adding our rendering properties
 * This eliminates the need for conversion between different message types
 */
export interface Message extends Omit<AIMessage, 'role'> {
  // We need to redefine role here to match our extended MessageRole
  role: MessageRole;
  // Additional properties from our rendering needs
  isStreaming?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  isTyping?: boolean;
  isPending?: boolean; 
  isComplete?: boolean;
  showToolCall?: boolean;
  contentParts?: MessageContent[];
  isToolMessage?: boolean;
  // Tool-specific properties
  toolCallId?: string;
  toolName?: string;
}

// Specific message type guards that check role property
export const isUserMessage = (message: Message): boolean => 
  message.role === 'user';

export const isAssistantMessage = (message: Message): boolean => 
  message.role === 'assistant';

export const isSystemMessage = (message: Message): boolean => 
  message.role === 'system';

export const isToolMessage = (message: Message): boolean => 
  message.role === 'data' && message.isToolMessage === true;

// Content utility function
export function formatContentForDisplay(content: MessageContent): string {
  switch (content.type) {
    case 'text':
      return content.text;
    case 'tool_result':
      return `[Tool Result: ${content.toolCallId}]`;
    case 'tool_call':
      return `[Tool Call: ${content.toolName}]`;
    case 'image':
      return `[Image: ${content.url}]`;
    default:
      return '';
  }
}

/**
 * Create a standard message
 */
export function createMessage(params: Partial<Message> & Pick<Message, 'content'> & {
  role: MessageRole;
}): Message {
  return {
    id: params.id || crypto.randomUUID(),
    createdAt: params.createdAt || new Date(),
    ...params
  };
}

/**
 * Create a tool message (represented as 'data' role for AI SDK compatibility)
 */
export function createToolMessage(params: Partial<Message> & Pick<Message, 'content'> & {
  toolCallId: string;
  toolName: string;
}): Message {
  return {
    id: params.id || crypto.randomUUID(),
    createdAt: params.createdAt || new Date(),
    role: 'data',
    isToolMessage: true,
    ...params
  };
}

// AI SDK compatibility - define explicit map functions
export function toAIMessage(message: Message): AIMessage {
  // Convert content to string if needed
  const content = typeof message.content === 'string' 
    ? message.content 
    : JSON.stringify(message.content);

  return {
    id: message.id,
    createdAt: message.createdAt,
    role: message.role as AIMessage['role'],
    content
  };
}

export function fromAIMessage(aiMessage: AIMessage): Message {
  return {
    id: aiMessage.id,
    createdAt: aiMessage.createdAt,
    role: aiMessage.role as MessageRole,
    content: aiMessage.content
  };
} 