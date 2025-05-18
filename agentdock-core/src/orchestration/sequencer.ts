/**
 * @fileoverview Simplified tool sequencing for orchestration steps.
 *
 * This file implements logic for managing tool sequences in orchestration steps,
 * ensuring tools are executed in the correct order.
 */

import { logger, LogCategory } from '../logging';
import { OrchestrationStep } from '../types/orchestration';
import { SessionId } from '../types/session';
import {
  OrchestrationStateManager,
  createOrchestrationStateManager,
  OrchestrationState,
} from './state';

/**
 * Manages tool sequences within orchestration steps
 */
export class StepSequencer {
  private stateManager: OrchestrationStateManager;

  /**
   * Creates a new step sequencer
   */
  constructor(stateManager?: OrchestrationStateManager) {
    this.stateManager = stateManager || createOrchestrationStateManager();
  }

  /**
   * Determines if a step has an active sequence
   */
  public async hasActiveSequence(step: OrchestrationStep, sessionId: SessionId): Promise<boolean> {
    if (!step.sequence?.length) return false;

    const state = await this.stateManager.getState(sessionId);
    if (!state) {
      // Initialize the state if needed
      await this.stateManager.updateState(sessionId, { sequenceIndex: 0 });
      return true; // Has an active sequence starting at index 0
    }

    // If sequenceIndex is undefined, set it to 0
    if (state.sequenceIndex === undefined) {
      await this.stateManager.updateState(sessionId, { sequenceIndex: 0 });
      return true; // Has an active sequence starting at index 0
    }

    // Ensure sequenceIndex is treated as a number
    const currentSequenceIndex = state.sequenceIndex ?? 0;
    return currentSequenceIndex < step.sequence.length;
  }

  /**
   * Gets the current tool in a sequence
   */
  public async getCurrentSequenceTool(
    step: OrchestrationStep,
    sessionId: SessionId,
  ): Promise<string | null> {
    if (!step.sequence?.length) return null;

    // Ensure we have a state with a valid sequence index
    if (!(await this.hasActiveSequence(step, sessionId))) {
      return null;
    }

    const state = await this.stateManager.getState(sessionId);
    if (!state || state.sequenceIndex === undefined) {
      logger.warn(
        LogCategory.ORCHESTRATION,
        'StepSequencer',
        'State or sequenceIndex unexpectedly missing after hasActiveSequence check',
        { sessionId, step: step.name },
      );
      // Fallback cautiously: only return first tool if index is truly missing/invalid
      return step.sequence[0];
    }

    const currentSequenceIndex = state.sequenceIndex ?? 0;
    return currentSequenceIndex < step.sequence.length ? step.sequence[currentSequenceIndex] : null;
  }

  /**
   * Advances to the next tool in a sequence
   */
  public async advanceSequence(step: OrchestrationStep, sessionId: SessionId): Promise<boolean> {
    if (!step.sequence?.length) return false;

    const state = await this.stateManager.getState(sessionId);
    if (!state) {
      return false;
    }

    const currentIndex = state.sequenceIndex === undefined ? 0 : state.sequenceIndex;
    const nextIndex = currentIndex + 1;

    // Update the state with the new index
    await this.stateManager.updateState(sessionId, { sequenceIndex: nextIndex });

    logger.debug(LogCategory.ORCHESTRATION, 'StepSequencer', 'Advanced sequence', {
      sessionId,
      step: step.name,
      sequenceIndex: nextIndex,
      nextTool: nextIndex < step.sequence.length ? step.sequence[nextIndex] : 'end',
    });

    return true;
  }

  /**
   * Processes a tool usage in a sequence
   */
  public async processTool(
    step: OrchestrationStep,
    sessionId: SessionId,
    usedTool: string,
  ): Promise<boolean> {
    // Track the tool usage asynchronously
    await this.stateManager.addUsedTool(sessionId, usedTool);

    // If no sequence, just return success
    if (!step.sequence?.length) return true;

    // Get current expected tool in the sequence
    const currentTool = await this.getCurrentSequenceTool(step, sessionId);
    if (!currentTool) return true; // End of sequence or no sequence

    // If tool matches sequence, advance asynchronously
    if (currentTool === usedTool) {
      return await this.advanceSequence(step, sessionId);
    }

    // Tool doesn't match expected sequence
    logger.warn(LogCategory.ORCHESTRATION, 'StepSequencer', 'Tool used out of sequence', {
      sessionId,
      step: step.name,
      expectedTool: currentTool,
      actualTool: usedTool,
    });

    return false;
  }

  /**
   * Filters available tools based on sequence
   */
  public async filterToolsBySequence(
    step: OrchestrationStep,
    sessionId: SessionId,
    allToolIds: string[],
  ): Promise<string[]> {
    // Check if we have a sequence to enforce
    if (!step.sequence?.length) return allToolIds;

    // Ensure we have a state with a valid sequence index
    if (!(await this.hasActiveSequence(step, sessionId))) {
      return allToolIds;
    }

    // Get the current tool in the sequence
    const currentTool = await this.getCurrentSequenceTool(step, sessionId);
    if (!currentTool) {
      // Sequence is finished or state issue occurred, allow all tools
      logger.debug(
        LogCategory.ORCHESTRATION,
        'StepSequencer',
        'Sequence finished or no current tool found, allowing all tools',
        { sessionId, step: step.name },
      );
      return allToolIds;
    }

    // If current tool is available, only allow that tool
    if (allToolIds.includes(currentTool)) {
      logger.debug(
        LogCategory.ORCHESTRATION,
        'StepSequencer',
        'Enforcing sequence - only allowing current tool',
        {
          sessionId,
          step: step.name,
          currentTool,
          allToolsCount: allToolIds.length,
        },
      );
      return [currentTool];
    }

    // Current sequence tool is not in the list of currently available tools
    logger.warn(
      LogCategory.ORCHESTRATION,
      'StepSequencer',
      'Current sequence tool not available in provided tool list',
      {
        sessionId,
        step: step.name,
        currentTool,
        availableTools: allToolIds,
      },
    );

    // Decide behavior: Allow all tools? Allow none? Return empty list might be safest.
    return [];
  }
}

/**
 * Creates a step sequencer
 */
export function createStepSequencer(stateManager?: OrchestrationStateManager): StepSequencer {
  return new StepSequencer(stateManager);
}
