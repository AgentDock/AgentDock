/**
 * @fileoverview Agent node implementation for the AgentDock framework.
 * This node provides a clean abstraction for agent functionality with tool calling support.
 */

import { BaseNode } from './base-node';
import { LLMBase } from '../llm/llm-base';
import { createLLM, LLMConfig, LLMProvider } from '../llm';
import { TokenUsage } from '../llm/types';
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
}

/**
 * Agent node that provides a clean abstraction for agent functionality
 */
export class AgentNode extends BaseNode<AgentNodeConfig> {
  readonly type = 'core.agent';
  private llm: LLMBase;
  private fallbackLlm: LLMBase | null = null;

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
    
    // Validate API key
    if (!config.apiKey) {
      const error = 'Missing API key in agent configuration';
      logger.error(LogCategory.NODE, 'AgentNode', error);
      throw createError('node', error, ErrorCode.NODE_VALIDATION);
    }
    
    // Log creation with minimal info
    logger.debug(
      LogCategory.NODE,
      'AgentNode',
      'Creating agent node with API key',
      { 
        nodeId: this.id,
        apiKeyPrefix: config.apiKey.substring(0, 8) + '...',
        apiKeyLength: config.apiKey.length,
        hasFallback: !!config.fallbackApiKey
      }
    );
    
    // Create primary LLM
    try {
      const llmConfig = this.getLLMConfig(config);
      this.llm = createLLM(llmConfig);
      
      logger.debug(
        LogCategory.NODE,
        'AgentNode',
        'Created primary LLM instance successfully',
        { nodeId: this.id, model: llmConfig.model }
      );
      
      // Create fallback LLM if fallback API key is provided
      if (config.fallbackApiKey) {
        const fallbackConfig = {
          ...llmConfig,
          apiKey: config.fallbackApiKey
        };
        
        this.fallbackLlm = createLLM(fallbackConfig);
        
        logger.debug(
          LogCategory.NODE,
          'AgentNode',
          'Created fallback LLM instance successfully',
          { nodeId: this.id, model: fallbackConfig.model }
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        LogCategory.NODE,
        'AgentNode',
        `Failed to create LLM instance: ${errorMessage}`,
        { nodeId: this.id, error }
      );
      throw createError(
        'node',
        `Failed to create LLM instance: ${errorMessage}`,
        ErrorCode.NODE_EXECUTION,
        { error }
      );
    }
  }

  /**
   * Get LLM configuration from agent configuration
   */
  private getLLMConfig(config: AgentNodeConfig): LLMConfig {
    const llmConfig = config.agentConfig?.nodeConfigurations?.['llm.anthropic'] || {};
    
    return {
      provider: config.provider || 'anthropic',
      apiKey: config.apiKey,
      model: llmConfig.model || 'claude-3-7-sonnet-20250219',
      temperature: llmConfig.temperature,
      maxTokens: llmConfig.maxTokens,
      topP: llmConfig.topP,
      maxSteps: llmConfig.maxSteps
    };
  }

  /**
   * Get the appropriate LLM instance based on options
   */
  private getLLM(useFallback?: boolean): LLMBase {
    const isUsingFallback = useFallback && this.fallbackLlm !== null;
    
    // Return the appropriate LLM instance without redundant logging
    // The calling method will log which LLM is being used if needed
    return isUsingFallback ? this.fallbackLlm! : this.llm;
  }

  /**
   * Get the last token usage information
   */
  getLastTokenUsage(): TokenUsage | null {
    return this.llm.getLastTokenUsage();
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
          messageCount: options.messages.length,
          apiKeyPrefix: this.config.apiKey.substring(0, 8) + '...',
          apiKeyLength: this.config.apiKey.length,
          useFallback: options.useFallback || false
        }
      );
      
      // Get tools for this agent
      let tools;
      try {
        tools = this.getTools();
        logger.debug(
          LogCategory.NODE,
          'AgentNode',
          'Retrieved tools for agent',
          { 
            nodeId: this.id,
            toolCount: Object.keys(tools).length,
            toolNames: Object.keys(tools)
          }
        );
      } catch (error) {
        logger.error(
          LogCategory.NODE,
          'AgentNode',
          'Failed to get tools for agent',
          { 
            nodeId: this.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        );
        // Continue without tools if there's an error
        tools = {};
      }
      
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
      
      logger.debug(
        LogCategory.NODE,
        'AgentNode',
        'Prepared messages for LLM',
        { 
          nodeId: this.id,
          messageCount: messagesWithSystem.length,
          systemPromptLength: finalSystemPrompt.length
        }
      );
      
      // Determine which LLM to use
      const useFallback = options.useFallback || false;
      const activeLlm = this.getLLM(useFallback);
      const isUsingFallback = useFallback && this.fallbackLlm !== null;
      
      // Log which LLM is being used
      logger.debug(
        LogCategory.NODE,
        'AgentNode',
        `Using ${isUsingFallback ? 'fallback' : 'primary'} LLM`,
        { nodeId: this.id, useFallback }
      );
      
      // Call LLM
      try {
        const result = await activeLlm.streamText({
          messages: messagesWithSystem,
          tools: tools
        });
        
        logger.debug(
          LogCategory.NODE,
          'AgentNode',
          'Successfully streamed text from LLM',
          { nodeId: this.id, usedFallback: isUsingFallback }
        );
        
        // Capture token usage information
        const tokenUsage = activeLlm.getLastTokenUsage();
        if (tokenUsage) {
          logger.info(
            LogCategory.NODE,
            'AgentNode',
            'Token usage for message',
            {
              nodeId: this.id,
              promptTokens: tokenUsage.promptTokens,
              completionTokens: tokenUsage.completionTokens,
              totalTokens: tokenUsage.totalTokens
            }
          );
        }
        
        return result;
      } catch (error) {
        // Enhanced error logging for LLM errors
        const errorDetails: Record<string, any> = {
          message: error instanceof Error ? error.message : 'Unknown error',
          nodeId: this.id,
          usedFallback: isUsingFallback
        };
        
        // Extract more details if available
        if (error && typeof error === 'object') {
          if ('status' in error) errorDetails.status = (error as any).status;
          if ('type' in error) errorDetails.type = (error as any).type;
          if ('code' in error) errorDetails.code = (error as any).code;
          
          // Extract response details if available
          if ('response' in error && (error as any).response) {
            const response = (error as any).response;
            errorDetails.responseStatus = response.status;
            errorDetails.responseStatusText = response.statusText;
            
            // Try to extract response data
            if (response.data) {
              try {
                errorDetails.responseData = response.data;
              } catch (e) {
                errorDetails.responseDataError = 'Could not process response data';
              }
            }
          }
        }
        
        logger.error(
          LogCategory.NODE,
          'AgentNode',
          'Failed to stream text from LLM',
          errorDetails
        );
        
        // Try fallback if available and not already using it
        if (!isUsingFallback && this.fallbackLlm) {
          logger.info(
            LogCategory.NODE,
            'AgentNode',
            'Attempting to use fallback LLM',
            { nodeId: this.id, error: errorDetails.message }
          );
          
          try {
            // Use fallback directly instead of recursive call to avoid potential issues
            const fallbackResult = await this.fallbackLlm.streamText({
              messages: messagesWithSystem,
              tools: tools
            });
            
            logger.info(
              LogCategory.NODE,
              'AgentNode',
              'Successfully used fallback LLM',
              { nodeId: this.id }
            );
            
            // Capture token usage information
            const fallbackTokenUsage = this.fallbackLlm.getLastTokenUsage();
            if (fallbackTokenUsage) {
              logger.info(
                LogCategory.NODE,
                'AgentNode',
                'Token usage for message',
                {
                  nodeId: this.id,
                  promptTokens: fallbackTokenUsage.promptTokens,
                  completionTokens: fallbackTokenUsage.completionTokens,
                  totalTokens: fallbackTokenUsage.totalTokens
                }
              );
            }
            
            return fallbackResult;
          } catch (fallbackError) {
            // Log fallback error
            const fallbackErrorDetails = {
              message: fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback error',
              nodeId: this.id,
              primaryError: errorDetails.message
            };
            
            logger.error(
              LogCategory.NODE,
              'AgentNode',
              'Fallback LLM also failed',
              fallbackErrorDetails
            );
            
            throw createError(
              'node',
              `Both primary and fallback LLMs failed. Primary: ${errorDetails.message}, Fallback: ${fallbackErrorDetails.message}`,
              ErrorCode.NODE_EXECUTION,
              { primaryError: error, fallbackError }
            );
          }
        }
        
        throw createError(
          'node',
          'Failed to stream text from LLM: ' + (error instanceof Error ? error.message : 'Unknown error'),
          ErrorCode.NODE_EXECUTION,
          { error, details: errorDetails }
        );
      }
    } catch (error) {
      logger.error(
        LogCategory.NODE,
        'AgentNode',
        'Failed to handle message',
        { 
          nodeId: this.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
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
    
    // Get node names from agent config
    const nodeNames = this.config.agentConfig.nodes || [];
    
    // Log node names for debugging
    logger.debug(
      LogCategory.NODE,
      'AgentNode',
      'Getting tools for agent',
      { 
        nodeId: this.id,
        nodeNames
      }
    );
    
    // Get tools for this agent
    return registry.getToolsForAgent(nodeNames);
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