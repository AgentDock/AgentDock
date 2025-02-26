/**
 * @fileoverview Message type definitions and conversion utilities for Vercel AI SDK v4.1
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  CoreMessage as VercelCoreMessage,
  CoreSystemMessage as VercelSystemMessage,
  CoreUserMessage as VercelUserMessage,
  CoreAssistantMessage as VercelAssistantMessage,
  CoreToolMessage as VercelToolMessage,
  TextPart as VercelTextPart,
  ImagePart as VercelImagePart,
  ToolCallPart as VercelToolCallPart,
  ToolResultPart as VercelToolResultPart,
  UserContent as VercelUserContent,
  AssistantContent as VercelAssistantContent,
  ToolContent as VercelToolContent
} from 'ai';

import {
  Message,
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ToolMessage,
  MessageContent,
  TextContent,
  ImageContent,
  ToolCallContent,
  ToolResultContent,
  isMultipartContent
} from '../../types/messages';

/**
 * Convert a TextContent to a Vercel TextPart
 */
export function toVercelTextPart(content: TextContent): VercelTextPart {
  return {
    type: 'text',
    text: content.text
  };
}

/**
 * Convert an ImageContent to a Vercel ImagePart
 */
export function toVercelImagePart(content: ImageContent): VercelImagePart {
  return {
    type: 'image',
    image: content.url
  };
}

/**
 * Convert a ToolCallContent to a Vercel ToolCallPart
 */
export function toVercelToolCallPart(content: ToolCallContent): VercelToolCallPart {
  return {
    type: 'tool-call',
    toolCallId: content.toolCallId,
    toolName: content.toolName,
    args: content.args
  };
}

/**
 * Custom extension of VercelToolResultPart to include content property
 * This is needed because the Vercel AI SDK's ToolResultPart has a different structure
 * than our ToolResultContent
 */
interface ExtendedToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  content: any;
}

/**
 * Convert a ToolResultContent to a Vercel ToolResultPart
 */
export function toVercelToolResultPart(content: ToolResultContent): ExtendedToolResultPart {
  return {
    type: 'tool-result',
    toolCallId: content.toolCallId,
    toolName: content.toolCallId.split(':')[0] || 'unknown',
    content: content.result
  };
}

/**
 * Convert a MessageContent to a Vercel content part
 */
export function toVercelContentPart(content: MessageContent): VercelTextPart | VercelImagePart | VercelToolCallPart | ExtendedToolResultPart {
  switch (content.type) {
    case 'text':
      return toVercelTextPart(content);
    case 'image':
      return toVercelImagePart(content);
    case 'tool_call':
      return toVercelToolCallPart(content);
    case 'tool_result':
      return toVercelToolResultPart(content);
    default:
      throw new Error(`Unsupported content type: ${(content as any).type}`);
  }
}

/**
 * Convert a Vercel TextPart to a TextContent
 */
export function fromVercelTextPart(part: VercelTextPart): TextContent {
  return {
    type: 'text',
    text: part.text
  };
}

/**
 * Convert a Vercel ImagePart to an ImageContent
 */
export function fromVercelImagePart(part: VercelImagePart): ImageContent {
  const url = typeof part.image === 'string' 
    ? part.image 
    : part.image instanceof URL 
      ? part.image.toString() 
      : '';

  return {
    type: 'image',
    url,
    alt: ''
  };
}

/**
 * Convert a Vercel ToolCallPart to a ToolCallContent
 */
export function fromVercelToolCallPart(part: VercelToolCallPart): ToolCallContent {
  return {
    type: 'tool_call',
    toolName: part.toolName,
    toolCallId: part.toolCallId,
    args: part.args || {}
  };
}

/**
 * Convert a Vercel ToolResultPart to a ToolResultContent
 */
export function fromVercelToolResultPart(part: VercelToolResultPart | ExtendedToolResultPart): ToolResultContent {
  return {
    type: 'tool_result',
    toolCallId: part.toolCallId,
    // Access content property from our extended interface
    result: (part as ExtendedToolResultPart).content || {}
  };
}

/**
 * Convert a SystemMessage to a Vercel SystemMessage
 */
export function toVercelSystemMessage(message: SystemMessage): VercelSystemMessage {
  return {
    role: 'system',
    content: message.content as string
  };
}

/**
 * Convert a UserMessage to a Vercel UserMessage
 */
export function toVercelUserMessage(message: UserMessage): VercelUserMessage {
  let content: VercelUserContent;

  if (isMultipartContent(message.content)) {
    // Filter to only include text and image parts which are valid for user messages
    const validParts = message.content.filter(
      part => part.type === 'text' || part.type === 'image'
    ) as (TextContent | ImageContent)[];
    
    content = validParts.map(part => {
      if (part.type === 'text') {
        return toVercelTextPart(part);
      } else {
        return toVercelImagePart(part);
      }
    }) as VercelUserContent;
  } else {
    content = message.content;
  }

  return {
    role: 'user',
    content
  };
}

/**
 * Convert an AssistantMessage to a Vercel AssistantMessage
 */
export function toVercelAssistantMessage(message: AssistantMessage): VercelAssistantMessage {
  let content: VercelAssistantContent;

  if (isMultipartContent(message.content)) {
    // Filter to only include text and tool call parts which are valid for assistant messages
    const validParts = message.content.filter(
      part => part.type === 'text' || part.type === 'tool_call'
    ) as (TextContent | ToolCallContent)[];
    
    content = validParts.map(part => {
      if (part.type === 'text') {
        return toVercelTextPart(part);
      } else {
        return toVercelToolCallPart(part);
      }
    }) as VercelAssistantContent;
  } else {
    content = message.content;
  }

  return {
    role: 'assistant',
    content
  };
}

/**
 * Convert a ToolMessage to a Vercel ToolMessage
 */
export function toVercelToolMessage(message: ToolMessage): VercelToolMessage {
  const content = message.content.map(part => toVercelToolResultPart(part)) as unknown as VercelToolContent;

  return {
    role: 'tool',
    content
  };
}

/**
 * Convert a Message to a Vercel CoreMessage
 */
export function toVercelMessage(message: Message): VercelCoreMessage {
  const role = message.role;
  switch (role) {
    case 'system':
      return toVercelSystemMessage(message as SystemMessage);
    case 'user':
      return toVercelUserMessage(message as UserMessage);
    case 'assistant':
      return toVercelAssistantMessage(message as AssistantMessage);
    case 'tool':
      return toVercelToolMessage(message as ToolMessage);
    default:
      throw new Error(`Unsupported message role: ${String(role)}`);
  }
}

/**
 * Convert a Vercel SystemMessage to a SystemMessage
 */
export function fromVercelSystemMessage(message: VercelSystemMessage): SystemMessage {
  return {
    id: uuidv4(),
    role: 'system',
    content: message.content,
    createdAt: new Date()
  };
}

/**
 * Convert a Vercel UserMessage to a UserMessage
 */
export function fromVercelUserMessage(message: VercelUserMessage): UserMessage {
  let content: string | (TextContent | ImageContent)[];

  if (typeof message.content === 'string') {
    content = message.content;
  } else {
    content = message.content.map(part => {
      if ('text' in part && part.type === 'text') {
        return fromVercelTextPart(part);
      } else if ('image' in part && part.type === 'image') {
        return fromVercelImagePart(part);
      } else {
        throw new Error(`Unsupported content part type in user message: ${(part as any).type}`);
      }
    }) as (TextContent | ImageContent)[];
  }

  return {
    id: uuidv4(),
    role: 'user',
    content,
    createdAt: new Date()
  };
}

/**
 * Convert a Vercel AssistantMessage to an AssistantMessage
 */
export function fromVercelAssistantMessage(message: VercelAssistantMessage): AssistantMessage {
  let content: string | (TextContent | ToolCallContent)[];

  if (typeof message.content === 'string') {
    content = message.content;
  } else {
    content = message.content.map(part => {
      if ('text' in part && part.type === 'text') {
        return fromVercelTextPart(part);
      } else if ('toolCallId' in part && part.type === 'tool-call') {
        return fromVercelToolCallPart(part);
      } else {
        throw new Error(`Unsupported content part type in assistant message: ${(part as any).type}`);
      }
    }) as (TextContent | ToolCallContent)[];
  }

  return {
    id: uuidv4(),
    role: 'assistant',
    content,
    createdAt: new Date()
  };
}

/**
 * Convert a Vercel ToolMessage to a ToolMessage
 */
export function fromVercelToolMessage(message: VercelToolMessage): ToolMessage {
  const content = message.content.map(part => fromVercelToolResultPart(part));
  const toolCallId = content[0]?.toolCallId || uuidv4();
  const toolName = content[0]?.toolCallId.split(':')[0] || 'unknown';

  return {
    id: uuidv4(),
    role: 'tool',
    content,
    toolCallId,
    toolName,
    createdAt: new Date()
  };
}

/**
 * Convert a Vercel CoreMessage to a Message
 */
export function fromVercelMessage(message: VercelCoreMessage): Message {
  const role = message.role;
  switch (role) {
    case 'system':
      return fromVercelSystemMessage(message as VercelSystemMessage);
    case 'user':
      return fromVercelUserMessage(message as VercelUserMessage);
    case 'assistant':
      return fromVercelAssistantMessage(message as VercelAssistantMessage);
    case 'tool':
      return fromVercelToolMessage(message as VercelToolMessage);
    default:
      throw new Error(`Unsupported message role: ${String(role)}`);
  }
}

/**
 * Convert an array of Messages to an array of Vercel CoreMessages
 */
export function toVercelMessages(messages: Message[]): VercelCoreMessage[] {
  return messages.map(toVercelMessage);
}

/**
 * Convert an array of Vercel CoreMessages to an array of Messages
 */
export function fromVercelMessages(messages: VercelCoreMessage[]): Message[] {
  return messages.map(fromVercelMessage);
} 