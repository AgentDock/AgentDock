/**
 * @fileoverview Lifecycle Module - Memory evolution and lifecycle management
 * 
 * Exports for the memory lifecycle management system including evolution tracking,
 * automated promotion, cleanup, and scheduling.
 * 
 * @author AgentDock Core Team
 */

// Core lifecycle components
export { MemoryEvolutionTracker } from './MemoryEvolutionTracker';
export { MemoryLifecycleManager } from './MemoryLifecycleManager';
export { LifecycleScheduler } from './LifecycleScheduler';

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

// Scheduler configuration
export type { ScheduleConfig } from './LifecycleScheduler'; 
 
 
 