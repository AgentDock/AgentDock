/**
 * @fileoverview Agent node implementation for the AgentDock framework.
 * Provides agent functionality with tool calling support and orchestration.
 */

import { BaseNode, NodeMetadata, NodePort } from './base-node';
import { getToolRegistry } from './tool-registry';
import { LLMProvider, TokenUsage, LLMMessage, LLMConfig } from '../llm/types';
import { CoreLLM, createLLM, LLMOrchestrationService } from '../llm';
import { ProviderRegistry } from '../llm/provider-registry';
import { createError, ErrorCode } from '../errors';
import { logger, LogCategory } from '../logging';
import { NodeCategory } from '../types/node-category';
import { Message, ToolResultContent } from '../types/messages';
import { convertCoreToLLMMessages } from '../utils/message-utils';
import { createSystemPrompt } from '../utils/prompt-utils';
import { OrchestrationConfig, AIOrchestrationState } from '../types/orchestration';
import { OrchestrationManager } from '../orchestration/index';
import { SessionId } from '../types/session';
import { Tool } from '../types/tools';
import { CoreMessage, AgentDockStreamResult, LanguageModelUsage, CoreTool, FinishReason } from '../llm';
import { z } from 'zod';
import { AgentConfig, PersonalitySchema } from '../types/agent-config';
import { DynamicOrchestrationState } from '../utils/prompt-utils';

/**
 * Configuration specific to the AgentNode.
 */
export interface AgentNodeConfig {
  /** LLM Provider identifier (e.g., 'anthropic', 'openai'). Optional, derived from agentConfig if not set. */
  provider?: string;
  /** Primary API Key for the LLM provider. */
  apiKey: string;
  /** Optional Fallback API Key. */
  fallbackApiKey?: string;
  /** Optional Fallback Provider identifier. */
  fallbackProvider?: string;
  /** Optional Fallback Model identifier. */
  fallbackModel?: string;
  /** Optional LLM configuration options (merged with provider/agent defaults). */
  options?: Partial<LLMConfig>;
  /** 
   * The full, validated Agent Configuration object containing all agent-specific
   * settings (personality, tools, orchestration, etc.).
   */
  agentConfig?: AgentConfig;
}

/**
 * Options for handling a message within AgentNode.
 * Defines the runtime context required for execution.
 */
export interface AgentNodeHandleMessageOptions {
  /** The array of messages representing the conversation history. */
  messages: Message[];
  /** 
   * The instance of OrchestrationManager for the current session.
   * Required for state access and tool filtering.
   * Provided by the calling adapter.
   */
  orchestrationManager: OrchestrationManager;
  /** The unique identifier for the current session. */
  sessionId: string;
  /** Optional system prompt override for this specific call. */
  systemOverride?: string | string[];
  /** Optional flag to force use of the fallback LLM. */
  useFallback?: boolean;
  /** Optional LLM configuration overrides for this specific call. */
  config?: Partial<LLMConfig>;
  /** Optional pre-fetched orchestration state to bypass internal fetch. */
  orchestrationState?: AIOrchestrationState;
}

/**
 * Core Agent Node for AgentDock.
 * 
 * Extends `BaseNode` and implements conversational AI logic using the Vercel AI SDK.
 * Adheres to the standard node pattern: simple constructor (`id`, `config`), 
 * with runtime dependencies (like `OrchestrationManager`) injected via the `handleMessage` method.
 * 
 * Responsibilities:
 * - Initializes the appropriate LLM provider (`CoreLLM`).
 * - Determines available tools based on configuration and orchestration state.
 * - Injects current date and time information into system prompts to ensure agents always have access to current time.
 * - Calls the Vercel AI SDK's `streamText` function, attaching an `onFinish` callback 
 *   to handle asynchronous tasks like token usage updates after the stream completes.
 * - Returns the `StreamTextResult` object (containing the live stream and usage promise) 
 *   immediately to the caller (adapter).
 * 
 * **Note:** This node delegates stream processing (consuming deltas, handling tool calls) 
 * and the construction of the final HTTP response to the calling adapter/API route.
 */
export class AgentNode extends BaseNode<AgentNodeConfig> {
  readonly type = 'core.agent';
  private llm: CoreLLM;
  private fallbackLlm: CoreLLM | null = null;
  
  /**
   * Constructs an AgentNode instance.
   * @param id The unique node identifier.
   * @param config Static configuration including API keys, provider, and agent-specific settings.
   */
  constructor(id: string, config: AgentNodeConfig) {
    super(id, config);
    if (!config.apiKey) {
      throw createError('node', 'API key is required for AgentNode', ErrorCode.NODE_INITIALIZATION);
    }
    if (!config.agentConfig) {
        logger.warn(LogCategory.NODE, 'AgentNode', 'AgentConfig missing during construction, using minimal default.', { nodeId: id });
        config.agentConfig = {
            version: '1.0', 
            agentId: id, 
            name: 'Default Agent', 
            description: '', 
            personality: PersonalitySchema.parse(''),
            nodes: [], 
            nodeConfigurations: {}, 
            chatSettings: {}
        };
    }
    const primaryProvider = config.provider;
    this.llm = this.createLLMInstance(primaryProvider, config.apiKey, config.options);
    
    if (config.fallbackApiKey && (config.fallbackProvider || config.fallbackModel)) { 
        const fallbackProviderOrDefault = config.fallbackProvider || this.llm.getProvider();
        const fallbackModelOrDefault = config.fallbackModel || 'claude-3-5-sonnet-20240620';
        
        if (config.fallbackApiKey === config.apiKey && fallbackProviderOrDefault === this.llm.getProvider() && fallbackModelOrDefault === this.llm.getModelId()) {
             logger.warn(LogCategory.NODE, 'AgentNode', 'Fallback LLM configuration is identical to primary LLM.', { nodeId: this.id });
        } else {
             this.fallbackLlm = this.createLLMInstance(
                 fallbackProviderOrDefault, 
                 config.fallbackApiKey, 
                 { ...config.options, model: fallbackModelOrDefault }
             );
             logger.debug(LogCategory.NODE, 'AgentNode', 'Created fallback LLM', { 
                 nodeId: this.id, 
                 provider: this.fallbackLlm.getProvider(), 
                 model: this.fallbackLlm.getModelId() 
             });
        }
    }
  }
  
  /**
   * Creates a CoreLLM instance.
   * Derives provider/model if not explicitly passed.
   * Throws error if model cannot be determined.
   */
  private createLLMInstance(provider: string | undefined | null, apiKey: string, options?: Partial<LLMConfig>): CoreLLM {
    logger.debug(LogCategory.NODE, 'AgentNode', 'Entering createLLMInstance', { nodeId: this.id, provider }); 
    try {
      let determinedProvider = provider as LLMProvider | undefined;
      let modelName = options?.model;
      
      logger.debug(LogCategory.NODE, 'AgentNode', 'Attempting to derive provider', { nodeId: this.id, initialProvider: determinedProvider });
      if (!determinedProvider && this.config.agentConfig) {
          const nodes = this.config.agentConfig.nodes || [];
          determinedProvider = ProviderRegistry.getProviderFromNodes(nodes);
          if (!determinedProvider) {
               logger.warn(LogCategory.NODE, 'AgentNode', 'Could not determine LLM provider from agentConfig nodes.', { nodeId: this.id });
               determinedProvider = 'anthropic'; 
          }
      } else if (!determinedProvider) {
           logger.warn(LogCategory.NODE, 'AgentNode', 'No provider specified and could not derive from agentConfig. Using default.', { nodeId: this.id });
           determinedProvider = 'anthropic';
      }
      logger.debug(LogCategory.NODE, 'AgentNode', 'Derived provider', { nodeId: this.id, determinedProvider });

      logger.debug(LogCategory.NODE, 'AgentNode', 'Attempting to derive model', { nodeId: this.id, initialModel: modelName, provider: determinedProvider });
      if (!modelName && this.config.agentConfig) {
          const providerNodeType = ProviderRegistry.getNodeTypeFromProvider(determinedProvider);
          modelName = this.config.agentConfig.nodeConfigurations?.[providerNodeType]?.model;
      }
      if (!modelName) {
          const providerMeta = ProviderRegistry.getProvider(determinedProvider);
          modelName = providerMeta?.defaultModel; 
      }
      if (!modelName) {
          logger.error(LogCategory.NODE, 'AgentNode', 'Could not determine model name from options, agentConfig, or provider defaults.', { nodeId: this.id, provider: determinedProvider });
          throw createError('node', `Failed to determine model name for provider ${determinedProvider}. Please configure explicitly.`, ErrorCode.NODE_INITIALIZATION);
      }
      logger.debug(LogCategory.NODE, 'AgentNode', 'Derived model', { nodeId: this.id, modelName });

      logger.debug(LogCategory.NODE, 'AgentNode', 'Calling actual createLLM function', { nodeId: this.id, provider: determinedProvider, model: modelName });

      const llmInstance = createLLM({ 
        provider: determinedProvider, 
        apiKey, 
        model: modelName, 
        config: options, 
        agentConfig: this.config.agentConfig
      });
      
      // Log the instance being returned
      logger.debug(LogCategory.NODE, 'AgentNode', 'Attempting to return LLM instance', { 
          nodeId: this.id, 
          instanceDetails: { 
              provider: llmInstance?.getProvider ? llmInstance.getProvider() : 'unknown', 
              model: llmInstance?.getModelId ? llmInstance.getModelId() : 'unknown' 
          }
      });
      return llmInstance;

    } catch (error) {
      // Log the raw error object IMMEDIATELY upon catching
      logger.error(LogCategory.NODE, 'AgentNode', 'IMMEDIATE CATCH in createLLMInstance', { 
          rawError: error, // Log the raw error object
          errorMessage: error instanceof Error ? error.message : String(error),
          nodeId: this.id
      });
      logger.error(LogCategory.NODE, 'AgentNode', 'Error caught within createLLMInstance', {
        nodeId: this.id,
        provider,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'N/A'
      });
      throw createError('node', `Failed to create LLM for provider ${provider ?? 'unknown'}`, ErrorCode.NODE_INITIALIZATION, { cause: error });
    }
  }
  
  /**
   * Determines the tools available for the current turn.
   * Uses the correctly typed this.config.agentConfig.
   */
  private async getAvailableTools(messages: Message[], sessionId: string, orchestrationManager: OrchestrationManager): Promise<Tool[]> {
    try {
      const agentToolNodeIds = this.config.agentConfig?.nodes || [];

      if (agentToolNodeIds.length === 0) {
        return [];
      }
      
      const registry = getToolRegistry();
      const allAgentToolsObj = registry.getToolsForAgent(agentToolNodeIds);
      const allAgentToolsList: Tool[] = Object.entries(allAgentToolsObj).map(([toolKey, tool]) => ({ ...tool, name: toolKey }));
      const allToolIds = allAgentToolsList.map(t => t.name);
      
      const orchestrationConfig = this.config.agentConfig?.orchestration || { steps: [] };
      
      let allowedToolNames: string[] = allToolIds;
      if (orchestrationConfig.steps.length > 0) {
          const llmMessages = convertCoreToLLMMessages(messages);
          allowedToolNames = await orchestrationManager.getAllowedTools(orchestrationConfig, llmMessages, sessionId, allToolIds);
      } 
      
      const availableTools = allAgentToolsList.filter(tool => allowedToolNames.includes(tool.name));
      logger.debug(LogCategory.NODE, 'AgentNode', 'Tools available for turn', { nodeId: this.id, sessionId: sessionId?.substring(0, 8), count: availableTools.length });
      return availableTools;
    } catch (error) {
      logger.error(LogCategory.NODE, 'AgentNode', 'Error getting available tools', { nodeId: this.id, sessionId: sessionId?.substring(0, 8), error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  /**
   * Handles an incoming message request for a specific session.
   *
   * This is the primary execution method for the AgentNode.
   * It orchestrates fetching available tools, preparing the prompt, calling the LLM 
   * via the Vercel AI SDK (`streamText`), and returning the stream result immediately.
   * It utilizes the SDK's `onFinish` callback for asynchronous post-stream tasks like updating token counts.
   *
   * @param options The `AgentNodeHandleMessageOptions` containing runtime context (messages, sessionId, manager) and overrides.
   * @returns A Promise resolving to the `StreamTextResult` object from the Vercel AI SDK, 
   *          containing the live stream and usage promise for the caller to handle.
   */
  async handleMessage(
    options: AgentNodeHandleMessageOptions
  ): Promise<AgentDockStreamResult<Record<string, CoreTool>, any>> { 
    const { 
        messages, 
        sessionId, 
        orchestrationManager, 
        systemOverride, 
        useFallback = false, 
        config: runtimeOverrides, 
        orchestrationState: providedState 
    } = options;

    const activeLLM = useFallback && this.fallbackLlm ? this.fallbackLlm : this.llm;
    if (!activeLLM) {
        throw createError('node', 'No active LLM available for handleMessage', ErrorCode.NODE_EXECUTION, { nodeId: this.id });
    }
    
    try {
      const orchestrationService = new LLMOrchestrationService(
        activeLLM,
        orchestrationManager,
        sessionId
      );

      logger.info(LogCategory.NODE, 'AgentNode', 'Handling message', { 
        nodeId: this.id, 
        sessionId: sessionId?.substring(0, 8), 
        msgCount: messages.length, 
        fallback: useFallback 
      });

      const availableTools = await this.getAvailableTools(messages, sessionId, orchestrationManager);
      
      const toolsForStreamText: Record<string, CoreTool> | undefined = 
        availableTools.length > 0 
          ? availableTools.reduce((acc, tool) => {
              const parametersSchema = (tool.parameters && typeof tool.parameters === 'object') 
                                       ? tool.parameters 
                                       : z.object({});
              acc[tool.name] = { 
                  description: tool.description,
                  parameters: parametersSchema,
                  execute: tool.execute
              }; 
              return acc; 
            }, {} as Record<string, CoreTool>)
          : undefined;

      // --- Prepare System Prompt with Dynamic State --- 
      let finalSystemPrompt: string;
      
      // 1. Get the current orchestration state (subset needed for prompt)
      // Use provided state if available, otherwise fetch
      let currentOrchestrationState: AIOrchestrationState | null = providedState || null;
      if (!currentOrchestrationState) {
          logger.debug(LogCategory.NODE, 'AgentNode', 'Fetching orchestration state for prompt', { nodeId: this.id, sessionId: sessionId?.substring(0, 8) });
          currentOrchestrationState = await orchestrationManager.getState(sessionId);
      }
      
      // 2. Prepare the dynamic state object expected by createSystemPrompt
      const dynamicStateForPrompt: DynamicOrchestrationState = {
        activeStepName: currentOrchestrationState?.activeStep,
        // Only include recentlyUsedTools if they exist and are non-empty
        recentlyUsedTools: (currentOrchestrationState?.recentlyUsedTools && currentOrchestrationState.recentlyUsedTools.length > 0) 
                           ? currentOrchestrationState.recentlyUsedTools 
                           : undefined
      };
      logger.debug(LogCategory.NODE, 'AgentNode', 'Dynamic state prepared for prompt', { nodeId: this.id, sessionId: sessionId?.substring(0, 8), dynamicState: dynamicStateForPrompt });
      
      // 3. Create the final prompt, passing both config and dynamic state
      if (systemOverride) {
         const baseConfig = this.config.agentConfig || {}; 
         const tempAgentConfig = { ...baseConfig, personality: systemOverride };
         // Pass dynamic state as second argument
         finalSystemPrompt = createSystemPrompt(tempAgentConfig, dynamicStateForPrompt); 
      } else {
         // Pass dynamic state as second argument
         finalSystemPrompt = createSystemPrompt(this.config.agentConfig, dynamicStateForPrompt); 
      }
      // --- System Prompt Preparation End ---
      
      // Inject current date and time information into the system prompt
      const now = new Date();
      const dateTimeInfo = `
Current date: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Current time: ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
Current timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
ISO timestamp: ${now.toISOString()}`;
      finalSystemPrompt = `${finalSystemPrompt}\n\n${dateTimeInfo}`;
      
      // >>> Debug Log for Final System Prompt <<<
      logger.debug(LogCategory.NODE, 'AgentNode', 'Final System Prompt before LLM call', { 
          nodeId: this.id, 
          sessionId: sessionId?.substring(0, 8), 
          prompt: finalSystemPrompt 
      });
      
      const coreMessages = convertCoreToLLMMessages(messages) as CoreMessage[];
      
      const maxSteps = runtimeOverrides?.maxSteps ?? 
                       (typeof this.config.agentConfig?.options?.maxSteps === 'number' ? this.config.agentConfig.options.maxSteps : undefined) ?? 
                       5;
                       
      logger.debug(LogCategory.NODE, 'AgentNode', 'Calling LLM Orchestration Service', { 
          nodeId: this.id, 
          sessionId: sessionId?.substring(0, 8), 
          provider: activeLLM.getProvider(), 
          model: activeLLM.getModelId(), 
          toolCount: availableTools.length,
          maxSteps 
      });

      const result = await orchestrationService.streamWithOrchestration({
        system: finalSystemPrompt,
        messages: coreMessages, 
        tools: toolsForStreamText,
        maxSteps: maxSteps,
        temperature: runtimeOverrides?.temperature ?? this.config.options?.temperature,
        maxTokens: runtimeOverrides?.maxTokens ?? this.config.options?.maxTokens,
        topP: runtimeOverrides?.topP ?? this.config.options?.topP,
        topK: runtimeOverrides?.topK ?? this.config.options?.topK,
      });

      logger.debug(LogCategory.NODE, 'AgentNode', 'Returning stream result object from service', { nodeId: this.id, sessionId: sessionId?.substring(0, 8) });
      return result as any;
      
    } catch (error) {
      logger.error(LogCategory.NODE, 'AgentNode', 'Error in handleMessage', { nodeId: this.id, sessionId: sessionId?.substring(0, 8), error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
  
  // --- BaseNode Implementation ---
  /** 
   * BaseNode requires an execute method. For AgentNode, handleMessage is preferred.
   * This implementation warns and throws an error.
   */
  async execute(input: unknown): Promise<unknown> {
    logger.warn(LogCategory.NODE, 'AgentNode', 'Direct execute() lacks context. Use handleMessage.', { nodeId: this.id });
    throw createError('node', 'Direct execute() not supported for AgentNode. Use handleMessage.', ErrorCode.NODE_EXECUTION);
  }

  /** Provides the category for this node type. */
  protected getCategory(): NodeCategory { return NodeCategory.CORE; }
  
  /** Provides the display label for this node. */
  protected getLabel(): string {
    return this.config.agentConfig?.name || 'Agent Node';
  }
  
  /** Provides the description for this node. */
  protected getDescription(): string {
    return this.config.agentConfig?.description || 'Core Agent Node using Vercel AI SDK streamText.';
  }
  
  /** Provides the version for this node implementation. */
  protected getVersion(): string { return '1.0.0'; }
  
  /** Provides compatibility information. */
  protected getCompatibility(): NodeMetadata['compatibility'] {
    return { core: true, pro: true, custom: false }; 
  }
  
  /** Defines the inputs required by the `handleMessage` method. */
  protected getInputs(): readonly NodePort[] {
    return [
      { id: 'messages', type: 'Message[]', label: 'Input Messages', required: true },
      { id: 'sessionId', type: 'string', label: 'Session ID', required: true },
      { id: 'orchestrationManager', type: 'OrchestrationManager', label: 'Orchestration Manager', required: true },
      { id: 'systemOverride', type: 'string | string[]', label: 'System Prompt Override', required: false },
      { id: 'useFallback', type: 'boolean', label: 'Use Fallback LLM', required: false, defaultValue: false },
      { id: 'config', type: 'Partial<LLMConfig>', label: 'LLM Config Overrides', required: false },
      { id: 'orchestrationState', type: 'AIOrchestrationState', label: 'Orchestration State', required: false },
    ];
  }
  
  /** Defines the primary output returned by the `handleMessage` method. */
  protected getOutputs(): readonly NodePort[] {
    return [
      { id: 'streamResult', type: 'AgentDockStreamResult<Record<string, CoreTool>>', label: 'Stream Result', required: true }, 
    ];
  }
} 