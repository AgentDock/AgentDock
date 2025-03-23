/**
 * @fileoverview Core message type definitions for AgentDock
 * 
 * These types are aligned with AI SDK 4.2.0's message architecture while
 * maintaining our enhanced content structure.
 */

// Import AI SDK types for proper alignment
import type { Message as AIMessage } from 'ai';

// Core message roles - aligned with AI SDK but with our 'tool' role
export const MessageRole = Object.freeze({
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
  TOOL: 'tool',  // Maps to 'data' in AI SDK
  DATA: 'data'   // Added for direct AI SDK compatibility
} as const);

// Type derived from the const object
export type MessageRole = typeof MessageRole[keyof typeof MessageRole];

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

// Base message interface
export interface BaseMessage {
  id: string;
  role: MessageRole;
  content: string | MessageContent[];
  createdAt?: Date;
  // Support for AI SDK 4.2.0 parts array
  parts?: MessageContent[];
}

// Specific message types
export interface UserMessage extends BaseMessage {
  role: 'user';
  content: string | (TextContent | ImageContent)[];
}

export interface AssistantMessage extends BaseMessage {
  role: 'assistant';
  content: string | (TextContent | ToolCallContent)[];
}

export interface SystemMessage extends BaseMessage {
  role: 'system';
  content: string;
}

export interface ToolMessage extends BaseMessage {
  role: 'tool' | 'data'; // Support both our role and AI SDK's role
  content: ToolResultContent[];
  toolCallId: string;
  toolName: string;
}

// Union type for all message types
export type Message = UserMessage | AssistantMessage | SystemMessage | ToolMessage;

// AI SDK compatibility - define explicit map functions
export function toAIMessage(message: Message): AIMessage {
  // Convert content to string as required by AI SDK
  const content = isMultipartContent(message.content)
    ? message.content.map(formatContent).join('\n')
    : message.content;

  // Map our roles to AI SDK roles
  const aiRole = message.role === 'tool' ? 'data' : message.role;

  return {
    id: message.id,
    createdAt: message.createdAt,
    role: aiRole as AIMessage['role'],
    content: String(content)
  };
}

export function fromAIMessage(aiMessage: AIMessage): Message {
  const base = {
    id: aiMessage.id,
    createdAt: aiMessage.createdAt,
    content: aiMessage.content
  };

  // Convert AI SDK message to our format
  switch(aiMessage.role) {
    case 'system':
      return { ...base, role: 'system' } as SystemMessage;
    
    case 'user':
      return { ...base, role: 'user' } as UserMessage;
    
    case 'assistant':
      return { ...base, role: 'assistant' } as AssistantMessage;
    
    case 'data':
      const toolResult: ToolResultContent = {
        type: 'tool_result',
        toolCallId: aiMessage.id,
        result: aiMessage.content
      };
      
      return {
        ...base,
        role: 'tool',
        content: [toolResult] as ToolResultContent[],
        toolCallId: toolResult.toolCallId,
        toolName: 'data'
      } as ToolMessage;
      
    default:
      return { ...base, role: 'assistant' } as AssistantMessage;
  }
}

// Format a message content part to string
function formatContent(content: MessageContent): string {
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

// Type guards
export const isUserMessage = (message: Message): message is UserMessage => 
  message.role === 'user';

export const isAssistantMessage = (message: Message): message is AssistantMessage => 
  message.role === 'assistant';

export const isSystemMessage = (message: Message): message is SystemMessage => 
  message.role === 'system';

export const isToolMessage = (message: Message): message is ToolMessage => 
  message.role === 'tool' || message.role === 'data';

export const isMultipartContent = (content: string | MessageContent[]): content is MessageContent[] => 
  Array.isArray(content); 