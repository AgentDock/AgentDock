/**
 * @fileoverview Common memory types used across the memory system
 *
 * @author AgentDock Core Team
 */

/**
 * Memory type enumeration - exported from shared types
 */
import { MemoryType } from '../../shared/types/memory';

export { MemoryType };

/**
 * Re-export Memory interface from storage types
 * This ensures all memory operations use the secure interface with userId
 */
export type { MemoryData as Memory } from '../../storage/types';

/**
 * Message interface for agent communications
 */
export interface MemoryMessage {
  /** Message ID */
  id: string;

  /** Agent ID */
  agentId: string;

  /** Message content */
  content: string;

  /** Message role */
  role?: 'user' | 'assistant' | 'system';

  /** Message timestamp */
  timestamp?: Date;

  /** Additional message metadata */
  metadata?: Record<string, unknown>;
}
