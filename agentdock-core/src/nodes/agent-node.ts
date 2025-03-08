/**
 * @fileoverview Agent node implementation for the AgentDock framework.
 * This node provides a clean abstraction for agent functionality with tool calling support.
 */

import { BaseNode } from './base-node';
import { AnthropicLLM } from '../llm/anthropic-llm';
import { createError, ErrorCode } from '../errors';
import { logger, LogCategory } from '../logging';
import { NodeCategory } from '../types/node-category';
import { getToolRegistry } from './tool-registry';
import { CoreMessage } from 'ai';

/**
 * Configuration for the agent node
 */
export interface AgentNodeConfig {
  /** Agent configuration */
  agentConfig: any;
  /** API key for LLM provider */
  apiKey: string;
}

/**
 * Options for handling a message
 */
export interface AgentNodeOptions {
  /** Array of messages in the conversation */
  messages: CoreMessage[];
  /** Optional system message to override the one in agent configuration */
  system?: string;
}

/**
 * Agent node that provides a clean abstraction for agent functionality
 */
export class AgentNode extends BaseNode<AgentNodeConfig> {
  readonly type = 'core.agent';
  private llm: AnthropicLLM;

  /**
   * Get static node metadata
   */
  static getNodeMetadata() {
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

  /**
   * Constructor
   */
  constructor(id: string, config: AgentNodeConfig) {
    super(id, config);
    
    // Create LLM instance
    this.llm = new AnthropicLLM({
      apiKey: config.apiKey,
      model: config.agentConfig.llm?.model || 'claude-3-sonnet-20240229',
      temperature: config.agentConfig.llm?.temperature,
      maxTokens: config.agentConfig.llm?.maxTokens,
      maxSteps: config.agentConfig.options?.maxSteps || 5
    });
    
    logger.debug(
      LogCategory.NODE,
      'AgentNode',
      'Created agent node',
      { nodeId: this.id }
    );
  }

  /**
   * Get node category
   */
  protected getCategory() {
    return NodeCategory.CORE;
  }

  /**
   * Get node label
   */
  protected getLabel() {
    return 'Agent';
  }

  /**
   * Get node description
   */
  protected getDescription() {
    return 'Handles agent functionality with tool calling support';
  }

  /**
   * Get node version
   */
  protected getVersion() {
    return '1.0.0';
  }

  /**
   * Get node compatibility
   */
  protected getCompatibility() {
    return {
      core: true,
      pro: true,
      custom: true
    };
  }

  /**
   * Get node inputs
   */
  protected getInputs() {
    return [{
      id: 'message',
      type: 'string',
      label: 'Input Message',
      required: true
    }];
  }

  /**
   * Get node outputs
   */
  protected getOutputs() {
    return [{
      id: 'response',
      type: 'string',
      label: 'Agent Response'
    }];
  }

  /**
   * Handle a message and return a response
   */
  async handleMessage(options: AgentNodeOptions): Promise<any> {
    try {
      logger.debug(
        LogCategory.NODE,
        'AgentNode',
        'Handling message',
        { 
          nodeId: this.id,
          messageCount: options.messages.length
        }
      );
      
      // Get tools for this agent
      const tools = this.getTools();
      
      // Prepare system message
      const systemPrompt = options.system || this.config.agentConfig.personality;
      const finalSystemPrompt = typeof systemPrompt === 'string' 
        ? systemPrompt 
        : Array.isArray(systemPrompt) 
          ? systemPrompt.join('\n') 
          : String(systemPrompt || '');
      
      // Prepare messages
      const messagesWithSystem: CoreMessage[] = [
        { role: 'system', content: finalSystemPrompt },
        ...options.messages
      ];
      
      // Call LLM
      return await this.llm.streamText({
        messages: messagesWithSystem,
        tools: tools
      });
    } catch (error) {
      logger.error(
        LogCategory.NODE,
        'AgentNode',
        'Failed to handle message',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      
      throw createError(
        'node',
        'Failed to handle message',
        ErrorCode.NODE_EXECUTION,
        { error }
      );
    }
  }
  
  /**
   * Get tools for this agent
   */
  private getTools(): Record<string, any> {
    // Get the tool registry
    const registry = getToolRegistry();
    
    // Get tools for this agent
    return registry.getToolsForAgent(this.config.agentConfig.nodes || []);
  }

  /**
   * Execute the agent node
   * This is required by the BaseNode interface but delegates to handleMessage
   */
  async execute(input: string | { message: string }): Promise<string> {
    try {
      // Extract message from input
      const message = typeof input === 'string' ? input : input.message;
      
      // Create message object
      const messageObj: CoreMessage = {
        role: 'user',
        content: message
      };
      
      // Handle message
      const result = await this.handleMessage({
        messages: [messageObj]
      });
      
      // For now, just return a placeholder response
      // In a real implementation, we would process the result
      return `Response to: ${message}`;
    } catch (error) {
      logger.error(
        LogCategory.NODE,
        'AgentNode',
        'Failed to execute agent node',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      
      throw createError(
        'node',
        'Failed to execute agent node',
        ErrorCode.NODE_EXECUTION,
        { error }
      );
    }
  }
} 