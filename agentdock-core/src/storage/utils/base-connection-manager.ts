/**
 * Base connection manager for storage adapters
 * Provides common connection management patterns
 */

import { ConnectionError } from './error-handling';

/**
 * Base class for connection managers
 * Implements singleton pattern with lazy initialization
 */
export abstract class BaseConnectionManager<TConfig, TConnection> {
  protected connection?: TConnection;
  protected connectionPromise?: Promise<TConnection>;

  constructor(protected config: TConfig) {}

  /**
   * Get or create a connection
   * Implements singleton pattern with promise deduplication
   */
  async getConnection(): Promise<TConnection> {
    if (this.connection) {
      return this.connection;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.createConnection();

    try {
      this.connection = await this.connectionPromise;
      return this.connection;
    } catch (error) {
      throw new ConnectionError(
        `Failed to establish connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error as Error
      );
    } finally {
      this.connectionPromise = undefined;
    }
  }

  /**
   * Create a new connection
   * Must be implemented by subclasses
   */
  protected abstract createConnection(): Promise<TConnection>;

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.connection) {
      await this.closeConnection();
      this.connection = undefined;
    }
  }

  /**
   * Close the actual connection
   * Must be implemented by subclasses
   */
  protected abstract closeConnection(): Promise<void>;

  /**
   * Check if connected
   */
  abstract isConnected(): boolean;

  /**
   * Get the current connection without creating one
   */
  getCurrentConnection(): TConnection | undefined {
    return this.connection;
  }

  /**
   * Reset the connection
   * Forces a new connection on next getConnection() call
   */
  async reset(): Promise<void> {
    await this.close();
    this.connectionPromise = undefined;
  }
}
