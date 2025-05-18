/**
 * Utility functions for message handling
 */

import { CoreMessage } from 'ai';
import { LLMMessage } from '../llm/types';
import { Message, MessageContent, formatContentForDisplay } from '../types/messages';

// Type for extended properties we need to handle
type ExtendedMessageProps = {
  id?: string;
  createdAt?: number | Date;
  experimental_attachments?: unknown[];
};

// Type for content parts with text
interface TextPart {
  type: 'text';
  text: string;
}

/**
 * Convert Message to LLMMessage for sending to LLM providers
 * This preserves all properties while formatting content appropriately
 */
export function convertCoreToLLMMessage(message: Message): LLMMessage {
  // Preserve all additional properties by default
  const baseProps = {
    id: message.id,
    createdAt:
      message.createdAt instanceof Date
        ? message.createdAt.getTime()
        : typeof message.createdAt === 'number'
          ? message.createdAt
          : undefined,
  };

  // Special handling for tool messages
  if (message.role === 'data' || message.isToolMessage === true) {
    return {
      ...baseProps,
      role: 'assistant', // Convert to assistant for LLM compatibility
      content: message.content,
    };
  }

  // Handle message with contentParts (our structured content)
  if (message.contentParts?.length) {
    const textContent = message.contentParts
      .map((part) => formatContentForDisplay(part))
      .join('\n');

    return {
      ...baseProps,
      role: message.role,
      content: textContent || message.content, // Fall back to string content if needed
    };
  }

  // Standard case - just pass through the content
  return {
    ...baseProps,
    role: message.role,
    content: message.content,
    experimental_attachments: (message as any).experimental_attachments,
  };
}

/**
 * Convert an array of Messages to LLMMessages
 */
export function convertCoreToLLMMessages(messages: Message[]): LLMMessage[] {
  return messages.map(convertCoreToLLMMessage);
}

/**
 * Apply history policy to messages based on settings
 * This trims the conversation history according to the specified policy
 *
 * @param messages Array of messages to apply policy to
 * @param options Configuration options for history policy
 * @returns Filtered message array based on policy
 */
export function applyHistoryPolicy(
  messages: Message[],
  options: {
    historyPolicy?: 'none' | 'lastN' | 'all';
    historyLength?: number;
    preserveSystemMessages?: boolean;
  },
): Message[] {
  const {
    historyPolicy = 'lastN',
    historyLength = 50, // Default remains high if not specified
    preserveSystemMessages = true,
  } = options;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  // Extract system messages if needed
  const systemMessages = preserveSystemMessages
    ? messages.filter((msg) => msg.role === 'system')
    : [];

  // Handle the simple cases first
  if (historyPolicy === 'none') {
    // Return only system messages (or empty if preserveSystemMessages is false)
    return systemMessages;
  }

  if (historyPolicy === 'all') {
    // Return all original messages
    return messages;
  }

  // For lastN policy, apply the corrected logic
  if (historyPolicy === 'lastN') {
    // Handle edge case: historyLength <= 0 should behave like historyLength = 1
    // to prevent errors from sending only system messages.
    const effectiveHistoryLength = Math.max(1, historyLength);

    // Get non-system messages for easier pair identification
    const conversationMessages = messages.filter((msg) => msg.role !== 'system');

    // If there are no conversation messages, just return system messages
    if (conversationMessages.length === 0) {
      return systemMessages;
    }

    // Find the indices of the user messages within the conversationMessages array
    const userMessageIndicesInConversation: number[] = [];
    conversationMessages.forEach((msg, index) => {
      if (msg.role === 'user') {
        userMessageIndicesInConversation.push(index);
      }
    });

    // Determine the starting index in conversationMessages for the slice
    // based on the *effective* history length.
    let startIndex = 0;
    if (userMessageIndicesInConversation.length > effectiveHistoryLength) {
      // Get the index of the Nth-to-last user message (using effective length)
      const firstUserIndexToKeep =
        userMessageIndicesInConversation[
          userMessageIndicesInConversation.length - effectiveHistoryLength
        ];
      startIndex = firstUserIndexToKeep;
    }

    // Slice the conversationMessages to get the relevant part
    const relevantConversation = conversationMessages.slice(startIndex);

    // Combine system messages with the relevant conversation part
    const resultMessages: Message[] = [...systemMessages, ...relevantConversation];

    return resultMessages;
  }

  // Default fallback: return all original messages if policy is unrecognized
  console.warn(
    `[applyHistoryPolicy] Unrecognized historyPolicy: ${historyPolicy}. Returning all messages.`,
  );
  return messages;
}
