/**
 * Connection pool utilities for database adapters
 */

import { ConnectionError, TimeoutError } from './error-handling';
import { ConnectionPoolOptions } from './types';

export interface PooledConnection<T> {
  connection: T;
  id: string;
  createdAt: number;
  lastUsedAt: number;
  inUse: boolean;
}

/**
 * Generic connection pool implementation
 */
export class ConnectionPool<T> {
  private connections: PooledConnection<T>[] = [];
  private waitingQueue: Array<{
    resolve: (conn: PooledConnection<T>) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];

  private options: Required<ConnectionPoolOptions>;
  private connectionId = 0;
  private evictionTimer?: NodeJS.Timeout;

  constructor(
    private createConnection: () => Promise<T>,
    private destroyConnection: (conn: T) => Promise<void>,
    options: ConnectionPoolOptions = {}
  ) {
    this.options = {
      min: options.min || 0,
      max: options.max || 10,
      idleTimeoutMillis: options.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: options.connectionTimeoutMillis || 5000,
      acquireTimeoutMillis: options.acquireTimeoutMillis || 30000,
      testOnBorrow: options.testOnBorrow || false,
      evictionRunIntervalMillis: options.evictionRunIntervalMillis || 60000
    };

    this.initializePool();
  }

  private async initializePool(): Promise<void> {
    // Create minimum connections
    const promises: Promise<void>[] = [];
    for (let i = 0; i < this.options.min; i++) {
      promises.push(this.createNewConnection());
    }
    await Promise.all(promises);

    // Start eviction timer
    if (this.options.evictionRunIntervalMillis > 0) {
      this.startEvictionTimer();
    }
  }

  private async createNewConnection(): Promise<void> {
    try {
      const connection = await this.createConnection();
      this.connections.push({
        connection,
        id: `conn-${++this.connectionId}`,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        inUse: false
      });
    } catch (error) {
      throw new ConnectionError('Failed to create connection', error as Error);
    }
  }

  async acquire(): Promise<PooledConnection<T>> {
    // Try to find an available connection
    const available = this.connections.find((conn) => !conn.inUse);

    if (available) {
      available.inUse = true;
      available.lastUsedAt = Date.now();
      return available;
    }

    // Create new connection if under limit
    if (this.connections.length < this.options.max) {
      await this.createNewConnection();
      return this.acquire(); // Recursive call to get the newly created connection
    }

    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(
          (item) => item.resolve === resolve
        );
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new TimeoutError('Connection acquisition timeout'));
      }, this.options.acquireTimeoutMillis);

      this.waitingQueue.push({ resolve, reject, timeout });
    });
  }

  async release(pooledConnection: PooledConnection<T>): Promise<void> {
    const conn = this.connections.find((c) => c.id === pooledConnection.id);
    if (!conn) {
      throw new Error('Connection not found in pool');
    }

    conn.inUse = false;
    conn.lastUsedAt = Date.now();

    // Give connection to waiting request
    if (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift()!;
      clearTimeout(waiting.timeout);
      conn.inUse = true;
      waiting.resolve(conn);
    }
  }

  async destroy(pooledConnection: PooledConnection<T>): Promise<void> {
    const index = this.connections.findIndex(
      (c) => c.id === pooledConnection.id
    );
    if (index === -1) return;

    const conn = this.connections[index];
    this.connections.splice(index, 1);

    try {
      await this.destroyConnection(conn.connection);
    } catch (error) {
      // Log but don't throw - connection is already removed from pool
      console.error('Error destroying connection:', error);
    }

    // Create replacement if below minimum
    if (this.connections.length < this.options.min) {
      this.createNewConnection().catch(console.error);
    }
  }

  private startEvictionTimer(): void {
    this.evictionTimer = setInterval(() => {
      this.evictIdleConnections();
    }, this.options.evictionRunIntervalMillis);
  }

  private async evictIdleConnections(): Promise<void> {
    const now = Date.now();
    const toEvict = this.connections.filter(
      (conn) =>
        !conn.inUse &&
        now - conn.lastUsedAt > this.options.idleTimeoutMillis &&
        this.connections.length > this.options.min
    );

    for (const conn of toEvict) {
      await this.destroy(conn);
    }
  }

  async shutdown(): Promise<void> {
    // Stop eviction timer
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
    }

    // Reject all waiting requests
    for (const waiting of this.waitingQueue) {
      clearTimeout(waiting.timeout);
      waiting.reject(new Error('Pool is shutting down'));
    }
    this.waitingQueue = [];

    // Destroy all connections
    const promises = this.connections.map((conn) =>
      this.destroyConnection(conn.connection).catch(console.error)
    );
    await Promise.all(promises);
    this.connections = [];
  }

  getStats(): {
    total: number;
    active: number;
    idle: number;
    waiting: number;
  } {
    const active = this.connections.filter((c) => c.inUse).length;
    return {
      total: this.connections.length,
      active,
      idle: this.connections.length - active,
      waiting: this.waitingQueue.length
    };
  }
}

/**
 * Create a simple connection pool wrapper
 */
export function createSimplePool<T>(
  factory: () => T | Promise<T>,
  options?: { max?: number }
): {
  acquire: () => Promise<T>;
  release: (resource: T) => void;
  drain: () => void;
} {
  const pool: T[] = [];
  const inUse = new Set<T>();
  const max = options?.max || 10;

  return {
    async acquire() {
      // Return available resource
      const available = pool.find((r) => !inUse.has(r));
      if (available) {
        inUse.add(available);
        return available;
      }

      // Create new if under limit
      if (pool.length < max) {
        const resource = await factory();
        pool.push(resource);
        inUse.add(resource);
        return resource;
      }

      // Wait and retry
      throw new Error('Pool exhausted');
    },

    release(resource: T) {
      inUse.delete(resource);
    },

    drain() {
      pool.length = 0;
      inUse.clear();
    }
  };
}
