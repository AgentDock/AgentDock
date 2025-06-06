/**
 * @fileoverview Simplified orchestration for AgentDock.
 *
 * This module provides orchestration for AI agents with conditional tool filtering,
 * step-based logic, and efficient state management with configurable cleanup.
 */

import { LLMMessage } from '../llm/types';
import { LogCategory, logger } from '../logging';
import {
  AIOrchestrationState,
  OrchestrationCondition,
  OrchestrationConfig,
  OrchestrationStep
} from '../types/orchestration';
import { SessionId } from '../types/session';
import { createStepSequencer, StepSequencer } from './sequencer';
// Import internal components
import {
  CleanupOptions,
  createOrchestrationStateManager,
  OrchestrationState,
  OrchestrationStateManager,
  OrchestrationStateManagerOptions
} from './state';

// Export other modules
export * from './state';
export * from './sequencer';

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
export interface OrchestrationManagerOptions
  extends OrchestrationStateManagerOptions {
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
      {
        /* Removed lightweight log */
      }
    );
  }

  /**
   * NEW: Explicitly ensures a session state record exists.
   * Calls the underlying state manager's getOrCreateState.
   */
  public async ensureStateExists(
    sessionId: SessionId
  ): Promise<OrchestrationState | null> {
    logger.debug(
      LogCategory.ORCHESTRATION,
      'ensureStateExists',
      'Ensuring state exists for session',
      { sessionId }
    );
    try {
      // Directly call the state manager's method that handles creation
      const state = await this.stateManager.getOrCreateState(sessionId);
      logger.debug(
        LogCategory.ORCHESTRATION,
        'ensureStateExists',
        'State ensured/retrieved',
        { sessionId, stateExists: !!state }
      );
      return state;
    } catch (error) {
      logger.error(
        LogCategory.ORCHESTRATION,
        'ensureStateExists',
        'Error ensuring state exists',
        {
          sessionId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return null; // Return null on error
    }
  }

  /**
   * Gets the active step based on conditions
   */
  public async getActiveStep(
    // Changed to async
    orchestration: OrchestrationConfig,
    messages: LLMMessage[],
    sessionId: SessionId
  ): Promise<OrchestrationStep | undefined> {
    // Changed to Promise
    // If no orchestration, return undefined
    if (!orchestration?.steps?.length) return undefined;

    logger.debug(
      LogCategory.ORCHESTRATION,
      'getActiveStep',
      'Starting step evaluation',
      { sessionId }
    ); // Log Start

    // Get state using the async state manager method
    const state = await this.stateManager.getOrCreateState(sessionId); // Changed to await + getOrCreateState
    if (!state) {
      logger.warn(
        LogCategory.ORCHESTRATION,
        'getActiveStep',
        'Failed to get or create state',
        { sessionId }
      );
      return undefined; // Cannot proceed without state
    }

    logger.debug(
      LogCategory.ORCHESTRATION,
      'getActiveStep',
      'Retrieved state',
      {
        sessionId,
        activeStep: state.activeStep,
        recentlyUsedTools: state.recentlyUsedTools
      }
    ); // Log retrieved state

    // Create tool context
    const toolContext: ToolContext = {
      recentlyUsedTools: state?.recentlyUsedTools || []
    };

    // Check each step (prioritize non-default steps with conditions)
    for (const step of orchestration.steps) {
      if (step.conditions?.length && !step.isDefault) {
        logger.debug(
          LogCategory.ORCHESTRATION,
          'getActiveStep',
          'Checking conditions for step',
          { sessionId, stepName: step.name }
        ); // Log checking step
        let allConditionsMet = true;
        for (const condition of step.conditions) {
          // Pass the step to checkCondition
          const conditionMet = this.checkCondition(
            condition,
            toolContext,
            step
          );
          logger.debug(
            LogCategory.ORCHESTRATION,
            'getActiveStep',
            'Condition check result',
            {
              sessionId,
              stepName: step.name,
              conditionType: condition.type,
              conditionValue: condition.value,
              conditionMet
            }
          ); // Log condition check
          if (!conditionMet) {
            allConditionsMet = false;
            break;
          }
        }

        // If all conditions met, activate this step
        if (allConditionsMet) {
          logger.debug(
            LogCategory.ORCHESTRATION,
            'getActiveStep',
            'All conditions met for step',
            { sessionId, stepName: step.name }
          ); // Log conditions met
          if (state.activeStep !== step.name) {
            logger.info(
              LogCategory.ORCHESTRATION,
              'getActiveStep',
              'Transitioning active step',
              { sessionId, fromStep: state.activeStep, toStep: step.name }
            ); // Log transition
            // Also reset sequence index when transitioning to a new step
            await this.stateManager.updateState(sessionId, {
              activeStep: step.name,
              sequenceIndex: 0
            });
          } else {
            logger.debug(
              LogCategory.ORCHESTRATION,
              'getActiveStep',
              'Conditions met, but step is already active',
              { sessionId, stepName: step.name }
            ); // Log already active
          }
          return step;
        }
      }
    }

    // If no transition occurred, check if the current step in state is still valid
    if (state.activeStep) {
      const currentStepInConfig = orchestration.steps.find(
        (s) => s.name === state.activeStep
      );
      if (currentStepInConfig) {
        logger.debug(
          LogCategory.ORCHESTRATION,
          'getActiveStep',
          'No transition conditions met, returning current step from state',
          { sessionId, stepName: state.activeStep }
        ); // Log returning current
        return currentStepInConfig;
      }
      logger.warn(
        LogCategory.ORCHESTRATION,
        'getActiveStep',
        'Active step in state not found in config, falling back to default',
        { sessionId, invalidStep: state.activeStep }
      );
    }

    // Find default step if needed
    const defaultStep = orchestration.steps.find((step) => step.isDefault);
    if (defaultStep) {
      logger.debug(
        LogCategory.ORCHESTRATION,
        'getActiveStep',
        'Falling back to default step',
        { sessionId, defaultStepName: defaultStep.name }
      ); // Log falling back to default
      if (state.activeStep !== defaultStep.name) {
        // Also reset sequence index when falling back to default
        await this.stateManager.updateState(sessionId, {
          activeStep: defaultStep.name,
          sequenceIndex: 0
        });
      }
      return defaultStep;
    }

    logger.warn(
      LogCategory.ORCHESTRATION,
      'getActiveStep',
      'No active or default step found',
      { sessionId }
    ); // Log no step found
    return undefined;
  }

  /**
   * Checks if a condition is met (remains synchronous)
   */
  private checkCondition(
    condition: OrchestrationCondition,
    toolContext: ToolContext | undefined, // Made context optional for safety
    step: OrchestrationStep // Added step parameter
  ): boolean {
    const history = toolContext?.recentlyUsedTools || [];

    switch (condition.type) {
      case 'tool_used':
        // Keep original behavior: check if the specified tool exists anywhere in history
        // Consider changing this later to only check the *last* tool if needed for more precision
        // Check if condition.value is actually a string before passing to includes()
        if (typeof condition.value === 'string') {
          return history.includes(condition.value);
        }
        // If value is undefined (which shouldn't happen for tool_used based on Zod schema,
        // but TypeScript requires the check), the condition fails.
        return false;

      case 'sequence_match': {
        // New condition: check if the end of the history matches the step's sequence
        const sequence = step.sequence;
        if (!sequence || sequence.length === 0) {
          logger.warn(
            LogCategory.ORCHESTRATION,
            'checkCondition',
            'sequence_match condition used on step with no sequence',
            { stepName: step.name }
          );
          return false; // Cannot match if the step has no sequence defined
        }
        if (history.length < sequence.length) {
          return false; // History is too short to match the sequence
        }

        // Get the tail of the history matching the sequence length
        const historyTail = history.slice(-sequence.length);

        // Compare the tail with the sequence
        const match = sequence.every(
          (tool, index) => historyTail[index] === tool
        );

        logger.debug(
          LogCategory.ORCHESTRATION,
          'checkCondition',
          'Sequence match check',
          {
            stepName: step.name,
            sequence,
            historyTail,
            match
          }
        );
        return match;
      }

      default:
        // Potentially add more condition types here if needed
        logger.warn(
          LogCategory.ORCHESTRATION,
          'OrchestrationManager',
          'Unsupported condition type',
          { type: (condition as any).type }
        );
        return false;
    }
  }

  /**
   * Gets allowed tools for the current step
   */
  public async getAllowedTools(
    // Changed to async
    orchestration: OrchestrationConfig,
    messages: LLMMessage[],
    sessionId: SessionId,
    allToolIds: string[]
  ): Promise<string[]> {
    // Changed to Promise
    // If no orchestration, return all tools
    if (!orchestration?.steps?.length) return allToolIds;

    // Get active step using the async method
    const activeStep = await this.getActiveStep(
      orchestration,
      messages,
      sessionId
    ); // Changed to await

    // If no active step, return all tools
    if (!activeStep) return allToolIds;

    // Apply sequence filtering (sequencer methods might need to become async too if they touch state)
    // Assuming sequencer.filterToolsBySequence remains sync for now, check its implementation.
    // If sequencer needs state, pass sessionId and let it call stateManager async methods.
    if (activeStep.sequence?.length) {
      // Assuming filterToolsBySequence is synchronous or adapted internally
      return this.sequencer.filterToolsBySequence(
        activeStep,
        sessionId,
        allToolIds
      );
    }

    // Filter based on allowed/denied lists (synchronous logic)
    if (
      activeStep.availableTools?.allowed &&
      activeStep.availableTools.allowed.length > 0
    ) {
      return allToolIds.filter((toolId) => {
        return activeStep.availableTools?.allowed?.includes(toolId) || false;
      });
    }

    if (
      activeStep.availableTools?.denied &&
      activeStep.availableTools.denied.length > 0
    ) {
      return allToolIds.filter((toolId) => {
        return !activeStep.availableTools?.denied?.includes(toolId);
      });
    }

    // Default - return all tools
    return allToolIds;
  }

  /**
   * Processes a tool usage event
   */
  public async processToolUsage(
    // Changed to async
    orchestration: OrchestrationConfig,
    messages: LLMMessage[],
    sessionId: SessionId,
    toolName: string
  ): Promise<void> {
    // Changed to Promise
    // Get active step
    const activeStep = await this.getActiveStep(
      orchestration,
      messages,
      sessionId
    ); // Changed to await

    // Skip if no active step
    if (!activeStep) return;

    // Process tools through the sequencer (sequencer methods might need async)
    // Assuming sequencer.processTool remains sync or adapted internally
    await this.sequencer.processTool(activeStep, sessionId, toolName);

    // Re-evaluate active step after tool usage is processed
    // Explicitly re-evaluate the active step after processing the tool
    // This ensures transitions happen immediately when a sequence completes
    await this.getActiveStep(orchestration, messages, sessionId);
  }

  /**
   * Gets the orchestration state (AI-facing subset)
   * Does NOT create state if it doesn't exist.
   */
  public async getState(
    sessionId: SessionId
  ): Promise<AIOrchestrationState | null> {
    // Note: This now strictly uses the stateManager's conversion method,
    // which relies on the underlying SessionManager's getSession (read-only).
    logger.debug(
      LogCategory.ORCHESTRATION,
      'getState',
      'Getting state for session',
      { sessionId }
    );
    try {
      return await this.stateManager.toAIOrchestrationState(sessionId);
    } catch (error) {
      logger.error(
        LogCategory.ORCHESTRATION,
        'getState',
        'Error getting state',
        {
          sessionId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return null;
    }
  }

  /**
   * Updates the orchestration state
   * Assumes state likely exists due to prior ensureStateExists or getActiveStep calls.
   */
  public async updateState(
    sessionId: SessionId,
    partialState: Partial<OrchestrationState>
  ): Promise<OrchestrationState | null> {
    logger.debug(LogCategory.ORCHESTRATION, 'updateState', 'Updating state', {
      sessionId,
      keysToUpdate: Object.keys(partialState)
    });
    try {
      const updatedState = await this.stateManager.updateState(
        sessionId,
        partialState
      );
      if (!updatedState) {
        // Log if update failed (e.g., session disappeared between check and update)
        logger.error(
          LogCategory.ORCHESTRATION,
          'updateState',
          'State update failed (stateManager.updateState returned null)',
          { sessionId }
        );
      }
      return updatedState;
    } catch (error) {
      logger.error(
        LogCategory.ORCHESTRATION,
        'updateState',
        'Error updating state',
        {
          sessionId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return null;
    }
  }

  /**
   * Resets the orchestration state for a session
   */
  public async resetState(sessionId: SessionId): Promise<void> {
    logger.debug(
      LogCategory.ORCHESTRATION,
      'resetState',
      'Resetting state for session',
      { sessionId }
    );
    try {
      // Use resetState, not deleteState
      await this.stateManager.resetState(sessionId);
    } catch (error) {
      logger.error(
        LogCategory.ORCHESTRATION,
        'resetState',
        'Error resetting state',
        {
          sessionId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  /**
   * Removes a session and its state
   */
  public async removeSession(sessionId: SessionId): Promise<void> {
    // Changed to async Promise<void>
    // Removed lightweight check
    await this.stateManager.cleanupSession(sessionId); // Changed to await
  }

  // NEW: Add getter for the state manager instance
  public getStateManager(): OrchestrationStateManager {
    return this.stateManager;
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
