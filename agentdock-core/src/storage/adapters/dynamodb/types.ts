/**
 * DynamoDB adapter types
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import type { AwsCredentialIdentity } from '@aws-sdk/types';

/**
 * DynamoDB adapter configuration
 */
export interface DynamoDBConfig {
  /** AWS region */
  region?: string;

  /** DynamoDB table name */
  tableName: string;

  /** Optional credentials (uses default AWS credential chain if not provided) */
  credentials?: AwsCredentialIdentity;

  /** Optional endpoint for local DynamoDB */
  endpoint?: string;

  /** Default namespace for keys */
  namespace?: string;

  /** Partition key name (default: 'pk') */
  partitionKey?: string;

  /** Sort key name (default: 'sk') */
  sortKey?: string;

  /** TTL attribute name (default: 'expiresAt') */
  ttlAttribute?: string;

  /** Whether to create table if it doesn't exist (default: false) */
  createTableIfNotExists?: boolean;

  /** Billing mode for table creation */
  billingMode?: 'PAY_PER_REQUEST' | 'PROVISIONED';

  /** Read capacity units (for provisioned mode) */
  readCapacityUnits?: number;

  /** Write capacity units (for provisioned mode) */
  writeCapacityUnits?: number;

  /** Additional client configuration */
  clientConfig?: Record<string, any>;
}

/**
 * DynamoDB connection
 */
export interface DynamoDBConnection {
  client: DynamoDBClient;
  tableName: string;
  partitionKey: string;
  sortKey: string;
  ttlAttribute: string;
  defaultNamespace?: string;
}

/**
 * DynamoDB item structure
 */
export interface DynamoDBItem {
  pk: string;
  sk: string;
  value: any;
  metadata?: Record<string, any>;
  expiresAt?: number;
  namespace?: string;
  type?: 'kv' | 'list';
  listData?: any[];
}
