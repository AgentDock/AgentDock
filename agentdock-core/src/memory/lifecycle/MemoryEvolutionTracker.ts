/**
 * Memory Evolution Tracker
 * Tracks changes to memories over time for analytics and insights
 */

import { LogCategory, logger } from '../../logging';
import { StorageProvider } from '../../storage';
import { generateId } from '../../storage/utils';
import { MemoryChangeType, MemoryEvolution } from './types';

/**
 * Tracks memory evolution events for analytics and insights
 */
export class MemoryEvolutionTracker {
  constructor(private storage: StorageProvider) {}

  /**
   * Track a memory evolution event
   */
  async trackEvolution(
    memoryId: string,
    evolution: Omit<MemoryEvolution, 'id' | 'memoryId' | 'timestamp'>
  ): Promise<void> {
    try {
      const evolutionRecord: MemoryEvolution = {
        id: generateId('evo'),
        memoryId,
        timestamp: new Date(),
        ...evolution
      };

      const key = `evolution:${memoryId}:${evolutionRecord.id}`;
      await this.storage.set(key, evolutionRecord);

      logger.debug(
        LogCategory.STORAGE,
        'MemoryEvolutionTracker',
        'Tracked evolution',
        {
          memoryId,
          changeType: evolution.changeType,
          reason: evolution.reason
        }
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'MemoryEvolutionTracker',
        'Failed to track evolution',
        {
          memoryId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  /**
   * Get evolution history for a memory
   */
  async getEvolutionHistory(memoryId: string): Promise<MemoryEvolution[]> {
    try {
      const prefix = `evolution:${memoryId}:`;
      const keys = await this.storage.list(prefix);

      const evolutions: MemoryEvolution[] = [];
      for (const key of keys) {
        const evolution = await this.storage.get<MemoryEvolution>(key);
        if (evolution) {
          evolutions.push(evolution);
        }
      }

      // Sort by timestamp
      return evolutions.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'MemoryEvolutionTracker',
        'Failed to get evolution history',
        {
          memoryId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return [];
    }
  }
}
