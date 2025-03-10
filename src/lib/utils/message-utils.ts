import { Message as AIMessage } from 'ai';
import { 
  Message as AgentMessage, 
  UserMessage,
  AssistantMessage,
  SystemMessage,
  ToolMessage,
  MessageContent,
  ToolResultContent,
  isMultipartContent
} from 'agentdock-core';
import { v4 as uuidv4 } from 'uuid';

// Common base message creation
function createBaseMessage(id?: string, createdAt?: Date) {
  return {
    id: id || uuidv4(),
    createdAt: createdAt || new Date()
  };
}

// Content formatting for display
function formatContent(content: MessageContent): string {
  switch (content.type) {
    case 'text':
      return content.text;
    case 'tool_call':
      return `[Tool Call: ${content.toolName}]`;
    case 'tool_result':
      return `[Tool Result: ${content.toolCallId}]`;
    default:
      return '';
  }
}

/**
 * Convert a Message to Vercel AI SDK Message
 */
export function toAIMessage(message: AgentMessage): AIMessage {
  const content = isMultipartContent(message.content)
    ? message.content.map(formatContent).join('\n')
    : message.content;

  return {
    ...createBaseMessage(message.id, message.createdAt),
    role: message.role === 'tool' ? 'assistant' : message.role,
    content
  };
}

/**
 * Convert a Vercel AI SDK Message to CoreMessage
 */
export function toCoreMessage(message: AIMessage): AgentMessage {
  const base = createBaseMessage(message.id, message.createdAt);

  switch (message.role) {
    case 'system': {
      return {
        ...base,
        role: 'system',
        content: message.content
      } as SystemMessage;
    }

    case 'user': {
      return {
        ...base,
        role: 'user',
        content: message.content
      } as UserMessage;
    }

    case 'assistant': {
      return {
        ...base,
        role: 'assistant',
        content: message.content
      } as AssistantMessage;
    }

    case 'data': {
      const toolResult: ToolResultContent = {
        type: 'tool_result',
        toolCallId: uuidv4(),
        result: message.content
      };
      
      return {
        ...base,
        role: 'tool',
        content: [toolResult],
        toolCallId: toolResult.toolCallId,
        toolName: 'data'
      } as ToolMessage;
    }

    default: {
      return {
        ...base,
        role: 'assistant',
        content: message.content
      } as AssistantMessage;
    }
  }
}

/**
 * Convert an array of CoreMessages to Vercel AI SDK Messages
 */
export function toAIMessages(messages: AgentMessage[]): AIMessage[] {
  return messages.map(toAIMessage);
}

/**
 * Convert an array of Vercel AI SDK Messages to CoreMessages
 */
export function toCoreMessages(messages: AIMessage[]): AgentMessage[] {
  return messages.map(toCoreMessage);
}

/**
 * Create a new message with the given role and content
 */
export function createMessage(role: AgentMessage['role'], content: string | MessageContent[]): AgentMessage {
  const base = createBaseMessage();

  switch (role) {
    case 'system':
      return {
        ...base,
        role,
        content: typeof content === 'string' ? content : content[0].type === 'text' ? content[0].text : ''
      } as SystemMessage;

    case 'user':
      return {
        ...base,
        role,
        content
      } as UserMessage;

    case 'assistant':
      return {
        ...base,
        role,
        content
      } as AssistantMessage;

    case 'tool':
      if (typeof content === 'string' || !content.every(part => part.type === 'tool_result')) {
        throw new Error('Tool messages must contain only tool results');
      }
      return {
        ...base,
        role,
        content: content as ToolResultContent[],
        toolCallId: content[0].toolCallId,
        toolName: 'unknown'
      } as ToolMessage;
  }
} 