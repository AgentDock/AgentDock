/**
 * @fileoverview Workflow Learning Module
 * 
 * Exports for the workflow learning system that captures tool execution patterns
 * and enables deterministic replay of complex workflows.
 * 
 * @author AgentDock Core Team
 */

export { WorkflowLearningService } from './WorkflowLearningService';

// Export types from local module
export type {
  ToolCall,
  ToolPattern,
  ProceduralMemory,
  ProceduralConfig,
  LearningResult,
  SuggestionContext,
  ToolSuggestion,
  ProceduralStats
} from './types';