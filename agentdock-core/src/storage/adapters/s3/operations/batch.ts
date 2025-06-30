/**
 * Batch operations for S3
 */

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
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
  validateBatch,
  validateKey
} from '../../../utils';
import { S3Connection, S3Metadata } from '../types';
import { createS3Key } from '../utils';

export class S3BatchOperations {
  constructor(
    private connection: S3Connection,
    private keyManager: KeyManager,
    private ttlManager: TTLManager,
    private namespace?: string
  ) {}

  /**
   * Get multiple values by keys
   */
  async mget(keys: string[]): Promise<Array<any | null>> {
    try {
      // Validate all keys
      const errors = validateBatch(keys, validateKey);
      if (errors.length > 0) {
        throw new Error(
          `Invalid keys: ${errors.map((e: { error: Error }) => e.error.message).join(', ')}`
        );
      }

      // S3 doesn't support batch get, so we need to do parallel requests
      const promises = keys.map(async (key) => {
        try {
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
              return null;
            }
          }

          const bodyString = await streamToString(response.Body);
          return jsonDeserializer(bodyString);
        } catch (error) {
          const err = error as {
            name?: string;
            $metadata?: { httpStatusCode?: number };
          };
          if (
            err.name === 'NoSuchKey' ||
            err.$metadata?.httpStatusCode === 404
          ) {
            return null;
          }
          throw error;
        }
      });

      return await Promise.all(promises);
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(
    pairs: Array<{ key: string; value: any; ttl?: number }>
  ): Promise<void> {
    try {
      // Validate all keys
      const errors = validateBatch(pairs, (item: { key: string }) =>
        validateKey(item.key)
      );
      if (errors.length > 0) {
        throw new Error(
          `Invalid keys: ${errors.map((e: { error: Error }) => e.error.message).join(', ')}`
        );
      }

      // S3 doesn't support batch put, so we need to do parallel requests
      const promises = pairs.map(async ({ key, value, ttl }) => {
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

        if (ttl !== undefined) {
          metadata['x-amz-meta-ttl'] = ttl.toString();
          this.ttlManager.setTTL(fullKey, ttl);
        }

        const command = new PutObjectCommand({
          Bucket: this.connection.bucket,
          Key: fullKey,
          Body: serializedValue,
          ContentType: 'application/json',
          ServerSideEncryption: 'AES256', // Add default encryption
          Metadata: metadata
        });

        await this.connection.client.send(command);
      });

      await Promise.all(promises);
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Delete multiple keys
   */
  async mdel(keys: string[]): Promise<number> {
    try {
      // Validate all keys
      const errors = validateBatch(keys, validateKey);
      if (errors.length > 0) {
        throw new Error(
          `Invalid keys: ${errors.map((e: { error: Error }) => e.error.message).join(', ')}`
        );
      }

      if (keys.length === 0) return 0;

      // S3 supports batch delete up to 1000 objects
      const chunks = chunkArray(keys, 1000);
      let totalDeleted = 0;

      for (const chunk of chunks) {
        const objects = chunk.map((key) => ({
          Key: createS3Key(
            key,
            this.namespace,
            this.connection.prefix,
            this.keyManager
          )
        }));

        const command = new DeleteObjectsCommand({
          Bucket: this.connection.bucket,
          Delete: {
            Objects: objects,
            Quiet: true
          }
        });

        const response = await this.connection.client.send(command);
        totalDeleted += response.Deleted?.length || 0;

        // Remove TTL entries
        chunk.forEach((key) => {
          const fullKey = createS3Key(
            key,
            this.namespace,
            this.connection.prefix,
            this.keyManager
          );
          this.ttlManager.removeTTL(fullKey);
        });
      }

      return totalDeleted;
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Check existence of multiple keys
   */
  async mexists(keys: string[]): Promise<boolean[]> {
    try {
      // Validate all keys
      const errors = validateBatch(keys, validateKey);
      if (errors.length > 0) {
        throw new Error(
          `Invalid keys: ${errors.map((e: { error: Error }) => e.error.message).join(', ')}`
        );
      }

      // S3 doesn't support batch head, so we need to do parallel requests
      const promises = keys.map(async (key) => {
        try {
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
          if (
            err.name === 'NotFound' ||
            err.$metadata?.httpStatusCode === 404
          ) {
            return false;
          }
          throw error;
        }
      });

      return await Promise.all(promises);
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }
}
