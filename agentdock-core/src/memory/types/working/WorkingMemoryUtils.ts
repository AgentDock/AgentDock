import { LogCategory, logger } from '../../../logging';
import {
  MemoryOperations,
  VectorMemoryOperations
} from '../../../storage/types';
import { EmbeddingService } from '../../intelligence/embeddings/EmbeddingService';
import { WorkingMemoryData, WorkingMemoryConfig } from './WorkingMemoryTypes';

/**
 * Utility functions for WorkingMemory operations
 * Works with memory-enabled adapters only - see index.ts for adapter compatibility
 */

// Memory adapter infrastructure (validated at initialization)
let embeddingService: EmbeddingService | null = null;
let vectorMemoryOps: VectorMemoryOperations | null = null;
let memoryOps: MemoryOperations | null = null;

/**
 * Initialize working memory analysis services with validated memory adapter
 * @param embedding - Embedding service for semantic operations
 * @param adapter - Validated storage adapter with memory operations
 * @param adapterName - Name of adapter for logging
 */
export function initializeWorkingMemoryServices(
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
    'WorkingMemoryUtils',
    'Working memory services initialized successfully',
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
 * Estimate token count for content
 */
export function estimateTokens(content: string): number {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(content.length / 4);
}

/**
 * Generate unique working memory ID
 */
export function generateWorkingMemoryId(): string {
  return `wm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Consolidate similar memories for compression
 */
export function consolidateSimilarMemories(
  memories: WorkingMemoryData[]
): WorkingMemoryData[] {
  // Simple consolidation: group by similar content length and importance
  const groups = new Map<string, WorkingMemoryData[]>();

  memories.forEach((memory) => {
    const key = `${Math.floor(memory.importance * 10)}_${Math.floor(memory.tokenCount / 100)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(memory);
  });

  const consolidated: WorkingMemoryData[] = [];

  for (const group of Array.from(groups.values())) {
    if (group.length === 1) {
      consolidated.push(group[0]);
    } else {
      // Merge group into single memory
      const merged = {
        ...group[0],
        content: group.map((m) => m.content).join('\n\n'),
        tokenCount: group.reduce((sum, m) => sum + m.tokenCount, 0),
        importance: Math.max(...group.map((m) => m.importance)),
        metadata: {
          ...group[0].metadata,
          consolidatedFrom: group.map((m) => m.id),
          originalCount: group.length
        }
      };
      consolidated.push(merged);
    }
  }

  return consolidated;
}

/**
 * Check if content is suitable for working memory using tiered analysis
 */
export async function isWorkingMemoryWorthy(content: string): Promise<boolean> {
  return (
    content.length > 10 &&
    content.length < 5000 &&
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
        'working-boilerplate-detection',
        'meaningful conversation, important context, valuable working information',
        embedding.embedding,
        { threshold: 0.3, limit: 1, textWeight: 0.3, vectorWeight: 0.7 }
      );

      return meaningfulResults.length === 0;
    }

    // Tier 2: Try vector-only search for meaningful content
    if (vectorMemoryOps && 'searchByVector' in vectorMemoryOps) {
      const meaningfulResults = await vectorMemoryOps.searchByVector(
        'system',
        'working-boilerplate-detection',
        embedding.embedding,
        { threshold: 0.3, limit: 1 }
      );

      return meaningfulResults.length === 0;
    }

    // Tier 3: Text search for meaningful content
    if (memoryOps) {
      const meaningfulResults = await memoryOps.recall(
        'system',
        'working-boilerplate-detection',
        'meaningful conversation important context valuable information',
        { limit: 1 }
      );

      return meaningfulResults.length === 0;
    }
  } catch (error) {
    logger.warn(
      LogCategory.STORAGE,
      'WorkingMemoryUtils',
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

/**
 * Calculate importance based on content characteristics using tiered analysis
 */
export async function calculateImportance(
  content: string,
  position: number = 0
): Promise<number> {
  let importance = 0.5;

  // Recent messages are more important for working memory
  const recencyBonus = Math.max(0, 0.3 * (1 - position / 10));
  importance += recencyBonus;

  // Questions and requests are important (use tiered analysis)
  if ((await containsQuestion(content)) || (await containsRequest(content))) {
    importance += 0.2;
  }

  // Complex content is more important
  if (content.length > 200) {
    importance += 0.1;
  }

  return Math.min(importance, 1.0);
}

/**
 * Check if content contains a question using tiered semantic analysis (MEMORY ADAPTERS)
 * Tier 1: Hybrid search (PostgreSQL-Vector, SQLite-Vec)
 * Tier 2: Vector search (if supported by memory adapter)
 * Tier 3: Text search (all memory adapters)
 * Tier 4: Simple pattern matching (fallback)
 */
async function containsQuestion(content: string): Promise<boolean> {
  // Quick check for question mark
  if (content.includes('?')) {
    return true;
  }

  if (!embeddingService) {
    // Tier 4: Simple pattern matching fallback
    const lowerContent = content.toLowerCase();
    return (
      lowerContent.startsWith('what') ||
      lowerContent.startsWith('how') ||
      lowerContent.startsWith('why') ||
      lowerContent.startsWith('when') ||
      lowerContent.startsWith('where') ||
      lowerContent.startsWith('who')
    );
  }

  try {
    // Generate embedding for the content
    const embedding = await embeddingService.generateEmbedding(content);

    // Tier 1: Try hybrid search for question patterns
    if (
      vectorMemoryOps &&
      'hybridSearch' in vectorMemoryOps &&
      typeof vectorMemoryOps.hybridSearch === 'function'
    ) {
      const questionResults = await vectorMemoryOps.hybridSearch(
        'system',
        'question-detection',
        'questions, inquiries, requests for information, asking for help',
        embedding.embedding,
        { threshold: 0.7, limit: 1, textWeight: 0.3, vectorWeight: 0.7 }
      );

      return questionResults.length > 0;
    }

    // Tier 2: Try vector-only search for question patterns
    if (vectorMemoryOps && 'searchByVector' in vectorMemoryOps) {
      const questionResults = await vectorMemoryOps.searchByVector(
        'system',
        'question-detection',
        embedding.embedding,
        { threshold: 0.7, limit: 1 }
      );

      return questionResults.length > 0;
    }

    // Tier 3: Text search for question patterns
    if (memoryOps) {
      const questionResults = await memoryOps.recall(
        'system',
        'question-detection',
        'what how why when where who questions inquiry',
        { limit: 1 }
      );

      return questionResults.length > 0;
    }
  } catch (error) {
    logger.warn(
      LogCategory.STORAGE,
      'WorkingMemoryUtils',
      'Question detection failed, falling back to pattern matching',
      {
        error: error instanceof Error ? error.message : String(error),
        operation: 'containsQuestion',
        fallback: 'simple pattern matching'
      }
    );
  }

  // Tier 4: Simple pattern matching fallback
  const lowerContent = content.toLowerCase();
  return (
    lowerContent.startsWith('what') ||
    lowerContent.startsWith('how') ||
    lowerContent.startsWith('why')
  );
}

/**
 * Check if content contains a request using tiered semantic analysis (MEMORY ADAPTERS)
 * Tier 1: Hybrid search (PostgreSQL-Vector, SQLite-Vec)
 * Tier 2: Vector search (if supported by memory adapter)
 * Tier 3: Text search (all memory adapters)
 * Tier 4: Simple pattern matching (fallback)
 */
async function containsRequest(content: string): Promise<boolean> {
  if (!embeddingService) {
    // Tier 4: Simple pattern matching fallback
    const lowerContent = content.toLowerCase();
    return (
      lowerContent.startsWith('please') ||
      lowerContent.startsWith('can you') ||
      lowerContent.startsWith('could you') ||
      lowerContent.startsWith('would you') ||
      lowerContent.startsWith('help me') ||
      lowerContent.startsWith('i need')
    );
  }

  try {
    // Generate embedding for the content
    const embedding = await embeddingService.generateEmbedding(content);

    // Tier 1: Try hybrid search for request patterns
    if (
      vectorMemoryOps &&
      'hybridSearch' in vectorMemoryOps &&
      typeof vectorMemoryOps.hybridSearch === 'function'
    ) {
      const requestResults = await vectorMemoryOps.hybridSearch(
        'system',
        'request-detection',
        'requests for help, asking someone to do something, polite commands',
        embedding.embedding,
        { threshold: 0.7, limit: 1, textWeight: 0.3, vectorWeight: 0.7 }
      );

      return requestResults.length > 0;
    }

    // Tier 2: Try vector-only search for request patterns
    if (vectorMemoryOps && 'searchByVector' in vectorMemoryOps) {
      const requestResults = await vectorMemoryOps.searchByVector(
        'system',
        'request-detection',
        embedding.embedding,
        { threshold: 0.7, limit: 1 }
      );

      return requestResults.length > 0;
    }

    // Tier 3: Text search for request patterns
    if (memoryOps) {
      const requestResults = await memoryOps.recall(
        'system',
        'request-detection',
        'please can you could you help request',
        { limit: 1 }
      );

      return requestResults.length > 0;
    }
  } catch (error) {
    logger.warn(
      LogCategory.STORAGE,
      'WorkingMemoryUtils',
      'Request detection failed, falling back to pattern matching',
      {
        error: error instanceof Error ? error.message : String(error),
        operation: 'containsRequest',
        fallback: 'simple pattern matching'
      }
    );
  }

  // Tier 4: Simple pattern matching fallback
  const lowerContent = content.toLowerCase();
  return (
    lowerContent.startsWith('please') ||
    lowerContent.startsWith('can you') ||
    lowerContent.startsWith('could you')
  );
}

/**
 * Prepare SQL table name for namespace
 */
export function getTableName(namespace: string): string {
  return `working_memory_${namespace.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Validate working memory configuration
 */
export function validateConfig(config: WorkingMemoryConfig): boolean {
  return (
    config.maxTokens > 0 &&
    config.ttlSeconds > 0 &&
    config.maxContextItems > 0 &&
    typeof config.encryptSensitive === 'boolean'
  );
}
