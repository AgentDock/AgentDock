/**
 * @fileoverview Agent node implementation for the AgentDock framework.
 * This node provides a clean abstraction for agent functionality with tool calling support.
 * 
 * Features:
 * - Handles agent functionality with tool calling support
 * - Supports fallback LLM instances
 * - Injects current date and time into system prompts to ensure agents have access to current time information
 */

import { BaseNode } from './base-node';
import { LLMProvider, TokenUsage } from '../llm/types';
import { createError, ErrorCode } from '../errors';
import { logger, LogCategory } from '../logging';
import { NodeCategory } from '../types/node-category';
import { getToolRegistry } from './tool-registry';
import { CoreMessage } from 'ai';
import { convertCoreToLLMMessages } from '../utils/message-utils';
import { NodeMetadata, NodePort } from './base-node';
import { maskSensitiveData } from '../utils/security-utils';
import { CoreLLM, createLLM } from '../llm';
import { ProviderRegistry } from '../llm/provider-registry';

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
  /** Provider-specific options (optional) */
  options?: Record<string, any>;
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
  private llm: CoreLLM;
  private fallbackLlm: CoreLLM | null = null;

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
    
    // Validate API key
    if (!config.apiKey) {
      throw new Error('API key is required for AgentNode');
    }
    
    // Validate API key format using provider registry
    const provider = config.provider || 'anthropic';
    const providerMetadata = ProviderRegistry.getProvider(provider);
    if (!providerMetadata) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    
    if (!providerMetadata.validateApiKey(config.apiKey)) {
      throw new Error(`Invalid API key format for ${providerMetadata.displayName}`);
    }
    
    // Create LLM instance directly
    const llmConfig = this.getLLMConfig(config);
    this.llm = this.createLLMInstance(llmConfig);
    
    // Create fallback LLM instance if fallback API key is provided
    if (config.fallbackApiKey) {
      try {
        const fallbackConfig = {
          ...llmConfig,
          apiKey: config.fallbackApiKey
        };
        this.fallbackLlm = this.createLLMInstance(fallbackConfig);
      } catch (error) {
        logger.warn(
          LogCategory.NODE,
          'AgentNode',
          'Failed to create fallback LLM instance',
          { error: error instanceof Error ? error.message : String(error) }
        );
        this.fallbackLlm = null;
      }
    }
  }

  /**
   * Create an LLM instance based on the provider
   */
  private createLLMInstance(config: any): CoreLLM {
    logger.debug(
      LogCategory.NODE,
      'AgentNode',
      'Creating LLM instance',
      {
        provider: config.provider,
        model: config.model,
        apiKeyPrefix: maskSensitiveData(config.apiKey, 5)
      }
    );
    
    // Create the LLM instance using the unified createLLM function
    return createLLM(config);
  }

  private getLLMConfig(config: AgentNodeConfig): any {
    const provider = config.provider || 'anthropic';
    const nodeType = ProviderRegistry.getNodeTypeFromProvider(provider);
    const modelConfig = config.agentConfig?.nodeConfigurations?.[nodeType];
    
    // Get provider metadata from registry
    const providerMetadata = ProviderRegistry.getProvider(provider);
    if (!providerMetadata) {
      throw createError('node', `Unknown provider: ${provider}`, ErrorCode.NODE_VALIDATION);
    }
    
    // Base config with defaults from provider metadata
    const llmConfig: any = {
      provider,
      apiKey: config.apiKey,
      model: modelConfig?.model || providerMetadata.defaultModel,
      temperature: modelConfig?.temperature,
      maxTokens: modelConfig?.maxTokens,
      topP: modelConfig?.topP,
      maxSteps: modelConfig?.maxSteps
    };
    
    // Apply provider-specific configurations
    if (providerMetadata.applyConfig) {
      providerMetadata.applyConfig(llmConfig, modelConfig, config.options);
    }
    
    return llmConfig;
  }

  private getLLM(useFallback?: boolean): CoreLLM {
    return (useFallback && this.fallbackLlm) ? this.fallbackLlm : this.llm;
  }

  getLastTokenUsage(): TokenUsage | null {
    // First check the primary LLM
    const primaryTokenUsage = this.llm.getLastTokenUsage();
    if (primaryTokenUsage) {
      return primaryTokenUsage;
    }
    
    // If no token usage from primary LLM, check fallback if available
    if (this.fallbackLlm) {
      return this.fallbackLlm.getLastTokenUsage();
    }
    
    return null;
  }

  /**
   * Get the provider of the LLM
   */
  getProvider(): string {
    return this.llm.getProvider();
  }

  /**
   * Handle a message and return a response
   * 
   * This method:
   * 1. Prepares the system prompt and messages
   * 2. Injects current date and time information into the system prompt
   * 3. Calls the LLM with the prepared messages and tools
   * 4. Returns the LLM response
   */
  async handleMessage(options: AgentNodeOptions): Promise<any> {
    try {
      const tools = this.getTools();
      
      // Prepare system message and messages array
      const systemPrompt = options.system || this.config.agentConfig.personality;
      let finalSystemPrompt = typeof systemPrompt === 'string' 
        ? systemPrompt 
        : Array.isArray(systemPrompt) ? systemPrompt.join('\n') : String(systemPrompt || '');
      
      // Inject current date and time information into the system prompt
      const now = new Date();
      const dateTimeInfo = `Current date and time: ${now.toISOString()} (ISO format)
Current date: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Current time: ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}`;
      
      // Append the date/time information to the system prompt
      finalSystemPrompt = `${finalSystemPrompt}\n\n${dateTimeInfo}`;
      
      logger.debug(LogCategory.NODE, 'AgentNode', 'Injected current date/time into system prompt', { 
        nodeId: this.id,
        currentDate: now.toISOString()
      });
      
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
          messages: messagesWithSystem as CoreMessage[],
          tools,
          maxSteps: this.config.agentConfig.options?.maxSteps || 5,
          onStepFinish,
          onFinish: (completion: any) => {
            // Ensure token usage is captured when the stream is complete
            if (completion && typeof completion === 'object' && completion.usage) {
              // The token usage will be captured by the CoreLLM class
            }
            
            // Log token usage after the stream completes and CoreLLM has had a chance to update it
            const tokenUsage = activeLlm.getLastTokenUsage();
            if (tokenUsage) {
              logger.info(
                LogCategory.NODE,
                'AgentNode',
                'Token usage',
                {
                  nodeId: this.id,
                  provider: tokenUsage.provider,
                  promptTokens: tokenUsage.promptTokens,
                  completionTokens: tokenUsage.completionTokens,
                  totalTokens: tokenUsage.totalTokens,
                  usedFallback: useFallback && !!this.fallbackLlm
                }
              );
            } else {
              logger.warn(
                LogCategory.NODE,
                'AgentNode',
                'No token usage available after completion',
                {
                  nodeId: this.id,
                  provider: activeLlm.getProvider(),
                  model: activeLlm.getModelId()
                }
              );
            }
          }
        });
        
        return result;
      } catch (error) {
        // Try fallback if available and not already using it
        if (!useFallback && this.fallbackLlm) {
          logger.info(LogCategory.NODE, 'AgentNode', 'Using fallback LLM', { 
            nodeId: this.id, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          
          try {
            const result = await this.fallbackLlm.streamText({
              messages: messagesWithSystem as CoreMessage[],
              tools,
              maxSteps: this.config.agentConfig.options?.maxSteps || 5,
              onStepFinish: options.onStepFinish,
              onFinish: (completion: any) => {
                // Ensure token usage is captured when the stream is complete
                if (completion && typeof completion === 'object' && completion.usage) {
                  // The token usage will be captured by the CoreLLM class
                }
                
                // Log token usage after the stream completes and CoreLLM has had a chance to update it
                const tokenUsage = this.fallbackLlm?.getLastTokenUsage();
                if (tokenUsage) {
                  logger.info(
                    LogCategory.NODE,
                    'AgentNode',
                    'Fallback token usage',
                    {
                      nodeId: this.id,
                      provider: tokenUsage.provider,
                      promptTokens: tokenUsage.promptTokens,
                      completionTokens: tokenUsage.completionTokens,
                      totalTokens: tokenUsage.totalTokens,
                      usedFallback: true
                    }
                  );
                } else {
                  logger.warn(
                    LogCategory.NODE,
                    'AgentNode',
                    'No fallback token usage available after completion',
                    {
                      nodeId: this.id,
                      provider: this.fallbackLlm?.getProvider(),
                      model: this.fallbackLlm?.getModelId()
                    }
                  );
                }
              }
            });
            
            return result;
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
      const tools = getToolRegistry().getToolsForAgent(this.config.agentConfig.nodes || []);
      
      // Create LLM context for tools
      const llmContext = {
        apiKey: this.config.apiKey,
        provider: this.config.provider || 'anthropic',
        model: this.getLLM().getModelId(),
        llm: this.getLLM()
      };
      
      // Wrap tools to inject LLM context
      const wrappedTools: Record<string, any> = {};
      
      for (const [name, tool] of Object.entries(tools)) {
        // Create a wrapper for the tool's execute function
        const originalExecute = tool.execute;
        
        // Create a new execute function that injects the LLM context
        tool.execute = async (params: any, options: any) => {
          // Create new options with LLM context
          const newOptions = {
            ...options,
            llmContext
          };
          
          // Call the original execute function with the new options
          return await originalExecute(params, newOptions);
        };
        
        wrappedTools[name] = tool;
      }
      
      return wrappedTools;
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