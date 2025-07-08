/**
 * Memory-specific transaction support for atomic operations
 *
 * Ensures that memory operations (store, embed, index) either all succeed
 * or all fail, preventing inconsistent state in the memory system.
 */

import { LogCategory, logger } from '../../logging';

export interface Transaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  addOperation(
    forward: () => Promise<void>,
    rollback: () => Promise<void>
  ): void;
}

/**
 * Memory transaction implementation with rollback support
 *
 * @example
 * ```typescript
 * const transaction = new MemoryTransaction();
 *
 * // Add memory store operation
 * transaction.addOperation(
 *   async () => { memoryId = await storage.store(data); },
 *   async () => { if (memoryId) await storage.delete(memoryId); }
 * );
 *
 * // Add embedding operation
 * transaction.addOperation(
 *   async () => { embeddingId = await vector.store(embedding); },
 *   async () => { if (embeddingId) await vector.delete(embeddingId); }
 * );
 *
 * try {
 *   await transaction.commit();
 * } catch (error) {
 *   // Automatically rolled back
 *   throw error;
 * }
 * ```
 */
export class MemoryTransaction implements Transaction {
  private operations: Array<{
    forward: () => Promise<void>;
    rollback: () => Promise<void>;
  }> = [];
  private executed: number = 0;
  private isCommitted = false;
  private isRolledBack = false;

  /**
   * Add an operation to the transaction
   *
   * @param forward - The operation to execute
   * @param rollback - The operation to undo if transaction fails
   */
  addOperation(
    forward: () => Promise<void>,
    rollback: () => Promise<void>
  ): void {
    if (this.isCommitted) {
      throw new Error('Cannot add operations to committed transaction');
    }
    if (this.isRolledBack) {
      throw new Error('Cannot add operations to rolled back transaction');
    }

    this.operations.push({ forward, rollback });
  }

  /**
   * Commit all operations in the transaction
   *
   * @throws {Error} If any operation fails, all are rolled back
   */
  async commit(): Promise<void> {
    if (this.isCommitted) {
      throw new Error('Transaction already committed');
    }
    if (this.isRolledBack) {
      throw new Error('Cannot commit rolled back transaction');
    }

    try {
      // Execute all forward operations
      for (const op of this.operations) {
        await op.forward();
        this.executed++;
      }

      this.isCommitted = true;
    } catch (error) {
      // Rollback on failure
      logger.error(
        LogCategory.STORAGE,
        'MemoryTransaction',
        'Transaction commit failed, rolling back',
        {
          executed: this.executed,
          total: this.operations.length,
          error: error instanceof Error ? error.message : String(error)
        }
      );

      await this.rollback();
      throw error;
    }
  }

  /**
   * Rollback all executed operations
   *
   * Executes rollback operations in reverse order to properly
   * undo the transaction. Continues even if individual rollbacks fail.
   */
  async rollback(): Promise<void> {
    if (this.isRolledBack) {
      return; // Already rolled back
    }

    const failedRollbacks: Array<{ index: number; error: unknown }> = [];

    // Rollback in reverse order
    for (let i = this.executed - 1; i >= 0; i--) {
      try {
        await this.operations[i].rollback();
      } catch (rollbackError) {
        failedRollbacks.push({ index: i, error: rollbackError });
        logger.error(
          LogCategory.STORAGE,
          'MemoryTransaction',
          'Rollback operation failed',
          {
            operation: i,
            error:
              rollbackError instanceof Error
                ? rollbackError.message
                : String(rollbackError)
          }
        );
      }
    }

    this.isRolledBack = true;

    // If any rollbacks failed, log a warning
    if (failedRollbacks.length > 0) {
      logger.warn(
        LogCategory.STORAGE,
        'MemoryTransaction',
        'Some rollback operations failed',
        {
          failed: failedRollbacks.length,
          total: this.executed
        }
      );
    }
  }

  /**
   * Get transaction state
   */
  get state(): 'pending' | 'committed' | 'rolled_back' {
    if (this.isCommitted) return 'committed';
    if (this.isRolledBack) return 'rolled_back';
    return 'pending';
  }

  /**
   * Get number of operations in transaction
   */
  get size(): number {
    return this.operations.length;
  }

  /**
   * Get number of executed operations
   */
  get executedCount(): number {
    return this.executed;
  }
}

/**
 * Create a transaction scope for automatic rollback
 *
 * @example
 * ```typescript
 * await withMemoryTransaction(async (transaction) => {
 *   transaction.addOperation(...);
 *   transaction.addOperation(...);
 *   // Automatically commits if no error thrown
 * });
 * ```
 */
export async function withMemoryTransaction<T>(
  callback: (transaction: MemoryTransaction) => Promise<T>
): Promise<T> {
  const transaction = new MemoryTransaction();

  try {
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    // Transaction automatically rolled back in commit()
    throw error;
  }
}
