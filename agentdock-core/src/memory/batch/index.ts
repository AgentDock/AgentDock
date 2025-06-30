// Import for use in the factory function
import { BatchProcessor } from './BatchProcessor';

/**
 * @fileoverview Batch Processing System - Public Exports
 *
 * Main entry point for the AgentDock batch processing memory system.
 * Provides configurable extraction strategies with 5x cost reduction.
 *
 * @author AgentDock Core Team
 */

// Core types and interfaces
export * from './types';

// Main batch processor
export { BatchProcessor } from './BatchProcessor';

// Extractor implementations
export {
  RuleBasedExtractor,
  createExtractionRule
} from './extractors/RuleBasedExtractor';

// Configuration examples (not defaults!)
export * from './examples';

/**
 * Quick start batch processing with default configuration.
 * Users should customize this for their specific needs.
 *
 * @example
 * ```typescript
 * import { createBatchProcessor } from '@agentdock/core/memory/batch';
 *
 * const processor = createBatchProcessor(storage, {
 *   extractors: [
 *     { type: 'rules', enabled: true, costPerMemory: 0 }
 *   ],
 *   costBudget: 1.00
 * });
 *
 * const result = await processor.process(agentId, messages);
 * ```
 */
export function createBatchProcessor(storage: any, config: any): any {
  // Implementation will be added when BatchProcessor is complete
  return new BatchProcessor(storage, config);
}
