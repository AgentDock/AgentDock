/**
 * Batch operations for MongoDB
 */

import {
  ErrorMapper,
  jsonDeserializer,
  jsonSerializer,
  KeyManager,
  TTLManager,
  validateBatch,
  validateKey
} from '../../../utils';
import { MongoBulkOperation, MongoConnection, MongoDocument } from '../types';

export class MongoBatchOperations {
  constructor(
    private connection: MongoConnection,
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

      const fullKeys = keys.map((key) =>
        this.keyManager.createKey(key, this.namespace)
      );

      const docs = await this.connection.kvCollection
        .find({
          _id: { $in: fullKeys },
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } }
          ]
        })
        .toArray();

      // Create a map for quick lookup
      const docMap = new Map(docs.map((doc: MongoDocument) => [doc._id, doc]));

      // Return values in the same order as keys
      return fullKeys.map((fullKey) => {
        const doc = docMap.get(fullKey);
        if (!doc) return null;

        return jsonDeserializer((doc as MongoDocument).value);
      });
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

      const bulkOps = pairs.map(({ key, value, ttl }) => {
        const fullKey = this.keyManager.createKey(key, this.namespace);
        const now = new Date();

        const doc: MongoDocument = {
          _id: fullKey,
          value: jsonSerializer(value),
          namespace: this.namespace,
          createdAt: now,
          updatedAt: now
        };

        if (ttl !== undefined) {
          doc.expiresAt = new Date(Date.now() + ttl);
          this.ttlManager.setTTL(fullKey, ttl);
        }

        return {
          replaceOne: {
            filter: { _id: fullKey },
            replacement: doc,
            upsert: true
          }
        };
      });

      if (bulkOps.length > 0) {
        await this.connection.kvCollection.bulkWrite(bulkOps);
      }
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

      const fullKeys = keys.map((key) =>
        this.keyManager.createKey(key, this.namespace)
      );

      const result = await this.connection.kvCollection.deleteMany({
        _id: { $in: fullKeys }
      });

      // Remove TTL entries
      fullKeys.forEach((key) => this.ttlManager.removeTTL(key));

      return result.deletedCount;
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Execute a batch of mixed operations
   */
  async batch(operations: MongoBulkOperation[]): Promise<void> {
    try {
      const bulkOps = operations.map((op) => {
        switch (op.type) {
          case 'insert':
          case 'update': {
            if (!op.key || op.value === undefined) {
              throw new Error('Insert/update operations require key and value');
            }

            validateKey(op.key);
            const fullKey = this.keyManager.createKey(op.key, this.namespace);
            const now = new Date();

            const doc: MongoDocument = {
              _id: fullKey,
              value: jsonSerializer(op.value),
              namespace: this.namespace,
              createdAt: now,
              updatedAt: now
            };

            return {
              replaceOne: {
                filter: { _id: fullKey },
                replacement: doc,
                upsert: true
              }
            };
          }

          case 'delete': {
            if (!op.key) {
              throw new Error('Delete operation requires key');
            }

            validateKey(op.key);
            const fullKey = this.keyManager.createKey(op.key, this.namespace);
            this.ttlManager.removeTTL(fullKey);

            return {
              deleteOne: {
                filter: { _id: fullKey }
              }
            };
          }

          default:
            throw new Error(`Unsupported operation type: ${op.type}`);
        }
      });

      if (bulkOps.length > 0) {
        await this.connection.kvCollection.bulkWrite(bulkOps);
      }
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

      const fullKeys = keys.map((key) =>
        this.keyManager.createKey(key, this.namespace)
      );

      const docs = await this.connection.kvCollection
        .find(
          {
            _id: { $in: fullKeys },
            $or: [
              { expiresAt: { $exists: false } },
              { expiresAt: { $gt: new Date() } }
            ]
          },
          { projection: { _id: 1 } }
        )
        .toArray();

      const existingKeys = new Set(docs.map((doc: { _id: string }) => doc._id));

      return fullKeys.map((key) => existingKeys.has(key));
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }
}
