/**
 * @fileoverview Core type definitions for the AgentDock framework
 */

import type { LanguageModelV1, Message } from 'ai';

/**
 * LLM message role
 */
export type LLMRole = 'user' | 'system' | 'assistant' | 'tool';

/**
 * LLM message format
 */
export interface LLMMessage {
  id?: string;
  role: LLMRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

/**
 * LLM configuration
 * Extends Record<string, unknown> to allow for provider-specific settings
 */
export interface LLMConfig extends Record<string, unknown> {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * LLM provider interface
 */
export interface LLMProvider {
  /**
   * Generate text from messages
   */
  generateText(messages: LLMMessage[], config: LLMConfig, tools?: any): Promise<string>;

  /**
   * Generate a stream from messages
   */
  generateStream(messages: LLMMessage[], config: LLMConfig, tools?: any): Promise<ReadableStream<Uint8Array>>;
}

/**
 * LLM adapter interface
 */
export interface LLMAdapter {
  /**
   * Generate text from messages
   */
  generateText(messages: LLMMessage[], tools?: any): Promise<string>;

  /**
   * Generate a stream from messages
   */
  generateStream(messages: LLMMessage[], tools?: any): Promise<ReadableStream<Uint8Array>>;
  toLanguageModel(): LanguageModelV1;
} 