/**
 * @fileoverview Main entry point for the AgentDock Evaluation Framework module.
 */

// Export core types and interfaces
export * from './types';

// Export the main runner function and config type
export * from './runner';

// Export concrete storage provider implementations
// export { JsonFileStorageProvider } from './storage/json_file_storage'; // Commented out

// Export all concrete evaluator implementations, their configs, and rule types
// by re-exporting from the main evaluators index file.
export * from './evaluators';

// Remove older, more specific evaluator exports if they are covered by the above
// export { RuleBasedEvaluator, type EvaluationRule, type RuleConfig } from './evaluators/rule-based'; // Covered by './evaluators'
// export { LLMJudgeEvaluator, type LLMJudgeConfig } from './evaluators/llm'; // Covered by './evaluators'

// TODO: Export concrete evaluator implementations from ./evaluators/* when they exist
// Example:
// export { RuleBasedEvaluator } from './evaluators/rule-based/evaluator';
// export { LLMJudgeEvaluator } from './evaluators/llm/judge'; 