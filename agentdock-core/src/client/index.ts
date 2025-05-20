/**
 * @fileoverview Client-side exports for the AgentDock framework
 * This is specifically for React client components in Next.js
 */

import { useChat, useCompletion } from 'ai/react';

// Re-export the client-side hooks
export { useChat, useCompletion };

// Re-export types
export type { UseChatOptions, UseChatHelpers, Message, CreateMessage } from 'ai/react';

// Re-export message utilities
export { isSystemMessage, isToolMessage } from '../types/messages';
