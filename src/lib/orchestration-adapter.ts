/**
 * Adapter for the agentdock-core orchestration system to work in NextJS
 * 
 * This adapter provides an efficient way to use the orchestration system
 * in NextJS API routes, avoiding global state and performance problems.
 */

import type { Message } from 'agentdock-core';
import type { AIOrchestrationState } from 'agentdock-core/types/orchestration';
import type { SessionId } from 'agentdock-core/types/session';
import { NextRequest, NextResponse } from 'next/server';
import { 
    logger, 
    LogCategory, 
    createOrchestrationManager,
    OrchestrationManager,
    OrchestrationConfig,
    getStorageFactory,
    StorageProvider,
    convertCoreToLLMMessages,
    LLMMessage,
    RedisStorageProvider,
    MemoryStorageProvider
} from 'agentdock-core';

// Local type for template orchestration config, which may have readonly properties
export type TemplateOrchestrationConfig = {
  readonly description?: string | ReadonlyArray<string>;
  readonly steps?: ReadonlyArray<{
    readonly name: string;
    readonly description?: string;
    readonly isDefault?: boolean;
    readonly conditions?: ReadonlyArray<{
      readonly type: string;
      readonly value?: string;
    }>;
    readonly sequence?: ReadonlyArray<string>;
    readonly availableTools?: {
      readonly allowed?: ReadonlyArray<string>;
      readonly denied?: ReadonlyArray<string>;
    };
  }>;
};

/**
 * Interface for orchestration adapter
 */
export interface OrchestrationAdapter {
  getActiveStep: (sessionId: SessionId, config: any) => Promise<any>;
  trackToolUsage: (sessionId: SessionId, toolName: string, config: any) => Promise<any>;
  getState: (sessionId: SessionId, config?: any) => Promise<AIOrchestrationState | null>;
  filterTools: (sessionId: SessionId, config: any, availableTools: string[]) => Promise<string[]>;
  createHeaders: (req: NextRequest, sessionId: string, state: any) => Promise<Record<string, string>>;
}

/**
 * Helper function to get the correctly configured storage provider based on environment variables.
 */
const getConfiguredStorageProvider = () => {
  const debug = {
    STORAGE_TYPE: process.env.STORAGE_TYPE,
    REDIS_URL: process.env.REDIS_URL,
    SRH_TOKEN: process.env.SRH_TOKEN,
    KV_STORE_PROVIDER: process.env.KV_STORE_PROVIDER
  };
  logger.debug(LogCategory.API, 'OrchestrationAdapter', 'Storage configuration', debug);

  const storageType = process.env.KV_STORE_PROVIDER || 'memory';
  const redisUrl = process.env.REDIS_URL;
  const redisToken = process.env.SRH_TOKEN;

  if (storageType === 'redis' && redisUrl) {
    // Token is required by @upstash/redis, use placeholder if missing locally
    const tokenToUse = redisToken || 'local_placeholder_token';
    logger.info(LogCategory.API, 'OrchestrationAdapter', `Using Redis Storage Provider: ${redisUrl}`);

    try {
      return new RedisStorageProvider({
        url: redisUrl,
        token: tokenToUse // Pass token (now read from SRH_TOKEN)
        // @upstash/redis handles TLS based on URL
      });
    } catch (error) {
        logger.error(LogCategory.API, 'OrchestrationAdapter', 'Failed to initialize RedisStorageProvider, falling back to Memory', {
            error: error instanceof Error ? error.message : String(error)
        });
    }
  } 
  else if (storageType === 'vercel-kv') { 
      // Check if necessary env vars are present (optional, @vercel/kv might handle errors)
      // const kvUrl = process.env.KV_URL;
      // const kvToken = process.env.KV_REST_API_TOKEN;
      // if (!kvUrl || !kvToken) {
      //    logger.error(LogCategory.API, 'OrchestrationAdapter', 'Vercel KV environment variables (KV_URL, KV_REST_API_TOKEN) are missing, falling back to Memory');
      // }
      // else {
          logger.info(LogCategory.API, 'OrchestrationAdapter', 'Using Vercel KV Storage Provider');
          try {
              // Use the factory to get the Vercel KV provider instance
              return getStorageFactory().getProvider({ type: 'vercel-kv', namespace: 'sessions' });
          } catch (error) {
              logger.error(LogCategory.API, 'OrchestrationAdapter', 'Failed to initialize VercelKVProvider, falling back to Memory', {
                  error: error instanceof Error ? error.message : String(error)
              });
          }
      // }
  }
  
  // Default / Fallback
  logger.warn(LogCategory.API, 'OrchestrationAdapter', 'Using Memory Storage Provider (State will NOT persist across requests)');
  // Use factory for memory provider, ensuring a consistent namespace
  return getStorageFactory().getProvider({ type: 'memory', namespace: 'sessions' });
}

/**
 * PUBLICLY EXPORTED function to get the correctly configured storage provider.
 */
export const getStorageProvider = getConfiguredStorageProvider;

/**
 * Change from 'let' to 'declare global' for true singleton in Node/Vercel Serverless
 */
declare global {
  var __orchestrationManagerInstance: OrchestrationManager | null | undefined;
}

/**
 * Gets or creates the orchestration manager instance.
 * 
 * Ensures a single instance is used across the server process and configured correctly
 * with the storage provider determined by the environment.
 * 
 * @returns The orchestration manager instance
 */
export function getOrchestrationManagerInstance(): OrchestrationManager {
  // If an instance already exists globally, return it.
  if (globalThis.__orchestrationManagerInstance) {
    return globalThis.__orchestrationManagerInstance;
  }

  // Create a new instance and store it globally.
  logger.info(LogCategory.API, 'OrchestrationAdapter', 'Creating SINGLETON OrchestrationManager instance');
  
  // Get the storage provider based on environment config
  const storageProvider = getConfiguredStorageProvider();

  // --- Configure TTL --- 
  // agentdock-core OrchestrationStateManager has a default TTL (e.g., 30 mins).
  // We allow overriding this via the SESSION_TTL_SECONDS environment variable.
  let sessionTtlMs: number | undefined = undefined;
  const ttlSecondsEnv = process.env.SESSION_TTL_SECONDS;
  if (ttlSecondsEnv) {
    const parsedTtl = parseInt(ttlSecondsEnv, 10);
    if (!isNaN(parsedTtl) && parsedTtl > 0) {
      sessionTtlMs = parsedTtl * 1000;
      logger.info(LogCategory.API, 'OrchestrationAdapter', 
        `Using custom session TTL from env: ${parsedTtl} seconds`);
    } else {
      logger.warn(LogCategory.API, 'OrchestrationAdapter', 
        `Invalid SESSION_TTL_SECONDS value: ${ttlSecondsEnv}. Using core default TTL.`);
    }
  }
  // --- End Configure TTL ---

  const newInstance = createOrchestrationManager({
      storageProvider: storageProvider, 
      // Pass the configured TTL (or undefined to let core use its default)
      cleanup: { 
        // Keep cleanup disabled by default in adapter, core handles TTL via SessionManager
        enabled: false, 
        ttlMs: sessionTtlMs 
      }
  });

  globalThis.__orchestrationManagerInstance = newInstance;
  return newInstance;
}

/**
 * Gets orchestration state for a session
 * 
 * @param sessionId - The session ID to get state for
 * @param config - Optional orchestration config (currently unused by core getState)
 * @returns The orchestration state or null
 */
export async function getOrchestrationState(
  sessionId: SessionId,
  config?: OrchestrationConfig
): Promise<AIOrchestrationState | null> {
  if (!sessionId) {
    return null;
  }
  
  try {
    const manager = getOrchestrationManagerInstance();
    
    const state = await manager.getState(sessionId);
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug(
          LogCategory.API,
          'OrchestrationAdapter', 
          'Retrieved state via core manager', 
          { state: state ? JSON.stringify(state) : 'null' }
      );
    }
    
    return state;
  } catch (error) {
    logger.error(LogCategory.API, 'OrchestrationAdapter', 'Error getting orchestration state', { 
        error: error instanceof Error ? error.message : String(error),
        sessionId
    });
    return { sessionId, recentlyUsedTools: [] };
  }
}

/**
 * Tracks tool usage for orchestration
 * 
 * @param sessionId - The session ID
 * @param toolName - The tool that was used
 * @param config - Orchestration config (passed to processToolUsage)
 * @returns Updated orchestration state (AI-facing subset)
 */
export async function trackToolUsage(
  sessionId: SessionId,
  toolName: string,
  config: OrchestrationConfig,
  messages: Message[] = []
): Promise<AIOrchestrationState | null> {
  if (!sessionId || !toolName) {
    return null;
  }
  
  try {
    const manager = getOrchestrationManagerInstance();
    
    const llmMessages: LLMMessage[] = convertCoreToLLMMessages(messages);

    await manager.processToolUsage(config, llmMessages, sessionId, toolName);

    const updatedState = await manager.getState(sessionId);
    logger.debug(LogCategory.API, 'OrchestrationAdapter', 'Tracked tool usage via core manager', { toolName, updatedState });
    return updatedState;

  } catch (error) {
    logger.error(LogCategory.API, 'OrchestrationAdapter', 'Error tracking tool usage', { 
        error: error instanceof Error ? error.message : String(error),
        sessionId,
        toolName 
    });
    try {
        const state = await getOrchestrationManagerInstance().getState(sessionId);
        return state ?? { sessionId, recentlyUsedTools: [toolName] };
    } catch (innerError) {
        return { sessionId, recentlyUsedTools: [toolName] };
    }
  }
}

/**
 * Gets active step for a session
 * 
 * @param config - The orchestration config
 * @param messages - Current conversation messages
 * @param sessionId - The session ID
 * @returns Active step info or null
 */
export async function getActiveStep(
  config: OrchestrationConfig,
  messages: Message[],
  sessionId: SessionId
): Promise<{ name: string; index: number } | null> {
  if (!sessionId || !config?.steps?.length) {
    return null;
  }
  
  try {
    const manager = getOrchestrationManagerInstance();
    
    const llmMessages: LLMMessage[] = convertCoreToLLMMessages(messages);

    const step = await manager.getActiveStep(config, llmMessages, sessionId);
    if (!step) {
      return null;
    }
    
    return {
      name: step.name,
      index: config.steps?.findIndex(s => s.name === step.name) ?? -1 
    };
  } catch (error) {
    logger.error(LogCategory.API, 'OrchestrationAdapter', 'Error getting active step', { 
        error: error instanceof Error ? error.message : String(error),
        sessionId 
    });
    return null;
  }
}

/**
 * Gets allowed tools for a session
 * 
 * @param sessionId - The session ID
 * @param config - The orchestration config
 * @param allTools - All available tools
 * @param messages - Current conversation messages
 * @returns Filtered list of allowed tools
 */
export async function getAllowedTools(
  sessionId: SessionId,
  config: OrchestrationConfig,
  allTools: string[],
  messages: Message[] = []
): Promise<string[]> {
  if (!sessionId || !config?.steps?.length) {
    return allTools;
  }
  
  try {
    const manager = getOrchestrationManagerInstance();
    
    const llmMessages: LLMMessage[] = convertCoreToLLMMessages(messages);
    
    return await manager.getAllowedTools(config, llmMessages, sessionId, allTools);
  } catch (error) {
    logger.error(LogCategory.API, 'OrchestrationAdapter', 'Error getting allowed tools', { 
        error: error instanceof Error ? error.message : String(error),
        sessionId 
    });
    return allTools;
  }
}

/**
 * Adds orchestration headers to a response
 * 
 * @param response - The Next.js response
 * @param sessionId - The session ID
 * @returns The response with added headers
 */
export async function addOrchestrationHeaders(
  response: NextResponse,
  sessionId: SessionId
): Promise<NextResponse> {
  if (!sessionId) {
    return response;
  }
  
  response.headers.set('x-session-id', sessionId);
  
  try {
    const manager = getOrchestrationManagerInstance();
    const state = await manager.getState(sessionId);
    
    if (state) {
      const headerState: AIOrchestrationState = {
          sessionId: state.sessionId,
          recentlyUsedTools: state.recentlyUsedTools,
          activeStep: state.activeStep,
          sequenceIndex: state.sequenceIndex
      };
      response.headers.set('x-orchestration-state', JSON.stringify(headerState));
      if (process.env.NODE_ENV === 'development') {
          logger.debug(LogCategory.API, 'OrchestrationAdapter', 'Setting header state', { headerState });
      }
    } else {
      response.headers.set(
        'x-orchestration-state', 
        JSON.stringify({ sessionId, recentlyUsedTools: [] })
      );
       logger.debug(LogCategory.API, 'OrchestrationAdapter', 'Setting minimal fallback header state', { sessionId });
    }
  } catch (error) {
    logger.error(LogCategory.API, 'OrchestrationAdapter', 'Error adding orchestration headers', { 
        error: error instanceof Error ? error.message : String(error),
        sessionId 
    });
    response.headers.set(
      'x-orchestration-state', 
      JSON.stringify({ sessionId, recentlyUsedTools: [] })
    );
  }
  
  return response;
}

/**
 * Resets orchestration state for a session
 */
export async function resetOrchestrationState(sessionId: SessionId): Promise<void> {
  if (!sessionId) return;
  
  try {
    const manager = getOrchestrationManagerInstance();
    await manager.resetState(sessionId);
    logger.debug(LogCategory.API, 'OrchestrationAdapter', 'Reset orchestration state requested via adapter', { sessionId });
  } catch (error) {
    logger.error(LogCategory.API, 'OrchestrationAdapter', 'Error resetting orchestration state', { 
        error: error instanceof Error ? error.message : String(error),
        sessionId 
    });
  }
}

/**
 * Converts a read-only template config to a mutable form
 * so it can be used with the orchestration manager
 */
export function toMutableConfig(config: TemplateOrchestrationConfig): any {
  if (!config || !config.steps) return { steps: [] };
  
  return {
    description: config.description,
    steps: config.steps.map(step => ({
      name: step.name,
      description: step.description,
      isDefault: step.isDefault,
      conditions: step.conditions ? 
        step.conditions.map(condition => ({ 
          type: condition.type, 
          ...(condition.value !== undefined && { value: condition.value })
        })) : [],
      sequence: step.sequence ? [...step.sequence] : [],
      availableTools: step.availableTools ? {
        allowed: step.availableTools.allowed ? 
          [...step.availableTools.allowed] : undefined,
        denied: step.availableTools.denied ? 
          [...step.availableTools.denied] : undefined
      } : undefined
    }))
  };
} 