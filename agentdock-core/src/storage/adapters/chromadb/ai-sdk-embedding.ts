/**
 * @fileoverview AI SDK embedding function for ChromaDB
 *
 * Properly typed embedding function using AI SDK embedding models
 */

import {
  createEmbedding,
  embedMany,
  getEmbeddingDimensions
} from '../../../llm';
import { LogCategory, logger } from '../../../logging';
import { ChromaEmbeddingFunction } from './types';

/**
 * AI SDK embedding function that uses real embeddings with proper typing
 */
export class AISDKEmbeddingFunction implements ChromaEmbeddingFunction {
  private embeddingCache = new Map<string, number[]>();
  private cacheEnabled: boolean;
  private embeddingModelName: string;
  private embeddingProvider: string;

  constructor(
    embeddingModelName: string = 'text-embedding-3-small',
    private dimension: number = 1536,
    options?: {
      cacheEnabled?: boolean;
      provider?: string;
    }
  ) {
    this.embeddingModelName = embeddingModelName;
    this.embeddingProvider = options?.provider || 'openai';
    this.cacheEnabled = options?.cacheEnabled ?? true;
  }

  /**
   * Generate embeddings for documents using AI SDK
   */
  async generate(documents: string[]): Promise<number[][]> {
    if (documents.length === 0) {
      return [];
    }

    try {
      // Separate cached and uncached documents
      const uncachedDocs: { index: number; text: string }[] = [];
      const embeddings: number[][] = new Array(documents.length);

      // Check cache if enabled
      if (this.cacheEnabled) {
        documents.forEach((doc, index) => {
          const cacheKey = this.getCacheKey(doc);
          const cached = this.embeddingCache.get(cacheKey);

          if (cached) {
            embeddings[index] = cached;
          } else {
            uncachedDocs.push({ index, text: doc });
          }
        });
      } else {
        // No cache, process all documents
        documents.forEach((doc, index) => {
          uncachedDocs.push({ index, text: doc });
        });
      }

      // Generate embeddings for uncached documents
      if (uncachedDocs.length > 0) {
        const texts = uncachedDocs.map((d) => d.text);

        logger.debug(
          LogCategory.STORAGE,
          'AISDKEmbeddingFunction',
          'Generating embeddings',
          {
            count: texts.length,
            cached: documents.length - texts.length,
            model: this.embeddingModelName,
            provider: this.embeddingProvider
          }
        );

        // Use createEmbedding factory to create the model
        const apiKey =
          process.env[`${this.embeddingProvider.toUpperCase()}_API_KEY`] || '';

        if (!apiKey) {
          throw new Error(
            `${this.embeddingProvider} API key is required for embeddings`
          );
        }

        const embeddingModel = createEmbedding({
          provider: this.embeddingProvider as any,
          apiKey,
          model: this.embeddingModelName,
          dimensions: this.dimension
        });

        const result = await embedMany({
          model: embeddingModel,
          values: texts
        });

        // Store results and update cache
        uncachedDocs.forEach((doc, i) => {
          const embedding = result.embeddings[i];

          // Ensure correct dimension
          const adjustedEmbedding = this.adjustDimension(embedding);

          embeddings[doc.index] = adjustedEmbedding;

          // Cache if enabled
          if (this.cacheEnabled) {
            this.embeddingCache.set(
              this.getCacheKey(doc.text),
              adjustedEmbedding
            );
          }
        });
      }

      return embeddings;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'AISDKEmbeddingFunction',
        'Failed to generate embeddings',
        {
          error: error instanceof Error ? error.message : String(error),
          documentCount: documents.length,
          model: this.embeddingModelName,
          provider: this.embeddingProvider
        }
      );

      // Fallback to zero vectors on error
      return documents.map(() => new Array(this.dimension).fill(0));
    }
  }

  /**
   * Adjust embedding dimension if needed
   */
  private adjustDimension(embedding: number[]): number[] {
    if (embedding.length === this.dimension) {
      return embedding;
    }

    if (embedding.length > this.dimension) {
      // Truncate to desired dimension
      logger.debug(
        LogCategory.STORAGE,
        'AISDKEmbeddingFunction',
        'Truncating embedding',
        {
          from: embedding.length,
          to: this.dimension
        }
      );
      return embedding.slice(0, this.dimension);
    }

    // Pad with zeros if too short
    logger.debug(
      LogCategory.STORAGE,
      'AISDKEmbeddingFunction',
      'Padding embedding',
      {
        from: embedding.length,
        to: this.dimension
      }
    );

    const padded = [...embedding];
    while (padded.length < this.dimension) {
      padded.push(0);
    }
    return padded;
  }

  /**
   * Generate cache key for content
   */
  private getCacheKey(content: string): string {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `emb_${this.dimension}_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.embeddingCache.clear();
    logger.debug(
      LogCategory.STORAGE,
      'AISDKEmbeddingFunction',
      'Cache cleared'
    );
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    enabled: boolean;
  } {
    return {
      size: this.embeddingCache.size,
      enabled: this.cacheEnabled
    };
  }
}

/**
 * Factory function to create AI SDK embedding function with proper typing
 */
export function createAISDKEmbeddingFunction(
  embeddingModelName?: string,
  dimension?: number,
  options?: {
    cacheEnabled?: boolean;
    provider?: string;
  }
): ChromaEmbeddingFunction {
  return new AISDKEmbeddingFunction(embeddingModelName, dimension, options);
}
