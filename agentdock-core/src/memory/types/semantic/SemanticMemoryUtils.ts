import { createHash } from 'crypto';
import { LogCategory, logger } from '../../../logging';
import {
  MemoryOperations,
  VectorMemoryOperations
} from '../../../storage/types';
import { EmbeddingService } from '../../intelligence/embeddings/EmbeddingService';
import { SemanticMemoryData, SemanticMemoryConfig } from './SemanticMemoryTypes';

/**
 * Utility functions for SemanticMemory operations
 * Works with memory-enabled adapters only - see index.ts for adapter compatibility
 */

// Memory adapter infrastructure (validated at initialization)
let embeddingService: EmbeddingService | null = null;
let vectorMemoryOps: VectorMemoryOperations | null = null;
let memoryOps: MemoryOperations | null = null;

/**
 * Initialize semantic analysis services with validated memory adapter
 * @param embedding - Embedding service for semantic operations
 * @param adapter - Validated storage adapter with memory operations
 * @param adapterName - Name of adapter for logging
 */
export function initializeSemanticServices(
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
    'SemanticMemoryUtils',
    'Semantic services initialized successfully',
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
 * Generate unique semantic memory ID
 */
export function generateSemanticMemoryId(): string {
  return `sm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get table name for namespace
 */
export function getSemanticTableName(namespace: string): string {
  return `semantic_memory_${namespace.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Extract keywords from content using simple frequency analysis
 */
export function extractKeywords(content: string): string[] {
  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .filter((word) => !isStopWord(word));

  // Count frequency and return top keywords
  const wordCount = new Map<string, number>();
  words.forEach((word) => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  });

  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Extract facts from content using tiered semantic search (MEMORY ADAPTERS)
 * Tier 1: Hybrid search (PostgreSQL-Vector, SQLite-Vec)
 * Tier 2: Vector search (if supported by memory adapter)
 * Tier 3: Text search (all memory adapters)
 * Tier 4: Simple content analysis (fallback)
 */
export async function extractFacts(content: string): Promise<string[]> {
  if (!embeddingService) {
    // Tier 4: Simple content analysis fallback
    return content.length > 50 ? [content.substring(0, 100)] : [];
  }

  try {
    // Generate embedding for the content
    const embedding = await embeddingService.generateEmbedding(content);
    const factQuery =
      'factual statements, definitions, objective information, things that are true';

    // Tier 1: Try hybrid search (PostgreSQL-Vector, SQLite-Vec)
    if (
      vectorMemoryOps &&
      'hybridSearch' in vectorMemoryOps &&
      typeof vectorMemoryOps.hybridSearch === 'function'
    ) {
      const hybridResults = await vectorMemoryOps.hybridSearch(
        'system',
        'fact-extraction',
        factQuery,
        embedding.embedding,
        {
          threshold: 0.6,
          limit: 5,
          textWeight: 0.3,
          vectorWeight: 0.7
        }
      );

      if (hybridResults.length > 0) {
        return hybridResults
          .filter(
            (result) =>
              result.content.length > 10 && result.content.length < 200
          )
          .map((result) => result.content.trim())
          .slice(0, 5);
      }
    }

    // Tier 2: Try vector-only search (if supported by memory adapter)
    if (vectorMemoryOps && 'searchByVector' in vectorMemoryOps) {
      const vectorResults = await vectorMemoryOps.searchByVector(
        'system',
        'fact-extraction',
        embedding.embedding,
        {
          threshold: 0.6,
          limit: 5
        }
      );

      if (vectorResults.length > 0) {
        return vectorResults
          .filter(
            (result) =>
              result.content.length > 10 && result.content.length < 200
          )
          .map((result) => result.content.trim())
          .slice(0, 5);
      }
    }

    // Tier 3: Try text search (all memory adapters)
    if (memoryOps) {
      const textResults = await memoryOps.recall(
        'system',
        'fact-extraction',
        factQuery,
        { limit: 5 }
      );

      if (textResults.length > 0) {
        return textResults
          .filter(
            (result) =>
              result.content.length > 10 && result.content.length < 200
          )
          .map((result) => result.content.trim())
          .slice(0, 5);
      }
    }
  } catch (error) {
    logger.warn(
      LogCategory.STORAGE,
      'SemanticMemoryUtils',
      'Semantic search failed, falling back to simple analysis',
      {
        error: error instanceof Error ? error.message : String(error),
        operation: 'extractFacts',
        fallback: 'simple content analysis'
      }
    );
  }

  // Tier 4: Simple content analysis fallback
  return content.length > 50 ? [content.substring(0, 100)] : [];
}

/**
 * Categorize semantic content based on keywords and patterns using tiered search
 */
export async function categorizeContent(content: string): Promise<string> {
  const lowerContent = content.toLowerCase();

  if (lowerContent.includes('code') || lowerContent.includes('programming')) {
    return 'programming';
  }
  if (lowerContent.includes('definition') || (await isDefinition(content))) {
    return 'definition';
  }
  if (isExplanation(content)) {
    return 'explanation';
  }
  if (lowerContent.includes('fact') || lowerContent.includes('information')) {
    return 'facts';
  }
  if (lowerContent.includes('procedure') || lowerContent.includes('how to')) {
    return 'procedure';
  }

  return 'general_knowledge';
}

/**
 * Calculate semantic memory importance based on content characteristics
 */
export async function calculateSemanticImportance(
  content: string,
  facts: string[] = [],
  keywords: string[] = []
): Promise<number> {
  let importance = 0.4;

  // More facts = more important
  importance += Math.min(facts.length * 0.1, 0.3);

  // More keywords = more comprehensive
  importance += Math.min(keywords.length * 0.02, 0.2);

  // Definitions and explanations are important
  if ((await isDefinition(content)) || isExplanation(content)) {
    importance += 0.3;
  }

  // Longer content might be more detailed
  if (content.length > 500) {
    importance += 0.1;
  }

  return Math.min(importance, 1.0);
}

/**
 * Calculate confidence based on content quality using tiered semantic analysis (MEMORY ADAPTERS)
 * Tier 1: Hybrid search (PostgreSQL-Vector, SQLite-Vec)
 * Tier 2: Vector search (if supported by memory adapter)
 * Tier 3: Text search (all memory adapters)
 * Tier 4: Simple heuristics (fallback)
 */
export async function calculateSemanticConfidence(
  content: string,
  sourceRole: string = 'assistant',
  facts: string[] = []
): Promise<number> {
  let confidence = 0.5;

  // Assistant messages generally more reliable
  if (sourceRole === 'assistant') confidence += 0.2;

  // More facts = higher confidence
  confidence += Math.min(facts.length * 0.05, 0.2);

  if (!embeddingService) {
    // Tier 4: Simple heuristics fallback
    return Math.max(Math.min(confidence, 1.0), 0.1);
  }

  try {
    // Generate embedding for the content
    const embedding = await embeddingService.generateEmbedding(content);

    // Tier 1: Try hybrid search for confidence indicators
    if (
      vectorMemoryOps &&
      'hybridSearch' in vectorMemoryOps &&
      typeof vectorMemoryOps.hybridSearch === 'function'
    ) {
      const confidenceResults = await vectorMemoryOps.hybridSearch(
        'system',
        'confidence-analysis',
        'definitive statements, certain information, confident assertions, clear facts',
        embedding.embedding,
        { threshold: 0.7, limit: 1, textWeight: 0.3, vectorWeight: 0.7 }
      );

      if (confidenceResults.length > 0) {
        confidence += 0.1;
      }

      const uncertaintyResults = await vectorMemoryOps.hybridSearch(
        'system',
        'uncertainty-analysis',
        'uncertain statements, maybe, perhaps, might be, possibly, unclear information',
        embedding.embedding,
        { threshold: 0.7, limit: 1, textWeight: 0.3, vectorWeight: 0.7 }
      );

      if (uncertaintyResults.length > 0) {
        confidence -= 0.1;
      }

      return Math.max(Math.min(confidence, 1.0), 0.1);
    }

    // Tier 2: Try vector-only search for confidence indicators
    if (vectorMemoryOps && 'searchByVector' in vectorMemoryOps) {
      const confidenceResults = await vectorMemoryOps.searchByVector(
        'system',
        'confidence-analysis',
        embedding.embedding,
        { threshold: 0.7, limit: 1 }
      );

      if (confidenceResults.length > 0) {
        confidence += 0.1;
      }

      return Math.max(Math.min(confidence, 1.0), 0.1);
    }

    // Tier 3: Text search for confidence patterns
    if (memoryOps) {
      const confidenceResults = await memoryOps.recall(
        'system',
        'confidence-analysis',
        'definitive certain confident clear',
        { limit: 1 }
      );

      if (confidenceResults.length > 0) {
        confidence += 0.05;
      }
    }
  } catch (error) {
    logger.warn(
      LogCategory.STORAGE,
      'SemanticMemoryUtils',
      'Confidence analysis failed, falling back to simple heuristics',
      {
        error: error instanceof Error ? error.message : String(error),
        operation: 'calculateSemanticConfidence',
        fallback: 'simple heuristics'
      }
    );
  }

  // Tier 4: Simple heuristics
  return Math.max(Math.min(confidence, 1.0), 0.1);
}

/**
 * Check if content is a definition using tiered semantic analysis (MEMORY ADAPTERS)
 * Tier 1: Hybrid search (PostgreSQL-Vector, SQLite-Vec)
 * Tier 2: Vector search (if supported by memory adapter)
 * Tier 3: Text search (all memory adapters)
 * Tier 4: Simple keyword matching (fallback)
 */
export async function isDefinition(content: string): Promise<boolean> {
  if (!embeddingService) {
    // Tier 4: Simple keyword matching fallback
    const lowerContent = content.toLowerCase();
    return (
      lowerContent.includes('means') ||
      lowerContent.includes('refers to') ||
      lowerContent.includes('definition')
    );
  }

  try {
    // Generate embedding for the content
    const embedding = await embeddingService.generateEmbedding(content);

    // Tier 1: Try hybrid search for definition patterns
    if (
      vectorMemoryOps &&
      'hybridSearch' in vectorMemoryOps &&
      typeof vectorMemoryOps.hybridSearch === 'function'
    ) {
      const definitionResults = await vectorMemoryOps.hybridSearch(
        'system',
        'definition-detection',
        'definitions, explanations of what something means, describes what something is',
        embedding.embedding,
        { threshold: 0.75, limit: 1, textWeight: 0.3, vectorWeight: 0.7 }
      );

      return definitionResults.length > 0;
    }

    // Tier 2: Try vector-only search for definition patterns
    if (vectorMemoryOps && 'searchByVector' in vectorMemoryOps) {
      const definitionResults = await vectorMemoryOps.searchByVector(
        'system',
        'definition-detection',
        embedding.embedding,
        { threshold: 0.75, limit: 1 }
      );

      return definitionResults.length > 0;
    }

    // Tier 3: Text search for definition patterns
    if (memoryOps) {
      const definitionResults = await memoryOps.recall(
        'system',
        'definition-detection',
        'means refers definition explains describes',
        { limit: 1 }
      );

      return definitionResults.length > 0;
    }
  } catch (error) {
    logger.warn(
      LogCategory.STORAGE,
      'SemanticMemoryUtils',
      'Definition detection failed, falling back to keyword matching',
      {
        error: error instanceof Error ? error.message : String(error),
        operation: 'isDefinition',
        fallback: 'simple keyword matching'
      }
    );
  }

  // Tier 4: Simple keyword matching fallback
  const lowerContent = content.toLowerCase();
  return (
    lowerContent.includes('means') ||
    lowerContent.includes('refers to') ||
    lowerContent.includes('definition')
  );
}

/**
 * Check if content is an explanation
 */
export function isExplanation(content: string): boolean {
  return (
    content.includes('because') ||
    content.includes('therefore') ||
    content.includes('as a result') ||
    /this (is|works|happens) because/i.test(content) ||
    /the reason (.+) is/i.test(content)
  );
}

/**
 * Check if word is a stop word
 */
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'this',
    'that',
    'these',
    'those',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'should',
    'could',
    'can',
    'may',
    'might',
    'must'
  ]);
  return stopWords.has(word);
}

/**
 * Find similar content based on keyword overlap
 */
export function calculateContentSimilarity(
  content1: string,
  content2: string,
  keywords1: string[],
  keywords2: string[]
): number {
  // Simple similarity based on keyword overlap
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  const intersection = new Set(Array.from(set1).filter((x) => set2.has(x)));
  const union = new Set(Array.from(set1).concat(Array.from(set2)));

  const jaccardSimilarity = intersection.size / union.size;

  // Also consider content length similarity
  const lengthSimilarity =
    1 -
    Math.abs(content1.length - content2.length) /
      Math.max(content1.length, content2.length);

  return jaccardSimilarity * 0.7 + lengthSimilarity * 0.3;
}

/**
 * Merge two semantic memories into one
 */
export function mergeSemanticMemories(
  memory1: SemanticMemoryData,
  memory2: SemanticMemoryData
): SemanticMemoryData {
  // Keep the one with higher confidence as base
  const primary = memory1.confidence >= memory2.confidence ? memory1 : memory2;
  const secondary = primary === memory1 ? memory2 : memory1;

  // Merge keywords and facts
  const mergedKeywords = Array.from(
    new Set([...primary.keywords, ...secondary.keywords])
  );
  const mergedFacts = Array.from(
    new Set([...primary.facts, ...secondary.facts])
  );
  const mergedSourceIds = Array.from(
    new Set([...primary.sourceIds, ...secondary.sourceIds])
  );

  return {
    ...primary,
    keywords: mergedKeywords,
    facts: mergedFacts,
    sourceIds: mergedSourceIds,
    importance: Math.max(primary.importance, secondary.importance),
    confidence: Math.max(primary.confidence, secondary.confidence),
    metadata: {
      ...primary.metadata,
      ...secondary.metadata,
      mergedFrom: [primary.id, secondary.id],
      mergedAt: Date.now()
    }
  };
}

/**
 * Validate semantic memory configuration
 */
export function validateSemanticConfig(config: SemanticMemoryConfig): boolean {
  return (
    config.deduplicationThreshold >= 0 &&
    config.deduplicationThreshold <= 1 &&
    config.maxMemoriesPerCategory > 0 &&
    config.confidenceThreshold >= 0 &&
    config.confidenceThreshold <= 1 &&
    typeof config.vectorSearchEnabled === 'boolean' &&
    typeof config.encryptSensitive === 'boolean' &&
    typeof config.autoExtractFacts === 'boolean'
  );
}

/**
 * Check if content is suitable for semantic memory using tiered analysis
 */
export async function isSemanticWorthy(content: string): Promise<boolean> {
  return (
    content.length > 20 &&
    content.length < 5000 &&
    !(await isBoilerplate(content)) &&
    hasSemanticValue(content)
  );
}

/**
 * Check if content has semantic value
 */
function hasSemanticValue(content: string): boolean {
  // Check for factual indicators
  const factualIndicators = [
    'is',
    'are',
    'was',
    'were',
    'means',
    'refers to',
    'definition',
    'because',
    'therefore',
    'how to',
    'method',
    'approach',
    'solution'
  ];

  const lowerContent = content.toLowerCase();
  return factualIndicators.some((indicator) =>
    lowerContent.includes(indicator)
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
        'semantic-boilerplate-detection',
        'meaningful knowledge, facts, definitions, valuable semantic information worth remembering',
        embedding.embedding,
        { threshold: 0.3, limit: 1, textWeight: 0.3, vectorWeight: 0.7 }
      );

      return meaningfulResults.length === 0;
    }

    // Tier 2: Try vector-only search for meaningful content
    if (vectorMemoryOps && 'searchByVector' in vectorMemoryOps) {
      const meaningfulResults = await vectorMemoryOps.searchByVector(
        'system',
        'semantic-boilerplate-detection',
        embedding.embedding,
        { threshold: 0.3, limit: 1 }
      );

      return meaningfulResults.length === 0;
    }

    // Tier 3: Text search for meaningful content
    if (memoryOps) {
      const meaningfulResults = await memoryOps.recall(
        'system',
        'semantic-boilerplate-detection',
        'meaningful knowledge facts definitions valuable information',
        { limit: 1 }
      );

      return meaningfulResults.length === 0;
    }
  } catch (error) {
    logger.warn(
      LogCategory.STORAGE,
      'SemanticMemoryUtils',
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
 * Generate content hash for deduplication
 */
export function generateContentHash(content: string): string {
  // Use SHA-256 for secure content hashing
  return createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 16); // Use first 16 chars for reasonable length
}
