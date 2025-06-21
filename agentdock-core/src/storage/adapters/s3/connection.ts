/**
 * S3 connection management
 */

import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';

import { BaseConnectionManager } from '../../utils';
import { S3Config, S3Connection } from './types';

export class S3ConnectionManager extends BaseConnectionManager<
  S3Config,
  S3Connection
> {
  /**
   * Create a new S3 client connection
   */
  protected async createConnection(): Promise<S3Connection> {
    const clientConfig: S3ClientConfig = {
      region: this.config.region || 'us-east-1',
      ...this.config.clientConfig
    };

    // Add credentials if provided
    if (this.config.credentials) {
      clientConfig.credentials = this.config.credentials;
    }

    // Add endpoint for S3-compatible services (MinIO, etc.)
    if (this.config.endpoint) {
      clientConfig.endpoint = this.config.endpoint;
      clientConfig.forcePathStyle = this.config.forcePathStyle ?? true;
    }

    const client = new S3Client(clientConfig);

    // Test connection by checking if bucket exists
    await this.verifyBucket(client);

    return {
      client,
      bucket: this.config.bucket,
      prefix: this.config.prefix
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
   * Verify bucket exists and is accessible
   */
  private async verifyBucket(client: S3Client): Promise<void> {
    try {
      const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
      await client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
    } catch (error) {
      const err = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        throw new Error(`Bucket '${this.config.bucket}' does not exist`);
      } else if (
        err.name === 'Forbidden' ||
        err.$metadata?.httpStatusCode === 403
      ) {
        throw new Error(`Access denied to bucket '${this.config.bucket}'`);
      }
      throw error;
    }
  }

  /**
   * Get the bucket name
   */
  getBucket(): string {
    return this.config.bucket;
  }

  /**
   * Get the key prefix
   */
  getPrefix(): string | undefined {
    return this.config.prefix;
  }
}
