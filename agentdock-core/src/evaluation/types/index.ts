/**
 * @fileoverview Core type definitions for the AgentDock Evaluation Framework.
 */

// Import Message type from the correct location and alias it as AgentMessage for this module and export
import type { Message, MessageContent, TextContent, ImageContent, ToolCallContent, ToolResultContent } from '../../types/messages';
export type AgentMessage = Message;
// Export MessageContent and its constituent types as they are used by ToolUsageEvaluator
export type { MessageContent, TextContent, ImageContent, ToolCallContent, ToolResultContent };

/**
 * Defines the scale used for scoring an evaluation criterion.
 * Allows standard scales plus custom string identifiers.
 */
export type EvaluationScale = 'binary' | 'likert5' | 'numeric' | 'pass/fail' | string;

/**
 * Represents a single criterion used for evaluation.
 */
export interface EvaluationCriteria {
  /** Unique identifier for the criterion (e.g., 'relevance', 'conciseness'). */
  name: string;
  /** Human-readable explanation of what this criterion measures. */
  description: string;
  /** The scale used for scoring this criterion. */
  scale: EvaluationScale;
  /** Optional weight for this criterion when calculating an aggregated score (default: 1). */
  weight?: number;
}

/**
 * Represents the input data provided to an evaluator.
 * This structure is designed to be rich and flexible.
 */
export interface EvaluationInput {
  /** The initial prompt that led to the response, if applicable. */
  prompt?: string;
  /** The agent's output (response) being evaluated. Can be raw string or structured message. */
  response: string | AgentMessage; // Now uses the locally defined AgentMessage alias
  /** Arbitrary contextual data relevant to the evaluation (e.g., RAG context, user profile). */
  context?: Record<string, any>;
  /** Optional ground truth or reference answer/data for comparison. */
  groundTruth?: string | any;
  /** The specific criteria this input should be evaluated against in this run. */
  criteria: EvaluationCriteria[];
  /** A snapshot of the agent's configuration at the time the response was generated. */
  agentConfig?: Record<string, any>; // Consider defining a more specific AgentConfig snapshot type if needed
  /** The message history leading up to the response being evaluated. */
  messageHistory?: AgentMessage[]; // Now uses the locally defined AgentMessage alias
  /** Timestamp when the agent response was generated or evaluation was triggered. */
  timestamp?: number; // Consider using Date object? Using number for simplicity for now.
  /** Identifier for the session or conversation, if applicable. */
  sessionId?: string;
  /** Identifier for the agent instance that produced the response. */
  agentId?: string;
  /** Other arbitrary metadata relevant to this input (e.g., test runner context if applicable). */
  metadata?: Record<string, any>;
}

/**
 * Represents the result of evaluating a single criterion by a single evaluator.
 */
export interface EvaluationResult {
  /** The name of the criterion being evaluated (links back to EvaluationCriteria.name). */
  criterionName: string;
  /** The actual score or judgment provided by the evaluator, matching the criterion's scale. */
  score: number | boolean | string;
  /** Optional textual explanation or reasoning from the evaluator (especially useful for LLM judges). */
  reasoning?: string;
  /** String identifier for the type of evaluator that produced this result (e.g., 'RuleBased', 'LLMJudge:gpt-4o'). */
  evaluatorType: string;
  /** Error message if this specific criterion evaluation failed for some reason. */
  error?: string;
  /** Any additional metadata specific to this evaluator or result. */
  metadata?: Record<string, any>;
}

/**
 * Represents the aggregated results of a complete evaluation run against multiple criteria and potentially multiple evaluators.
 */
export interface AggregatedEvaluationResult {
  /** Optional overall score calculated from individual results (e.g., weighted average). */
  overallScore?: number;
  /** List of individual results for each criterion evaluated successfully. */
  results: EvaluationResult[];
  /** Timestamp indicating when the evaluation run completed. */
  timestamp: number; // Consider using Date object? Using number for simplicity.
  /** Identifier for the agent instance, copied from input. */
  agentId?: string;
  /** Identifier for the session, copied from input. */
  sessionId?: string;
  /** A snapshot of the exact EvaluationInput used for this run, ensuring reproducibility. */
  inputSnapshot: EvaluationInput;
  /** Optional snapshot of the evaluation configuration used (e.g., list of evaluators, specific settings). */
  evaluationConfigSnapshot?: any; // Define more specifically later if needed
  /** Any run-level metadata not captured elsewhere. */
  metadata?: Record<string, any>;
  /** Optional list of errors that occurred at the run level (e.g., an evaluator failing completely). */
  runErrors?: { evaluatorType?: string; message: string; stack?: string }[];
}

/**
 * Interface defining the contract for any evaluation method (Evaluator).
 * Evaluators are responsible for assessing an input against a set of criteria.
 */
export interface Evaluator {
  /** Unique string identifier for the type of evaluator (e.g., 'RuleBased', 'LLMJudge'). */
  type: string;
  /**
   * Executes the evaluation logic.
   * @param input The evaluation input data.
   * @param criteria The specific criteria this evaluator should assess. An evaluator might only handle a subset of criteria passed in the input.
   * @returns A promise resolving to an array of EvaluationResult objects for the criteria this evaluator assessed.
   */
  evaluate(input: EvaluationInput, criteria: EvaluationCriteria[]): Promise<EvaluationResult[]>;
} 