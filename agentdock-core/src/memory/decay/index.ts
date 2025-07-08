/**
 * @fileoverview Decay Module - Lazy memory decay system
 *
 * Exports for the lazy decay system that calculates decay on-demand
 * instead of using scheduled batch processes.
 *
 * @author AgentDock Core Team
 */

// LAZY DECAY SYSTEM - New implementation
export { LazyDecayCalculator } from './LazyDecayCalculator';
export { LazyDecayBatchProcessor } from './LazyDecayBatchProcessor';

// Type definitions for lazy decay
export type {
  DecayCalculationResult,
  LazyDecayConfig
} from './LazyDecayCalculator';

export type {
  BatchProcessorConfig,
  BatchProcessingResult
} from './LazyDecayBatchProcessor';

// Legacy type definitions (kept for compatibility)
export type { DecayRule, DecayConfiguration } from './types';
export type { DecayResult } from '../base-types';
