/**
 * List operations for MongoDB
 */

import { Collection } from 'mongodb';

import {
  ErrorMapper,
  jsonDeserializer,
  jsonSerializer,
  KeyManager,
  validateKey
} from '../../../utils';
import { MongoListDocument } from '../types';

// Type for MongoDB projection results
interface ItemCountProjection {
  itemCount: number;
}

export class MongoListOperations {
  constructor(
    private collection: Collection<MongoListDocument>,
    private keyManager: KeyManager,
    private namespace?: string
  ) {}

  /**
   * Push items to the end of a list
   */
  async lpush(key: string, ...items: any[]): Promise<number> {
    try {
      validateKey(key);
      const fullKey = this.keyManager.createKey(key, this.namespace);
      const serializedItems = items.map((item) => jsonSerializer(item));

      const result = await this.collection.findOneAndUpdate(
        { _id: fullKey },
        {
          $push: { items: { $each: serializedItems, $position: 0 } },
          $set: {
            name: key,
            namespace: this.namespace,
            updatedAt: new Date()
          },
          $setOnInsert: { createdAt: new Date() }
        },
        {
          upsert: true,
          returnDocument: 'after',
          projection: { items: 1 }
        }
      );

      return result?.items?.length || items.length;
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Push items to the start of a list
   */
  async rpush(key: string, ...items: any[]): Promise<number> {
    try {
      validateKey(key);
      const fullKey = this.keyManager.createKey(key, this.namespace);
      const serializedItems = items.map((item) => jsonSerializer(item));

      const result = await this.collection.findOneAndUpdate(
        { _id: fullKey },
        {
          $push: { items: { $each: serializedItems } },
          $set: {
            name: key,
            namespace: this.namespace,
            updatedAt: new Date()
          },
          $setOnInsert: { createdAt: new Date() }
        },
        {
          upsert: true,
          returnDocument: 'after',
          projection: { items: 1 }
        }
      );

      return result?.items?.length || items.length;
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Remove and return the first element
   */
  async lpop(key: string): Promise<any> {
    try {
      validateKey(key);
      const fullKey = this.keyManager.createKey(key, this.namespace);

      const result = await this.collection.findOneAndUpdate(
        { _id: fullKey, items: { $exists: true, $ne: [] } },
        {
          $pop: { items: -1 },
          $set: { updatedAt: new Date() }
        },
        { projection: { items: { $slice: 1 } } }
      );

      if (!result?.items?.[0]) {
        return null;
      }

      return jsonDeserializer(result.items[0]);
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Remove and return the last element
   */
  async rpop(key: string): Promise<any> {
    try {
      validateKey(key);
      const fullKey = this.keyManager.createKey(key, this.namespace);

      const result = await this.collection.findOneAndUpdate(
        { _id: fullKey, items: { $exists: true, $ne: [] } },
        {
          $pop: { items: 1 },
          $set: { updatedAt: new Date() }
        },
        { projection: { items: { $slice: -1 } } }
      );

      if (!result?.items?.[0]) {
        return null;
      }

      return jsonDeserializer(result.items[0]);
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Get the length of a list
   */
  async llen(key: string): Promise<number> {
    try {
      validateKey(key);
      const fullKey = this.keyManager.createKey(key, this.namespace);

      const result = (await this.collection.findOne(
        { _id: fullKey },
        { projection: { itemCount: { $size: '$items' } } }
      )) as ItemCountProjection | null;

      return result?.itemCount || 0;
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Get a range of elements from a list
   */
  async lrange(key: string, start: number, stop: number): Promise<any[]> {
    try {
      validateKey(key);
      const fullKey = this.keyManager.createKey(key, this.namespace);

      // MongoDB slice is inclusive, Redis lrange stop is inclusive
      const sliceArgs = stop === -1 ? [start] : [start, stop - start + 1];

      const result = await this.collection.findOne(
        { _id: fullKey },
        { projection: { items: { $slice: sliceArgs } } }
      );

      if (!result?.items) {
        return [];
      }

      return result.items.map((item: any) => jsonDeserializer(item));
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Set the value of an element by index
   */
  async lset(key: string, index: number, value: any): Promise<void> {
    try {
      validateKey(key);
      const fullKey = this.keyManager.createKey(key, this.namespace);
      const serializedValue = jsonSerializer(value);

      // Convert negative index to positive
      if (index < 0) {
        const doc = (await this.collection.findOne(
          { _id: fullKey },
          { projection: { itemCount: { $size: '$items' } } }
        )) as ItemCountProjection | null;

        if (!doc) {
          throw new Error('List does not exist');
        }

        index = doc.itemCount + index;
      }

      const result = await this.collection.updateOne(
        { _id: fullKey },
        {
          $set: {
            [`items.${index}`]: serializedValue,
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('List does not exist or index out of range');
      }
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Get an element by index
   */
  async lindex(key: string, index: number): Promise<any> {
    try {
      validateKey(key);
      const fullKey = this.keyManager.createKey(key, this.namespace);

      const sliceArgs = index < 0 ? [index, 1] : [index, 1];

      const result = await this.collection.findOne(
        { _id: fullKey },
        { projection: { items: { $slice: sliceArgs } } }
      );

      if (!result?.items?.[0]) {
        return null;
      }

      return jsonDeserializer(result.items[0] as string);
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Remove elements from a list
   */
  async lrem(key: string, count: number, value: any): Promise<number> {
    try {
      validateKey(key);
      const fullKey = this.keyManager.createKey(key, this.namespace);
      const serializedValue = jsonSerializer(value);

      // MongoDB doesn't have a direct equivalent to Redis LREM
      // We need to fetch, modify, and update
      const doc = await this.collection.findOne({ _id: fullKey });

      if (!doc?.items) {
        return 0;
      }

      const items = doc.items;
      let removed = 0;

      if (count > 0) {
        // Remove first count occurrences
        for (let i = 0; i < items.length && removed < count; i++) {
          if (JSON.stringify(items[i]) === JSON.stringify(serializedValue)) {
            items.splice(i, 1);
            i--;
            removed++;
          }
        }
      } else if (count < 0) {
        // Remove last count occurrences
        for (
          let i = items.length - 1;
          i >= 0 && removed < Math.abs(count);
          i--
        ) {
          if (JSON.stringify(items[i]) === JSON.stringify(serializedValue)) {
            items.splice(i, 1);
            removed++;
          }
        }
      } else {
        // Remove all occurrences
        const originalLength = items.length;
        doc.items = items.filter(
          (item: any) =>
            JSON.stringify(item) !== JSON.stringify(serializedValue)
        );
        removed = originalLength - doc.items.length;
      }

      if (removed > 0) {
        await this.collection.replaceOne(
          { _id: fullKey },
          { ...doc, updatedAt: new Date() }
        );
      }

      return removed;
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Trim a list to specified range
   */
  async ltrim(key: string, start: number, stop: number): Promise<void> {
    try {
      validateKey(key);
      const fullKey = this.keyManager.createKey(key, this.namespace);

      const doc = await this.collection.findOne({ _id: fullKey });

      if (!doc?.items) {
        return;
      }

      // Handle negative indices
      const length = doc.items.length;
      if (start < 0) start = length + start;
      if (stop < 0) stop = length + stop;

      // Trim the array
      doc.items = doc.items.slice(start, stop + 1);

      await this.collection.replaceOne(
        { _id: fullKey },
        { ...doc, updatedAt: new Date() }
      );
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }
}
