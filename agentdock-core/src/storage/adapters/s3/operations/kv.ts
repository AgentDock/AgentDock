/**
 * Key-value operations for S3
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand
} from '@aws-sdk/client-s3';

import {
  chunkArray,
  ErrorMapper,
  jsonDeserializer,
  jsonSerializer,
  KeyManager,
  streamToString,
  TTLManager,
  validateKey
} from '../../../utils';
import { S3Connection, S3Metadata } from '../types';
import {
  createS3Key,
  createS3Prefix,
  extractKeyFromS3Key,
  matchesPattern
} from '../utils';

export class S3KVOperations {
  constructor(
    private connection: S3Connection,
    private keyManager: KeyManager,
    private ttlManager: TTLManager,
    private namespace?: string
  ) {}

  /**
   * Get a value by key
   */
  async get(key: string): Promise<any> {
    try {
      validateKey(key);
      const fullKey = createS3Key(
        key,
        this.namespace,
        this.connection.prefix,
        this.keyManager
      );

      const command = new GetObjectCommand({
        Bucket: this.connection.bucket,
        Key: fullKey
      });

      const response = await this.connection.client.send(command);

      // Check TTL from metadata
      if (response.Metadata?.['x-amz-meta-ttl']) {
        const ttl = parseInt(response.Metadata['x-amz-meta-ttl'], 10);
        const createdAt = response.Metadata['x-amz-meta-created-at'];

        if (createdAt && Date.now() > parseInt(createdAt, 10) + ttl) {
          await this.delete(key);
          return null;
        }
      }

      // Convert body to string
      const bodyString = await streamToString(response.Body);
      return jsonDeserializer(bodyString);
    } catch (error) {
      const err = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Set a value with optional TTL
   */
  async set(key: string, value: any, ttlMs?: number): Promise<void> {
    try {
      validateKey(key);
      const fullKey = createS3Key(
        key,
        this.namespace,
        this.connection.prefix,
        this.keyManager
      );
      const serializedValue = jsonSerializer(value);

      const metadata: S3Metadata = {
        'x-amz-meta-namespace': this.namespace,
        'x-amz-meta-created-at': Date.now().toString(),
        'x-amz-meta-content-type': 'application/json'
      };

      // Add TTL to metadata
      if (ttlMs) {
        metadata['x-amz-meta-ttl'] = ttlMs.toString();
        this.ttlManager.setTTL(fullKey, ttlMs);
      }

      const command = new PutObjectCommand({
        Bucket: this.connection.bucket,
        Key: fullKey,
        Body: serializedValue,
        ContentType: 'application/json',
        Metadata: metadata
      });

      await this.connection.client.send(command);
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<void> {
    try {
      validateKey(key);
      const fullKey = createS3Key(
        key,
        this.namespace,
        this.connection.prefix,
        this.keyManager
      );

      const command = new DeleteObjectCommand({
        Bucket: this.connection.bucket,
        Key: fullKey
      });

      await this.connection.client.send(command);
      this.ttlManager.removeTTL(fullKey);
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      validateKey(key);
      const fullKey = createS3Key(
        key,
        this.namespace,
        this.connection.prefix,
        this.keyManager
      );

      const command = new HeadObjectCommand({
        Bucket: this.connection.bucket,
        Key: fullKey
      });

      const response = await this.connection.client.send(command);

      // Check TTL
      if (response.Metadata?.['x-amz-meta-ttl']) {
        const ttl = parseInt(response.Metadata['x-amz-meta-ttl'], 10);
        const createdAt = response.Metadata['x-amz-meta-created-at'];

        if (createdAt && Date.now() > parseInt(createdAt, 10) + ttl) {
          return false;
        }
      }

      return true;
    } catch (error) {
      const err = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern: string = '*'): Promise<string[]> {
    try {
      const prefix = createS3Prefix(
        pattern,
        this.namespace,
        this.connection.prefix
      );
      const keys: string[] = [];
      let continuationToken: string | undefined;

      do {
        const command = new ListObjectsV2Command({
          Bucket: this.connection.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          MaxKeys: 1000
        });

        const response = await this.connection.client.send(command);

        if (response.Contents) {
          for (const object of response.Contents) {
            if (object.Key) {
              const key = extractKeyFromS3Key(
                object.Key,
                this.connection.prefix,
                this.keyManager
              );
              if (key && matchesPattern(key, pattern)) {
                keys.push(key);
              }
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return keys;
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Clear all keys in namespace
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.keys('*');

      if (keys.length === 0) return;

      // S3 batch delete (up to 1000 at a time)
      const chunks = chunkArray(keys, 1000);

      for (const chunk of chunks) {
        const objects = chunk.map((key) => ({
          Key: createS3Key(
            key,
            this.namespace,
            this.connection.prefix,
            this.keyManager
          )
        }));

        const { DeleteObjectsCommand } = await import('@aws-sdk/client-s3');
        const command = new DeleteObjectsCommand({
          Bucket: this.connection.bucket,
          Delete: { Objects: objects }
        });

        await this.connection.client.send(command);
      }

      // Clear TTL entries
      if (!this.namespace) {
        this.ttlManager.clear();
      }
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Get the size of the collection
   */
  async size(): Promise<number> {
    try {
      const keys = await this.keys('*');
      return keys.length;
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number | null> {
    try {
      validateKey(key);
      const fullKey = createS3Key(
        key,
        this.namespace,
        this.connection.prefix,
        this.keyManager
      );

      const command = new HeadObjectCommand({
        Bucket: this.connection.bucket,
        Key: fullKey
      });

      const response = await this.connection.client.send(command);

      if (!response.Metadata?.['x-amz-meta-ttl']) {
        return null;
      }

      const ttl = parseInt(response.Metadata['x-amz-meta-ttl'], 10);
      const createdAt = parseInt(
        response.Metadata['x-amz-meta-created-at'] || '0',
        10
      );

      const remaining = createdAt + ttl - Date.now();
      return remaining > 0 ? remaining : 0;
    } catch (error) {
      const err = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw ErrorMapper.mapError(error, 'generic');
    }
  }
}
