import { MemoryType } from '../types/common';
import { EpisodicMemoryData } from '../types/episodic/EpisodicMemoryTypes';
import { ProceduralMemoryData } from '../types/procedural/ProceduralMemoryTypes';
import { SemanticMemoryData } from '../types/semantic/SemanticMemoryTypes';
import { WorkingMemoryData } from '../types/working/WorkingMemoryTypes';

/**
 * RecallService provides unified cross-memory search and retrieval
 */

/**
 * Configuration-driven recall query
 */
export interface RecallQuery {
  userId: string;
  agentId: string;
  query: string;
  memoryTypes?: MemoryType[];
  limit?: number;
  minRelevance?: number;
  includeRelated?: boolean;
  timeRange?: {
    start: number;
    end: number;
  };
  context?: Record<string, unknown>;
}

export interface RecallResult {
  memories: UnifiedMemoryResult[];
  totalRelevance: number;
  searchStrategy: string;
  executionTime: number;
  sources: {
    working: number;
    episodic: number;
    semantic: number;
    procedural: number;
  };
  // NEW: Conversation temporal context for AgentNode-style injection
  conversationContext?: string;
}

export interface UnifiedMemoryResult {
  id: string;
  type: MemoryType;
  content: string;
  relevance: number;
  confidence: number;
  timestamp: number;
  context: Record<string, unknown>;
  relationships: RelatedMemory[];
  metadata: Record<string, unknown>;
}

export interface RelatedMemory {
  id: string;
  type: MemoryType;
  relationshipType: string;
  strength: number;
  reason: string;
}

export interface HybridSearchResult {
  vectorResults: VectorSearchResult[];
  textResults: TextSearchResult[];
  proceduralResults: ProceduralMatchResult[];
  combinedScore: number;
}

export interface VectorSearchResult {
  memory: UnifiedMemoryResult;
  similarity: number;
  embeddingDistance: number;
}

export interface TextSearchResult {
  memory: UnifiedMemoryResult;
  relevance: number;
  matchedTerms: string[];
  matchScore: number;
}

export interface ProceduralMatchResult {
  memory: UnifiedMemoryResult;
  patternMatch: number;
  contextMatch: number;
  usageScore: number;
}

export interface RecallConfig {
  defaultLimit: number;
  minRelevanceThreshold: number;
  hybridSearchWeights: {
    vector: number;
    text: number;
    temporal: number;
    procedural: number;
  };
  enableVectorSearch: boolean;
  enableRelatedMemories: boolean;
  maxRelatedDepth: number;
  cacheResults: boolean;
  cacheTTL: number;
}

export interface SearchStrategy {
  name: string;
  weight: number;
  minScore: number;
  enabled: boolean;
}

export interface RecallMetrics {
  totalQueries: number;
  avgResponseTime: number;
  cacheHitRate: number;
  memoryTypeDistribution: Record<MemoryType, number>;
  popularQueries: Array<{
    query: string;
    count: number;
    avgRelevance: number;
  }>;
}
