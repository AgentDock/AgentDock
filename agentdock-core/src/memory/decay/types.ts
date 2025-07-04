/**
 * @fileoverview Decay Types - User-configurable memory decay interfaces
 *
 * Provides type definitions for the decay and lifecycle management system.
 * NO hardcoded business logic - everything is user-configurable.
 *
 * @author AgentDock Core Team
 */

/**
 * User-defined decay rule for memory lifecycle management.
 * Supports safe JavaScript expression evaluation for conditions.
 */
export interface DecayRule {
  /** Unique identifier for this decay rule */
  id: string;

  /** Human-readable name for this rule */
  name: string;

  /** JavaScript expression for matching memories (e.g., "type === 'episodic'" or "keywords.includes('trauma')") */
  condition: string;

  /** Decay rate per day (0.01 = 1% decay per day) */
  decayRate: number;

  /** Minimum importance below which memories won't decay */
  minImportance: number;

  /** If true, memories matching this rule never decay */
  neverDecay: boolean;

  /** Whether this rule is currently active */
  enabled: boolean;

  /** Who created this rule (for tracking) */
  createdBy?: string;

  /** When this rule was created */
  createdAt?: Date;

  /** Optional description of what this rule does */
  description?: string;
}

/**
 * Configuration for the decay engine behavior.
 * All decay logic is user-defined through rules.
 */
export interface DecayConfiguration {
  /** Agent this configuration applies to */
  agentId: string;

  /** User-defined decay rules (applied in order) */
  rules: DecayRule[];

  /** Default decay rate for memories not matching any rule */
  defaultDecayRate: number;

  /** How often to run decay operations (in milliseconds) */
  decayInterval: number;

  /** Minimum resonance threshold - memories below this are deleted */
  deleteThreshold?: number;

  /** Whether to log detailed decay operations */
  verbose?: boolean;
}

/**
 * Result of applying decay operations.
 * Note: This is different from the framework DecayResult in base-types
 */
export interface DecayOperationResult {
  /** Number of memories processed */
  processed: number;

  /** Number of memories that had their resonance updated */
  updated: number;

  /** Number of memories deleted due to low resonance */
  deleted: number;

  /** When the decay operation was performed */
  timestamp: Date;

  /** Breakdown by rule */
  ruleResults?: Array<{
    ruleId: string;
    ruleName: string;
    memoriesAffected: number;
    avgDecayApplied: number;
  }>;

  /** Any errors encountered during decay */
  errors?: string[];
}
