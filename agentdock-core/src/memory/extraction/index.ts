// Factory function for easy setup
import { StorageProvider } from '../../storage/types';
import {
  PRIMEOrchestrator,
  PRIMEOrchestratorConfig
} from './PRIMEOrchestrator';

/**
 * @fileoverview Memory extraction module exports
 *
 * Provides the PRIME (Priority Rules Intelligent Memory Extraction) system
 * for efficient, intelligent memory extraction with embedded rule guidance.
 */

// Core PRIME system exports
export { PRIMEExtractor } from './PRIMEExtractor';
export { PRIMEOrchestrator } from './PRIMEOrchestrator';

// PRIME type exports
export type {
  PRIMEConfig,
  PRIMERule,
  PRIMEExtractionContext,
  PRIMEExtractionMetrics
} from './PRIMEExtractor';

export type {
  PRIMEOrchestratorConfig,
  PRIMEExtractionResult,
  PRIMEProcessingMetrics
} from './PRIMEOrchestrator';

export function createPRIMEOrchestrator(
  storage: StorageProvider,
  config: PRIMEOrchestratorConfig
): PRIMEOrchestrator {
  return new PRIMEOrchestrator(storage, config);
}
