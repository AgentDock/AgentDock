import { Memory } from '../types/common';

// Connection types between memories
export type ConnectionType = 
  | 'similar'        // Semantically similar content
  | 'contradicts'    // Conflicting information
  | 'extends'        // Builds upon
  | 'references'     // Explicitly references
  | 'temporal'       // Time-based relationship
  | 'causal'         // Cause-effect relationship
  | 'derived'        // Derived from other memory
  | 'corrects'       // Corrects previous memory
  | 'updates';       // Updates previous memory

export interface MemoryConnection {
  id: string;
  sourceId: string;
  targetId: string;
  type: ConnectionType;
  strength: number;      // 0-1, where 1 is strongest
  reason?: string;
  createdAt: number;
  method: 'embedding' | 'user-rules' | 'small-llm' | 'hybrid';
  metadata?: {
    confidence?: number;
    algorithm?: string;
    embeddingSimilarity?: number;
    llmUsed?: boolean;
    cost?: number;
  };
}

// Intelligence layer configuration - following CTO's hybrid approach
export interface IntelligenceLayerConfig {
  // Base layer - always enabled, zero cost
  embedding: {
    enabled: true;
    similarityThreshold: number; // 0.7 default
    model?: string; // Which embedding model to use
  };
  
  // Optional enhancement layers
  connectionDetection: {
    method: 'embedding-only' | 'user-rules' | 'small-llm' | 'hybrid';
    
    // User-defined rules (free, configurable)
    userRules?: {
      enabled?: boolean;
      patterns?: ConnectionRule[];
    };
    
    // LLM enhancement (optional, cost-aware)
    llmEnhancement?: {
      enabled?: boolean;
      provider?: string;      // User's choice
      model?: string;         // Small model (claude-3-haiku, gemini-flash, etc)
      apiKey?: string;       // Or use env var
      maxTokensPerAnalysis?: number;
      temperature?: number;   // 0.1-0.3 for consistency
      validateResponses?: true; // Always validate with Zod
      fallbackToEmbedding?: true; // When validation fails
      minConfidence?: number; // LLM confidence threshold
      
      // Cost configuration - user defines based on their provider/model
      costPerToken?: number;     // e.g., 0.0000002 for input tokens
      costPerOperation?: number; // Alternative: flat rate per analysis
    };
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
  pattern: string;           // Regex or simple string match
  connectionType: ConnectionType;
  confidence: number;        // 0-1
  language?: string;         // Optional language hint
  caseSensitive?: boolean;
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

export interface ConsolidationResult {
  original: Memory[];
  consolidated: Memory;
  preservedIds?: string[];
  strategy: string;
  confidence: number;
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

// Importance scoring for memories
export interface ImportanceFactors {
  frequency: number;      // How often accessed
  recency: number;        // How recent
  connections: number;    // Number of connections
  centrality: number;     // Graph centrality
  userMarked: boolean;    // User flagged as important
  consolidated: boolean;  // Result of consolidation
}

export interface ImportanceScore {
  total: number;         // 0-1 overall score
  factors: ImportanceFactors;
  confidence: number;
  explanation?: string;
} 