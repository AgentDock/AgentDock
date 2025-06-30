/**
 * BaseMemoryType - Abstract base class for all memory types with automatic connection discovery
 *
 * Provides common functionality including automatic Zettelkasten connection discovery
 * when memories are stored.
 */

import { StorageProvider } from '../../../storage/types';
import { generateId } from '../../../storage/utils';
import { MemoryConnectionManager } from '../../intelligence/connections/MemoryConnectionManager';
import { IntelligenceLayerConfig } from '../../intelligence/types';

export abstract class BaseMemoryType {
  protected connectionManager?: MemoryConnectionManager;

  constructor(
    protected storage: StorageProvider,
    protected config: any,
    intelligenceConfig?: IntelligenceLayerConfig
  ) {
    // Auto-instantiate connection manager if config provided
    if (intelligenceConfig?.connectionDetection) {
      this.connectionManager = new MemoryConnectionManager(
        storage,
        intelligenceConfig
      );
    }
  }

  /**
   * Store with automatic connection discovery
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
      setImmediate(async () => {
        try {
          const memory = await this.storage.memory?.getById?.(userId, memoryId);
          if (memory) {
            const connections =
              await this.connectionManager!.discoverConnections(
                userId,
                agentId,
                memory
              );

            if (connections.length > 0) {
              await this.connectionManager!.createConnections(connections);
            }
          }
        } catch (error) {
          console.error('Connection discovery failed:', error);
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
