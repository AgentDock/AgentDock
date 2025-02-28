/**
 * @fileoverview Chat node implementation for handling chat messages
 */

import { BaseNode } from './base-node';
import { NodeMessage } from '../messaging/types';
import { createError, ErrorCode } from '../errors';
import { logger, LogCategory } from '../logging';
import { NodeCategory } from '../types/node-category';

/**
 * Configuration for the chat node
 */
export interface ChatNodeConfig {
  /** Maximum message history to maintain */
  maxHistory?: number;
  /** Whether to include system messages in history */
  includeSystem?: boolean;
}

/**
 * Chat message format
 */
export interface ChatMessage extends NodeMessage {
  /** Unique message identifier */
  id: string;
  /** Message content */
  content: string;
}

/**
 * Chat node for handling chat messages
 */
export class ChatNode extends BaseNode<ChatNodeConfig> {
  readonly type = 'core.chat';
  private messages: ChatMessage[] = [];

  /**
   * Get static node metadata
   */
  static getNodeMetadata() {
    return {
      category: NodeCategory.CORE,
      label: 'Chat',
      description: 'Handles chat message processing and history management',
      inputs: [{
        id: 'message',
        type: 'any',
        label: 'Input Message',
        required: true
      }],
      outputs: [{
        id: 'response',
        type: 'any',
        label: 'Chat Response'
      }],
      version: '1.0.0',
      compatibility: {
        core: true,
        pro: true,
        custom: true
      }
    };
  }

  protected getCategory(): NodeCategory {
    return NodeCategory.CORE;
  }

  protected getLabel(): string {
    return 'Chat';
  }

  protected getDescription(): string {
    return 'Handles chat message processing and history management';
  }

  protected getVersion(): string {
    return '1.0.0';
  }

  protected getCompatibility(): { core: boolean; pro: boolean; custom: boolean } {
    return {
      core: true,
      pro: true,
      custom: true
    };
  }

  protected getInputs() {
    return [
      {
        id: 'message',
        type: 'any',
        label: 'Input Message',
        required: true
      }
    ];
  }

  protected getOutputs() {
    return [
      {
        id: 'response',
        type: 'any',
        label: 'Chat Response'
      }
    ];
  }

  /**
   * Initialize the chat node
   */
  async initialize(): Promise<void> {
    await super.initialize();
    this.messages = [];
    logger.debug(
      LogCategory.NODE,
      'ChatNode',
      'Initialized chat node',
      { maxHistory: this.config.maxHistory }
    );
  }

  /**
   * Execute chat message processing
   */
  async execute(input: unknown): Promise<unknown> {
    try {
      const message = this.validateMessage(input);
      this.addMessage(message);
      logger.debug(
        LogCategory.NODE,
        'ChatNode',
        'Processed chat message',
        { 
          messageId: message.id,
          historySize: this.messages.length,
          maxHistory: this.config.maxHistory 
        }
      );
      return message;
    } catch (error) {
      throw createError(
        'node',
        'Failed to process chat message',
        ErrorCode.NODE_EXECUTION,
        { cause: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Validate incoming message
   */
  private validateMessage(input: unknown): ChatMessage {
    if (!input || typeof input !== 'object') {
      throw createError(
        'node',
        'Invalid message format',
        ErrorCode.VALIDATION_ERROR,
        { input }
      );
    }

    const message = input as ChatMessage;
    if (!message.content || typeof message.content !== 'string') {
      throw createError(
        'node',
        'Message must have string content',
        ErrorCode.VALIDATION_ERROR,
        { message }
      );
    }

    return message;
  }

  /**
   * Add message to history
   */
  private addMessage(message: ChatMessage): void {
    this.messages.push(message);
    if (this.config.maxHistory && this.messages.length > this.config.maxHistory) {
      const removed = this.messages.length - this.config.maxHistory;
      this.messages = this.messages.slice(-this.config.maxHistory);
      logger.debug(
        LogCategory.NODE,
        'ChatNode',
        'Trimmed message history',
        { 
          removedMessages: removed,
          newHistorySize: this.messages.length 
        }
      );
    }
  }

  /**
   * Get message history
   */
  getHistory(): ChatMessage[] {
    logger.debug(
      LogCategory.NODE,
      'ChatNode',
      'Retrieved message history',
      { historySize: this.messages.length }
    );
    return this.messages;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    logger.debug(
      LogCategory.NODE,
      'ChatNode',
      'Cleaning up chat node',
      { clearedMessages: this.messages.length }
    );
    this.messages = [];
    await super.cleanup();
  }
} 
 