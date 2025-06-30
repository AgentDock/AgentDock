/**
 * Transaction utilities for database adapters
 */

import { TimeoutError } from './error-handling';
import { TransactionOptions } from './types';

export interface Transaction {
  id: string;
  startTime: number;
  operations: Array<{
    type: 'set' | 'delete' | 'update';
    key: string;
    value?: any;
    timestamp: number;
  }>;
  state: 'active' | 'committed' | 'aborted';
  timeoutId?: NodeJS.Timeout; // Track timeout reference to prevent memory leak
}

/**
 * Transaction manager for coordinating transactional operations
 */
export class TransactionManager {
  private transactions = new Map<string, Transaction>();
  private transactionId = 0;

  /**
   * Begin a new transaction
   */
  begin(options?: TransactionOptions): Transaction {
    const id = `txn-${++this.transactionId}`;
    const transaction: Transaction = {
      id,
      startTime: Date.now(),
      operations: [],
      state: 'active'
    };

    this.transactions.set(id, transaction);

    // Set timeout if specified and store reference to prevent memory leak
    if (options?.timeout) {
      const timeoutId = setTimeout(() => {
        if (this.transactions.get(id)?.state === 'active') {
          this.abort(id, new TimeoutError('Transaction timeout'));
        }
      }, options.timeout);
      transaction.timeoutId = timeoutId;
    }

    return transaction;
  }

  /**
   * Add operation to transaction
   */
  addOperation(
    transactionId: string,
    type: 'set' | 'delete' | 'update',
    key: string,
    value?: any
  ): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.state !== 'active') {
      throw new Error(`Transaction is ${transaction.state}`);
    }

    transaction.operations.push({
      type,
      key,
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Commit a transaction
   */
  async commit(
    transactionId: string,
    executor: (operations: Transaction['operations']) => Promise<void>
  ): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.state !== 'active') {
      throw new Error(`Transaction is already ${transaction.state}`);
    }

    try {
      await executor(transaction.operations);
      transaction.state = 'committed';
    } catch (error) {
      transaction.state = 'aborted';
      throw error;
    } finally {
      // Clear timeout to prevent memory leak
      if (transaction.timeoutId) {
        clearTimeout(transaction.timeoutId);
      }

      // CRITICAL FIX: Immediate cleanup for completed transactions
      // Only delay cleanup for potentially stuck active transactions
      if (transaction.state !== 'active') {
        this.transactions.delete(transactionId);
      } else {
        // Reduced delay from 60s to 5s for stuck transactions
        setTimeout(() => this.transactions.delete(transactionId), 5000);
      }
    }
  }

  /**
   * Abort a transaction
   */
  abort(transactionId: string, reason?: Error): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return;

    if (transaction.state === 'active') {
      transaction.state = 'aborted';
    }

    // Clear timeout to prevent memory leak
    if (transaction.timeoutId) {
      clearTimeout(transaction.timeoutId);
    }

    // CRITICAL FIX: Immediate cleanup for aborted transactions
    this.transactions.delete(transactionId);
  }

  /**
   * Get transaction state
   */
  getState(transactionId: string): Transaction['state'] | undefined {
    return this.transactions.get(transactionId)?.state;
  }

  /**
   * Get active transactions
   */
  getActiveTransactions(): Transaction[] {
    return Array.from(this.transactions.values()).filter(
      (txn) => txn.state === 'active'
    );
  }
}

/**
 * Simple transaction helper for non-database storages
 */
export class SimpleTransaction {
  private rollbackActions: Array<() => Promise<void>> = [];
  private committed = false;

  /**
   * Add a rollback action
   */
  addRollback(action: () => Promise<void>): void {
    if (this.committed) {
      throw new Error('Cannot add rollback to committed transaction');
    }
    this.rollbackActions.push(action);
  }

  /**
   * Commit the transaction (clear rollback actions)
   */
  commit(): void {
    this.committed = true;
    this.rollbackActions = [];
  }

  /**
   * Rollback the transaction
   */
  async rollback(): Promise<void> {
    if (this.committed) {
      throw new Error('Cannot rollback committed transaction');
    }

    // Execute rollback actions in reverse order
    const actions = [...this.rollbackActions].reverse();
    for (const action of actions) {
      try {
        await action();
      } catch (error) {
        console.error('Rollback action failed:', error);
      }
    }

    this.rollbackActions = [];
  }
}

/**
 * Transaction decorator for methods
 */
export function transactional(options?: TransactionOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const transaction = new SimpleTransaction();

      try {
        const result = await originalMethod.apply(this, [...args, transaction]);
        transaction.commit();
        return result;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Create a transactional wrapper
 */
export function withTransaction<T>(
  storage: T,
  transactionManager: TransactionManager
): T & { beginTransaction: () => string } {
  return new Proxy(storage as any, {
    get(target, prop) {
      if (prop === 'beginTransaction') {
        return () => transactionManager.begin().id;
      }

      // Wrap storage methods to track operations
      if (typeof target[prop] === 'function') {
        return (...args: any[]) => {
          // Check if first arg is transaction ID
          const [firstArg, ...restArgs] = args;
          if (typeof firstArg === 'string' && firstArg.startsWith('txn-')) {
            const txnId = firstArg;
            // Track operation in transaction
            if (prop === 'set') {
              transactionManager.addOperation(txnId, 'set', args[1], args[2]);
            } else if (prop === 'delete') {
              transactionManager.addOperation(txnId, 'delete', args[1]);
            }
            // Execute operation without transaction ID
            return target[prop](...restArgs);
          }

          return target[prop](...args);
        };
      }

      return target[prop];
    }
  }) as T & { beginTransaction: () => string };
}
