import { Message as AIMessage } from 'ai';
import { 
  Message as AgentMessage,
  UserMessage,
  AssistantMessage,
  ToolMessage,
  ToolResultContent
} from 'agentdock-core';
import { 
  toAIMessage, 
  toCoreMessage, 
  toAIMessages, 
  toCoreMessages,
  createMessage
} from '../message-utils';

describe('Message Utils', () => {
  describe('toAIMessage', () => {
    it('should convert user message to AI SDK message', () => {
      const input: UserMessage = {
        id: '1',
        role: 'user',
        content: 'Hello'
      };

      const result = toAIMessage(input);
      expect(result.id).toBe('1');
      expect(result.role).toBe('user');
      expect(result.content).toBe('Hello');
    });

    it('should convert assistant message to AI SDK message', () => {
      const input: AssistantMessage = {
        id: '2',
        role: 'assistant',
        content: 'Hi there'
      };

      const result = toAIMessage(input);
      expect(result.id).toBe('2');
      expect(result.role).toBe('assistant');
      expect(result.content).toBe('Hi there');
    });

    it('should convert tool message to assistant message', () => {
      const input: ToolMessage = {
        id: '3',
        role: 'tool',
        content: [{ type: 'tool_result', toolCallId: 'test', result: 'result' }],
        toolCallId: 'test',
        toolName: 'test-tool'
      };

      const result = toAIMessage(input);
      expect(result.id).toBe('3');
      expect(result.role).toBe('assistant');
      expect(result.content).toBe('[Tool Result: test]');
    });

    it('should handle multi-part content', () => {
      const input: UserMessage = {
        id: '4',
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'image', url: 'test.jpg', alt: 'Test Image' }
        ]
      };

      const result = toAIMessage(input);
      expect(result.id).toBe('4');
      expect(result.role).toBe('user');
      expect(result.content).toBe('Hello\n[Image: Test Image]');
    });
  });

  describe('toCoreMessage', () => {
    it('should convert AI SDK message to core message', () => {
      const input: AIMessage = {
        id: '1',
        role: 'user',
        content: 'Hello'
      };

      const result = toCoreMessage(input);
      expect(result.id).toBe('1');
      expect(result.role).toBe('user');
      expect(result.content).toBe('Hello');
    });

    it('should handle data role as tool message', () => {
      const input: AIMessage = {
        id: '2',
        role: 'assistant',
        content: 'Result',
        data: {
          toolCallId: 'test',
          result: 'result'
        }
      };

      const result = toCoreMessage(input) as ToolMessage;
      expect(result.role).toBe('tool');
      expect(result.toolName).toBe('test-tool');
      expect(result.toolCallId).toBe('test');
    });
  });

  describe('Array Conversions', () => {
    it('should convert array of core messages to AI SDK messages', () => {
      const input: AgentMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello'
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Hi there'
        }
      ];

      const result = toAIMessages(input);
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
    });

    it('should convert array of AI SDK messages to core messages', () => {
      const input: AIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello'
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Hi there'
        }
      ];

      const result = toCoreMessages(input);
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
    });
  });

  describe('createMessage', () => {
    it('should create a tool message', () => {
      const toolResult: ToolResultContent = {
        type: 'tool_result',
        toolCallId: 'test',
        result: 'result'
      };

      const result = createMessage('tool', [toolResult]) as ToolMessage;
      expect(result.role).toBe('tool');
      expect(result.content[0].type).toBe('tool_result');
      expect(result.toolCallId).toBe('test');
    });
  });
}); 