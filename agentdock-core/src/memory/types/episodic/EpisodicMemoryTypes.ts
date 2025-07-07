// Import unified types from base-types
import { ConsolidationResult, DecayResult } from '../../base-types';

export interface EpisodicMemoryData {
  id: string;
  agentId: string;
  sessionId: string;
  content: string;
  context: string;
  importance: number;
  resonance: number;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  sourceMessageIds: string[];
  metadata: Record<string, unknown>;
  tags: string[];
  embeddingId?: string;
}

export interface EpisodicMemoryConfig {
  maxMemoriesPerSession: number;
  decayRate: number;
  importanceThreshold: number;
  compressionAge: number;
  encryptSensitive: boolean;
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface EpisodicQuery {
  agentId: string;
  sessionId?: string;
  timeRange?: TimeRange;
  minImportance?: number;
  tags?: string[];
  content?: string;
  limit?: number;
}

// Re-export for this module's convenience
export type { ConsolidationResult, DecayResult };

export interface EpisodicMemoryStats {
  totalMemories: number;
  memoriesBySession: Record<string, number>;
  avgImportance: number;
  avgResonance: number;
  oldestMemory: number;
  newestMemory: number;
  topTags: Array<{ tag: string; count: number }>;
}

export interface StoreEpisodicOptions {
  context?: string;
  importance?: number;
  sourceMessageIds?: string[];
  metadata?: Record<string, unknown>;
  tags?: string[];
  encrypt?: boolean;
  sessionId?: string; // Added for MemoryManager compatibility
}

export interface RelatedMemoryOptions {
  maxResults?: number;
  timeWindowHours?: number;
  minImportance?: number;
}
