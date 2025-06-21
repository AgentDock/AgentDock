/**
 * DynamoDB list operations
 */

import { LogCategory, logger } from '../../../../logging';
import { StorageOptions } from '../../../types';
import { DynamoDBConnection } from '../types';
import {
  buildListKey,
  convertFromAttributeValue,
  convertToAttributeValue
} from '../utils';

export class ListOperations {
  constructor(private connection: DynamoDBConnection) {}

  /**
   * Get a list by key
   */
  async getList<T>(
    key: string,
    start?: number,
    end?: number,
    options?: StorageOptions
  ): Promise<T[] | null> {
    const namespace =
      options?.namespace || this.connection.defaultNamespace || 'default';
    const { pk, sk } = buildListKey(namespace, key);

    try {
      const { GetItemCommand } = await import('@aws-sdk/client-dynamodb');
      const command = new GetItemCommand({
        TableName: this.connection.tableName,
        Key: { pk: { S: pk }, sk: { S: sk } }
      });

      const response = await this.connection.client.send(command);

      if (!response.Item || !response.Item.listData) {
        return null;
      }

      // Convert list data
      const listData = convertFromAttributeValue(response.Item.listData);
      if (!Array.isArray(listData)) {
        return null;
      }

      // Apply range if specified
      if (start !== undefined || end !== undefined) {
        return listData.slice(start, end);
      }

      return listData;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'DynamoDB:getList',
        'Failed to get list',
        {
          key,
          namespace,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  /**
   * Save a list
   */
  async saveList<T>(
    key: string,
    values: T[],
    options?: StorageOptions
  ): Promise<void> {
    const namespace =
      options?.namespace || this.connection.defaultNamespace || 'default';
    const { pk, sk } = buildListKey(namespace, key);

    try {
      const { PutItemCommand } = await import('@aws-sdk/client-dynamodb');

      const item: Record<string, any> = {
        pk: { S: pk },
        sk: { S: sk },
        namespace: { S: namespace },
        type: { S: 'list' },
        listData: convertToAttributeValue(values)
      };

      const command = new PutItemCommand({
        TableName: this.connection.tableName,
        Item: item
      });

      await this.connection.client.send(command);

      logger.debug(LogCategory.STORAGE, 'DynamoDB:saveList', 'List saved', {
        key,
        namespace,
        count: values.length
      });
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'DynamoDB:saveList',
        'Failed to save list',
        {
          key,
          namespace,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  /**
   * Delete a list
   */
  async deleteList(key: string, options?: StorageOptions): Promise<boolean> {
    const namespace =
      options?.namespace || this.connection.defaultNamespace || 'default';
    const { pk, sk } = buildListKey(namespace, key);

    try {
      const { DeleteItemCommand } = await import('@aws-sdk/client-dynamodb');
      const command = new DeleteItemCommand({
        TableName: this.connection.tableName,
        Key: { pk: { S: pk }, sk: { S: sk } },
        ReturnValues: 'ALL_OLD'
      });

      const response = await this.connection.client.send(command);

      logger.debug(LogCategory.STORAGE, 'DynamoDB:deleteList', 'List deleted', {
        key,
        namespace,
        existed: !!response.Attributes
      });

      return !!response.Attributes;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'DynamoDB:deleteList',
        'Failed to delete list',
        {
          key,
          namespace,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  /**
   * Clear all lists
   */
  async clear(): Promise<void> {
    const namespace = this.connection.defaultNamespace || 'default';

    try {
      const { QueryCommand, BatchWriteItemCommand } = await import(
        '@aws-sdk/client-dynamodb'
      );

      // Query all lists
      const pk = `ns#${namespace}`;
      const lists: Array<{ pk: string; sk: string }> = [];
      let lastEvaluatedKey: any;

      do {
        const command = new QueryCommand({
          TableName: this.connection.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
          ExpressionAttributeValues: {
            ':pk': { S: pk },
            ':prefix': { S: 'list#' }
          },
          ProjectionExpression: 'pk, sk',
          ExclusiveStartKey: lastEvaluatedKey
        });

        const response = await this.connection.client.send(command);

        if (response.Items) {
          for (const item of response.Items) {
            if (item.pk?.S && item.sk?.S) {
              lists.push({ pk: item.pk.S, sk: item.sk.S });
            }
          }
        }

        lastEvaluatedKey = response.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      if (lists.length === 0) return;

      // Delete in batches
      const batchSize = 25; // DynamoDB limit

      for (let i = 0; i < lists.length; i += batchSize) {
        const batch = lists.slice(i, i + batchSize);
        const deleteRequests = batch.map((item) => ({
          DeleteRequest: {
            Key: {
              pk: { S: item.pk },
              sk: { S: item.sk }
            }
          }
        }));

        const command = new BatchWriteItemCommand({
          RequestItems: {
            [this.connection.tableName]: deleteRequests
          }
        });

        await this.connection.client.send(command);
      }

      logger.info(
        LogCategory.STORAGE,
        'DynamoDB:clearLists',
        'All lists cleared',
        {
          namespace,
          count: lists.length
        }
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'DynamoDB:clearLists',
        'Failed to clear lists',
        {
          namespace,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }
}
