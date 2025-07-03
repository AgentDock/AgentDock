// Import unified ConsolidationResult from base-types
import { ConsolidationResult } from '../../base-types';

export interface SemanticMemoryData {
  id: string;
  agentId: string;
  content: string;
  category: string;
  importance: number;
  resonance: number;
  confidence: number;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  sourceIds: string[];
  keywords: string[];
  metadata: Record<string, any>;
  embeddingId?: string;
  facts: string[];
  relations: Array<{ subject: string; predicate: string; object: string }>;
}

export interface SemanticMemoryConfig {
  deduplicationThreshold: number;
  maxMemoriesPerCategory: number;
  confidenceThreshold: number;
  vectorSearchEnabled: boolean;
  encryptSensitive: boolean;
  autoExtractFacts: boolean;
}

// OpenAI Embedding Best Practices (June 2025)
// Based on text-embedding-3-small/large similarity thresholds
export const SEMANTIC_MEMORY_DEFAULTS = {
  // OpenAI 2025: 0.5 = moderate similarity threshold for text-embedding-3 models
  confidenceThreshold: 0.5,

  // OpenAI 2025: 0.8+ = high similarity, good for deduplication
  deduplicationThreshold: 0.8,

  // Reasonable category limits for knowledge management
  maxMemoriesPerCategory: 500,

  // Standard configuration defaults
  vectorSearchEnabled: true,
  encryptSensitive: false,
  autoExtractFacts: false
} as const;

export interface SemanticQuery {
  agentId: string;
  query?: string;
  category?: string;
  keywords?: string[];
  minConfidence?: number;
  minImportance?: number;
  vectorSearch?: boolean;
  limit?: number;
}

export interface VectorSearchResult {
  memory: SemanticMemoryData;
  similarity: number;
  reason: string;
}

export interface SemanticMemoryStats {
  totalMemories: number;
  memoriesByCategory: Record<string, number>;
  avgConfidence: number;
  avgImportance: number;
  totalFacts: number;
  totalRelations: number;
  topKeywords: Array<{ keyword: string; count: number }>;
}

export interface StoreSemanticOptions {
  category?: string;
  importance?: number;
  confidence?: number;
  sourceIds?: string[];
  keywords?: string[];
  metadata?: Record<string, any>;
  encrypt?: boolean;
  skipDeduplication?: boolean;
}

export interface ConsolidationOptions {
  category?: string;
  similarityThreshold?: number;
}

// Re-export for this module's convenience
export type { ConsolidationResult };

export interface RelatedMemoryResult {
  memory: SemanticMemoryData;
  path: string[];
  strength: number;
}

export interface RelationOptions {
  maxDepth?: number;
  minStrength?: number;
  relationTypes?: string[];
  maxResults?: number;
}
