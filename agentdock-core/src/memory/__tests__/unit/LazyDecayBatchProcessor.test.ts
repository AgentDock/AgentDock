/**
 * @fileoverview Tests for LazyDecayBatchProcessor
 * 
 * Tests the correct lazy decay batch processor that collects updates
 * from recall operations and writes them efficiently.
 */

import { LazyDecayBatchProcessor, BatchProcessorConfig } from '../../decay/LazyDecayBatchProcessor';
import { MemoryUpdate, StorageProvider, MemoryOperations } from '../../../storage/types';

// Mock storage provider with batch update capability
const createMockStorage = (): StorageProvider => {
  const mockMemoryOps: MemoryOperations = {
    store: jest.fn(),
    recall: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getStats: jest.fn(),
    batchUpdateMemories: jest.fn().mockResolvedValue(undefined),
  };

  return {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    getMany: jest.fn(),
    setMany: jest.fn(),
    deleteMany: jest.fn(),
    list: jest.fn(),
    clear: jest.fn(),
    getList: jest.fn(),
    saveList: jest.fn(),
    deleteList: jest.fn(),
    memory: mockMemoryOps
  };
};

// Mock storage without batch update capability
const createMockStorageWithoutBatch = (): StorageProvider => {
  const storage = createMockStorage();
  delete (storage.memory as any).batchUpdateMemories;
  return storage;
};

describe('LazyDecayBatchProcessor - Correct Implementation', () => {
  let processor: LazyDecayBatchProcessor;
  let mockStorage: StorageProvider;
  let mockUpdate: MemoryUpdate;

  beforeEach(() => {
    jest.useFakeTimers();
    mockStorage = createMockStorage();
    
    processor = new LazyDecayBatchProcessor(mockStorage);

    mockUpdate = {
      id: 'mem-123',
      resonance: 0.8,
      lastAccessedAt: Date.now(),
      accessCount: 5
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const config = processor.getConfig();
      
      expect(config.maxBatchSize).toBe(100);
      expect(config.flushIntervalMs).toBe(5000);
      expect(config.maxPendingUpdates).toBe(10000);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<BatchProcessorConfig> = {
        maxBatchSize: 50,
        flushIntervalMs: 2000,
        maxPendingUpdates: 5000
      };

      const customProcessor = new LazyDecayBatchProcessor(mockStorage, customConfig);
      const config = customProcessor.getConfig();

      expect(config.maxBatchSize).toBe(50);
      expect(config.flushIntervalMs).toBe(2000);
      expect(config.maxPendingUpdates).toBe(5000);
    });

    it('should throw error if storage lacks batch update capability', () => {
      const storageWithoutBatch = createMockStorageWithoutBatch();
      
      expect(() => {
        new LazyDecayBatchProcessor(storageWithoutBatch);
      }).toThrow('Storage provider does not support batch updates');
    });

    it('should update configuration at runtime', () => {
      const newConfig = { maxBatchSize: 200 };
      processor.updateConfig(newConfig);
      
      expect(processor.getConfig().maxBatchSize).toBe(200);
    });
  });

  describe('Adding Updates', () => {
    it('should add update to pending queue', () => {
      processor.add(mockUpdate);
      
      const status = processor.getQueueStatus();
      expect(status.pendingUpdates).toBe(1);
    });

    it('should merge updates for same memory ID', () => {
      // Add first update
      processor.add(mockUpdate);
      
      // Add second update for same memory with different values
      const secondUpdate: MemoryUpdate = {
        id: 'mem-123', // Same ID
        resonance: 0.9,
        lastAccessedAt: Date.now() + 1000,
        accessCount: 10
      };
      
      processor.add(secondUpdate);
      
      // Should still have only 1 pending update (merged)
      const status = processor.getQueueStatus();
      expect(status.pendingUpdates).toBe(1);
    });

    it('should handle overflow protection', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Configure small max pending for testing
      processor.updateConfig({ maxPendingUpdates: 2 });
      
      // Add updates beyond limit
      processor.add({ id: 'mem-1', resonance: 0.5, lastAccessedAt: Date.now(), accessCount: 1 });
      processor.add({ id: 'mem-2', resonance: 0.5, lastAccessedAt: Date.now(), accessCount: 1 });
      processor.add({ id: 'mem-3', resonance: 0.5, lastAccessedAt: Date.now(), accessCount: 1 }); // Should be dropped
      
      const status = processor.getQueueStatus();
      expect(status.pendingUpdates).toBe(2); // Only first 2 should be kept
      
      consoleWarnSpy.mockRestore();
    });

    it('should not add updates when processor is destroyed', () => {
      processor.destroy();
      processor.add(mockUpdate);
      
      const status = processor.getQueueStatus();
      expect(status.pendingUpdates).toBe(0);
    });
  });

  describe('Batch Flushing', () => {
    it('should flush immediately when batch size reached', async () => {
      // Configure small batch size for testing
      processor.updateConfig({ maxBatchSize: 2 });
      
      // Add updates
      processor.add({ id: 'mem-1', resonance: 0.5, lastAccessedAt: Date.now(), accessCount: 1 });
      processor.add({ id: 'mem-2', resonance: 0.6, lastAccessedAt: Date.now(), accessCount: 2 });
      
      // Should trigger immediate flush
      await jest.runAllTimersAsync();
      
      expect(mockStorage.memory!.batchUpdateMemories).toHaveBeenCalledWith([
        { id: 'mem-1', resonance: 0.5, lastAccessedAt: expect.any(Number), accessCount: 1 },
        { id: 'mem-2', resonance: 0.6, lastAccessedAt: expect.any(Number), accessCount: 2 }
      ]);
    });

    it('should flush automatically after interval', async () => {
      // Configure short interval for testing
      processor.updateConfig({ flushIntervalMs: 1000 });
      
      processor.add(mockUpdate);
      
      // Advance time to trigger flush
      jest.advanceTimersByTime(1000);
      await jest.runAllTimersAsync();
      
      expect(mockStorage.memory!.batchUpdateMemories).toHaveBeenCalledWith([mockUpdate]);
    });

    it('should handle flush now manually', async () => {
      processor.add(mockUpdate);
      
      const result = await processor.flushNow();
      
      expect(result.updatesWritten).toBe(1);
      expect(result.databaseOperations).toBe(1);
      expect(result.processingTimeMs).toBeGreaterThan(0);
      expect(result.errors).toEqual([]);
      expect(mockStorage.memory!.batchUpdateMemories).toHaveBeenCalledWith([mockUpdate]);
    });

    it('should handle empty flush', async () => {
      const result = await processor.flushNow();
      
      expect(result.updatesWritten).toBe(0);
      expect(result.databaseOperations).toBe(0);
      expect(result.processingTimeMs).toBe(0);
      expect(mockStorage.memory!.batchUpdateMemories).not.toHaveBeenCalled();
    });

    it('should handle flush errors and retry', async () => {
      const batchUpdateSpy = jest.spyOn(mockStorage.memory!, 'batchUpdateMemories')
        .mockRejectedValueOnce(new Error('Database error'));
      
      processor.add(mockUpdate);
      
      const result = await processor.flushNow();
      
      expect(result.updatesWritten).toBe(1);
      expect(result.databaseOperations).toBe(0);
      expect(result.errors).toEqual(['Database error']);
      
      // Update should be re-queued for retry
      const status = processor.getQueueStatus();
      expect(status.pendingUpdates).toBe(1);
      
      batchUpdateSpy.mockRestore();
    });
  });

  describe('Queue Status', () => {
    it('should return correct queue status', () => {
      processor.add(mockUpdate);
      
      const status = processor.getQueueStatus();
      expect(status.pendingUpdates).toBe(1);
      expect(status.isDestroyed).toBe(false);
    });

    it('should show destroyed status after destruction', async () => {
      await processor.destroy();
      
      const status = processor.getQueueStatus();
      expect(status.isDestroyed).toBe(true);
    });
  });

  describe('Destruction and Cleanup', () => {
    it('should flush pending updates before destroy', async () => {
      processor.add(mockUpdate);
      
      await processor.destroy();
      
      expect(mockStorage.memory!.batchUpdateMemories).toHaveBeenCalledWith([mockUpdate]);
      
      const status = processor.getQueueStatus();
      expect(status.isDestroyed).toBe(true);
    });

    it('should handle multiple destroy calls safely', async () => {
      await processor.destroy();
      await processor.destroy(); // Should not throw
      
      const status = processor.getQueueStatus();
      expect(status.isDestroyed).toBe(true);
    });

    it('should clear timeout on destroy', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      await processor.destroy();
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
      
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('Performance and Timing', () => {
    it('should track processing time accurately', async () => {
      processor.add(mockUpdate);
      
      const result = await processor.flushNow();
      
      expect(result.processingTimeMs).toBeGreaterThan(0);
      expect(result.processingTimeMs).toBeLessThan(1000); // Should be fast
    });

    it('should ensure minimum 1ms processing time', async () => {
      // Mock Date.now to return same value for instant processing
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => 12345);
      
      processor.add(mockUpdate);
      const result = await processor.flushNow();
      
      expect(result.processingTimeMs).toBe(1); // Should be at least 1ms
      
      Date.now = originalDateNow;
    });

    it('should handle concurrent flush operations', async () => {
      processor.add({ id: 'mem-1', resonance: 0.5, lastAccessedAt: Date.now(), accessCount: 1 });
      processor.add({ id: 'mem-2', resonance: 0.6, lastAccessedAt: Date.now(), accessCount: 2 });
      
      // Start multiple flushes concurrently
      const [result1, result2] = await Promise.all([
        processor.flushNow(),
        processor.flushNow()
      ]);
      
      // First flush should process all updates, second should be empty
      expect(result1.updatesWritten + result2.updatesWritten).toBe(2);
      expect(mockStorage.memory!.batchUpdateMemories).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle updates with zero access count', () => {
      const zeroAccessUpdate: MemoryUpdate = {
        id: 'mem-zero',
        resonance: 0.5,
        lastAccessedAt: Date.now(),
        accessCount: 0
      };
      
      processor.add(zeroAccessUpdate);
      
      const status = processor.getQueueStatus();
      expect(status.pendingUpdates).toBe(1);
    });

    it('should handle updates with very high resonance', () => {
      const highResonanceUpdate: MemoryUpdate = {
        id: 'mem-high',
        resonance: 1.0,
        lastAccessedAt: Date.now(),
        accessCount: 100
      };
      
      processor.add(highResonanceUpdate);
      
      const status = processor.getQueueStatus();
      expect(status.pendingUpdates).toBe(1);
    });

    it('should handle updates with old timestamps', () => {
      const oldUpdate: MemoryUpdate = {
        id: 'mem-old',
        resonance: 0.3,
        lastAccessedAt: Date.now() - (365 * 24 * 60 * 60 * 1000), // 1 year ago
        accessCount: 1
      };
      
      processor.add(oldUpdate);
      
      const status = processor.getQueueStatus();
      expect(status.pendingUpdates).toBe(1);
    });
  });
}); 