/**
 * @fileoverview Shared memory type definitions
 *
 * Central location for types shared between storage and memory modules.
 * This breaks circular dependencies and provides a single source of truth.
 *
 * @author AgentDock Core Team
 */

/**
 * Memory type enumeration - defines the four types of memory
 */
export enum MemoryType {
  WORKING = 'working',
  EPISODIC = 'episodic',
  SEMANTIC = 'semantic',
  PROCEDURAL = 'procedural'
}
