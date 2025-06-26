/**
 * DynamoDB key-value operations
 */

import { LogCategory, logger } from '../../../../logging';
import { StorageOptions, StorageProvider } from '../../../types';
import { StorageError } from '../../../utils/error-handling';
import { NamespaceManager } from '../../../utils/namespace';
import { retry } from '../../../utils/retry';
// Import directly from specific files to avoid circular dependency issues
import { TTLManager } from '../../../utils/ttl-manager';
import { DynamoDBConnection } from '../types';
import {
  buildCompositeKey,
  buildPattern,
  convertFromAttributeValue,
  itemToStorageFormat,
  parseKey,
  valueToItemFormat
} from '../utils';

export class KVOperations {
  private ttlManager: TTLManager;
  private namespaceManager: NamespaceManager;

  constructor(private connection: DynamoDBConnection) {
    this.ttlManager = new TTLManager();
    this.namespaceManager = new NamespaceManager({ separator: ':' });
    if (connection.defaultNamespace) {
      this.namespaceManager.setNamespace(connection.defaultNamespace);
    }
  }

  /**
   * Get a value by key
   */
  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    const namespace =
      options?.namespace || this.connection.defaultNamespace || 'default';
    const { pk, sk } = buildCompositeKey(namespace, key);

    try {
      const { GetItemCommand } = await import('@aws-sdk/client-dynamodb');
      const command = new GetItemCommand({
        TableName: this.connection.tableName,
        Key: { pk: { S: pk }, sk: { S: sk } }
      });

      const response = await retry(() => this.connection.client.send(command));

      if (!response.Item) {
        return null;
      }

      // Check TTL
      if (response.Item.expiresAt?.N) {
        const expiresAt = Number(response.Item.expiresAt.N);
        if (expiresAt < Date.now()) {
          // Clean up expired item
          await this.delete(key, options);
          return null;
        }
      }

      // Convert item to value
      const item: Record<string, any> = {};
      for (const [key, value] of Object.entries(response.Item)) {
        item[key] = convertFromAttributeValue(value);
      }

      return itemToStorageFormat<T>(item, this.connection);
    } catch (error) {
      if (error instanceof Error) {
        throw new StorageError(error.message, 'READ_ERROR', error);
      }
      throw error;
    }
  }

  /**
   * Set a value by key
   */
  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    const namespace =
      options?.namespace || this.connection.defaultNamespace || 'default';
    // Handle TTL from options.ttlSeconds
    let ttl: number | undefined;
    if (options?.ttlSeconds && typeof options.ttlSeconds === 'number') {
      // DynamoDB TTL expects seconds since Unix epoch, not milliseconds
      ttl = Math.floor(
        TTLManager.calculateExpiration(options.ttlSeconds) / 1000
      );
    }

    try {
      const { PutItemCommand } = await import('@aws-sdk/client-dynamodb');
      const item = valueToItemFormat(
        key,
        value,
        namespace,
        ttl,
        options?.metadata
      );

      const command = new PutItemCommand({
        TableName: this.connection.tableName,
        Item: item
      });

      await retry(() => this.connection.client.send(command));

      logger.debug(LogCategory.STORAGE, 'DynamoDB:set', 'Value set', {
        key,
        namespace,
        ttl
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new StorageError(error.message, 'WRITE_ERROR', error);
      }
      throw error;
    }
  }

  /**
   * Delete a value by key
   */
  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    const namespace =
      options?.namespace || this.connection.defaultNamespace || 'default';
    const { pk, sk } = buildCompositeKey(namespace, key);

    try {
      const { DeleteItemCommand } = await import('@aws-sdk/client-dynamodb');
      const command = new DeleteItemCommand({
        TableName: this.connection.tableName,
        Key: { pk: { S: pk }, sk: { S: sk } },
        ReturnValues: 'ALL_OLD'
      });

      const response = await retry(() => this.connection.client.send(command));

      logger.debug(LogCategory.STORAGE, 'DynamoDB:delete', 'Value deleted', {
        key,
        namespace,
        existed: !!response.Attributes
      });

      return !!response.Attributes;
    } catch (error) {
      if (error instanceof Error) {
        throw new StorageError(error.message, 'DELETE_ERROR', error);
      }
      throw error;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string, options?: StorageOptions): Promise<boolean> {
    const value = await this.get(key, options);
    return value !== null;
  }

  /**
   * List keys matching a prefix
   */
  async list(prefix: string, options?: StorageOptions): Promise<string[]> {
    const namespace =
      options?.namespace || this.connection.defaultNamespace || 'default';

    try {
      const { QueryCommand } = await import('@aws-sdk/client-dynamodb');
      const pk = `ns#${namespace}`;
      // Use DynamoDB's native prefix filtering instead of client-side regex
      const skPrefix = `key#${prefix}`;

      const items: string[] = [];
      let lastEvaluatedKey:
        | Record<string, import('@aws-sdk/client-dynamodb').AttributeValue>
        | undefined;

      do {
        const command = new QueryCommand({
          TableName: this.connection.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
          ExpressionAttributeValues: {
            ':pk': { S: pk },
            ':prefix': { S: skPrefix } // Server-side prefix filtering
          },
          ExclusiveStartKey: lastEvaluatedKey
        });

        const response = await retry(() =>
          this.connection.client.send(command)
        );

        if (response.Items) {
          for (const item of response.Items) {
            if (item.sk?.S) {
              const key = parseKey(item.sk.S);
              // No client-side filtering needed - DynamoDB already filtered by prefix
              items.push(key);
            }
          }
        }

        lastEvaluatedKey = response.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      logger.debug(LogCategory.STORAGE, 'DynamoDB:list', 'Keys listed', {
        prefix,
        namespace,
        count: items.length
      });

      return items;
    } catch (error) {
      if (error instanceof Error) {
        throw new StorageError(error.message, 'LIST_ERROR', error);
      }
      throw error;
    }
  }

  /**
   * Clear all data or data matching a prefix
   */
  async clear(prefix?: string): Promise<void> {
    const namespace = this.connection.defaultNamespace || 'default';

    try {
      // List all keys to delete
      const keys = await this.list(prefix || '', { namespace });

      if (keys.length === 0) return;

      // Delete in batches
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

        await retry(() => this.connection.client.send(command));
      }

      logger.info(LogCategory.STORAGE, 'DynamoDB:clear', 'Data cleared', {
        prefix,
        namespace,
        count: keys.length
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new StorageError(error.message, 'CLEAR_ERROR', error);
      }
      throw error;
    }
  }
}
