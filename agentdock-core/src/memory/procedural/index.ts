/**
 * @fileoverview Procedural Memory Module - Tool pattern learning system
 * 
 * Exports for the procedural memory system that learns from successful
 * tool usage patterns and provides intelligent tool sequence suggestions.
 * 
 * @author AgentDock Core Team
 */

// Core procedural memory component
export { ProceduralMemoryManager } from './ProceduralMemoryManager';

// Type definitions
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
