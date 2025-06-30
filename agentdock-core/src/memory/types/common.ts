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
 * Base memory interface used by batch processing and other systems
 */
export interface Memory {
  /** Unique identifier for this memory */
  id: string;
  
  /** Agent this memory belongs to */
  agentId: string;
  
  /** Memory content */
  content: string;
  
  /** Type of memory */
  type: MemoryType;
  
  /** Importance score (0.0 to 1.0) */
  importance: number;
  
  /** How well this memory resonates with current context */
  resonance?: number;
  
  /** Number of times this memory has been accessed */
  accessCount: number;
  
  /** Creation timestamp */
  createdAt: number;
  
  /** Last update timestamp */
  updatedAt: number;
  
  /** Last access timestamp */
  lastAccessedAt: number;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
  
  /** Keywords for search and categorization */
  keywords?: string[];
  
  /** IDs of connected memories */
  connections?: string[];
}

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
  metadata?: Record<string, any>;
} 