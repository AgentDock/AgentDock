/**
 * @fileoverview Shared types for chat-related functionality
 */

import type { ValidatedPersonality } from 'agentdock-core/types/agent-config';

/**
 * Base chat settings interface
 */
export interface BaseChatSettings {
  /** Initial messages to send when chat starts */
  initialMessages: string[];
}

/**
 * Template-specific chat settings
 */
export interface TemplateChatSettings extends BaseChatSettings {
  /** Message history retention policy */
  historyPolicy: 'lastN' | 'all';
  /** Number of messages to retain if historyPolicy is 'lastN' */
  historyLength?: number;
  /** Chat prompt suggestions to display when chat is empty */
  chatPrompts?: string[];
}

/**
 * Runtime chat settings
 */
export interface ChatSettings extends BaseChatSettings {
  /** Message history retention policy */
  historyPolicy: 'none' | 'lastN' | 'all';
  /** Number of messages to retain if historyPolicy is 'lastN' */
  historyLength: number;
  /** Chat prompt suggestions to display when chat is empty */
  chatPrompts?: string[];
}

/**
 * LLM provider type
 */
export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'deepseek' | 'groq' | 'cerebras';

/**
 * Chat settings for the UI
 */
export interface ChatUISettings {
  /** Display name of the agent */
  name: string;
  /** LLM provider */
  provider: LLMProvider;
  /** Model name */
  model: string;
  /** Temperature setting */
  temperature: number;
  /** Maximum tokens to generate */
  maxTokens: number;
  /** Agent personality */
  personality?: ValidatedPersonality;
  /** API key */
  apiKey?: string;
  /** Initial messages to display */
  initialMessages?: readonly string[];
  /** Chat prompt suggestions */
  chatPrompts?: readonly string[];
}

/**
 * Runtime configuration for chat
 */
export interface ChatRuntimeConfig {
  /** Display name */
  name?: string;
  /** Description */
  description?: string;
  /** Model name */
  model?: string;
  /** Temperature setting */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Agent personality */
  personality?: ValidatedPersonality;
  /** Chat settings */
  chatSettings?: {
    /** Initial messages to display */
    initialMessages?: string[];
    /** Chat prompt suggestions */
    chatPrompts?: string[];
  };
} 