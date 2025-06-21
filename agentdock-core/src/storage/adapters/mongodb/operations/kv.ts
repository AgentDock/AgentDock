/**
 * Key-value operations for MongoDB
 */

import { Collection } from 'mongodb';

import {
  ErrorMapper,
  jsonDeserializer,
  jsonSerializer,
  KeyManager,
  TTLManager,
  validateKey
} from '../../../utils';
import { MongoDocument } from '../types';

export class MongoKVOperations {
  constructor(
    private collection: Collection<MongoDocument>,
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
      const fullKey = this.keyManager.createKey(key, this.namespace);

      const doc = await this.collection.findOne({ _id: fullKey });

      if (!doc) {
        return null;
      }

      // Check TTL
      if (doc.expiresAt && new Date() >= doc.expiresAt) {
        await this.delete(key);
        return null;
      }

      return jsonDeserializer(doc.value);
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Set a value with optional TTL
   */
  async set(key: string, value: any, ttlMs?: number): Promise<void> {
    try {
      validateKey(key);
      const fullKey = this.keyManager.createKey(key, this.namespace);
      const serializedValue = jsonSerializer(value);

      const now = new Date();
      const doc: MongoDocument = {
        _id: fullKey,
        value: serializedValue,
        namespace: this.namespace,
        createdAt: now,
        updatedAt: now
      };

      // Handle TTL
      if (ttlMs) {
        const expiresAt = new Date(Date.now() + ttlMs);
        doc.expiresAt = expiresAt;
        this.ttlManager.setTTL(fullKey, ttlMs);
      }

      await this.collection.replaceOne({ _id: fullKey }, doc, { upsert: true });
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
      const fullKey = this.keyManager.createKey(key, this.namespace);

      await this.collection.deleteOne({ _id: fullKey });
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
      const fullKey = this.keyManager.createKey(key, this.namespace);

      const count = await this.collection.countDocuments({
        _id: fullKey,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      });

      return count > 0;
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern: string = '*'): Promise<string[]> {
    try {
      const mongoPattern = this.keyManager.createPattern(
        pattern,
        this.namespace
      );

      // Convert wildcard pattern to regex
      const regex = new RegExp(
        '^' +
          mongoPattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.') +
          '$'
      );

      const docs = await this.collection
        .find(
          {
            _id: { $regex: regex },
            $or: [
              { expiresAt: { $exists: false } },
              { expiresAt: { $gt: new Date() } }
            ]
          },
          { projection: { _id: 1 } }
        )
        .toArray();

      return docs.map((doc: { _id: string }) => {
        const { baseKey } = this.keyManager.extractNamespace(doc._id);
        return baseKey;
      });
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Clear all keys in namespace
   */
  async clear(): Promise<void> {
    try {
      const filter = this.namespace
        ? { _id: { $regex: new RegExp(`^${this.namespace}:`) } }
        : {};

      await this.collection.deleteMany(filter);

      // Clear TTL manager if no namespace
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
      const filter = this.namespace
        ? { _id: { $regex: new RegExp(`^${this.namespace}:`) } }
        : {};

      return await this.collection.countDocuments({
        ...filter,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      });
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
      const fullKey = this.keyManager.createKey(key, this.namespace);

      const doc = await this.collection.findOne(
        { _id: fullKey },
        { projection: { expiresAt: 1 } }
      );

      if (!doc || !doc.expiresAt) {
        return null;
      }

      const remaining = doc.expiresAt.getTime() - Date.now();
      return remaining > 0 ? remaining : 0;
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }
}
