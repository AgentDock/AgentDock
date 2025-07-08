import { LogCategory, logger } from '../../../logging';
import {
  MemoryOperations,
  VectorMemoryOperations
} from '../../../storage/types';
import { EmbeddingService } from '../../intelligence/embeddings/EmbeddingService';
import { SemanticMemoryData } from '../semantic/SemanticMemoryTypes';
import {
  EpisodicMemoryConfig,
  EpisodicMemoryData
} from './EpisodicMemoryTypes';

/**
 * Utility functions for EpisodicMemory operations
 * Works with memory-enabled adapters only - see index.ts for adapter compatibility
 */

// Memory adapter infrastructure (validated at initialization)
let embeddingService: EmbeddingService | null = null;
let vectorMemoryOps: VectorMemoryOperations | null = null;
let memoryOps: MemoryOperations | null = null;

/**
 * Initialize episodic memory analysis services with validated memory adapter
 * @param embedding - Embedding service for semantic operations
 * @param adapter - Validated storage adapter with memory operations
 * @param adapterName - Name of adapter for logging
 */
export function initializeEpisodicMemoryServices(
  embedding: EmbeddingService,
  adapter: any,
  adapterName: string = 'unknown'
): void {
  embeddingService = embedding;

  // Adapter is already validated by initializeMemoryUtilities
  const memoryOperations = adapter.memory as MemoryOperations;

  // Safe capability detection
  const hasVectorSearch =
    'searchByVector' in memoryOperations &&
    typeof memoryOperations.searchByVector === 'function';
  const hasHybridSearch =
    hasVectorSearch &&
    'hybridSearch' in memoryOperations &&
    typeof memoryOperations.hybridSearch === 'function';

  if (hasVectorSearch) {
    vectorMemoryOps = memoryOperations as VectorMemoryOperations;
  }

  memoryOps = memoryOperations;

  logger.info(
    LogCategory.STORAGE,
    'EpisodicMemoryUtils',
    'Episodic memory services initialized successfully',
    {
      adapterName,
      hasVectorSearch,
      hasHybridSearch,
      capabilities: hasHybridSearch
        ? 'hybrid'
        : hasVectorSearch
          ? 'vector'
          : 'text'
    }
  );
}

/**
 * Generate unique episodic memory ID
 */
export function generateEpisodicMemoryId(): string {
  return `em_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get table name for namespace
 */
export function getEpisodicTableName(namespace: string): string {
  return `episodic_memory_${namespace.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Calculate memory decay factor based on time
 */
export function calculateDecayFactor(
  timestamp: Date,
  currentTime: Date = new Date()
): number {
  const ageInHours =
    (currentTime.getTime() - timestamp.getTime()) / (1000 * 60 * 60);

  // Exponential decay: 50% after 24 hours, 25% after 48 hours, etc.
  return Math.pow(0.5, ageInHours / 24);
}

/**
 * Calculate episodic importance based on content and context
 */
export function calculateEpisodicImportance(
  content: string,
  emotionalWeight: number = 0.5,
  contextualRelevance: number = 0.5
): number {
  let importance = 0.3;

  // Emotional content is more memorable
  importance += emotionalWeight * 0.3;

  // Contextually relevant content is important
  importance += contextualRelevance * 0.3;

  // Length factor (moderate length often more important)
  if (content.length > 100 && content.length < 1000) {
    importance += 0.1;
  }

  return Math.min(importance, 1.0);
}

/**
 * Extract tags from content
 */
export function extractTags(content: string): string[] {
  const tags: string[] = [];

  const lowerContent = content.toLowerCase();

  // Topic-based tags
  if (lowerContent.includes('question')) tags.push('question');
  if (lowerContent.includes('problem')) tags.push('problem');
  if (lowerContent.includes('help')) tags.push('help');
  if (lowerContent.includes('learn')) tags.push('learning');
  if (lowerContent.includes('error')) tags.push('error');
  if (lowerContent.includes('code')) tags.push('coding');
  if (lowerContent.includes('explain')) tags.push('explanation');
  if (lowerContent.includes('example')) tags.push('example');

  return tags;
}

/**
 * Check if content represents problem-solving
 */
function isProblemSolving(content: string): boolean {
  const problemKeywords = [
    'problem',
    'issue',
    'error',
    'bug',
    'fix',
    'solve',
    'solution'
  ];
  return problemKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );
}

/**
 * Check if content represents learning
 */
function isLearningContent(content: string): boolean {
  const learningKeywords = [
    'learn',
    'understand',
    'explain',
    'how to',
    'tutorial',
    'guide'
  ];
  return learningKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );
}

/**
 * Group memories by time window for compression
 */
export function groupByTimeWindow(
  memories: EpisodicMemoryData[],
  windowHours: number = 24
): EpisodicMemoryData[][] {
  const windowMs = windowHours * 60 * 60 * 1000;
  const groups: EpisodicMemoryData[][] = [];

  // Sort by creation time
  const sorted = [...memories].sort((a, b) => a.createdAt - b.createdAt);

  let currentGroup: EpisodicMemoryData[] = [];
  let groupStartTime = 0;

  for (const memory of sorted) {
    if (currentGroup.length === 0) {
      currentGroup = [memory];
      groupStartTime = memory.createdAt;
    } else if (memory.createdAt - groupStartTime <= windowMs) {
      currentGroup.push(memory);
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [memory];
      groupStartTime = memory.createdAt;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Convert group of memories to semantic summary
 */
export function convertToSemantic(
  group: EpisodicMemoryData[]
): SemanticMemoryData | null {
  if (group.length === 0) return null;

  // Extract key information
  const allTags = new Set<string>();
  let totalImportance = 0;

  group.forEach((m) => {
    m.tags.forEach((tag) => allTags.add(tag));
    totalImportance += m.importance;
  });

  // Create compressed summary
  const summary = `Session summary (${group.length} memories): Key events and interactions from ${new Date(group[0].createdAt).toISOString()} to ${new Date(group[group.length - 1].createdAt).toISOString()}`;

  return {
    id: `sm_compressed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    agentId: group[0].agentId,
    content: summary,
    category: 'learned_experience',
    importance: Math.min((totalImportance / group.length) * 1.2, 1.0), // Boost compressed importance
    resonance: 0.8, // Required property for SemanticMemoryData
    confidence: 0.8,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    accessCount: 0,
    sourceIds: group.map((m) => m.id),
    keywords: Array.from(allTags),
    metadata: {
      compressed: true,
      originalCount: group.length,
      originalMemoryIds: group.map((m) => m.id),
      compressionDate: Date.now()
    },
    facts: [],
    relations: []
  };
}

/**
 * Apply decay formula to memory resonance
 */
export function applyDecayFormula(
  memory: EpisodicMemoryData,
  decayRate: number,
  importanceWeight: number = 0.3
): number {
  const age = Date.now() - memory.lastAccessedAt;
  const ageDays = age / (24 * 60 * 60 * 1000);

  // Apply decay formula
  const decayFactor = Math.exp(-decayRate * ageDays);
  const newResonance = memory.resonance * decayFactor;

  // Importance affects decay rate
  const importanceBoost = memory.importance * importanceWeight;
  const finalResonance = Math.max(newResonance + importanceBoost, 0);

  return finalResonance;
}

/**
 * Calculate relevance score for search results
 */
export function calculateRelevanceScore(
  memory: EpisodicMemoryData,
  query: string,
  sessionMatch: boolean = false
): number {
  let score = 0;

  // Base importance and resonance
  score += memory.importance * 0.3;
  score += memory.resonance * 0.2;

  // Recency bonus
  const age = Date.now() - memory.lastAccessedAt;
  const recencyFactor = Math.exp(-age / (7 * 24 * 60 * 60 * 1000)); // 7 day half-life
  score += recencyFactor * 0.3;

  // Content match
  if (query && memory.content.toLowerCase().includes(query.toLowerCase())) {
    score += 0.2;
  }

  // Session match bonus
  if (sessionMatch) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

/**
 * Validate episodic memory configuration
 */
export function validateEpisodicConfig(config: EpisodicMemoryConfig): boolean {
  return (
    config.maxMemoriesPerSession > 0 &&
    config.decayRate > 0 &&
    config.importanceThreshold >= 0 &&
    config.compressionAge > 0 &&
    typeof config.encryptSensitive === 'boolean'
  );
}

/**
 * Check if content is suitable for episodic memory using tiered analysis
 */
export async function isEpisodicWorthy(content: string): Promise<boolean> {
  return (
    content.length > 20 &&
    content.length < 10000 &&
    !(await isBoilerplate(content))
  );
}

/**
 * Check if content is boilerplate using tiered semantic analysis (MEMORY ADAPTERS)
 * Tier 1: Hybrid search (PostgreSQL-Vector, SQLite-Vec)
 * Tier 2: Vector search (if supported by memory adapter)
 * Tier 3: Text search (all memory adapters)
 * Tier 4: Simple keyword matching (fallback)
 */
async function isBoilerplate(content: string): Promise<boolean> {
  if (!embeddingService) {
    // Tier 4: Simple keyword matching fallback
    const trimmed = content.trim().toLowerCase();
    return (
      trimmed.length < 4 ||
      trimmed === 'hi' ||
      trimmed === 'hello' ||
      trimmed === 'hey' ||
      trimmed === 'thanks' ||
      trimmed === 'thank you' ||
      trimmed === 'ok' ||
      trimmed === 'okay' ||
      trimmed === 'yes' ||
      trimmed === 'no' ||
      trimmed === 'please' ||
      trimmed.startsWith('can you') ||
      trimmed.startsWith('could you')
    );
  }

  try {
    // Generate embedding for the content
    const embedding = await embeddingService.generateEmbedding(content);

    // Tier 1: Try hybrid search for meaningful content
    if (
      vectorMemoryOps &&
      'hybridSearch' in vectorMemoryOps &&
      typeof vectorMemoryOps.hybridSearch === 'function'
    ) {
      const meaningfulResults = await vectorMemoryOps.hybridSearch(
        'system',
        'episodic-boilerplate-detection',
        'meaningful experiences, important events, memorable conversations, significant interactions',
        embedding.embedding,
        { threshold: 0.3, limit: 1, textWeight: 0.3, vectorWeight: 0.7 }
      );

      return meaningfulResults.length === 0;
    }

    // Tier 2: Try vector-only search for meaningful content
    if (vectorMemoryOps && 'searchByVector' in vectorMemoryOps) {
      const meaningfulResults = await vectorMemoryOps.searchByVector(
        'system',
        'episodic-boilerplate-detection',
        embedding.embedding,
        { threshold: 0.3, limit: 1 }
      );

      return meaningfulResults.length === 0;
    }

    // Tier 3: Text search for meaningful content
    if (memoryOps) {
      const meaningfulResults = await memoryOps.recall(
        'system',
        'episodic-boilerplate-detection',
        'meaningful experiences important events memorable conversations',
        { limit: 1 }
      );

      return meaningfulResults.length === 0;
    }
  } catch (error) {
    logger.warn(
      LogCategory.STORAGE,
      'EpisodicMemoryUtils',
      'Boilerplate detection failed, falling back to keyword matching',
      {
        error: error instanceof Error ? error.message : String(error),
        operation: 'isBoilerplate',
        fallback: 'simple keyword matching'
      }
    );
  }

  // Tier 4: Simple keyword matching fallback
  const trimmed = content.trim().toLowerCase();
  return (
    trimmed.length < 4 ||
    trimmed === 'hi' ||
    trimmed === 'hello' ||
    trimmed === 'thanks' ||
    trimmed === 'ok' ||
    trimmed === 'yes' ||
    trimmed === 'no'
  );
}
