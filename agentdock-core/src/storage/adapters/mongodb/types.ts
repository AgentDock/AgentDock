/**
 * MongoDB-specific types and interfaces
 */

import { Collection, Db, MongoClient, MongoClientOptions } from 'mongodb';

export interface MongoDBConfig {
  uri: string;
  database: string;
  collection?: string;
  options?: MongoClientOptions;
  indexes?: MongoIndexSpec[];
}

export interface MongoIndexSpec {
  key: Record<string, 1 | -1>;
  options?: {
    unique?: boolean;
    sparse?: boolean;
    expireAfterSeconds?: number;
    background?: boolean;
    name?: string;
  };
}

export interface MongoConnection {
  client: MongoClient;
  db: Db;
  kvCollection: Collection<MongoDocument<unknown>>;
  listCollection: Collection<MongoListDocument<unknown>>;
}

export interface MongoDocument<T = unknown> {
  _id: string;
  value: T;
  namespace?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MongoListDocument<T = unknown> {
  _id: string;
  name: string;
  items: T[];
  namespace?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MongoQueryOptions {
  projection?: Record<string, 0 | 1>;
  sort?: Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
}

export interface MongoBulkOperation<T = unknown> {
  type: 'insert' | 'update' | 'delete';
  key?: string;
  value?: T;
  filter?: Record<string, unknown>;
  update?: Record<string, unknown>;
  options?: Record<string, unknown>;
}
