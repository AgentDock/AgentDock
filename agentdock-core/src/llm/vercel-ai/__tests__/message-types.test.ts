/**
 * @fileoverview Tests for message type conversion utilities
 */

import { v4 as uuidv4 } from 'uuid';
import {
  toVercelMessage,
  fromVercelMessage,
  toVercelMessages,
  fromVercelMessages
} from '../message-types';
import {
  Message,
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ToolMessage,
  TextContent,
  ImageContent,
  ToolCallContent,
  ToolResultContent
} from '../../../types/messages';

describe('Message Type Conversion', () => {
  // Test data
  const systemMessage: SystemMessage = {
    id: uuidv4(),
    role: 'system',
    content: 'You are a helpful assistant.',
    createdAt: new Date()
  };

  const userTextMessage: UserMessage = {
    id: uuidv4(),
    role: 'user',
    content: 'Hello, how are you?',
    createdAt: new Date()
  };

  const userMultipartMessage: UserMessage = {
    id: uuidv4(),
    role: 'user',
    content: [
      {
        type: 'text',
        text: 'What is this image?'
      } as TextContent,
      {
        type: 'image',
        url: 'https://example.com/image.jpg',
        alt: 'Example image'
      } as ImageContent
    ],
    createdAt: new Date()
  };

  const assistantTextMessage: AssistantMessage = {
    id: uuidv4(),
    role: 'assistant',
    content: 'I am doing well, thank you for asking!',
    createdAt: new Date()
  };

  const assistantToolCallMessage: AssistantMessage = {
    id: uuidv4(),
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: 'Let me check the weather for you.'
      } as TextContent,
      {
        type: 'tool_call',
        toolName: 'weather',
        toolCallId: 'weather-123',
        args: { location: 'New York' }
      } as ToolCallContent
    ],
    createdAt: new Date()
  };

  const toolMessage: ToolMessage = {
    id: uuidv4(),
    role: 'tool',
    content: [
      {
        type: 'tool_result',
        toolCallId: 'weather-123',
        result: { temperature: 72, conditions: 'sunny' }
      } as ToolResultContent
    ],
    toolCallId: 'weather-123',
    toolName: 'weather',
    createdAt: new Date()
  };

  describe('toVercelMessage', () => {
    it('should convert a system message correctly', () => {
      const vercelMessage = toVercelMessage(systemMessage);
      expect(vercelMessage.role).toBe('system');
      expect(vercelMessage.content).toBe(systemMessage.content);
    });

    it('should convert a user text message correctly', () => {
      const vercelMessage = toVercelMessage(userTextMessage);
      expect(vercelMessage.role).toBe('user');
      expect(vercelMessage.content).toBe(userTextMessage.content);
    });

    it('should convert a user multipart message correctly', () => {
      const vercelMessage = toVercelMessage(userMultipartMessage);
      expect(vercelMessage.role).toBe('user');
      expect(Array.isArray(vercelMessage.content)).toBe(true);
      
      const content = vercelMessage.content as any[];
      expect(content.length).toBe(2);
      expect(content[0].type).toBe('text');
      expect(content[0].text).toBe('What is this image?');
      expect(content[1].type).toBe('image');
      expect(typeof content[1].image).toBe('string');
    });

    it('should convert an assistant text message correctly', () => {
      const vercelMessage = toVercelMessage(assistantTextMessage);
      expect(vercelMessage.role).toBe('assistant');
      expect(vercelMessage.content).toBe(assistantTextMessage.content);
    });

    it('should convert an assistant tool call message correctly', () => {
      const vercelMessage = toVercelMessage(assistantToolCallMessage);
      expect(vercelMessage.role).toBe('assistant');
      expect(Array.isArray(vercelMessage.content)).toBe(true);
      
      const content = vercelMessage.content as any[];
      expect(content.length).toBe(2);
      expect(content[0].type).toBe('text');
      expect(content[0].text).toBe('Let me check the weather for you.');
      expect(content[1].type).toBe('tool-call');
      expect(content[1].toolName).toBe('weather');
      expect(content[1].toolCallId).toBe('weather-123');
      expect(content[1].args).toEqual({ location: 'New York' });
    });

    it('should convert a tool message correctly', () => {
      const vercelMessage = toVercelMessage(toolMessage);
      expect(vercelMessage.role).toBe('tool');
      expect(Array.isArray(vercelMessage.content)).toBe(true);
      
      const content = vercelMessage.content as any[];
      expect(content.length).toBe(1);
      expect(content[0].type).toBe('tool-result');
      expect(content[0].toolCallId).toBe('weather-123');
      expect(content[0].toolName).toBe('weather');
      expect(content[0].content).toEqual({ temperature: 72, conditions: 'sunny' });
    });
  });

  describe('fromVercelMessage', () => {
    it('should convert a Vercel system message correctly', () => {
      const vercelMessage = toVercelMessage(systemMessage);
      const convertedMessage = fromVercelMessage(vercelMessage);
      
      expect(convertedMessage.role).toBe('system');
      expect(convertedMessage.content).toBe(systemMessage.content);
      expect(convertedMessage.id).toBeDefined();
      expect(convertedMessage.createdAt).toBeInstanceOf(Date);
    });

    it('should convert a Vercel user text message correctly', () => {
      const vercelMessage = toVercelMessage(userTextMessage);
      const convertedMessage = fromVercelMessage(vercelMessage);
      
      expect(convertedMessage.role).toBe('user');
      expect(convertedMessage.content).toBe(userTextMessage.content);
      expect(convertedMessage.id).toBeDefined();
      expect(convertedMessage.createdAt).toBeInstanceOf(Date);
    });

    it('should convert a Vercel user multipart message correctly', () => {
      const vercelMessage = toVercelMessage(userMultipartMessage);
      const convertedMessage = fromVercelMessage(vercelMessage) as UserMessage;
      
      expect(convertedMessage.role).toBe('user');
      expect(Array.isArray(convertedMessage.content)).toBe(true);
      
      const content = convertedMessage.content as any[];
      expect(content.length).toBe(2);
      expect(content[0].type).toBe('text');
      expect(content[0].text).toBe('What is this image?');
      expect(content[1].type).toBe('image');
      expect(content[1].url).toBeDefined();
    });

    it('should convert a Vercel assistant text message correctly', () => {
      const vercelMessage = toVercelMessage(assistantTextMessage);
      const convertedMessage = fromVercelMessage(vercelMessage);
      
      expect(convertedMessage.role).toBe('assistant');
      expect(convertedMessage.content).toBe(assistantTextMessage.content);
      expect(convertedMessage.id).toBeDefined();
      expect(convertedMessage.createdAt).toBeInstanceOf(Date);
    });

    it('should convert a Vercel assistant tool call message correctly', () => {
      const vercelMessage = toVercelMessage(assistantToolCallMessage);
      const convertedMessage = fromVercelMessage(vercelMessage) as AssistantMessage;
      
      expect(convertedMessage.role).toBe('assistant');
      expect(Array.isArray(convertedMessage.content)).toBe(true);
      
      const content = convertedMessage.content as any[];
      expect(content.length).toBe(2);
      expect(content[0].type).toBe('text');
      expect(content[0].text).toBe('Let me check the weather for you.');
      expect(content[1].type).toBe('tool_call');
      expect(content[1].toolName).toBe('weather');
      expect(content[1].toolCallId).toBe('weather-123');
      expect(content[1].args).toEqual({ location: 'New York' });
    });

    it('should convert a Vercel tool message correctly', () => {
      const vercelMessage = toVercelMessage(toolMessage);
      const convertedMessage = fromVercelMessage(vercelMessage) as ToolMessage;
      
      expect(convertedMessage.role).toBe('tool');
      expect(Array.isArray(convertedMessage.content)).toBe(true);
      
      const content = convertedMessage.content as ToolResultContent[];
      expect(content.length).toBe(1);
      expect(content[0].type).toBe('tool_result');
      expect(content[0].toolCallId).toBe('weather-123');
      expect(content[0].result).toEqual({ temperature: 72, conditions: 'sunny' });
      expect(convertedMessage.toolCallId).toBeDefined();
      expect(convertedMessage.toolName).toBeDefined();
    });
  });

  describe('toVercelMessages and fromVercelMessages', () => {
    it('should convert an array of messages correctly', () => {
      const messages: Message[] = [
        systemMessage,
        userTextMessage,
        assistantTextMessage,
        userMultipartMessage,
        assistantToolCallMessage,
        toolMessage
      ];
      
      const vercelMessages = toVercelMessages(messages);
      expect(vercelMessages.length).toBe(messages.length);
      
      const convertedMessages = fromVercelMessages(vercelMessages);
      expect(convertedMessages.length).toBe(messages.length);
      
      // Check each message type
      expect(convertedMessages[0].role).toBe('system');
      expect(convertedMessages[1].role).toBe('user');
      expect(convertedMessages[2].role).toBe('assistant');
      expect(convertedMessages[3].role).toBe('user');
      expect(convertedMessages[4].role).toBe('assistant');
      expect(convertedMessages[5].role).toBe('tool');
    });
  });
}); 