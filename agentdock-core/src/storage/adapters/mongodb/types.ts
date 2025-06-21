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
  kvCollection: Collection<MongoDocument>;
  listCollection: Collection<MongoListDocument>;
}

export interface MongoDocument {
  _id: string;
  value: any;
  namespace?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MongoListDocument {
  _id: string;
  name: string;
  items: any[];
  namespace?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MongoQueryOptions {
  projection?: Record<string, 0 | 1>;
  sort?: Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
}

export interface MongoBulkOperation {
  type: 'insert' | 'update' | 'delete';
  key?: string;
  value?: any;
  filter?: Record<string, any>;
  update?: Record<string, any>;
  options?: Record<string, any>;
}
