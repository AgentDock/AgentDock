/**
 * @fileoverview Core message type definitions for AgentDock
 */

// Base message roles
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

// Message content types
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
  role: 'tool';
  content: ToolResultContent[];
  toolCallId: string;
  toolName: string;
}

// Union type for all message types
export type Message = UserMessage | AssistantMessage | SystemMessage | ToolMessage;

// Type guards
export const isUserMessage = (message: Message): message is UserMessage => 
  message.role === 'user';

export const isAssistantMessage = (message: Message): message is AssistantMessage => 
  message.role === 'assistant';

export const isSystemMessage = (message: Message): message is SystemMessage => 
  message.role === 'system';

export const isToolMessage = (message: Message): message is ToolMessage => 
  message.role === 'tool';

export const isMultipartContent = (content: string | MessageContent[]): content is MessageContent[] => 
  Array.isArray(content); 