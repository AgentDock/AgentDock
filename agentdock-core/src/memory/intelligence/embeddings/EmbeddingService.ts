/**
 * @fileoverview EmbeddingService - Vector embeddings using AgentDock's AI infrastructure
 *
 * Provides configurable embedding generation with caching and batch processing.
 * Uses AgentDock's LLM module following established patterns.
 *
 * @author AgentDock Core Team
 */

import type { EmbeddingModel } from 'ai';

import { embedMany } from '../../../llm';
import { LogCategory, logger } from '../../../logging';
import { Memory } from '../../types/common';
import { EmbeddingConfig, EmbeddingResult } from '../types';

/**
 * Simple LRU Cache implementation for embeddings
 */
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first entry)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Service for generating embeddings using AgentDock's LLM infrastructure
 */
export class EmbeddingService {
  private embeddingCache: LRUCache<string, number[]>;
  private cacheEnabled: boolean;
  private batchSize: number;

  constructor(
    private embeddingModel: EmbeddingModel<string>,
    private config: EmbeddingConfig
  ) {
    this.cacheEnabled = config.cacheEnabled ?? true;
    this.batchSize = config.batchSize ?? 100;

    // Initialize LRU cache with configurable size (default 1000)
    const cacheSize = config.cacheSize ?? 1000;
    this.embeddingCache = new LRUCache<string, number[]>(cacheSize);

    logger.debug(
      LogCategory.STORAGE,
      'EmbeddingService',
      'Initialized embedding service',
      {
        provider: config.provider,
        model: config.model,
        dimensions: config.dimensions,
        cacheEnabled: this.cacheEnabled,
        cacheSize: cacheSize,
        batchSize: this.batchSize
      }
    );
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const results = await this.generateBatchEmbeddings([text]);
    return results[0];
  }

  /**
   * Generate embeddings for multiple texts with batching and caching
   */
  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      // Separate cached and uncached texts
      const uncachedItems: { index: number; text: string }[] = [];
      const results: EmbeddingResult[] = new Array(texts.length);

      // Check cache if enabled
      if (this.cacheEnabled) {
        texts.forEach((text, index) => {
          const cacheKey = this.getCacheKey(text);
          const cached = this.embeddingCache.get(cacheKey);

          if (cached) {
            results[index] = {
              embedding: cached,
              dimensions: cached.length,
              provider: this.config.provider,
              model: this.config.model,
              cached: true
            };
          } else {
            uncachedItems.push({ index, text });
          }
        });
      } else {
        texts.forEach((text, index) => {
          uncachedItems.push({ index, text });
        });
      }

      // Generate embeddings for uncached texts
      if (uncachedItems.length > 0) {
        const uncachedTexts = uncachedItems.map((item) => item.text);

        logger.debug(
          LogCategory.STORAGE,
          'EmbeddingService',
          'Generating embeddings',
          {
            total: texts.length,
            uncached: uncachedTexts.length,
            cached: texts.length - uncachedTexts.length
          }
        );

        // Use AgentDock's embedMany function with batching
        const batches = this.createBatches(uncachedTexts, this.batchSize);

        for (const batch of batches) {
          const batchResult = await embedMany({
            model: this.embeddingModel,
            values: batch.texts
          });

          // Process batch results
          batch.items.forEach((item, i) => {
            const embedding = batchResult.embeddings[i];
            const adjustedEmbedding = this.adjustDimension(embedding);

            const result: EmbeddingResult = {
              embedding: adjustedEmbedding,
              dimensions: adjustedEmbedding.length,
              provider: this.config.provider,
              model: this.config.model,
              cached: false
            };

            results[item.index] = result;

            // Cache if enabled
            if (this.cacheEnabled) {
              this.embeddingCache.set(
                this.getCacheKey(item.text),
                adjustedEmbedding
              );
            }
          });
        }
      }

      return results;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'EmbeddingService',
        'Failed to generate embeddings',
        {
          error: error instanceof Error ? error.message : String(error),
          textCount: texts.length
        }
      );
      throw error;
    }
  }

  /**
   * Find similar memories using vector similarity
   */
  async findSimilarMemories(
    agentId: string,
    queryText: string,
    threshold: number = 0.7,
    storage: any
  ): Promise<Memory[]> {
    const embeddingResult = await this.generateEmbedding(queryText);

    // Use storage adapter's vector search if available
    if (storage.searchSimilar) {
      return await storage.searchSimilar(
        agentId,
        embeddingResult.embedding,
        threshold
      );
    }

    logger.warn(
      LogCategory.STORAGE,
      'EmbeddingService',
      'Storage adapter does not support vector search',
      { agentId: agentId.substring(0, 8) }
    );

    return [];
  }

  /**
   * Create batches for efficient processing
   */
  private createBatches(
    texts: string[],
    batchSize: number
  ): Array<{
    texts: string[];
    items: Array<{ index: number; text: string }>;
  }> {
    const batches: Array<{
      texts: string[];
      items: Array<{ index: number; text: string }>;
    }> = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batchTexts = texts.slice(i, i + batchSize);
      const batchItems = batchTexts.map((text, idx) => ({
        index: i + idx,
        text
      }));

      batches.push({
        texts: batchTexts,
        items: batchItems
      });
    }

    return batches;
  }

  /**
   * Adjust embedding dimension if needed
   */
  private adjustDimension(embedding: number[]): number[] {
    const targetDimension = this.config.dimensions || embedding.length;

    if (embedding.length === targetDimension) {
      return embedding;
    }

    if (embedding.length > targetDimension) {
      return embedding.slice(0, targetDimension);
    }

    // Pad with zeros if too short
    const padded = [...embedding];
    while (padded.length < targetDimension) {
      padded.push(0);
    }
    return padded;
  }

  /**
   * Generate cache key for content
   */
  private getCacheKey(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `emb_${this.config.dimensions || 1536}_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Clear the embedding cache
   */
  clearCache(): void {
    this.embeddingCache.clear();
    logger.debug(
      LogCategory.STORAGE,
      'EmbeddingService',
      'Embedding cache cleared'
    );
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    enabled: boolean;
    maxSize: number;
    hitRate?: number;
  } {
    return {
      size: this.embeddingCache.size,
      maxSize: this.config.cacheSize ?? 1000,
      enabled: this.cacheEnabled
    };
  }
}
