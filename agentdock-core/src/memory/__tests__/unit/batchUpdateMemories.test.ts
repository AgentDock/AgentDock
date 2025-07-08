import { MemoryUpdate } from '../../../storage/types';
import { MemoryType } from '../../types';

// Mock logger to avoid console output during tests
jest.mock('../../../logging', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  },
  LogCategory: {
    STORAGE: 'STORAGE'
  }
}));

describe('batchUpdateMemories', () => {
  describe('PostgreSQL Adapter', () => {
    let mockPool: any;
    let mockClient: any;
    let adapter: any;

    beforeEach(() => {
      mockClient = {
        query: jest.fn().mockResolvedValue({ rowCount: 1 }),
        release: jest.fn()
      };

      mockPool = {
        connect: jest.fn().mockResolvedValue(mockClient)
      };

      // Create memory operations instance directly
      const {
        MemoryOperations
      } = require('../../../storage/adapters/postgresql/operations/memory');
      adapter = {
        memory: new MemoryOperations(mockPool, 'public')
      };
    });

    it('should update multiple memories in batch', async () => {
      const updates: MemoryUpdate[] = [
        {
          id: 'mem1',
          resonance: 0.8,
          lastAccessedAt: Date.now(),
          accessCount: 5
        },
        {
          id: 'mem2',
          resonance: 0.6,
          lastAccessedAt: Date.now(),
          accessCount: 3
        }
      ];

      await adapter.memory.batchUpdateMemories(updates);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining([
          ['mem1', 'mem2'],
          [0.8, 0.6],
          expect.any(Array),
          [5, 3]
        ])
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle empty updates array', async () => {
      await adapter.memory.batchUpdateMemories([]);
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      const updates: MemoryUpdate[] = [
        {
          id: 'mem1',
          resonance: 0.8,
          lastAccessedAt: Date.now(),
          accessCount: 5
        }
      ];

      await expect(adapter.memory.batchUpdateMemories(updates)).rejects.toThrow(
        'Batch update failed'
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('SQLite Adapter', () => {
    let mockDb: any;
    let adapter: any;

    beforeEach(() => {
      const mockStmt = {
        run: jest.fn()
      };

      mockDb = {
        prepare: jest.fn().mockReturnValue(mockStmt),
        transaction: jest.fn((fn: any) => fn)
      };

      // Create memory operations instance directly
      const {
        SqliteMemoryOperations
      } = require('../../../storage/adapters/sqlite/operations/memory');
      adapter = {
        memory: new SqliteMemoryOperations(mockDb)
      };
    });

    it('should update multiple memories in batch', async () => {
      const updates: MemoryUpdate[] = [
        {
          id: 'mem1',
          resonance: 0.8,
          lastAccessedAt: Date.now(),
          accessCount: 5
        },
        {
          id: 'mem2',
          resonance: 0.6,
          lastAccessedAt: Date.now(),
          accessCount: 3
        }
      ];

      await adapter.memory.batchUpdateMemories(updates);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE memories')
      );
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should handle empty updates array', async () => {
      await adapter.memory.batchUpdateMemories([]);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      // Mock transaction to return a function that throws when called
      mockDb.transaction.mockReturnValueOnce((updates: any) => {
        throw new Error('Transaction failed');
      });

      const updates: MemoryUpdate[] = [
        {
          id: 'mem1',
          resonance: 0.8,
          lastAccessedAt: Date.now(),
          accessCount: 5
        }
      ];

      await expect(adapter.memory.batchUpdateMemories(updates)).rejects.toThrow(
        'Batch update failed'
      );
    });
  });
});
