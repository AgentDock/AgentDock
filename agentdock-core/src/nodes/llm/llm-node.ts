/**
 * @fileoverview Base LLM node implementation for AgentDock.
 * Provides foundation for language model integration with streaming support.
 */

import { BaseNode } from '../base-node';
import { createError, ErrorCode } from '../../errors';
import { AgentDockConfig } from '../../types';
import { LLMMessage, LLMConfig as LLMConfigBase } from '../../types/llm';

/**
 * Configuration for LLM nodes
 */
export interface LLMConfig extends LLMConfigBase {
  /** Whether to only use BYOK (no fallback to service key) */
  byokOnly?: boolean;

  /** Framework configuration */
  frameworkConfig?: AgentDockConfig;
}

/**
 * Base class for LLM nodes
 */
export abstract class LLMNode extends BaseNode<LLMConfig> {
  /**
   * Get static node metadata
   */
  static getNodeMetadata() {
    return {
      category: 'core' as 'core' | 'custom',
      label: 'LLM Base',
      description: 'Base class for language model integration',
      inputs: [{
        id: 'messages',
        type: 'array',
        label: 'Messages',
        required: true
      }],
      outputs: [{
        id: 'response',
        type: 'stream',
        label: 'Response Stream'
      }],
      version: '1.0.0',
      compatibility: {
        core: true,
        pro: true,
        custom: false
      }
    };
  }

  protected getCategory() {
    return 'core' as const;
  }

  protected getInputs() {
    return [{
      id: 'messages',
      type: 'array',
      label: 'Messages',
      required: true
    }];
  }

  protected getOutputs() {
    return [{
      id: 'response',
      type: 'stream',
      label: 'Response Stream'
    }];
  }

  protected getVersion(): string {
    return '1.0.0';
  }

  protected getCompatibility() {
    return {
      core: true,
      pro: true,
      custom: false
    };
  }

  /**
   * Execute the LLM node with streaming support
   */
  async execute(input: unknown): Promise<ReadableStream<string>> {
    try {
      if (!this.validateInput(input)) {
        throw createError('llm', 'Invalid input format', ErrorCode.LLM_REQUEST, {
          nodeId: this.id,
          nodeType: this.type,
          input
        });
      }

      const messages = input as LLMMessage[];
      
      // Resolve API key before generating config
      const apiKey = await this.resolveApiKey();
      
      // Generate config with resolved API key
      const config = await this.generateConfig(messages, apiKey);
      
      // Get raw stream from LLM provider
      const rawStream = await this.llmProvider.generate(config, messages);

      // Check if rawStream is already a ReadableStream<string>
      if (this.isReadableStringStream(rawStream)) {
        return rawStream;
      }

      // Convert to ReadableStream<string>
      return new ReadableStream({
        async start(controller) {
          try {
            if (rawStream instanceof ReadableStream) {
              const reader = rawStream.getReader();
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  controller.enqueue(value);
                }
                controller.close();
              } finally {
                reader.releaseLock();
              }
            } else {
              // Handle non-stream response
              controller.enqueue(String(rawStream));
              controller.close();
            }
          } catch (error) {
            controller.error(error);
          }
        }
      });

    } catch (error) {
      throw createError('llm', 'LLM execution failed', ErrorCode.LLM_EXECUTION, {
        nodeId: this.id,
        nodeType: this.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Resolve API key with fallback to service key
   */
  protected async resolveApiKey(): Promise<string> {
    // 1. Check for BYOK key
    if (this.config.apiKey) {
      return this.config.apiKey;
    }

    // 2. Check if BYOK-only mode is enabled (either in node config or framework config)
    if (this.config.byokOnly || this.config.frameworkConfig?.byokOnly) {
      throw createError('llm', 'No API key provided and BYOK-only mode is enabled',
        ErrorCode.LLM_API_KEY);
    }

    // 3. Check if serviceKeyEndpoint is provided in framework config
    if (!this.config.frameworkConfig?.serviceKeyEndpoint) {
      throw createError('llm', 'No API key provided and no service key endpoint configured',
        ErrorCode.LLM_API_KEY);
    }

    // 4. Attempt to fetch service key
    try {
      const response = await fetch(this.config.frameworkConfig.serviceKeyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: this.getProvider() })
      });

      if (!response.ok) {
        // More specific error based on response status
        throw createError('llm', 
          `Failed to fetch service key: ${response.status} - ${response.statusText}`,
          ErrorCode.LLM_SERVICE_KEY_FETCH);
      }

      const { key } = await response.json();

      if (!key) {
        throw createError('llm', 'Service key endpoint returned an invalid response (missing key)',
          ErrorCode.LLM_SERVICE_KEY_INVALID);
      }

      return key;
    } catch (error) {
      // Catch-all error, preserve original cause if available
      throw createError('llm', 'Failed to obtain service key',
        ErrorCode.LLM_SERVICE_KEY_FETCH, { cause: error });
    }
  }

  /**
   * Check if a stream is a ReadableStream<string>
   */
  private isReadableStringStream(stream: unknown): stream is ReadableStream<string> {
    return (
      stream instanceof ReadableStream &&
      typeof (stream as any)?.getReader === 'function' &&
      typeof (stream as any)?.pipeTo === 'function'
    );
  }

  /**
   * Validate input format
   */
  public validateInput(input: unknown): boolean {
    if (!Array.isArray(input)) return false;
    
    return input.every(msg => 
      typeof msg === 'object' &&
      msg !== null &&
      'role' in msg &&
      'content' in msg &&
      typeof msg.content === 'string' &&
      ['system', 'user', 'assistant'].includes(msg.role)
    );
  }

  /**
   * Get the provider identifier for service key requests
   */
  protected abstract getProvider(): string;

  /**
   * Generate configuration for streaming response
   * @returns A promise that resolves to a streaming configuration
   */
  protected abstract generateConfig(messages: LLMMessage[], apiKey: string): Promise<{
    model: string;
    messages: LLMMessage[];
    temperature?: number;
    maxTokens?: number;
  }>;

  /**
   * Get the LLM provider instance
   * Must be implemented by concrete LLM nodes
   */
  protected abstract get llmProvider(): {
    generate(config: any, messages: LLMMessage[]): Promise<ReadableStream<string> | unknown>;
  };
} 