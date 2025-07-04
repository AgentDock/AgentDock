/**
 * BaseMemoryType - Abstract base class for all memory types with automatic connection discovery
 *
 * Provides common functionality including automatic Zettelkasten connection discovery
 * when memories are stored.
 */

import { StorageProvider } from '../../../storage/types';
import { generateId } from '../../../storage/utils';
import { MemoryConnectionManager } from '../../intelligence/connections/MemoryConnectionManager';
import { TemporalPatternAnalyzer } from '../../intelligence/patterns/TemporalPatternAnalyzer';
import { IntelligenceLayerConfig } from '../../intelligence/types';
import { CostTracker } from '../../tracking/CostTracker';

export abstract class BaseMemoryType {
  protected connectionManager?: MemoryConnectionManager;
  protected temporalAnalyzer?: TemporalPatternAnalyzer;

  constructor(
    protected storage: StorageProvider,
    protected config: any,
    intelligenceConfig?: IntelligenceLayerConfig
  ) {
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
      setImmediate(async () => {
        try {
          const memory = await this.storage.memory?.getById?.(userId, memoryId);
          if (memory) {
            // Update temporal patterns in background
            await this.temporalAnalyzer!.analyzePatterns(agentId);
          }
        } catch (error) {
          console.error('Temporal pattern analysis failed:', error);
        }
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
}
