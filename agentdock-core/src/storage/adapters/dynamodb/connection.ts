/**
 * DynamoDB connection management
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import { BaseConnectionManager } from '../../utils';
import { DynamoDBConfig, DynamoDBConnection } from './types';

export class DynamoDBConnectionManager extends BaseConnectionManager<
  DynamoDBConfig,
  DynamoDBConnection
> {
  /**
   * Create a new DynamoDB client connection
   */
  protected async createConnection(): Promise<DynamoDBConnection> {
    // Validate required configuration
    if (!this.config.tableName) {
      throw new Error('DynamoDB tableName is required');
    }

    const clientConfig: any = {
      region: this.config.region || 'us-east-1',
      maxAttempts: 3,
      retryMode: 'adaptive',
      ...this.config.clientConfig
    };

    // Add credentials if provided
    if (this.config.credentials) {
      clientConfig.credentials = this.config.credentials;
    }

    // Add endpoint for local DynamoDB
    if (this.config.endpoint) {
      clientConfig.endpoint = this.config.endpoint;
    }

    const client = new DynamoDBClient(clientConfig);

    // Create table if requested
    if (this.config.createTableIfNotExists) {
      await this.ensureTable(client);
    }

    // Verify table exists
    await this.verifyTable(client);

    return {
      client,
      tableName: this.config.tableName,
      partitionKey: this.config.partitionKey || 'pk',
      sortKey: this.config.sortKey || 'sk',
      ttlAttribute: this.config.ttlAttribute || 'expiresAt',
      defaultNamespace: this.config.namespace
    };
  }

  /**
   * Close the actual connection
   */
  protected async closeConnection(): Promise<void> {
    if (this.connection) {
      this.connection.client.destroy();
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return !!this.connection;
  }

  /**
   * Ensure table exists
   */
  private async ensureTable(client: DynamoDBClient): Promise<void> {
    const { CreateTableCommand } = await import('@aws-sdk/client-dynamodb');

    try {
      await client.send(
        new CreateTableCommand({
          TableName: this.config.tableName,
          KeySchema: [
            {
              AttributeName: this.config.partitionKey || 'pk',
              KeyType: 'HASH'
            },
            { AttributeName: this.config.sortKey || 'sk', KeyType: 'RANGE' }
          ],
          AttributeDefinitions: [
            {
              AttributeName: this.config.partitionKey || 'pk',
              AttributeType: 'S'
            },
            { AttributeName: this.config.sortKey || 'sk', AttributeType: 'S' }
          ],
          BillingMode: this.config.billingMode || 'PAY_PER_REQUEST',
          ...(this.config.billingMode === 'PROVISIONED' && {
            ProvisionedThroughput: {
              ReadCapacityUnits: this.config.readCapacityUnits || 5,
              WriteCapacityUnits: this.config.writeCapacityUnits || 5
            }
          }),
          ...(this.config.ttlAttribute && {
            TimeToLiveSpecification: {
              AttributeName: this.config.ttlAttribute,
              Enabled: true
            }
          })
        })
      );

      // Wait for table to be active
      await this.waitForTable(client);
    } catch (error: any) {
      if (error.name !== 'ResourceInUseException') {
        throw error;
      }
    }
  }

  /**
   * Verify table exists and is accessible
   */
  private async verifyTable(client: DynamoDBClient): Promise<void> {
    const { DescribeTableCommand } = await import('@aws-sdk/client-dynamodb');

    try {
      const response = await client.send(
        new DescribeTableCommand({
          TableName: this.config.tableName
        })
      );

      if (response.Table?.TableStatus !== 'ACTIVE') {
        throw new Error(`Table '${this.config.tableName}' is not active`);
      }
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        throw new Error(`Table '${this.config.tableName}' does not exist`);
      }
      throw error;
    }
  }

  /**
   * Wait for table to become active
   */
  private async waitForTable(client: DynamoDBClient): Promise<void> {
    const { DescribeTableCommand } = await import('@aws-sdk/client-dynamodb');

    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      const response = await client.send(
        new DescribeTableCommand({
          TableName: this.config.tableName
        })
      );

      if (response.Table?.TableStatus === 'ACTIVE') {
        return;
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(
      `Table '${this.config.tableName}' did not become active within timeout`
    );
  }
}
