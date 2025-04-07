/**
 * @fileoverview Simplified orchestration state management for AgentDock.
 *
 * This file implements a session-scoped orchestration state manager
 * with optimized memory usage and configurable cleanup.
 */

import { logger, LogCategory } from '../logging';
import { 
  AIOrchestrationState,
  OrchestrationConfig
} from '../types/orchestration';
import { SessionId, SessionState } from '../types/session';
import { SessionManager } from '../session';
import { StorageProvider } from '../storage/types';
import { getStorageFactory } from '../storage/factory';

/**
 * Extended orchestration state that includes tool sequence tracking
 */
export interface OrchestrationState extends SessionState, AIOrchestrationState {
  /** The active orchestration step */
  activeStep?: string;
  
  /** Recently used tools in this session */
  recentlyUsedTools: string[];
  
  /** Current position in tool sequence, if applicable */
  sequenceIndex?: number;
  
  /** When this state was last accessed (timestamp) */
  lastAccessed: number;
  
  /** TTL (time-to-live) in milliseconds */
  ttl: number;

  /** Cumulative token usage for the session */
  cumulativeTokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Configuration options for cleanup behavior
 */
export interface CleanupOptions {
  /** Whether cleanup is enabled */
  enabled: boolean;
  
  /** TTL in milliseconds (default: 30 minutes) */
  ttlMs?: number;
  
  /** Cleanup interval in milliseconds (default: 5 minutes) */
  intervalMs?: number;
  
  /** Maximum number of sessions to keep (removes oldest first) */
  maxSessions?: number;
}

/**
 * Options for configuring the OrchestrationStateManager
 */
export interface OrchestrationStateManagerOptions {
  /** Cleanup configuration */
  cleanup?: Partial<CleanupOptions>;
  /** Optional storage provider instance */
  storageProvider?: StorageProvider;
  /** Optional namespace for storage keys */
  storageNamespace?: string;
}

/**
 * Default values for state management
 */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (changed from 30 minutes)
const DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Creates a default state object
 */
function createDefaultState(sessionId: SessionId, ttl: number = DEFAULT_TTL_MS): OrchestrationState {
  return {
    sessionId,
    recentlyUsedTools: [],
    sequenceIndex: 0,
    lastAccessed: Date.now(),
    ttl,
    cumulativeTokenUsage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    }
  };
}

/**
 * Orchestration state manager with optimized memory usage
 */
export class OrchestrationStateManager {
  private static instance: OrchestrationStateManager | null = null;
  private sessionManager: SessionManager<OrchestrationState>;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cleanupOptions: CleanupOptions;
  private storageNamespace: string;
  
  /**
   * Creates a new state manager with the specified options
   */
  constructor(options: OrchestrationStateManagerOptions = {}) {
    // Configure cleanup with defaults
    this.cleanupOptions = {
      enabled: false,  // Default to disabled for performance
      ttlMs: DEFAULT_TTL_MS,
      intervalMs: DEFAULT_CLEANUP_INTERVAL_MS,
      ...options.cleanup
    };
    
    // Define storage namespace
    this.storageNamespace = options.storageNamespace || 'orchestration-state';

    // Get or create storage provider
    const storageProvider = options.storageProvider || getStorageFactory().getProvider({
        type: 'memory', // Default, can be configured
        namespace: this.storageNamespace
    });

    // Create session manager with state factory function and storage
    const stateFactory = (sessionId: SessionId) => 
      createDefaultState(sessionId, this.cleanupOptions.ttlMs);
      
    this.sessionManager = new SessionManager<OrchestrationState>(
        stateFactory, 
        storageProvider, 
        this.storageNamespace,
        { defaultTtlMs: this.cleanupOptions.ttlMs } // Pass configured/default TTL
    );
    
    // Only start cleanup timer if enabled
    if (this.cleanupOptions.enabled) {
      this.startCleanupTimer();
      logger.debug(
        LogCategory.ORCHESTRATION,
        'OrchestrationStateManager',
        'Initialized with automated cleanup (async storage)',
        {
          ttlMs: this.cleanupOptions.ttlMs,
          intervalMs: this.cleanupOptions.intervalMs,
          maxSessions: this.cleanupOptions.maxSessions,
          storageNamespace: this.storageNamespace
        }
      );
    } else {
      logger.debug(
        LogCategory.ORCHESTRATION,
        'OrchestrationStateManager',
        'Initialized without automated cleanup (async storage)',
        { storageNamespace: this.storageNamespace }
      );
    }
  }
  
  /**
   * Gets the singleton instance (backwards compatibility)
   * @deprecated Use createOrchestrationStateManager() instead
   */
  public static getInstance(): OrchestrationStateManager {
    logger.warn(
        LogCategory.ORCHESTRATION,
        'OrchestrationStateManager',
        'getInstance() is deprecated and may not use configured storage. Use createOrchestrationStateManager().'
    );
    if (!OrchestrationStateManager.instance) {
      OrchestrationStateManager.instance = new OrchestrationStateManager();
    }
    return OrchestrationStateManager.instance;
  }
  
  /**
   * Starts the cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    const cleanupIntervalMs = this.cleanupOptions.intervalMs || DEFAULT_CLEANUP_INTERVAL_MS;
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupExpiredStates();
      } catch (error) {
        logger.error(
          LogCategory.ORCHESTRATION,
          'OrchestrationStateManager',
          'Error during cleanup',
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }
    }, cleanupIntervalMs);
    
    // Ensure timer doesn't prevent Node from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
  
  /**
   * Stops the cleanup timer
   */
  public stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  /**
   * Removes expired states (Requires provider support or specific implementation)
   * @returns Number of states removed (estimation, as actual removal is async)
   */
  public async cleanupExpiredStates(): Promise<number> {
    logger.warn(
        LogCategory.ORCHESTRATION,
        'OrchestrationStateManager',
        'cleanupExpiredStates relies on SessionManager/StorageProvider TTL handling. Direct cleanup logic here is complex and likely unnecessary.'
    );
    // The actual cleanup logic is now primarily handled by the SessionManager's 
    // setupCleanupInterval and its interaction with the StorageProvider's TTL.
    // Direct iteration and check here is inefficient and might conflict.
    // We might need a way for SessionManager to report cleanup stats if needed.
    
    // Placeholder: Return 0 as direct cleanup isn't performed here anymore.
    return 0;
  }
  
  /**
   * Removes state for a specific session
   */
  public async cleanupSession(sessionId: SessionId): Promise<void> {
    try {
      await this.sessionManager.deleteSession(sessionId);
      logger.debug(
        LogCategory.ORCHESTRATION,
        'OrchestrationStateManager',
        'Cleaned up session state from storage',
        { sessionId }
      );
    } catch (error) {
      logger.error(
        LogCategory.ORCHESTRATION,
        'OrchestrationStateManager',
        'Error cleaning up session state',
        { sessionId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }
  
  /**
   * Gets the orchestration state for a session
   */
  public async getState(sessionId: SessionId): Promise<OrchestrationState | null> {
    // Use the session manager to get the state
    const result = await this.sessionManager.getSession(sessionId);
    
    // Check if the operation was successful and data exists
    if (result.success && result.data) {
      // Return the data (which is of type OrchestrationState)
      return result.data;
    }
    // If not successful or no data, return null
    return null;
  }
  
  /**
   * Gets or creates the orchestration state for a session
   */
  public async getOrCreateState(sessionId?: SessionId, config?: OrchestrationConfig): Promise<OrchestrationState | null> {
    const targetSessionId = sessionId || '';
    
    if (!targetSessionId) {
        logger.warn(LogCategory.ORCHESTRATION, 'OrchestrationStateManager', 'getOrCreateState called without sessionId');
        const creationResult = await this.sessionManager.createSession();
        if (creationResult.success && creationResult.data) {
            return creationResult.data;
        } else {
            logger.error(LogCategory.ORCHESTRATION, 'OrchestrationStateManager', 'Failed to create session for getOrCreateState', { error: creationResult.error });
      return null;
    }
    }

    let state = await this.getState(targetSessionId);
    
    if (!state) {
      try {
        const creationResult = await this.sessionManager.createSession({ sessionId: targetSessionId });
        if (creationResult.success && creationResult.data) {
          state = creationResult.data;
        } else {
            logger.error(
                LogCategory.ORCHESTRATION, 
                'OrchestrationStateManager', 
                'Failed to create session in getOrCreateState',
                { sessionId: targetSessionId, error: creationResult.error }
            );
            return null;
        }
      } catch (error) {
        logger.error(
          LogCategory.ORCHESTRATION, 
          'OrchestrationStateManager', 
          'Error creating session state',
          { sessionId: targetSessionId, error: error instanceof Error ? error.message : 'Unknown error' }
        );
      return null;
    }
    }
    
    return state;
  }
  
  /**
   * Updates parts of the orchestration state
   */
  public async updateState(
    sessionId: SessionId,
    updates: Partial<Omit<OrchestrationState, 'sessionId'>>
  ): Promise<OrchestrationState | null> {
    const updateFn = (currentState: OrchestrationState): OrchestrationState => {
        const newUpdates = { ...updates, lastAccessed: Date.now() };
        return { ...currentState, ...newUpdates };
    };
    
    const result = await this.sessionManager.updateSession(sessionId, updateFn);
    
    if (result.success && result.data) {
      return result.data;
    } else {
      logger.error(
        LogCategory.ORCHESTRATION, 
        'OrchestrationStateManager', 
        'Failed to update state via session manager',
        { sessionId, error: result.error }
      );
      return null;
    }
  }
  
  /**
   * Sets the active step in the orchestration state
   */
  public async setActiveStep(
    sessionId: SessionId,
    stepName: string | undefined
  ): Promise<OrchestrationState | null> {
    logger.debug(
      LogCategory.ORCHESTRATION,
      'OrchestrationStateManager',
      'Setting active step',
      { sessionId: sessionId?.substring(0, 8) + '...', step: stepName }
    );
    const result = await this.updateState(sessionId, { activeStep: stepName });

    // --- BEGIN LOGGING ---
    if (result) {
        logger.debug(
            LogCategory.ORCHESTRATION,
            'OrchestrationStateManager',
            'Successfully updated active step in state',
            { sessionId: sessionId?.substring(0, 8) + '...', activeStep: result.activeStep, recentlyUsedTools: result.recentlyUsedTools }
        );
    } else {
        logger.error(
            LogCategory.ORCHESTRATION,
            'OrchestrationStateManager',
            'Failed to update active step in state (updateState returned null)',
            { sessionId: sessionId?.substring(0, 8) + '...', stepAttempted: stepName }
        );
    }
    // --- END LOGGING ---

    return result;
  }
  
  /**
   * Adds a tool to the recently used list
   */
  public async addUsedTool(
    sessionId: SessionId,
    toolName: string
  ): Promise<OrchestrationState | null> {
    const state = await this.getState(sessionId);
    if (!state) return null;
    
    const updatedTools = [
      toolName, 
      ...(state.recentlyUsedTools || []).filter(t => t !== toolName)
    ].slice(0, 10);
    
    return this.updateState(sessionId, { recentlyUsedTools: updatedTools });
  }
  
  /**
   * Advances the sequence index in the state
   */
  public async advanceSequence(
    sessionId: SessionId
  ): Promise<OrchestrationState | null> {
    const state = await this.getState(sessionId);
    if (!state) return null;
    
    const newIndex = (state.sequenceIndex ?? -1) + 1;
    return this.updateState(sessionId, { sequenceIndex: newIndex });
  }
  
  /**
   * Resets the orchestration state for a session (by deleting and letting it recreate)
   */
  public async resetState(sessionId: SessionId): Promise<OrchestrationState | null> {
    await this.cleanupSession(sessionId);
    logger.debug(LogCategory.ORCHESTRATION, 'OrchestrationStateManager', 'Reset state requested', { sessionId });
    return null;
  }
  
  /**
   * Converts the full OrchestrationState to the AI-facing AIOrchestrationState
   */
  public async toAIOrchestrationState(sessionId: SessionId): Promise<AIOrchestrationState | null> {
    // Get the full internal state object using the existing getState method
    const state: OrchestrationState | null = await this.getState(sessionId);
    
    if (!state) {
      // If state is null, return null
      return null;
    }
    
    // Perform the conversion using the fetched state,
    // ensuring cumulativeTokenUsage is included
    return {
      sessionId: state.sessionId,
      recentlyUsedTools: state.recentlyUsedTools || [],
      activeStep: state.activeStep,
      sequenceIndex: state.sequenceIndex,
      cumulativeTokenUsage: state.cumulativeTokenUsage // Make sure this is included
    };
  }
}

/**
 * Factory function to create an OrchestrationStateManager instance
 */
export function createOrchestrationStateManager(
  options: OrchestrationStateManagerOptions = {}
): OrchestrationStateManager {
  return new OrchestrationStateManager(options);
} 