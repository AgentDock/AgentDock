/**
 * @fileoverview Lifecycle Module - Memory evolution and lifecycle management
 *
 * Exports for the memory lifecycle management system including evolution tracking,
 * automated promotion, cleanup, and scheduling.
 *
 * @author AgentDock Core Team
 */

// TEMP: Core lifecycle components - Removed for lazy decay implementation
export { MemoryEvolutionTracker } from './MemoryEvolutionTracker';
// export { MemoryLifecycleManager } from './MemoryLifecycleManager';
// export { LifecycleScheduler } from './LifecycleScheduler';

// Type definitions
export type {
  MemoryChangeType,
  MemoryEvolution,
  PromotionConfiguration,
  CleanupConfiguration,
  LifecycleConfig,
  PromotionResult,
  CleanupResult,
  LifecycleResult,
  LifecycleInsights
} from './types';

// TEMP: Scheduler configuration - Removed for lazy decay implementation
// export type { ScheduleConfig } from './LifecycleScheduler';
