import { 
  Message as AgentMessage,
  UserMessage,
  AssistantMessage,
  SystemMessage,
  ToolMessage,
  MessageContent,
  ToolResultContent,
  isMultipartContent,
  toAIMessage as coreToAIMessage,
  fromAIMessage as coreFromAIMessage,
  AISdkMessage,
} from 'agentdock-core';
import { v4 as uuidv4 } from 'uuid';

// Define mapping for role types to handle type incompatibilities
type AgentRole = 'system' | 'user' | 'assistant' | 'tool';

// Common base message creation
function createBaseMessage(id?: string, createdAt?: Date) {
  return {
    id: id || uuidv4(),
    createdAt: createdAt || new Date()
  };
}

// Format message content parts
function formatContent(content: MessageContent): string {
  switch (content.type) {
    case 'text':
      return content.text;
    case 'tool_result':
      return `[Tool Result: ${content.toolCallId}]`;
    default:
      return '';
  }
}

/**
 * Convert an AgentDock Message to Vercel AI SDK Message
 * 
 * Uses the conversion function from agentdock-core
 */
export function toAIMessage(message: AgentMessage): AISdkMessage {
  return coreToAIMessage(message);
}

/**
 * Convert a Vercel AI SDK Message to AgentDock Message
 * 
 * Uses the conversion function from agentdock-core
 */
export function toCoreMessage(message: AISdkMessage): AgentMessage {
  return coreFromAIMessage(message);
}

/**
 * Convert an array of AgentDock Messages to Vercel AI SDK Messages
 */
export function toAIMessages(messages: AgentMessage[]): AISdkMessage[] {
  return messages.map(toAIMessage);
}

/**
 * Convert an array of Vercel AI SDK Messages to AgentDock Messages
 */
export function toCoreMessages(messages: AISdkMessage[]): AgentMessage[] {
  return messages.map(toCoreMessage);
}

/**
 * Create a new message with the given role and content
 */
export function createMessage(role: AgentMessage['role'], content: string | MessageContent[]): AgentMessage {
  const base = createBaseMessage();

  switch (role) {
    case 'system': {
      return {
        ...base,
        role,
        content: typeof content === 'string' ? content : content[0]?.type === 'text' ? content[0].text : ''
      } as SystemMessage;
    }

    case 'user': {
      return {
        ...base,
        role,
        content
      } as UserMessage;
    }

    case 'assistant': {
      return {
        ...base,
        role,
        content
      } as AssistantMessage;
    }

    case 'tool': 
    case 'data': {
      if (typeof content === 'string' || !content.every(part => part.type === 'tool_result')) {
        throw new Error('Tool messages must contain only tool results');
      }
      
      return {
        ...base,
        role: 'tool',
        content: content as ToolResultContent[],
        toolCallId: content[0].toolCallId,
        toolName: 'unknown'
      } as ToolMessage;
    }
    
    default: {
      throw new Error(`Invalid role: ${role}`);
    }
  }
} 