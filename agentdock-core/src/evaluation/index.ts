/**
 * @fileoverview Main entry point for the AgentDock Evaluation Framework module.
 */

// Export core types and interfaces
export * from './types';

// Export the main runner function and config type
export * from './runner';

// Export concrete storage provider implementations
export { JsonFileStorageProvider } from './storage/json_file_storage';

// TODO: Export concrete evaluator implementations from ./evaluators/* when they exist
// Example:
// export { RuleBasedEvaluator } from './evaluators/rule-based/evaluator';
// export { LLMJudgeEvaluator } from './evaluators/llm/judge'; 