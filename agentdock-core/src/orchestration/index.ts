/**
 * @fileoverview Simplified orchestration for AgentDock.
 * 
 * This module provides orchestration for AI agents with conditional tool filtering,
 * step-based logic, and efficient state management with configurable cleanup.
 */

import { logger, LogCategory } from '../logging';
import { 
  OrchestrationConfig, 
  OrchestrationStep,
  OrchestrationCondition,
  AIOrchestrationState
} from '../types/orchestration';
import { LLMMessage } from '../llm/types';
import { SessionId } from '../types/session';

// Export other modules
export * from './state';
export * from './sequencer';

// Import internal components
import { 
  OrchestrationStateManager, 
  createOrchestrationStateManager,
  CleanupOptions,
  OrchestrationState,
  OrchestrationStateManagerOptions
} from './state';
import { StepSequencer, createStepSequencer } from './sequencer';

/**
 * Context for tool filtering
 */
export interface ToolContext {
  /** Recently used tools */
  recentlyUsedTools: string[];
}

/**
 * Options for configuring the orchestration manager
 */
export interface OrchestrationManagerOptions extends OrchestrationStateManagerOptions {
  // Removed lightweight option
  // Cleanup options are now part of OrchestrationStateManagerOptions
}

/**
 * Simplified orchestration manager
 */
export class OrchestrationManager {
  private stateManager: OrchestrationStateManager;
  private sequencer: StepSequencer;
  // private lightweight: boolean; // Removed
  
  /**
   * Creates a new orchestration manager
   */
  constructor(options: OrchestrationManagerOptions = {}) {
    // Create state manager with passed options (storage, cleanup, etc.)
    this.stateManager = createOrchestrationStateManager(options); // Updated
    
    this.sequencer = createStepSequencer(this.stateManager);
    // this.lightweight = !!options.lightweight; // Removed
    
    logger.debug(
      LogCategory.ORCHESTRATION,
      'OrchestrationManager',
      'Initialized (persistent state)', // Updated log
      { /* Removed lightweight log */ }
    );
  }
  
  /**
   * Gets the active step based on conditions
   */
  public async getActiveStep( // Changed to async
    orchestration: OrchestrationConfig,
    messages: LLMMessage[],
    sessionId: SessionId
  ): Promise<OrchestrationStep | undefined> { // Changed to Promise
    // If no orchestration, return undefined
    if (!orchestration?.steps?.length) return undefined;
    
    logger.debug(LogCategory.ORCHESTRATION, 'getActiveStep', 'Starting step evaluation', { sessionId }); // Log Start

    // Get state using the async state manager method
    const state = await this.stateManager.getOrCreateState(sessionId); // Changed to await + getOrCreateState
    if (!state) {
        logger.warn(LogCategory.ORCHESTRATION, 'getActiveStep', 'Failed to get or create state', { sessionId });
        return undefined; // Cannot proceed without state
    }
    
    logger.debug(LogCategory.ORCHESTRATION, 'getActiveStep', 'Retrieved state', { 
        sessionId, 
        activeStep: state.activeStep,
        recentlyUsedTools: state.recentlyUsedTools 
    }); // Log retrieved state
    
    // Create tool context
    const toolContext: ToolContext = {
      recentlyUsedTools: state?.recentlyUsedTools || []
    };
    
    // Check each step (prioritize non-default steps with conditions)
    for (const step of orchestration.steps) {
        if (step.conditions?.length && !step.isDefault) {
            logger.debug(LogCategory.ORCHESTRATION, 'getActiveStep', 'Checking conditions for step', { sessionId, stepName: step.name }); // Log checking step
      let allConditionsMet = true;
      for (const condition of step.conditions) {
                const conditionMet = this.checkCondition(condition, toolContext);
                logger.debug(LogCategory.ORCHESTRATION, 'getActiveStep', 'Condition check result', { sessionId, stepName: step.name, conditionType: condition.type, conditionValue: condition.value, conditionMet }); // Log condition check
                if (!conditionMet) { 
          allConditionsMet = false;
          break;
        }
      }
      
      // If all conditions met, activate this step
      if (allConditionsMet) {
                logger.debug(LogCategory.ORCHESTRATION, 'getActiveStep', 'All conditions met for step', { sessionId, stepName: step.name }); // Log conditions met
                if (state.activeStep !== step.name) {
                    logger.info(LogCategory.ORCHESTRATION, 'getActiveStep', 'Transitioning active step', { sessionId, fromStep: state.activeStep, toStep: step.name }); // Log transition
                    await this.stateManager.setActiveStep(sessionId, step.name); // Changed to await
                } else {
                    logger.debug(LogCategory.ORCHESTRATION, 'getActiveStep', 'Conditions met, but step is already active', { sessionId, stepName: step.name }); // Log already active
        }
        return step;
      }
        }
    }
    
    // If no transition occurred, check if the current step in state is still valid
    if (state.activeStep) {
        const currentStepInConfig = orchestration.steps.find(s => s.name === state.activeStep);
        if (currentStepInConfig) {
            logger.debug(LogCategory.ORCHESTRATION, 'getActiveStep', 'No transition conditions met, returning current step from state', { sessionId, stepName: state.activeStep }); // Log returning current
            return currentStepInConfig;
        }
         logger.warn(LogCategory.ORCHESTRATION, 'getActiveStep', 'Active step in state not found in config, falling back to default', { sessionId, invalidStep: state.activeStep });
    }
    
    // Find default step if needed
    const defaultStep = orchestration.steps.find(step => step.isDefault);
    if (defaultStep) {
        logger.debug(LogCategory.ORCHESTRATION, 'getActiveStep', 'Falling back to default step', { sessionId, defaultStepName: defaultStep.name }); // Log falling back to default
        if (state.activeStep !== defaultStep.name) {
             await this.stateManager.setActiveStep(sessionId, defaultStep.name); // Changed to await
      }
      return defaultStep;
    }
    
    logger.warn(LogCategory.ORCHESTRATION, 'getActiveStep', 'No active or default step found', { sessionId }); // Log no step found
    return undefined;
  }
  
  /**
   * Checks if a condition is met (remains synchronous)
   */
  private checkCondition(
    condition: OrchestrationCondition,
    toolContext?: ToolContext
  ): boolean {
    switch (condition.type) {
      case 'tool_used':
        return toolContext?.recentlyUsedTools.includes(condition.value) || false;
      
      default:
        // Potentially add more condition types here if needed
        logger.warn(LogCategory.ORCHESTRATION, 'OrchestrationManager', 'Unsupported condition type', { type: (condition as any).type });
        return false;
    }
  }
  
  /**
   * Gets allowed tools for the current step
   */
  public async getAllowedTools( // Changed to async
    orchestration: OrchestrationConfig,
    messages: LLMMessage[],
    sessionId: SessionId,
    allToolIds: string[]
  ): Promise<string[]> { // Changed to Promise
    // If no orchestration, return all tools
    if (!orchestration?.steps?.length) return allToolIds;
    
    // Get active step using the async method
    const activeStep = await this.getActiveStep(orchestration, messages, sessionId); // Changed to await
    
    // If no active step, return all tools
    if (!activeStep) return allToolIds;
    
    // Apply sequence filtering (sequencer methods might need to become async too if they touch state)
    // Assuming sequencer.filterToolsBySequence remains sync for now, check its implementation.
    // If sequencer needs state, pass sessionId and let it call stateManager async methods.
    if (activeStep.sequence?.length) {
      // Assuming filterToolsBySequence is synchronous or adapted internally
      return this.sequencer.filterToolsBySequence(activeStep, sessionId, allToolIds);
    }
    
    // Filter based on allowed/denied lists (synchronous logic)
    if (activeStep.availableTools?.allowed && activeStep.availableTools.allowed.length > 0) {
      return allToolIds.filter(toolId => {
        return activeStep.availableTools?.allowed?.includes(toolId) || false;
      });
    }
    
    if (activeStep.availableTools?.denied && activeStep.availableTools.denied.length > 0) {
      return allToolIds.filter(toolId => {
        return !activeStep.availableTools?.denied?.includes(toolId);
      });
    }
    
    // Default - return all tools
    return allToolIds;
  }
  
  /**
   * Processes a tool usage event
   */
  public async processToolUsage( // Changed to async
    orchestration: OrchestrationConfig,
    messages: LLMMessage[],
    sessionId: SessionId,
    toolName: string
  ): Promise<void> { // Changed to Promise
    // Get active step
    const activeStep = await this.getActiveStep(orchestration, messages, sessionId); // Changed to await
    
    // Skip if no active step
    if (!activeStep) return;
    
    // Process tools through the sequencer (sequencer methods might need async)
    // Assuming sequencer.processTool remains sync or adapted internally
    await this.sequencer.processTool(activeStep, sessionId, toolName); 

    // --- BEGIN FIX: Re-evaluate active step after tool usage is processed ---
    // REMOVED: await this.getActiveStep(orchestration, messages, sessionId);
    // --- END FIX ---
  }
  
  /**
   * Gets the orchestration state (AI-facing subset)
   */
  public async getState(sessionId: SessionId): Promise<AIOrchestrationState | null> { // Changed to async Promise
    // Removed lightweight check
    // Directly use the async state manager method
    return this.stateManager.toAIOrchestrationState(sessionId); // Changed to await (method is async)
  }
  
  /**
   * Ensures that a state record exists for the given session ID.
   * Calls the underlying state manager's method to get or create the state.
   * Useful for ensuring session presence even for non-orchestrated agents.
   */
  public async ensureStateExists(sessionId: SessionId): Promise<void> {
    if (!sessionId) return;
    try {
      await this.stateManager.getOrCreateState(sessionId);
      logger.debug(LogCategory.ORCHESTRATION, 'OrchestrationManager', 'Ensured state exists for session', { sessionId: sessionId?.substring(0, 8) + '...' });
    } catch (error) {
      logger.error(LogCategory.ORCHESTRATION, 'OrchestrationManager', 'Error ensuring state exists', {
        sessionId: sessionId?.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error)
      });
      // Decide if we should re-throw or just log
    }
  }
  
  /**
   * Updates parts of the orchestration state
   *
   * @param sessionId The session ID
   * @param partial The partial AI-facing state to update (e.g., { cumulativeTokenUsage: ... })
   * @returns The full updated state (AI-facing subset) or null if update failed
   */
  public async updateState(sessionId: SessionId, partial: Partial<AIOrchestrationState>): Promise<AIOrchestrationState | null> { 
    if (!sessionId) return null;
    
    logger.debug(LogCategory.ORCHESTRATION, 'OrchestrationManager', 'Updating state', { 
        sessionId: sessionId?.substring(0, 8) + '...', 
        keysToUpdate: Object.keys(partial) 
    });
    
    // Map the AI-facing partial state to the internal OrchestrationState structure
    const internalUpdates: Partial<Omit<OrchestrationState, 'sessionId'>> = {};
    if (partial.activeStep !== undefined) internalUpdates.activeStep = partial.activeStep;
    if (partial.sequenceIndex !== undefined) internalUpdates.sequenceIndex = partial.sequenceIndex;
    if (partial.recentlyUsedTools !== undefined) internalUpdates.recentlyUsedTools = partial.recentlyUsedTools;
    if (partial.cumulativeTokenUsage !== undefined) internalUpdates.cumulativeTokenUsage = partial.cumulativeTokenUsage;
    
    // Add lastAccessed timestamp update automatically
    internalUpdates.lastAccessed = Date.now();
    
    try {
      // Call the underlying state manager's update method
      const updatedFullState = await this.stateManager.updateState(sessionId, internalUpdates); // Uses the state manager's update method

      // Convert back to AIOrchestrationState for the return type
      if (updatedFullState) {
          logger.debug(LogCategory.ORCHESTRATION, 'OrchestrationManager', 'State update successful', { 
              sessionId: sessionId?.substring(0, 8) + '...', 
              updatedKeys: Object.keys(partial) 
          });
          return {
              sessionId: updatedFullState.sessionId,
              recentlyUsedTools: updatedFullState.recentlyUsedTools,
              activeStep: updatedFullState.activeStep,
              sequenceIndex: updatedFullState.sequenceIndex,
              cumulativeTokenUsage: updatedFullState.cumulativeTokenUsage
          };
      } else {
          logger.error(LogCategory.ORCHESTRATION, 'OrchestrationManager', 'State update failed (stateManager.updateState returned null)', { 
              sessionId: sessionId?.substring(0, 8) + '...'
          });
          return null;
      }
    } catch (error) {
        logger.error(LogCategory.ORCHESTRATION, 'OrchestrationManager', 'Error during state update', { 
            sessionId: sessionId?.substring(0, 8) + '...',
            error: error instanceof Error ? error.message : String(error) 
        });
        return null;
    }
  }
  
  /**
   * Resets the state for a session
   */
  public async resetState(sessionId: SessionId): Promise<void> { // Changed to async Promise<void>
    // Removed lightweight check
    await this.stateManager.resetState(sessionId); // Changed to await
  }
  
  /**
   * Removes a session and its state
   */
  public async removeSession(sessionId: SessionId): Promise<void> { // Changed to async Promise<void>
    // Removed lightweight check
    await this.stateManager.cleanupSession(sessionId); // Changed to await
  }
}

/**
 * Creates an orchestration manager
 */
export function createOrchestrationManager(
  options?: OrchestrationManagerOptions // Uses extended options
): OrchestrationManager {
  return new OrchestrationManager(options);
}

// Removed createLightweightOrchestrationManager as it's redundant now 