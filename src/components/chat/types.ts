/**
 * @fileoverview Chat component types
 */

import type { Message } from 'agentdock-core';
export type { Message };

// Re-export specific message types if needed
export type { 
  UserMessage,
  AssistantMessage,
  SystemMessage,
  ToolMessage,
  MessageContent,
  TextContent,
  ImageContent,
  ToolCallContent,
  ToolResultContent
} from 'agentdock-core'; 