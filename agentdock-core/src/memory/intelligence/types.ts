import { ConnectionType, MemoryConnection } from '../../storage/types';
import { Memory } from '../types/common';

/**
 * Configuration for the memory intelligence layer
 *
 * Controls embedding generation, connection detection, consolidation,
 * and cost optimization strategies for the memory system. This is the
 * primary configuration interface for advanced memory features.
 *
 * The intelligence layer uses progressive enhancement:
 * - Level 1: Embedding similarity (always enabled, zero cost after cache)
 * - Level 2: User-defined semantic rules (free, configurable)
 * - Level 3: LLM enhancement (optional, cost-controlled)
 * - Level 4: Heuristic fallback (temporal + similarity analysis)
 *
 * @example Minimal configuration
 * ```typescript
 * const config: IntelligenceLayerConfig = {
 *   embedding: {
 *     enabled: true,
 *     similarityThreshold: 0.7
 *   },
 *   connectionDetection: {
 *     method: 'embedding-only',
 *     maxRecentMemories: 50
 *   },
 *   costControl: {
 *     maxLLMCallsPerBatch: 10,
 *     preferEmbeddingWhenSimilar: true,
 *     trackTokenUsage: true
 *   }
 * };
 * ```
 *
 * @example Full configuration with all features
 * ```typescript
 * const config: IntelligenceLayerConfig = {
 *   embedding: {
 *     enabled: true,
 *     provider: 'google',
 *     model: 'text-embedding-004',
 *     similarityThreshold: 0.75,
 *     apiKey: process.env.GOOGLE_API_KEY
 *   },
 *   connectionDetection: {
 *     method: 'hybrid',
 *     maxRecentMemories: 100,
 *     temporalWindowDays: 7,
 *     enableTemporalAnalysis: true,
 *     userRules: {
 *       enabled: true,
 *       patterns: [semanticRules]
 *     },
 *     llmEnhancement: {
 *       enabled: true,
 *       provider: 'openai',
 *       model: 'gpt-4-turbo-preview',
 *       temperature: 0.2,
 *       validateResponses: true,
 *       fallbackToEmbedding: true,
 *       costPerToken: 0.00001
 *     }
 *   },
 *   temporal: {
 *     enabled: true,
 *     analysisFrequency: 'daily',
 *     minMemoriesForAnalysis: 10,
 *     enableLLMEnhancement: false
 *   },
 *   recall: {
 *     defaultLimit: 20,
 *     productionLimit: 15,
 *     minRelevanceThreshold: 0.1,
 *     enableCaching: true,
 *     cacheTTL: 300000
 *   },
 *   costControl: {
 *     maxLLMCallsPerBatch: 10,
 *     monthlyBudget: 50,
 *     preferEmbeddingWhenSimilar: true,
 *     trackTokenUsage: true
 *   }
 * };
 * ```
 *
 * @example Cost-optimized configuration
 * ```typescript
 * const config: IntelligenceLayerConfig = {
 *   embedding: {
 *     enabled: true,
 *     provider: 'openai', // Free tier available
 *     similarityThreshold: 0.8 // Higher threshold = fewer LLM calls
 *   },
 *   connectionDetection: {
 *     method: 'user-rules', // Free semantic rules only
 *     maxRecentMemories: 25, // Smaller comparison set
 *     userRules: {
 *       enabled: true,
 *       patterns: [costEffectiveRules]
 *     }
 *   },
 *   costControl: {
 *     maxLLMCallsPerBatch: 5,
 *     monthlyBudget: 10,
 *     preferEmbeddingWhenSimilar: true, // Skip LLM for similar content
 *     trackTokenUsage: true
 *   }
 * };
 * ```
 */
export interface IntelligenceLayerConfig {
  // Base layer - always enabled, zero cost
  embedding: {
    enabled: boolean;
    provider?: 'openai' | 'google' | 'mistral' | 'voyage' | 'cohere'; // Add provider types
    similarityThreshold: number; // 0.7 default
    model?: string; // Which embedding model to use
    apiKey?: string; // Optional override
  };

  // Connection detection configuration - Clean rebuild from scratch
  connectionDetection: {
    enabled: boolean; // Default: true - simple on/off toggle

    // LLM Configuration - follows PRIME pattern for seamless API key sharing
    provider?: string; // From env: CONNECTION_PROVIDER || PRIME_PROVIDER
    apiKey?: string; // From env: CONNECTION_API_KEY || {PROVIDER}_API_KEY

    // Model selection (environment-based, no hardcoding)
    model?: string; // From env: CONNECTION_MODEL (default: provider's efficient model)
    enhancedModel?: string; // From env: CONNECTION_ENHANCED_MODEL (default: provider's powerful model)

    // Smart triage thresholds (65% cost optimization through auto-classification)
    thresholds: {
      autoSimilar: number; // Default: 0.8 (40% auto-classified as "similar")
      autoRelated: number; // Default: 0.6 (25% auto-classified as "related")
      llmRequired: number; // Default: 0.3 (35% need LLM classification into 5 types)
    };

    // Processing configuration
    maxCandidates?: number; // Default: 20
    batchSize?: number; // Default: 10
    temperature?: number; // Default: 0.2
    maxTokens?: number; // Default: 500
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
    trackTokenUsage: boolean;
  };
}

/**
 * The 5 Research-Based Connection Types - Classification Targets
 *
 * These are the fundamental connection types that the LLM classifies content relationships into.
 * Based on 50+ years of cognitive science research. These are NOT user-configurable rules,
 * but the classification reality that represents how human memory actually works.
 *
 * @see Collins & Loftus (1975) - Spreading Activation Theory
 * @see Sowa (1984) - Conceptual Graphs and Dependency Theory
 * @see Conway (2009) - Memory Opposition and Contradiction
 */
export const FIVE_CORE_CONNECTION_TYPES = {
  similar: {
    description:
      'Semantically similar content (same topics, concepts, meaning)',
    examples: ['JavaScript arrays', 'Python lists'],
    research: 'Collins & Loftus (1975) - Spreading Activation Theory'
  },
  causes: {
    description: 'One memory leads to/causes the other (causal relationship)',
    examples: ['Bug reported', 'Fix deployed'],
    research: 'Sowa (1984) - Conceptual dependency theory'
  },
  part_of: {
    description: 'One memory is component/part of the other (hierarchical)',
    examples: ['Login component', 'Authentication system'],
    research: 'Sowa (1984) - Conceptual graphs'
  },
  opposite: {
    description: 'Memories contradict or oppose each other',
    examples: ['Dark mode preferred', 'Light mode selected'],
    research: 'Conway (2009) - Memory opposition and contradiction'
  },
  related: {
    description: 'General association or reference between topics',
    examples: ['React discussion', 'Frontend project'],
    research: 'Collins & Loftus (1975) - Associative networks'
  }
} as const;

/**
 * Memory connection graph for relationship analysis and traversal
 *
 * Represents memories as nodes and their relationships as edges in a directed graph.
 * Enables sophisticated memory traversal, cluster analysis, and path finding
 * between related memories for enhanced context retrieval.
 *
 * The graph structure supports both simple connections and complex relationship
 * networks, allowing agents to understand memory relationships at multiple levels.
 *
 * @example Basic graph construction
 * ```typescript
 * const graph: ConnectionGraph = new MemoryConnectionGraph();
 *
 * // Add memories as nodes
 * graph.addNode(userActionMemory);
 * graph.addNode(systemResponseMemory);
 *
 * // Add causal connection
 * graph.addEdge({
 *   id: 'conn_123',
 *   sourceMemoryId: userActionMemory.id,
 *   targetMemoryId: systemResponseMemory.id,
 *   connectionType: 'causes',
 *   strength: 0.9,
 *   createdAt: Date.now()
 * });
 * ```
 *
 * @example Path finding and traversal
 * ```typescript
 * // Find connection path between memories
 * const path = graph.findPath('mem_start', 'mem_end');
 * console.log(`Connection path: ${path.join(' -> ')}`);
 *
 * // Get immediate neighbors
 * const neighbors = graph.getNeighbors('mem_123', 'causes');
 * console.log(`Found ${neighbors.length} causal connections`);
 *
 * // Discover memory clusters
 * const clusters = graph.getClusters();
 * clusters.forEach((cluster, i) => {
 *   console.log(`Cluster ${i}: ${cluster.length} related memories`);
 * });
 * ```
 *
 * @example Graph analysis workflow
 * ```typescript
 * // Build comprehensive graph
 * for (const memory of memories) {
 *   graph.addNode(memory);
 * }
 *
 * for (const connection of connections) {
 *   graph.addEdge(connection);
 * }
 *
 * // Analyze memory relationships
 * const centralMemories = graph.getClusters()
 *   .filter(cluster => cluster.length > 5)
 *   .map(cluster => cluster[0]); // Get cluster centers
 *
 * console.log(`Found ${centralMemories.length} memory hubs`);
 * ```
 */
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

/**
 * Configuration for embedding service initialization
 *
 * Defines settings for embedding generation including provider selection,
 * model configuration, caching strategies, and batch processing options.
 * Used to initialize the EmbeddingService with optimal performance settings.
 *
 * @example OpenAI configuration
 * ```typescript
 * const openaiConfig: EmbeddingConfig = {
 *   provider: 'openai',
 *   model: 'text-embedding-3-large',
 *   dimensions: 3072,
 *   cacheEnabled: true,
 *   batchSize: 100,
 *   cacheSize: 1000
 * };
 * ```
 *
 * @example Google Gemini configuration
 * ```typescript
 * const googleConfig: EmbeddingConfig = {
 *   provider: 'google',
 *   model: 'text-embedding-004',
 *   dimensions: 768,
 *   cacheEnabled: true,
 *   batchSize: 50,
 *   cacheSize: 500
 * };
 * ```
 *
 * @example Minimal configuration
 * ```typescript
 * const minimalConfig: EmbeddingConfig = {
 *   provider: 'openai',
 *   model: 'text-embedding-ada-002'
 *   // Other settings will use defaults
 * };
 * ```
 */
// Embedding service types - simplified and configurable
export interface EmbeddingConfig {
  provider: string;
  model: string;
  dimensions?: number;
  cacheEnabled?: boolean;
  batchSize?: number;
  cacheSize?: number;
}

/**
 * Result of embedding generation with metadata
 *
 * Contains the generated embedding vector along with provider information
 * and performance metadata. Used for caching decisions and quality assessment.
 *
 * @example Processing embedding result
 * ```typescript
 * const result: EmbeddingResult = await embeddingService.generateEmbedding(
 *   'User prefers dark mode interface'
 * );
 *
 * console.log(`Provider: ${result.provider}`);
 * console.log(`Model: ${result.model}`);
 * console.log(`Dimensions: ${result.dimensions}`);
 * console.log(`From cache: ${result.cached ? 'Yes' : 'No'}`);
 * console.log(`Vector length: ${result.embedding.length}`);
 * ```
 *
 * @example Batch processing results
 * ```typescript
 * const texts = ['text1', 'text2', 'text3'];
 * const results: EmbeddingResult[] = [];
 *
 * for (const text of texts) {
 *   const result = await embeddingService.generateEmbedding(text);
 *   results.push(result);
 * }
 *
 * const cachedCount = results.filter(r => r.cached).length;
 * console.log(`${cachedCount}/${results.length} results from cache`);
 * ```
 *
 * @example Quality verification
 * ```typescript
 * const result = await embeddingService.generateEmbedding(content);
 *
 * // Verify embedding quality
 * if (result.embedding.length !== result.dimensions) {
 *   throw new Error('Embedding dimension mismatch');
 * }
 *
 * // Check for valid embedding values
 * const hasInvalidValues = result.embedding.some(val =>
 *   !Number.isFinite(val) || Math.abs(val) > 10
 * );
 *
 * if (hasInvalidValues) {
 *   console.warn('Unusual embedding values detected');
 * }
 * ```
 */
export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  provider: string;
  model: string;
  cached?: boolean;
}

/**
 * Temporal pattern in memory activity and behavior
 *
 * Represents recurring patterns in memory creation, access, or content themes
 * discovered through temporal analysis. Used for predictive insights and
 * behavioral understanding.
 *
 * @example Daily routine pattern
 * ```typescript
 * const dailyRoutine: TemporalPattern = {
 *   type: 'daily',
 *   frequency: 1, // Once per day
 *   confidence: 0.85,
 *   memories: ['mem_morning_coffee', 'mem_check_email', 'mem_standup_meeting'],
 *   metadata: {
 *     peakTimes: [
 *       new Date('2025-01-01T09:00:00Z'),
 *       new Date('2025-01-02T09:15:00Z'),
 *       new Date('2025-01-03T08:45:00Z')
 *     ],
 *     interval: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
 *     description: 'Morning routine activities between 8:45-9:15 AM'
 *   }
 * };
 * ```
 *
 * @example Weekly project pattern
 * ```typescript
 * const weeklyProject: TemporalPattern = {
 *   type: 'weekly',
 *   frequency: 1, // Once per week
 *   confidence: 0.72,
 *   memories: ['mem_project_review', 'mem_team_retrospective', 'mem_planning'],
 *   metadata: {
 *     peakTimes: [
 *       new Date('2025-01-03T14:00:00Z'), // Friday afternoons
 *       new Date('2025-01-10T14:30:00Z'),
 *       new Date('2025-01-17T13:45:00Z')
 *     ],
 *     interval: 7 * 24 * 60 * 60 * 1000, // 7 days
 *     description: 'Weekly project activities on Friday afternoons'
 *   }
 * };
 * ```
 *
 * @example Burst activity pattern
 * ```typescript
 * const burstActivity: TemporalPattern = {
 *   type: 'burst',
 *   confidence: 0.68,
 *   memories: ['mem_bug_report', 'mem_fix_attempt', 'mem_testing', 'mem_deployment'],
 *   metadata: {
 *     description: 'Intense problem-solving sessions with rapid memory creation',
 *     interval: 2 * 60 * 60 * 1000 // 2-hour burst periods
 *   }
 * };
 * ```
 */
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

/**
 * Cluster of related memory activity within a time window
 *
 * Groups memories that were created or accessed within a specific time period
 * and share common topics or themes. Used for understanding activity bursts
 * and identifying focused work sessions.
 *
 * @example Problem-solving session cluster
 * ```typescript
 * const problemSolvingCluster: ActivityCluster = {
 *   startTime: new Date('2025-01-15T09:30:00Z'),
 *   endTime: new Date('2025-01-15T12:45:00Z'),
 *   memoryIds: [
 *     'mem_bug_discovered',
 *     'mem_investigate_logs',
 *     'mem_identify_root_cause',
 *     'mem_implement_fix',
 *     'mem_test_solution'
 *   ],
 *   topics: ['debugging', 'problem-solving', 'software-fix'],
 *   intensity: 0.85 // High intensity activity
 * };
 * ```
 *
 * @example Learning session cluster
 * ```typescript
 * const learningCluster: ActivityCluster = {
 *   startTime: new Date('2025-01-15T14:00:00Z'),
 *   endTime: new Date('2025-01-15T16:30:00Z'),
 *   memoryIds: [
 *     'mem_read_documentation',
 *     'mem_watch_tutorial',
 *     'mem_practice_example',
 *     'mem_take_notes'
 *   ],
 *   topics: ['learning', 'documentation', 'tutorial', 'practice'],
 *   intensity: 0.65 // Medium intensity activity
 * };
 * ```
 *
 * @example Brief task cluster
 * ```typescript
 * const quickTaskCluster: ActivityCluster = {
 *   startTime: new Date('2025-01-15T10:15:00Z'),
 *   endTime: new Date('2025-01-15T10:45:00Z'),
 *   memoryIds: [
 *     'mem_check_email',
 *     'mem_respond_message',
 *     'mem_update_status'
 *   ],
 *   topics: ['communication', 'email', 'status-update'],
 *   intensity: 0.3 // Low intensity activity
 * };
 * ```
 */
export interface ActivityCluster {
  startTime: Date;
  endTime: Date;
  memoryIds: string[];
  topics: string[];
  intensity: number; // Activity level 0-1
}

/**
 * Candidate memories for consolidation into higher-level concepts
 *
 * Identifies groups of related memories that can be merged, synthesized,
 * or abstracted into more general knowledge. Used by the consolidation
 * engine to reduce memory fragmentation and create semantic knowledge.
 *
 * @example Merge strategy for duplicate information
 * ```typescript
 * const duplicateCandidate: ConsolidationCandidate = {
 *   memories: [
 *     { id: 'mem_1', content: 'User prefers dark theme', similarity: 0.95 },
 *     { id: 'mem_2', content: 'User likes dark mode interface', similarity: 0.95 },
 *     { id: 'mem_3', content: 'User set theme to dark', similarity: 0.95 }
 *   ],
 *   similarity: 0.95,
 *   strategy: 'merge',
 *   suggestedTitle: 'User Theme Preference',
 *   suggestedContent: 'User consistently prefers dark theme/mode interface'
 * };
 * ```
 *
 * @example Synthesis strategy for related concepts
 * ```typescript
 * const synthesisCandidate: ConsolidationCandidate = {
 *   memories: [
 *     { id: 'mem_a', content: 'User struggles with complex forms', similarity: 0.78 },
 *     { id: 'mem_b', content: 'User requested simpler navigation', similarity: 0.82 },
 *     { id: 'mem_c', content: 'User mentioned UI confusion', similarity: 0.75 }
 *   ],
 *   similarity: 0.78,
 *   strategy: 'synthesize',
 *   suggestedTitle: 'User Experience Feedback',
 *   suggestedContent: 'User consistently reports usability issues and requests for simpler interfaces'
 * };
 * ```
 *
 * @example Abstraction strategy for pattern recognition
 * ```typescript
 * const abstractCandidate: ConsolidationCandidate = {
 *   memories: [
 *     { id: 'mem_x', content: 'Fixed login bug after user report', similarity: 0.65 },
 *     { id: 'mem_y', content: 'Resolved payment issue from feedback', similarity: 0.68 },
 *     { id: 'mem_z', content: 'Updated UI based on user suggestion', similarity: 0.62 }
 *   ],
 *   similarity: 0.65,
 *   strategy: 'abstract',
 *   suggestedTitle: 'User-Driven Improvements',
 *   suggestedContent: 'System improvements consistently originate from user feedback and reports'
 * };
 * ```
 */
// Consolidation types
export interface ConsolidationCandidate {
  memories: Memory[];
  similarity: number;
  strategy: 'merge' | 'synthesize' | 'abstract' | 'hierarchy';
  suggestedTitle?: string;
  suggestedContent?: string;
}

/**
 * Configuration for memory consolidation process
 *
 * Controls how memories are identified, grouped, and consolidated into
 * higher-level semantic knowledge. Enables fine-tuning of consolidation
 * strategies, LLM enhancement, and preservation policies.
 *
 * @example Conservative consolidation config
 * ```typescript
 * const conservativeConfig: ConsolidationConfig = {
 *   similarityThreshold: 0.9, // High threshold for safety
 *   maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days max age
 *   preserveOriginals: true, // Keep original memories
 *   strategies: ['merge'], // Only merge very similar content
 *   batchSize: 10, // Small batches
 *   enableLLMSummarization: false // No LLM to avoid costs
 * };
 * ```
 *
 * @example Aggressive consolidation config
 * ```typescript
 * const aggressiveConfig: ConsolidationConfig = {
 *   similarityThreshold: 0.7, // Lower threshold for more consolidation
 *   maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days max age
 *   preserveOriginals: false, // Replace with consolidated versions
 *   strategies: ['merge', 'synthesize', 'abstract'], // All strategies
 *   batchSize: 50, // Larger batches for efficiency
 *   enableLLMSummarization: true,
 *   llmConfig: {
 *     provider: 'openai',
 *     model: 'gpt-4-turbo-preview',
 *     costPerToken: 0.00001,
 *     maxTokensPerSummary: 200
 *   }
 * };
 * ```
 *
 * @example Production-balanced config
 * ```typescript
 * const productionConfig: ConsolidationConfig = {
 *   similarityThreshold: 0.8, // Balanced threshold
 *   maxAge: 14 * 24 * 60 * 60 * 1000, // 2 weeks max age
 *   preserveOriginals: true, // Safe preservation
 *   strategies: ['merge', 'synthesize'], // Safe strategies only
 *   batchSize: 25, // Moderate batch size
 *   enableLLMSummarization: true,
 *   llmConfig: {
 *     provider: 'openai',
 *     model: 'gpt-4o-mini', // Cost-effective model
 *     costPerToken: 0.000002,
 *     maxTokensPerSummary: 150
 *   }
 * };
 * ```
 */
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
