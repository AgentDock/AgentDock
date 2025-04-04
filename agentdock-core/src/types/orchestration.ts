/**
 * @fileoverview Orchestration types for the AgentDock framework.
 * This defines the structure for orchestrating agent behavior and tool usage patterns.
 */

import { z } from 'zod';

/**
 * Vercel AI SDK compatible orchestration state
 * This matches the structure used by the Vercel AI SDK
 */
export interface AIOrchestrationState {
  /** Unique session ID */
  sessionId: string;
  
  /** Recently used tools in this session */
  recentlyUsedTools: string[];
  
  /** Current active step name */
  activeStep?: string;
  
  /** Current position in a tool sequence, if applicable */
  sequenceIndex?: number;

  /** Cumulative token usage for the session */
  cumulativeTokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Types of conditions that can trigger orchestration steps
 * Note: We've simplified this to only include tool usage tracking.
 * The LLM understands context naturally without regex or string matching.
 */
export type OrchestrationConditionType = 
  | 'tool_used';

/**
 * Condition that determines when a step should be activated
 */
export interface OrchestrationCondition {
  /** Type of condition */
  type: OrchestrationConditionType;
  
  /** Value to match against (meaning depends on condition type) */
  value: string;
  
  /** Optional description of the condition */
  description?: string;
}

/**
 * Tool availability configuration for an orchestration step
 */
export interface ToolAvailability {
  /** List of tools or tool patterns that are explicitly allowed */
  allowed?: string[];
  
  /** List of tools or tool patterns that are explicitly denied */
  denied?: string[];
}

/**
 * Definition of a single orchestration step
 */
export interface OrchestrationStep {
  /** Unique name for the step */
  name: string;
  
  /** Description of what the step does */
  description: string;
  
  /** Conditions that determine when this step should activate */
  conditions?: OrchestrationCondition[];
  
  /** Tool availability for this step */
  availableTools?: ToolAvailability;
  
  /** Whether this is the default step when no other conditions match */
  isDefault?: boolean;

  /** Ordered sequence of tools that should be used in this step */
  sequence?: string[];
}

/**
 * Complete orchestration configuration for an agent
 */
export interface OrchestrationConfig {
  /** Ordered sequence of steps */
  steps: OrchestrationStep[];
  
  /** Optional description of the overall orchestration */
  description?: string;
}

/**
 * Zod schema for validating the orchestration condition
 */
export const OrchestrationConditionSchema = z.object({
  type: z.enum(['tool_used']),
  value: z.string(),
  description: z.string().optional()
});

/**
 * Zod schema for validating tool availability
 */
export const ToolAvailabilitySchema = z.object({
  allowed: z.array(z.string()).optional(),
  denied: z.array(z.string()).optional()
});

/**
 * Zod schema for validating orchestration step configuration
 */
export const OrchestrationStepSchema = z.object({
  name: z.string(),
  description: z.string(),
  conditions: z.array(OrchestrationConditionSchema).optional(),
  availableTools: ToolAvailabilitySchema.optional(),
  isDefault: z.boolean().optional(),
  sequence: z.array(z.string()).optional()
});

/**
 * Zod schema for validating the complete orchestration configuration
 */
export const OrchestrationSchema = z.object({
  steps: z.array(OrchestrationStepSchema),
  description: z.string().optional()
});

/**
 * Type guard to check if an object is a valid OrchestrationConfig
 */
export function isOrchestrationConfig(obj: unknown): obj is OrchestrationConfig {
  return OrchestrationSchema.safeParse(obj).success;
}

/**
 * Function to create a default orchestration step
 */
export function createOrchestrationStep(step: Partial<OrchestrationStep>): OrchestrationStep {
  const defaultStep: OrchestrationStep = {
    name: '',
    description: '',
    conditions: []
  };
  
  return { ...defaultStep, ...step };
}

/**
 * Function to create a default orchestration configuration
 */
export function createOrchestration(config: Partial<OrchestrationConfig>): OrchestrationConfig {
  const defaultConfig: OrchestrationConfig = {
    steps: [],
    description: 'Default orchestration'
  };
  
  return { ...defaultConfig, ...config };
}

export interface TokenOptimizationOptions {
  /** Whether to include detailed orchestration steps in the system prompt */
  includeDetailedOrchestration?: boolean;
}

/**
 * Configuration options for an agent
 */
export interface AgentConfigOptions {
  /** Maximum number of steps to allow in a conversation */
  maxSteps?: number;
  
  /** Token optimization options */
  tokenOptimization?: TokenOptimizationOptions;
} 