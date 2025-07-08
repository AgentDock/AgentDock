/**
 * @fileoverview LazyDecayBatchProcessor - Collects lazy decay updates for efficient DB writes
 *
 * This processor collects memory updates generated during recall operations
 * and writes them efficiently in batches to reduce database load.
 *
 * Features:
 * - Collect updates from multiple recall operations
 * - Batch writes every 5 seconds or when batch size reached
 * - Handle race conditions with update merging
 * - Overflow protection to prevent memory leaks
 *
 * @author AgentDock Core Team
 */

import { LogCategory, logger } from '../../logging';
import { MemoryUpdate, StorageProvider } from '../../storage/types';

/**
 * Configuration for the lazy decay batch processor
 */
export interface BatchProcessorConfig {
  /** Maximum updates to collect before forcing a write */
  maxBatchSize: number;

  /** Time in milliseconds between automatic flushes */
  flushIntervalMs: number;

  /** Maximum pending updates before dropping new ones */
  maxPendingUpdates: number;
}

/**
 * Result of a batch write operation
 */
export interface BatchProcessingResult {
  /** Number of updates written */
  updatesWritten: number;

  /** Processing time in milliseconds */
  processingTimeMs: number;

  /** Number of database operations performed */
  databaseOperations: number;

  /** Any errors encountered */
  errors: string[];
}

/**
 * LazyDecayBatchProcessor - Collects and batches memory updates from lazy decay calculations
 *
 * This is the correct implementation according to the PRD specification.
 * It collects updates from MemoryManager.recall() operations and writes them efficiently.
 */
export class LazyDecayBatchProcessor {
  private storage: StorageProvider;
  private config: BatchProcessorConfig;
  private pendingUpdates = new Map<string, MemoryUpdate>();
  private flushTimeout?: NodeJS.Timeout;
  private isDestroyed = false;

  constructor(
    storage: StorageProvider,
    config: Partial<BatchProcessorConfig> = {}
  ) {
    // Validate storage has required interface
    if (!storage.memory?.batchUpdateMemories) {
      throw new Error('Storage provider does not support batch updates');
    }

    this.storage = storage;
    this.config = {
      maxBatchSize: config.maxBatchSize ?? 100,
      flushIntervalMs: config.flushIntervalMs ?? 5000,
      maxPendingUpdates: config.maxPendingUpdates ?? 10000,
      ...config
    };

    // Start the flush timer
    this.scheduleFlush();

    logger.debug(
      LogCategory.STORAGE,
      'LazyDecayBatchProcessor',
      'Initialized',
      {
        config: this.config
      }
    );
  }

  /**
   * Add a memory update to the batch queue
   * This is called by MemoryManager.recall() when lazy decay detects changes
   *
   * @param update - Memory update to batch
   */
  add(update: MemoryUpdate): void {
    if (this.isDestroyed) {
      logger.warn(
        LogCategory.STORAGE,
        'LazyDecayBatchProcessor',
        'Cannot add update - processor destroyed',
        {
          memoryId: update.id
        }
      );
      return;
    }

    // Overflow protection - prevent unbounded memory growth
    if (this.pendingUpdates.size >= this.config.maxPendingUpdates) {
      logger.warn(
        LogCategory.STORAGE,
        'LazyDecayBatchProcessor',
        'Pending updates overflow - dropping update',
        {
          memoryId: update.id,
          pendingSize: this.pendingUpdates.size,
          maxSize: this.config.maxPendingUpdates
        }
      );
      return;
    }

    // Merge with existing update to handle race conditions
    const existing = this.pendingUpdates.get(update.id);
    if (existing) {
      // Keep the most recent values
      update.accessCount = Math.max(update.accessCount, existing.accessCount);
      update.lastAccessedAt = Math.max(
        update.lastAccessedAt,
        existing.lastAccessedAt
      );
      // Use the newer resonance value
    }

    // Store the update
    this.pendingUpdates.set(update.id, update);

    // Check if we should flush immediately
    if (this.pendingUpdates.size >= this.config.maxBatchSize) {
      this.flushNow();
    }
  }

  /**
   * Force an immediate flush of pending updates
   */
  async flushNow(): Promise<BatchProcessingResult> {
    if (this.pendingUpdates.size === 0) {
      return {
        updatesWritten: 0,
        processingTimeMs: 0,
        databaseOperations: 0,
        errors: []
      };
    }

    const startTime = Date.now();
    const updates = Array.from(this.pendingUpdates.values());

    // Clear pending updates immediately to prevent duplicates
    this.pendingUpdates.clear();

    const result: BatchProcessingResult = {
      updatesWritten: updates.length,
      processingTimeMs: 0,
      databaseOperations: 0,
      errors: []
    };

    try {
      // Write to database
      await this.storage.memory!.batchUpdateMemories!(updates);
      result.databaseOperations = 1;

      logger.debug(
        LogCategory.STORAGE,
        'LazyDecayBatchProcessor',
        'Batch updates written',
        {
          updateCount: updates.length,
          processingTimeMs: Date.now() - startTime
        }
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);

      logger.error(
        LogCategory.STORAGE,
        'LazyDecayBatchProcessor',
        'Batch update failed',
        {
          updateCount: updates.length,
          error: errorMessage
        }
      );

      // Re-add updates to queue for retry (but don't exceed max pending)
      updates.forEach((update) => {
        if (this.pendingUpdates.size < this.config.maxPendingUpdates) {
          this.pendingUpdates.set(update.id, update);
        }
      });
    }

    result.processingTimeMs = Math.max(1, Date.now() - startTime); // Ensure minimum 1ms

    // Reschedule flush timer
    this.scheduleFlush();

    return result;
  }

  /**
   * Schedule the next automatic flush
   */
  private scheduleFlush(): void {
    if (this.isDestroyed) return;

    // Clear existing timeout
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }

    // Schedule next flush
    this.flushTimeout = setTimeout(() => {
      this.flushNow().catch((error) => {
        logger.error(
          LogCategory.STORAGE,
          'LazyDecayBatchProcessor',
          'Scheduled flush failed',
          {
            error: error instanceof Error ? error.message : String(error)
          }
        );
      });
    }, this.config.flushIntervalMs);
  }

  /**
   * Get current configuration
   */
  getConfig(): BatchProcessorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(newConfig: Partial<BatchProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Reschedule flush with new interval if changed
    if (newConfig.flushIntervalMs !== undefined) {
      this.scheduleFlush();
    }

    logger.debug(
      LogCategory.STORAGE,
      'LazyDecayBatchProcessor',
      'Configuration updated',
      {
        newConfig
      }
    );
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): { pendingUpdates: number; isDestroyed: boolean } {
    return {
      pendingUpdates: this.pendingUpdates.size,
      isDestroyed: this.isDestroyed
    };
  }

  /**
   * Cleanup and destroy the processor
   * Flushes any pending updates and clears resources
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed) return;

    this.isDestroyed = true;

    // Clear timeout
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = undefined;
    }

    // Flush any remaining updates
    if (this.pendingUpdates.size > 0) {
      logger.info(
        LogCategory.STORAGE,
        'LazyDecayBatchProcessor',
        'Flushing pending updates before destroy',
        {
          pendingCount: this.pendingUpdates.size
        }
      );

      await this.flushNow();
    }

    logger.debug(LogCategory.STORAGE, 'LazyDecayBatchProcessor', 'Destroyed');
  }
}
