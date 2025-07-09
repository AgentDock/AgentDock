/**
 * BaseMemoryType - Abstract base class for all memory types with automatic connection discovery
 *
 * Provides common functionality including automatic Zettelkasten connection discovery
 * when memories are stored.
 */

import { LogCategory, logger } from '../../../logging';
import { MemoryStorageError } from '../../../shared/errors/memory-errors';
import { MemoryOperations, StorageProvider } from '../../../storage/types';
import { generateId } from '../../../storage/utils';
import { MemoryConnectionManager } from '../../intelligence/connections/MemoryConnectionManager';
import { TemporalPatternAnalyzer } from '../../intelligence/patterns/TemporalPatternAnalyzer';
import { IntelligenceLayerConfig } from '../../intelligence/types';
import { CostTracker } from '../../tracking/CostTracker';

export abstract class BaseMemoryType<TConfig = any> {
  protected readonly memory: MemoryOperations;
  protected connectionManager?: MemoryConnectionManager;
  protected temporalAnalyzer?: TemporalPatternAnalyzer;
  private pendingOperations = new Set<{ abort: () => void }>();
  private isDestroyed = false;
  
  /**
   * The memory type identifier
   */
  protected abstract readonly type: string;

  constructor(
    protected storage: StorageProvider,
    protected config: TConfig,
    intelligenceConfig?: IntelligenceLayerConfig
  ) {
    // Validate storage has memory operations first
    if (!storage.memory) {
      throw new Error(
        `${this.constructor.name} requires storage with memory operations`
      );
    }
    this.memory = storage.memory;

    // Auto-instantiate connection manager if config provided
    if (intelligenceConfig?.connectionDetection) {
      const costTracker = new CostTracker(storage);
      this.connectionManager = new MemoryConnectionManager(
        storage,
        intelligenceConfig,
        costTracker
      );

      // Initialize temporal analyzer if enabled
      if (intelligenceConfig.temporal?.enabled) {
        this.temporalAnalyzer = new TemporalPatternAnalyzer(
          storage,
          intelligenceConfig,
          costTracker
        );
      }
    }
  }

  /**
   * Gets the temporal analyzer instance, ensuring it's initialized
   * @throws {MemoryStorageError} If temporal analyzer is not initialized
   * @returns TemporalPatternAnalyzer instance
   * @private
   */
  private getTemporalAnalyzer(): TemporalPatternAnalyzer {
    if (!this.temporalAnalyzer) {
      throw new MemoryStorageError(
        'Temporal analyzer not initialized',
        'STORAGE_NOT_INITIALIZED'
      );
    }
    return this.temporalAnalyzer;
  }

  /**
   * Store with automatic connection discovery and temporal analysis
   */
  async store(
    userId: string,
    agentId: string,
    content: string,
    options?: any
  ): Promise<string> {
    // Store the memory
    const memoryId = await this.doStore(userId, agentId, content, options);

    // Trigger non-blocking connection discovery
    if (this.connectionManager) {
      // Use async queue to prevent race conditions and blocking
      this.connectionManager.enqueueConnectionDiscovery(
        userId,
        agentId,
        memoryId
      );
    }

    // Trigger non-blocking temporal pattern analysis
    if (this.temporalAnalyzer) {
      this.scheduleTemporalAnalysis(userId, agentId, memoryId);
    }

    // Track memory creation event
    if (this.storage.evolution?.trackEvent) {
      this.storage.evolution.trackEvent({
        memoryId,
        userId,
        agentId,
        type: 'created',
        timestamp: Date.now(),
        metadata: {
          source: this.type,
          memoryType: this.type
        }
      }).catch(error => {
        logger.warn(
          LogCategory.STORAGE,
          'BaseMemoryType',
          'Failed to track memory creation event',
          { error: error instanceof Error ? error.message : String(error) }
        );
      });
    }

    return memoryId;
  }

  /**
   * Abstract method that each memory type must implement
   */
  protected abstract doStore(
    userId: string,
    agentId: string,
    content: string,
    options?: any
  ): Promise<string>;

  /**
   * Schedule temporal analysis with proper cleanup handling
   */
  private scheduleTemporalAnalysis(
    userId: string,
    agentId: string,
    memoryId: string
  ): void {
    if (this.isDestroyed) return;

    const abortController = new AbortController();
    let immediateId: NodeJS.Timeout;

    const operation = {
      abort: () => {
        abortController.abort();
        if (immediateId) clearTimeout(immediateId);
      }
    };

    this.pendingOperations.add(operation);

    immediateId = setTimeout(async () => {
      try {
        // Check if aborted
        if (abortController.signal.aborted || this.isDestroyed) {
          return;
        }

        const memory = await this.storage.memory?.getById?.(userId, memoryId);

        // Check again after async operation
        if (abortController.signal.aborted || this.isDestroyed) {
          return;
        }

        if (memory && this.temporalAnalyzer) {
          // Analyze patterns and store them in memory metadata
          const patterns = await this.temporalAnalyzer.analyzePatterns(agentId, undefined, userId);
          
          if (patterns.length > 0 && this.storage.memory?.update) {
            // Extract lightweight temporal insights
            const temporalInsights = {
              patterns: patterns.map(p => ({
                type: p.type,
                confidence: p.confidence,
                peakHours: p.type === 'daily' && p.metadata?.peakTimes 
                  ? p.metadata.peakTimes.map((d: Date) => d.getHours())
                  : [],
                frequency: p.frequency,
                description: p.metadata?.description
              })),
              lastAnalyzed: Date.now()
            };
            
            // Update the memory with temporal insights
            await this.storage.memory.update(
              userId,
              agentId,
              memoryId,
              {
                metadata: {
                  ...memory.metadata,
                  temporalInsights
                }
              }
            );
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          logger.error(
            LogCategory.STORAGE,
            'BaseMemoryType',
            'Temporal pattern analysis failed',
            {
              error: error instanceof Error ? error.message : String(error),
              userId,
              memoryId
            }
          );
        }
      } finally {
        this.pendingOperations.delete(operation);
      }
    }, 0); // Run on next tick
  }

  /**
   * Clean up all pending operations and resources
   */
  async destroy(): Promise<void> {
    this.isDestroyed = true;

    // Cancel all pending operations
    for (const operation of this.pendingOperations) {
      operation.abort();
    }
    this.pendingOperations.clear();

    // Clean up other resources
    if (this.connectionManager) {
      await this.connectionManager.destroy();
    }
    // Note: TemporalPatternAnalyzer doesn't currently have a destroy method
    // TODO: Add destroy method to TemporalPatternAnalyzer if it manages resources
  }
}
