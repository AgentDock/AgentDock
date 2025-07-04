import { ConnectionType, MemoryConnection } from '../../storage/types';
import { Memory } from '../types/common';

// Intelligence layer configuration - following CTO's hybrid approach
export interface IntelligenceLayerConfig {
  // Base layer - always enabled, zero cost
  embedding: {
    enabled: true;
    provider?: 'openai' | 'google' | 'mistral' | 'voyage' | 'cohere'; // Add provider types
    similarityThreshold: number; // 0.7 default
    model?: string; // Which embedding model to use
    apiKey?: string; // Optional override
  };

  // Optional enhancement layers
  connectionDetection: {
    method: 'embedding-only' | 'user-rules' | 'small-llm' | 'hybrid';

    // Connection discovery configuration
    maxRecentMemories?: number; // Default: 50, range: 10-500
    temporalWindowDays?: number; // Default: 7
    enableTemporalAnalysis?: boolean; // Default: false

    // User-defined rules (free, configurable)
    userRules?: {
      enabled?: boolean;
      patterns?: ConnectionRule[];
    };

    // LLM enhancement (optional, cost-aware)
    llmEnhancement?: {
      enabled?: boolean;
      provider?: string; // User's choice
      model?: string; // Small model (claude-3-haiku, gemini-flash, etc)
      apiKey?: string; // Or use env var
      maxTokensPerAnalysis?: number;
      temperature?: number; // 0.1-0.3 for consistency
      validateResponses?: true; // Always validate with Zod
      fallbackToEmbedding?: true; // When validation fails
      minConfidence?: number; // LLM confidence threshold

      // Cost configuration - user defines based on their provider/model
      costPerToken?: number; // e.g., 0.0000002 for input tokens
      costPerOperation?: number; // Alternative: flat rate per analysis
    };
  };

  // Temporal pattern analysis (optional)
  temporal?: {
    enabled?: boolean;
    analysisFrequency?: 'realtime' | 'hourly' | 'daily'; // How often to run analysis
    minMemoriesForAnalysis?: number; // Default: 5
    enableLLMEnhancement?: boolean; // Use LLM for deeper insights
  };

  // Memory recall configuration
  recall?: {
    defaultLimit?: number; // Default: 20, range: 5-100
    productionLimit?: number; // Default: 15 for production preset
    minRelevanceThreshold?: number; // Default: 0.1
    enableCaching?: boolean; // Default: true
    cacheTTL?: number; // Default: 300000 (5 minutes)
  };

  // Cost control
  costControl: {
    maxLLMCallsPerBatch: number;
    monthlyBudget?: number;
    preferEmbeddingWhenSimilar: boolean; // Skip LLM if embedding > 0.9
    trackTokenUsage: true;
  };
}

// User-configurable connection rules (language-agnostic)
export interface ConnectionRule {
  id: string;
  name: string;
  description: string;

  // Semantic approach - required, no more regex patterns
  semanticDescription: string; // Natural language description of what to look for
  semanticEmbedding?: number[]; // Pre-computed embedding of the semantic description

  connectionType: ConnectionType;
  confidence: number; // 0-1
  language?: string; // Optional language hint

  // Semantic matching configuration
  semanticThreshold?: number; // Embedding similarity threshold (default: 0.75)
  requiresBothMemories?: boolean; // Must match both memories vs either (default: true)

  enabled: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface ConnectionGraph {
  nodes: Map<string, Memory>;
  edges: Map<string, MemoryConnection[]>;

  // Graph operations
  addNode(memory: Memory): void;
  addEdge(connection: MemoryConnection): void;
  findPath(sourceId: string, targetId: string): string[];
  getNeighbors(memoryId: string, type?: ConnectionType): MemoryConnection[];
  getClusters(): string[][];
}

// Embedding service types - simplified and configurable
export interface EmbeddingConfig {
  provider: string;
  model: string;
  dimensions?: number;
  cacheEnabled?: boolean;
  batchSize?: number;
  cacheSize?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  provider: string;
  model: string;
  cached?: boolean;
}

// Pattern analysis types
export interface TemporalPattern {
  type: 'daily' | 'weekly' | 'monthly' | 'periodic' | 'burst';
  frequency?: number;
  confidence: number;
  memories: string[];
  metadata?: {
    peakTimes?: Date[];
    interval?: number;
    description?: string;
  };
}

export interface ActivityCluster {
  startTime: Date;
  endTime: Date;
  memoryIds: string[];
  topics: string[];
  intensity: number; // Activity level 0-1
}

// Consolidation types
export interface ConsolidationCandidate {
  memories: Memory[];
  similarity: number;
  strategy: 'merge' | 'synthesize' | 'abstract' | 'hierarchy';
  suggestedTitle?: string;
  suggestedContent?: string;
}

export interface ConsolidationConfig {
  similarityThreshold: number;
  maxAge: number; // Max age for episodic memories (ms)
  preserveOriginals: boolean;
  strategies: ('merge' | 'synthesize' | 'abstract' | 'hierarchy')[];
  batchSize: number;
  enableLLMSummarization?: boolean; // Optional LLM enhancement
  llmConfig?: {
    provider: string;
    model: string;
    costPerToken?: number;
    maxTokensPerSummary?: number;
  };
}
