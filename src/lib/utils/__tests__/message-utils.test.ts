import {
  Message,
  isUserMessage,
  isAssistantMessage,
  isToolMessage,
  ToolResultContent,
  MessageRole,
  createMessage, // Use core createMessage
  createToolMessage, // Use core createToolMessage
  fromAIMessage, // Use core fromAIMessage
  toAIMessage, // Use core toAIMessage
} from 'agentdock-core';
import { Message as VercelAIMessage } from 'ai'; // Vercel AI SDK message type

// Example bulk conversion functions (if needed by other parts of the app, otherwise remove)
const toAIMessages = (messages: Message[]): VercelAIMessage[] => {
  return messages.map(toAIMessage);
};
const fromAIMessages = (messages: VercelAIMessage[]): Message[] => {
  return messages.map(fromAIMessage);
};

describe('Core Message Utils Compatibility Tests', () => {
  describe('createMessage', () => {
    it('should create a user message', () => {
      const result = createMessage({ role: 'user', content: 'Hello' });
      expect(result.role).toBe('user');
      expect(result.content).toBe('Hello');
      expect(isUserMessage(result)).toBe(true);
    });

    it('should create an assistant message', () => {
      const result = createMessage({ role: 'assistant', content: 'Hi' });
      expect(result.role).toBe('assistant');
      expect(result.content).toBe('Hi');
      expect(isAssistantMessage(result)).toBe(true);
    });
  });

  describe('createToolMessage', () => {
    it('should create a tool message with role "data" and stringified content', () => {
      const toolResult: ToolResultContent = {
        type: 'tool_result',
        toolCallId: 'test-id-123',
        result: { value: 'Success' },
      };
      const toolResultArray = [toolResult];
      const result = createToolMessage({
        content: JSON.stringify(toolResultArray), // Pass stringified JSON
        toolCallId: 'test-id-123',
        toolName: 'test-tool',
      });

      expect(result.role).toBe('data');
      expect(result.isToolMessage).toBe(true);
      expect(isToolMessage(result)).toBe(true);
      expect(result.toolCallId).toBe('test-id-123');
      expect(result.toolName).toBe('test-tool');
      expect(result.content).toEqual(JSON.stringify(toolResultArray)); // Content is stringified
    });
  });

  describe('toAIMessage / fromAIMessage', () => {
    it('should convert core user message to AI SDK message and back', () => {
      const coreMsg: Message = createMessage({ role: 'user', content: 'Test Input' });
      const aiMsg = toAIMessage(coreMsg);

      expect(aiMsg.role).toBe('user');
      expect(aiMsg.content).toBe('Test Input');

      const convertedBack = fromAIMessage(aiMsg);
      expect(convertedBack.role).toBe('user');
      expect(convertedBack.content).toBe('Test Input');
    });

    it('should convert core assistant message to AI SDK message and back', () => {
      const coreMsg: Message = createMessage({ role: 'assistant', content: 'Test Output' });
      const aiMsg = toAIMessage(coreMsg);

      expect(aiMsg.role).toBe('assistant');
      expect(aiMsg.content).toBe('Test Output');

      const convertedBack = fromAIMessage(aiMsg);
      expect(convertedBack.role).toBe('assistant');
      expect(convertedBack.content).toBe('Test Output');
    });

    it('should convert core tool message (data role) to AI SDK message and back', () => {
      const toolResult: ToolResultContent = {
        type: 'tool_result',
        toolCallId: 't1',
        result: 'res',
      };
      const toolResultArray = [toolResult];
      const coreMsg: Message = createToolMessage({
        content: JSON.stringify(toolResultArray),
        toolCallId: 't1',
        toolName: 't',
      }); // Pass stringified JSON
      const aiMsg = toAIMessage(coreMsg);

      expect(aiMsg.role).toBe('data');
      expect(aiMsg.content).toEqual(JSON.stringify(toolResultArray));

      const convertedBack = fromAIMessage(aiMsg);
      expect(convertedBack.role).toBe('data');
      expect(convertedBack.content).toEqual(JSON.stringify(toolResultArray));
    });
  });

  describe('Bulk Conversions (Example Wrappers)', () => {
    it('should convert array of core messages to Vercel AI messages', () => {
      const toolResultArray: ToolResultContent[] = [
        { type: 'tool_result', toolCallId: 't1', result: 'res' },
      ];
      const input: Message[] = [
        createMessage({ role: 'user', content: 'Hello' }),
        createMessage({ role: 'assistant', content: 'Hi there' }),
        createToolMessage({
          content: JSON.stringify(toolResultArray),
          toolCallId: 't1',
          toolName: 't',
        }), // Pass stringified JSON
      ];

      const result = toAIMessages(input);
      expect(result).toHaveLength(3);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
      expect(result[2].role).toBe('data'); // Tool message becomes 'data'
      // Check if content of the tool message is stringified JSON
      expect(result[2].content).toEqual(JSON.stringify(toolResultArray));
    });

    it('should convert array of Vercel AI messages to core messages', () => {
      const input: VercelAIMessage[] = [
        { id: '1', role: 'user', content: 'Hello', createdAt: new Date() },
        { id: '2', role: 'assistant', content: 'Hi there', createdAt: new Date() },
      ];

      const result = fromAIMessages(input);
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
    });
  });
});
