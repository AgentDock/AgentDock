/**
 * @fileoverview SQLite connection management
 */

import Database from 'better-sqlite3';

import { LogCategory, logger } from '../../../logging';
import { BaseConnectionManager } from '../../utils';
import { cleanupExpired, initializeSchema } from './schema';
import { SQLiteAdapterOptions, SQLiteConnection } from './types';

export class SQLiteConnectionManager extends BaseConnectionManager<
  SQLiteAdapterOptions,
  SQLiteConnection
> {
  private cleanupInterval?: NodeJS.Timeout;

  /**
   * Create a new database connection
   */
  protected async createConnection(): Promise<SQLiteConnection> {
    const {
      path = './agentdock.db',
      namespace,
      verbose = false,
      walMode = true
    } = this.config;

    // Initialize database
    const db = new Database(path, {
      verbose: verbose ? console.log : undefined
    });

    // Enable WAL mode for better performance
    if (walMode && path !== ':memory:') {
      db.pragma('journal_mode = WAL');
    }

    // Initialize schema
    initializeSchema(db);

    // Create connection object
    const connection: SQLiteConnection = {
      db,
      defaultNamespace: namespace
    };

    // Start cleanup interval
    this.startCleanupInterval(connection);

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteConnection',
      'Connection established',
      {
        path,
        namespace,
        walMode
      }
    );

    return connection;
  }

  /**
   * Close the actual connection
   */
  protected async closeConnection(): Promise<void> {
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Close database
    if (this.connection?.db) {
      try {
        this.connection.db.close();
        logger.debug(
          LogCategory.STORAGE,
          'SQLiteConnection',
          'Connection closed'
        );
      } catch (error) {
        logger.warn(LogCategory.STORAGE, 'SQLiteConnection', 'Close failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return !!(this.connection?.db && this.connection.db.open);
  }

  /**
   * Start cleanup interval for expired items
   */
  private startCleanupInterval(connection: SQLiteConnection): void {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => {
      cleanupExpired(connection.db);
    }, 60 * 1000);
  }
}

// Export convenience functions for backward compatibility
export function createConnection(
  options: SQLiteAdapterOptions = {}
): SQLiteConnection {
  const manager = new SQLiteConnectionManager(options);
  // This is synchronous for SQLite, so we can use a workaround
  let conn: SQLiteConnection | undefined;
  manager.getConnection().then((c) => (conn = c));
  // SQLite connection is synchronous, so conn should be set immediately
  return conn!;
}

export async function closeConnection(
  connection: SQLiteConnection
): Promise<void> {
  // This is a legacy function - new code should use SQLiteConnectionManager
  if (connection.db) {
    connection.db.close();
  }
}
