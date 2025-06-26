/**
 * DynamoDB batch operations
 */

import { LogCategory, logger } from '../../../../logging';
import { StorageOptions } from '../../../types';
import { DynamoDBConnection } from '../types';
import {
  buildCompositeKey,
  convertFromAttributeValue,
  itemToStorageFormat,
  valueToItemFormat
} from '../utils';
import { KVOperations } from './kv';

export class BatchOperations {
  private kvOps: KVOperations;

  constructor(private connection: DynamoDBConnection) {
    this.kvOps = new KVOperations(connection);
  }

  /**
   * Get multiple values by keys
   */
  async getMany<T>(
    keys: string[],
    options?: StorageOptions
  ): Promise<Record<string, T | null>> {
    const namespace =
      options?.namespace || this.connection.defaultNamespace || 'default';
    const result: Record<string, T | null> = {};

    if (keys.length === 0) return result;

    try {
      const { BatchGetItemCommand } = await import('@aws-sdk/client-dynamodb');
      const batchSize = 100; // DynamoDB limit

      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);

        // Create Map for O(1) key lookups - eliminates O(n²) performance
        const skToKeyMap = new Map<string, string>();
        const keysToGet = batch.map((key) => {
          const { pk, sk } = buildCompositeKey(namespace, key);
          skToKeyMap.set(sk, key); // O(1) lookup mapping
          return { pk: { S: pk }, sk: { S: sk } };
        });

        const command = new BatchGetItemCommand({
          RequestItems: {
            [this.connection.tableName]: {
              Keys: keysToGet
            }
          }
        });

        const response = await this.connection.client.send(command);

        // Process responses with O(1) Map lookups instead of O(n) find()
        if (response.Responses?.[this.connection.tableName]) {
          for (const item of response.Responses[this.connection.tableName]) {
            if (item.sk?.S) {
              const originalKey = skToKeyMap.get(item.sk.S); // O(1) lookup!

              if (originalKey) {
                // Convert item
                const converted: Record<string, any> = {};
                for (const [k, v] of Object.entries(item)) {
                  converted[k] = convertFromAttributeValue(v);
                }
                result[originalKey] = itemToStorageFormat<T>(
                  converted,
                  this.connection
                );
              }
            }
          }
        }

        // Handle unprocessed keys with O(1) Map lookups
        if (response.UnprocessedKeys?.[this.connection.tableName]) {
          // For simplicity, try individual gets for unprocessed items
          for (const unprocessedKey of response.UnprocessedKeys[
            this.connection.tableName
          ].Keys || []) {
            if (unprocessedKey.sk?.S) {
              const originalKey = skToKeyMap.get(unprocessedKey.sk.S); // O(1) lookup!

              if (originalKey) {
                result[originalKey] = await this.kvOps.get<T>(
                  originalKey,
                  options
                );
              }
            }
          }
        }
      }

      // Fill in nulls for missing keys
      for (const key of keys) {
        if (!(key in result)) {
          result[key] = null;
        }
      }

      logger.debug(
        LogCategory.STORAGE,
        'DynamoDB:getMany',
        'Batch get completed',
        {
          count: keys.length,
          namespace,
          found: Object.values(result).filter((v) => v !== null).length
        }
      );

      return result;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'DynamoDB:getMany',
        'Batch get failed',
        {
          count: keys.length,
          namespace,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  /**
   * Set multiple values
   */
  async setMany<T>(
    items: Record<string, T>,
    options?: StorageOptions
  ): Promise<void> {
    const namespace =
      options?.namespace || this.connection.defaultNamespace || 'default';
    const entries = Object.entries(items);

    if (entries.length === 0) return;

    try {
      const { BatchWriteItemCommand } = await import(
        '@aws-sdk/client-dynamodb'
      );
      const batchSize = 25; // DynamoDB limit

      // Handle TTL from options
      let ttl: number | undefined;
      if (options?.ttlSeconds && typeof options.ttlSeconds === 'number') {
        // Import TTLManager for static method
        const { TTLManager } = await import('../../../utils/ttl-manager');
        ttl = TTLManager.calculateExpiration(options.ttlSeconds * 1000);
      }

      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const putRequests = batch.map(([key, value]) => {
          const item = valueToItemFormat(
            key,
            value,
            namespace,
            ttl,
            options?.metadata
          );
          return { PutRequest: { Item: item } };
        });

        const command = new BatchWriteItemCommand({
          RequestItems: {
            [this.connection.tableName]: putRequests
          }
        });

        const response = await this.connection.client.send(command);

        // Handle unprocessed items with O(1) Map lookups
        if (response.UnprocessedItems?.[this.connection.tableName]) {
          // Create Map for O(1) lookup of batch entries
          const skToBatchEntryMap = new Map<string, [string, T]>();
          batch.forEach(([key, value]) => {
            const { sk } = buildCompositeKey(namespace, key);
            skToBatchEntryMap.set(sk, [key, value]);
          });

          // For simplicity, try individual sets for unprocessed items
          for (const unprocessedItem of response.UnprocessedItems[
            this.connection.tableName
          ]) {
            if (unprocessedItem.PutRequest?.Item?.sk?.S) {
              const originalEntry = skToBatchEntryMap.get(
                unprocessedItem.PutRequest.Item.sk.S
              ); // O(1) lookup!

              if (originalEntry) {
                await this.kvOps.set(
                  originalEntry[0],
                  originalEntry[1],
                  options
                );
              }
            }
          }
        }
      }

      logger.debug(
        LogCategory.STORAGE,
        'DynamoDB:setMany',
        'Batch set completed',
        {
          count: entries.length,
          namespace
        }
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'DynamoDB:setMany',
        'Batch set failed',
        {
          count: entries.length,
          namespace,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  /**
   * Delete multiple values
   */
  async deleteMany(keys: string[], options?: StorageOptions): Promise<number> {
    const namespace =
      options?.namespace || this.connection.defaultNamespace || 'default';
    let deleted = 0;

    if (keys.length === 0) return deleted;

    try {
      const { BatchWriteItemCommand } = await import(
        '@aws-sdk/client-dynamodb'
      );
      const batchSize = 25; // DynamoDB limit

      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        const deleteRequests = batch.map((key) => {
          const { pk, sk } = buildCompositeKey(namespace, key);
          return {
            DeleteRequest: {
              Key: { pk: { S: pk }, sk: { S: sk } }
            }
          };
        });

        const command = new BatchWriteItemCommand({
          RequestItems: {
            [this.connection.tableName]: deleteRequests
          }
        });

        const response = await this.connection.client.send(command);

        // Count successful deletes (DynamoDB doesn't return info about what was actually deleted)
        deleted += batch.length;

        // Handle unprocessed items with O(1) Map lookups
        if (response.UnprocessedItems?.[this.connection.tableName]) {
          deleted -=
            response.UnprocessedItems[this.connection.tableName].length;

          // Create Map for O(1) lookup of batch keys
          const skToKeyMap = new Map<string, string>();
          batch.forEach((key) => {
            const { sk } = buildCompositeKey(namespace, key);
            skToKeyMap.set(sk, key);
          });

          // For simplicity, try individual deletes for unprocessed items
          for (const unprocessedItem of response.UnprocessedItems[
            this.connection.tableName
          ]) {
            if (unprocessedItem.DeleteRequest?.Key?.sk?.S) {
              const originalKey = skToKeyMap.get(
                unprocessedItem.DeleteRequest.Key.sk.S
              ); // O(1) lookup!

              if (originalKey) {
                const wasDeleted = await this.kvOps.delete(
                  originalKey,
                  options
                );
                if (wasDeleted) deleted++;
              }
            }
          }
        }
      }

      logger.debug(
        LogCategory.STORAGE,
        'DynamoDB:deleteMany',
        'Batch delete completed',
        {
          requested: keys.length,
          deleted,
          namespace
        }
      );

      return deleted;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'DynamoDB:deleteMany',
        'Batch delete failed',
        {
          count: keys.length,
          namespace,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }
}
