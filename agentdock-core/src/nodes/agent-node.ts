/**
 * @fileoverview Agent node implementation for the AgentDock framework.
 * This node provides a clean abstraction for agent functionality with tool calling support.
 */

import { BaseNode } from './base-node';
import { LLMBase } from '../llm/llm-base';
import { createLLM } from '../llm';
import { LLMConfig, LLMProvider, TokenUsage } from '../llm/types';
import { createError, ErrorCode } from '../errors';
import { logger, LogCategory } from '../logging';
import { NodeCategory } from '../types/node-category';
import { getToolRegistry } from './tool-registry';
import { CoreMessage } from 'ai';
import { convertCoreToLLMMessages } from '../utils/message-utils';
import { NodeMetadata, NodePort } from './base-node';

/**
 * Configuration for the agent node
 */
export interface AgentNodeConfig {
  /** Agent configuration */
  agentConfig: any;
  /** API key for LLM provider */
  apiKey: string;
  /** Fallback API key for LLM provider (optional) */
  fallbackApiKey?: string;
  /** LLM provider (default: 'anthropic') */
  provider?: LLMProvider;
}

/**
 * Options for handling a message
 */
export interface AgentNodeOptions {
  /** Array of messages in the conversation */
  messages: CoreMessage[];
  /** Optional system message to override the one in agent configuration */
  system?: string;
  /** Force use of fallback API key */
  useFallback?: boolean;
  /** Callback function to be called on each step of the LLM */
  onStepFinish?: (stepData: any) => void;
}

/**
 * Agent node that provides a clean abstraction for agent functionality
 */
export class AgentNode extends BaseNode<AgentNodeConfig> {
  readonly type = 'core.agent';
  private llm: LLMBase;
  private fallbackLlm: LLMBase | null = null;

  static getNodeMetadata(): NodeMetadata {
    return {
      category: NodeCategory.CORE,
      label: 'Agent',
      description: 'Handles agent functionality with tool calling support',
      inputs: [{
        id: 'message',
        type: 'string',
        label: 'Input Message',
        required: true
      }],
      outputs: [{
        id: 'response',
        type: 'string',
        label: 'Agent Response'
      }],
      version: '1.0.0',
      compatibility: {
        core: true,
        pro: true,
        custom: true
      }
    };
  }

  protected getMetadata(): NodeMetadata {
    return AgentNode.getNodeMetadata();
  }

  protected getCategory(): NodeCategory {
    return NodeCategory.CORE;
  }

  protected getLabel(): string {
    return 'Agent';
  }

  protected getDescription(): string {
    return 'Handles agent functionality with tool calling support';
  }

  protected getVersion(): string {
    return '1.0.0';
  }

  protected getCompatibility(): NodeMetadata['compatibility'] {
    return { core: true, pro: true, custom: true };
  }

  protected getInputs(): readonly NodePort[] {
    return AgentNode.getNodeMetadata().inputs;
  }

  protected getOutputs(): readonly NodePort[] {
    return AgentNode.getNodeMetadata().outputs;
  }

  constructor(id: string, config: AgentNodeConfig) {
    super(id, config);
    
    if (!config.apiKey) {
      throw createError('node', 'Missing API key', ErrorCode.NODE_VALIDATION);
    }
    
    logger.debug(LogCategory.NODE, 'AgentNode', 'Creating agent node', { 
      nodeId: this.id,
      apiKeyPrefix: config.apiKey.substring(0, 8) + '...',
      hasFallback: !!config.fallbackApiKey
    });
    
    try {
      const llmConfig = this.getLLMConfig(config);
      this.llm = createLLM(llmConfig);
      
      if (config.fallbackApiKey) {
        this.fallbackLlm = createLLM({...llmConfig, apiKey: config.fallbackApiKey});
      }
      
      logger.debug(LogCategory.NODE, 'AgentNode', 'LLM instances created', { 
        nodeId: this.id, 
        model: llmConfig.model,
        hasFallback: !!this.fallbackLlm
      });
    } catch (error) {
      throw createError(
        'node', 
        `Failed to create LLM: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        ErrorCode.NODE_EXECUTION, 
        { error }
      );
    }
  }

  private getLLMConfig(config: AgentNodeConfig): LLMConfig {
    return {
      provider: config.provider || 'anthropic',
      apiKey: config.apiKey,
      model: config.agentConfig?.nodeConfigurations?.['llm.anthropic']?.model || 'claude-3-7-sonnet-20250219',
      temperature: config.agentConfig?.nodeConfigurations?.['llm.anthropic']?.temperature,
      maxTokens: config.agentConfig?.nodeConfigurations?.['llm.anthropic']?.maxTokens,
      topP: config.agentConfig?.nodeConfigurations?.['llm.anthropic']?.topP,
      maxSteps: config.agentConfig?.nodeConfigurations?.['llm.anthropic']?.maxSteps
    };
  }

  private getLLM(useFallback?: boolean): LLMBase {
    return (useFallback && this.fallbackLlm) ? this.fallbackLlm : this.llm;
  }

  getLastTokenUsage(): TokenUsage | null {
    return this.llm.getLastTokenUsage();
  }

  /**
   * Handle a message and return a response
   */
  async handleMessage(options: AgentNodeOptions): Promise<any> {
    try {
      const tools = this.getTools();
      
      // Prepare system message and messages array
      const systemPrompt = options.system || this.config.agentConfig.personality;
      const finalSystemPrompt = typeof systemPrompt === 'string' 
        ? systemPrompt 
        : Array.isArray(systemPrompt) ? systemPrompt.join('\n') : String(systemPrompt || '');
      
      const messagesWithSystem: CoreMessage[] = [
        { role: 'system', content: finalSystemPrompt },
        ...options.messages
      ];
      
      logger.debug(LogCategory.NODE, 'AgentNode', 'Processing message', { 
        nodeId: this.id,
        messageCount: messagesWithSystem.length,
        systemPromptLength: finalSystemPrompt.length,
        toolCount: Object.keys(tools).length,
        useFallback: options.useFallback || false
      });
      
      // Determine which LLM to use and call it
      const useFallback = options.useFallback || false;
      const activeLlm = this.getLLM(useFallback);
      
      try {
        // Create a wrapper for the onStepFinish callback
        const onStepFinish = options.onStepFinish ? (stepData: any) => {
          logger.debug(LogCategory.NODE, 'AgentNode', 'Step completed', { 
            nodeId: this.id,
            hasText: !!stepData.text,
            hasToolCalls: !!stepData.toolCalls && stepData.toolCalls.length > 0,
            hasToolResults: !!stepData.toolResults && Object.keys(stepData.toolResults).length > 0
          });
          
          options.onStepFinish?.(stepData);
        } : undefined;
        
        // Call the LLM
        const result = await activeLlm.streamText({
          messages: convertCoreToLLMMessages(messagesWithSystem),
          tools,
          maxSteps: this.config.agentConfig.options?.maxSteps || 5,
          onStepFinish
        });
        
        // Log token usage if available
        const tokenUsage = activeLlm.getLastTokenUsage();
        if (tokenUsage) {
          logger.info(LogCategory.NODE, 'AgentNode', 'Token usage', {
            nodeId: this.id,
            ...tokenUsage,
            usedFallback: useFallback && !!this.fallbackLlm
          });
        }
        
        return result;
      } catch (error) {
        // Try fallback if available and not already using it
        if (!useFallback && this.fallbackLlm) {
          logger.info(LogCategory.NODE, 'AgentNode', 'Using fallback LLM', { 
            nodeId: this.id, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          
          try {
            return await this.fallbackLlm.streamText({
              messages: convertCoreToLLMMessages(messagesWithSystem),
              tools,
              maxSteps: this.config.agentConfig.options?.maxSteps || 5,
              onStepFinish: options.onStepFinish
            });
          } catch (fallbackError) {
            throw createError(
              'node',
              `Both LLMs failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              ErrorCode.NODE_EXECUTION,
              { primaryError: error, fallbackError }
            );
          }
        }
        
        throw createError(
          'node',
          `LLM error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ErrorCode.NODE_EXECUTION,
          { error }
        );
      }
    } catch (error) {
      throw createError(
        'node',
        `Message handling failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.NODE_EXECUTION,
        { error }
      );
    }
  }
  
  /**
   * Get tools for this agent
   */
  private getTools(): Record<string, any> {
    try {
      return getToolRegistry().getToolsForAgent(this.config.agentConfig.nodes || []);
    } catch (error) {
      logger.error(LogCategory.NODE, 'AgentNode', 'Failed to get tools', { 
        nodeId: this.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {};
    }
  }

  /**
   * Execute the agent node
   */
  async execute(input: string | { message: string }): Promise<string> {
    try {
      // Create message object and handle it
      const message = typeof input === 'string' ? input : input.message;
      const result = await this.handleMessage({ 
        messages: [{ role: 'user', content: message } as CoreMessage] 
      });
      
      // Extract text from the result
      if (result?.textStream) {
        try {
          let responseText = '';
          for await (const chunk of result.textStream) {
            responseText += chunk;
          }
          return responseText;
        } catch {
          // Fall back to other text extraction methods
        }
      }
      
      // Try other ways to get the text
      return result?.text || (typeof result === 'string' ? result : 'No response generated');
    } catch (error) {
      throw createError(
        'node',
        `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.NODE_EXECUTION,
        { error }
      );
    }
  }
} 