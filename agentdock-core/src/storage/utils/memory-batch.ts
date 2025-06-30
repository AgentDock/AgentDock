/**
 * @fileoverview Memory batch processing utilities
 *
 * High-performance batch processors for memory operations including
 * streaming, parallel processing, and consolidation.
 */

import { LogCategory, logger } from '../../logging';
import {
  Memory,
  MemoryConnection
} from '../adapters/postgresql/operations/memory';
import { MemoryType } from '../adapters/postgresql/schema-memory';

/**
 * Configuration for batch processing
 */
export interface BatchProcessorConfig {
  maxBatchSize: number;
  flushIntervalMs: number;
  maxMemoryMB: number;
  maxConcurrent?: number;
}

/**
 * Batch processor callback
 */
export type BatchProcessor<T> = (batch: T[]) => Promise<void>;

/**
 * Batch statistics
 */
export interface BatchStats {
  totalProcessed: number;
  batches: number;
  errors: number;
  duration: number;
  avgBatchSize: number;
  throughput: number; // items per second
}

/**
 * Streaming memory batch processor for real-time ingestion
 */
export class StreamingMemoryBatchProcessor {
  private buffer: Memory[] = [];
  private flushTimer?: NodeJS.Timeout;
  private stats: BatchStats = {
    totalProcessed: 0,
    batches: 0,
    errors: 0,
    duration: 0,
    avgBatchSize: 0,
    throughput: 0
  };
  private startTime: number = Date.now();

  constructor(
    private processor: BatchProcessor<Memory>,
    private config: BatchProcessorConfig
  ) {}

  /**
   * Process a single memory
   */
  async process(memory: Memory): Promise<void> {
    // CRITICAL FIX: Enforce hard buffer limit to prevent OOM crashes
    const MAX_BUFFER_SIZE = this.config.maxBatchSize * 3;

    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      logger.warn(
        LogCategory.STORAGE,
        'StreamingBatchProcessor',
        'Buffer overflow detected - applying backpressure',
        { bufferSize: this.buffer.length, maxSize: MAX_BUFFER_SIZE }
      );

      // Force flush to make room
      await this.flush();

      // If still at limit after flush, system cannot keep up
      if (this.buffer.length >= MAX_BUFFER_SIZE) {
        throw new Error(
          `Buffer overflow - system cannot keep up with load (buffer: ${this.buffer.length}, max: ${MAX_BUFFER_SIZE})`
        );
      }
    }

    this.buffer.push(memory);

    if (this.shouldFlush()) {
      await this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  /**
   * Process multiple memories
   */
  async processMany(memories: Memory[]): Promise<void> {
    // CRITICAL FIX: Check if we can handle the batch size before processing
    const MAX_BUFFER_SIZE = this.config.maxBatchSize * 3;

    if (this.buffer.length + memories.length > MAX_BUFFER_SIZE) {
      logger.warn(
        LogCategory.STORAGE,
        'StreamingBatchProcessor',
        'Large batch would overflow buffer - forcing flush first',
        {
          currentBuffer: this.buffer.length,
          incomingBatch: memories.length,
          maxSize: MAX_BUFFER_SIZE
        }
      );

      // Force flush to make room
      await this.flush();
    }

    for (const memory of memories) {
      await this.process(memory);
    }
  }

  /**
   * Check if buffer should be flushed
   */
  private shouldFlush(): boolean {
    // Size-based flush
    if (this.buffer.length >= this.config.maxBatchSize) {
      return true;
    }

    // Memory-based flush
    const estimatedSize = this.buffer.reduce(
      (sum, m) => sum + JSON.stringify(m).length,
      0
    );

    if (estimatedSize > this.config.maxMemoryMB * 1024 * 1024) {
      return true;
    }

    return false;
  }

  /**
   * Schedule a flush
   */
  private scheduleFlush(): void {
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush().catch((error) => {
          logger.error(
            LogCategory.STORAGE,
            'StreamingBatchProcessor',
            'Scheduled flush failed',
            { error: error.message }
          );
          this.stats.errors++;
        });
      }, this.config.flushIntervalMs);
    }
  }

  /**
   * Flush the buffer
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    // Clear timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Get buffer and reset
    const batch = [...this.buffer];
    this.buffer = [];

    try {
      // Process batch
      await this.processor(batch);

      // Update stats
      this.stats.totalProcessed += batch.length;
      this.stats.batches++;
      this.stats.avgBatchSize = this.stats.totalProcessed / this.stats.batches;

      logger.debug(
        LogCategory.STORAGE,
        'StreamingBatchProcessor',
        'Batch processed',
        {
          batchSize: batch.length,
          totalProcessed: this.stats.totalProcessed
        }
      );
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Get current statistics
   */
  getStats(): BatchStats {
    const duration = Date.now() - this.startTime;
    return {
      ...this.stats,
      duration,
      throughput: this.stats.totalProcessed / (duration / 1000)
    };
  }

  /**
   * Close the processor
   */
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    await this.flush();
  }
}

/**
 * Parallel batch processor for massive datasets
 */
export class ParallelBatchProcessor {
  private readonly WORKER_COUNT: number;
  private queues: Memory[][];
  private currentQueue = 0;
  private stats: BatchStats = {
    totalProcessed: 0,
    batches: 0,
    errors: 0,
    duration: 0,
    avgBatchSize: 0,
    throughput: 0
  };

  constructor(
    private processor: BatchProcessor<Memory>,
    private config: BatchProcessorConfig
  ) {
    this.WORKER_COUNT = config.maxConcurrent || 4;
    this.queues = Array(this.WORKER_COUNT)
      .fill(null)
      .map(() => []);
  }

  /**
   * Process a massive dataset in parallel
   */
  async processMassiveDataset(
    memories: AsyncIterable<Memory>
  ): Promise<BatchStats> {
    const startTime = Date.now();

    // Distribute memories across queues
    for await (const memory of memories) {
      this.queues[this.currentQueue].push(memory);
      this.currentQueue = (this.currentQueue + 1) % this.WORKER_COUNT;

      // Process when any queue is full
      for (let i = 0; i < this.WORKER_COUNT; i++) {
        if (this.queues[i].length >= this.config.maxBatchSize) {
          await this.processQueue(i);
        }
      }
    }

    // Process remaining
    await Promise.all(this.queues.map((_, idx) => this.processQueue(idx)));

    this.stats.duration = Date.now() - startTime;
    this.stats.throughput =
      this.stats.totalProcessed / (this.stats.duration / 1000);

    return this.stats;
  }

  /**
   * Process a single queue
   */
  private async processQueue(queueIdx: number): Promise<void> {
    const queue = this.queues[queueIdx];
    if (queue.length === 0) return;

    const batch = [...queue];
    this.queues[queueIdx] = [];

    try {
      await this.processor(batch);
      this.stats.totalProcessed += batch.length;
      this.stats.batches++;
      this.stats.avgBatchSize = this.stats.totalProcessed / this.stats.batches;
    } catch (error) {
      this.stats.errors++;
      logger.error(
        LogCategory.STORAGE,
        'ParallelBatchProcessor',
        `Queue ${queueIdx} batch failed`,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
}

/**
 * Memory consolidation options
 */
export interface ConsolidationOptions {
  similarityThreshold: number;
  minGroupSize: number;
  maxGroupSize: number;
  preserveImportant: boolean;
}

/**
 * Consolidation result
 */
export interface ConsolidationResult {
  examined: number;
  consolidated: number;
  spaceSaved: number;
  groups: number;
}

/**
 * Memory consolidator for similarity-based merging
 */
export class MemoryConsolidator {
  constructor(
    private similarityCalculator: (m1: Memory, m2: Memory) => number
  ) {}

  /**
   * Find similar memory groups
   */
  findSimilarGroups(
    memories: Memory[],
    options: ConsolidationOptions
  ): Memory[][] {
    const groups: Memory[][] = [];
    const processed = new Set<string>();

    for (const memory of memories) {
      if (processed.has(memory.id)) continue;

      // Find similar memories
      const group = this.findSimilarMemories(
        memory,
        memories,
        processed,
        options
      );

      if (group.length >= options.minGroupSize) {
        groups.push(group.slice(0, options.maxGroupSize));
        group.forEach((m) => processed.add(m.id));
      }
    }

    return groups;
  }

  /**
   * Find memories similar to a target
   */
  private findSimilarMemories(
    target: Memory,
    candidates: Memory[],
    processed: Set<string>,
    options: ConsolidationOptions
  ): Memory[] {
    const similar: Memory[] = [target];

    for (const candidate of candidates) {
      if (candidate.id === target.id || processed.has(candidate.id)) {
        continue;
      }

      // Skip important memories if preservation is enabled
      if (options.preserveImportant && candidate.importance > 0.8) {
        continue;
      }

      const similarity = this.similarityCalculator(target, candidate);

      if (similarity >= options.similarityThreshold) {
        similar.push(candidate);
      }
    }

    return similar;
  }

  /**
   * Consolidate a group of similar memories
   */
  consolidateGroup(group: Memory[]): Memory {
    // Sort by importance and recency
    group.sort((a, b) => {
      const scoreA =
        a.importance * 0.7 + (1 / (Date.now() - a.createdAt)) * 0.3;
      const scoreB =
        b.importance * 0.7 + (1 / (Date.now() - b.createdAt)) * 0.3;
      return scoreB - scoreA;
    });

    // Merge content intelligently
    const consolidatedContent = this.mergeContent(group.map((m) => m.content));

    // Combine metadata
    const keywords = new Set<string>();
    let totalImportance = 0;
    let totalResonance = 0;
    let totalTokens = 0;

    group.forEach((m) => {
      m.keywords?.forEach((k) => keywords.add(k));
      totalImportance += m.importance;
      totalResonance += m.resonance;
      totalTokens += m.tokenCount || 0;
    });

    return {
      id: `consolidated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId: group[0].agentId,
      userId: group[0].userId,
      type: group[0].type,
      content: consolidatedContent,
      importance: Math.min(1, (totalImportance / group.length) * 1.2), // Boost
      resonance: Math.max(...group.map((m) => m.resonance)),
      accessCount: Math.max(...group.map((m) => m.accessCount)),
      keywords: Array.from(keywords),
      metadata: {
        consolidatedFrom: group.map((m) => m.id),
        consolidationDate: Date.now(),
        originalCount: group.length
      },
      createdAt: Math.min(...group.map((m) => m.createdAt)),
      updatedAt: Date.now(),
      lastAccessedAt: Math.max(...group.map((m) => m.lastAccessedAt)),
      extractionMethod: 'consolidation',
      tokenCount: totalTokens,
      sessionId: group[0].sessionId
    };
  }

  /**
   * Merge content from multiple memories
   */
  private mergeContent(contents: string[]): string {
    // Simple deduplication and concatenation
    // In production, use more sophisticated NLP techniques
    const sentences = new Set<string>();

    contents.forEach((content) => {
      content.split(/[.!?]+/).forEach((sentence) => {
        const trimmed = sentence.trim();
        if (trimmed) {
          sentences.add(trimmed);
        }
      });
    });

    return Array.from(sentences).join('. ') + '.';
  }
}

/**
 * Bulk decay processor for resonance management
 */
export class BulkDecayProcessor {
  /**
   * Process decay in batches
   */
  async processBatch(
    memories: Memory[],
    decayRules: {
      decayRate: number;
      importanceWeight: number;
      accessBoost: number;
    }
  ): Promise<{
    decayed: Memory[];
    removed: string[];
  }> {
    const decayed: Memory[] = [];
    const removed: string[] = [];

    for (const memory of memories) {
      const ageMs = Date.now() - memory.lastAccessedAt;
      const ageDays = ageMs / (24 * 60 * 60 * 1000);

      // Apply decay formula
      const decayFactor = Math.exp(-decayRules.decayRate * ageDays);
      const importanceBoost = memory.importance * decayRules.importanceWeight;
      const accessBoost =
        Math.log(memory.accessCount + 1) * decayRules.accessBoost;

      const newResonance = Math.max(
        0,
        memory.resonance * decayFactor + importanceBoost + accessBoost
      );

      if (newResonance <= 0.01) {
        removed.push(memory.id);
      } else if (newResonance !== memory.resonance) {
        decayed.push({
          ...memory,
          resonance: newResonance,
          updatedAt: Date.now()
        });
      }
    }

    return { decayed, removed };
  }
}

/**
 * Memory batch utilities
 */
export class MemoryBatchUtils {
  /**
   * Chunk an array into smaller arrays
   */
  static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Create batches based on memory constraints
   */
  static createMemoryBatches(items: any[], maxMemoryMB: number): any[][] {
    const batches: any[][] = [];
    let currentBatch: any[] = [];
    let currentSize = 0;
    const maxBytes = maxMemoryMB * 1024 * 1024;

    for (const item of items) {
      const itemSize = JSON.stringify(item).length;

      if (currentSize + itemSize > maxBytes && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentSize = 0;
      }

      currentBatch.push(item);
      currentSize += itemSize;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * Process with controlled concurrency
   */
  static async processWithConcurrency<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    maxConcurrent: number
  ): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];

    for (const item of items) {
      const promise = processor(item).then((result) => {
        results.push(result);
      });

      executing.push(promise);

      if (executing.length >= maxConcurrent) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex((p) => p),
          1
        );
      }
    }

    await Promise.all(executing);
    return results;
  }
}
