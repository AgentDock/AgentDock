/**
 * MongoDB connection management
 */

import type { MongoClient } from 'mongodb';

import { BaseConnectionManager } from '../../utils';
import { MongoConnection, MongoDBConfig } from './types';

export class MongoConnectionManager extends BaseConnectionManager<
  MongoDBConfig,
  MongoConnection
> {
  /**
   * Create a new database connection
   */
  protected async createConnection(): Promise<MongoConnection> {
    // Lazy load MongoDB
    let MongoClientConstructor: typeof MongoClient;
    try {
      const mongodb = await import('mongodb');
      MongoClientConstructor = mongodb.MongoClient;
    } catch (error) {
      throw new Error(
        'MongoDB driver not found. Please install it with: npm install mongodb'
      );
    }

    const client = new MongoClientConstructor(this.config.uri, {
      ...this.config.options,
      // Ensure connection pooling is configured
      maxPoolSize: this.config.options?.maxPoolSize || 10,
      minPoolSize: this.config.options?.minPoolSize || 2
    });

    await client.connect();

    const db = client.db(this.config.database);
    const kvCollection = db.collection<any>(
      this.config.collection || 'agentdock_kv'
    );
    const listCollection = db.collection<any>('agentdock_lists');

    // Create indexes
    await this.createIndexes(kvCollection, listCollection);

    return {
      client,
      db,
      kvCollection,
      listCollection
    };
  }

  /**
   * Close the actual connection
   */
  protected async closeConnection(): Promise<void> {
    if (this.connection) {
      await this.connection.client.close();
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return !!(
      this.connection && this.connection.client.topology?.isConnected?.()
    );
  }

  /**
   * Create necessary indexes
   */
  private async createIndexes(
    kvCollection: any,
    listCollection: any
  ): Promise<void> {
    // Default indexes for KV collection
    await kvCollection.createIndex({ namespace: 1, _id: 1 });
    await kvCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await kvCollection.createIndex(
      { 'metadata._search': 'text' },
      { sparse: true }
    );

    // Default indexes for list collection
    await listCollection.createIndex({ namespace: 1, _id: 1 });
    await listCollection.createIndex({ name: 1 });

    // User-defined indexes
    if (this.config.indexes) {
      for (const index of this.config.indexes) {
        await kvCollection.createIndex(index.key, index.options);
      }
    }
  }
}
