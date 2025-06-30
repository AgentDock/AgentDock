/**
 * @fileoverview Decay Module - Configurable memory decay system
 *
 * Exports for the decay and lifecycle management system.
 * Provides user-configurable decay rules with no hardcoded business logic.
 *
 * @author AgentDock Core Team
 */

// Core decay engine
export { ConfigurableDecayEngine } from './ConfigurableDecayEngine';

// Type definitions
export type { DecayRule, DecayConfiguration, DecayResult } from './types';
