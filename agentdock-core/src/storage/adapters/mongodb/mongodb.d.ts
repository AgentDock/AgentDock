/**
 * Type declarations for MongoDB
 * This file provides minimal type definitions for MongoDB to resolve linter errors
 * when the mongodb package is marked as external
 */

declare module 'mongodb' {
  export interface MongoClientOptions {
    maxPoolSize?: number;
    minPoolSize?: number;
    maxIdleTimeMS?: number;
    serverSelectionTimeoutMS?: number;
    [key: string]: any;
  }

  export interface Db {
    collection<T = any>(name: string): Collection<T>;
  }

  export interface Collection<T = any> {
    findOne(filter: any, options?: any): Promise<T | null>;
    find(filter: any, options?: any): any;
    insertOne(doc: T): Promise<any>;
    insertMany(docs: T[]): Promise<any>;
    updateOne(filter: any, update: any, options?: any): Promise<any>;
    updateMany(filter: any, update: any, options?: any): Promise<any>;
    replaceOne(filter: any, replacement: any, options?: any): Promise<any>;
    deleteOne(filter: any): Promise<any>;
    deleteMany(filter: any): Promise<any>;
    findOneAndUpdate(filter: any, update: any, options?: any): Promise<any>;
    countDocuments(filter?: any): Promise<number>;
    createIndex(indexSpec: any, options?: any): Promise<any>;
    bulkWrite(operations: any[]): Promise<any>;
    stats(): Promise<any>;
  }

  export class MongoClient {
    constructor(uri: string, options?: MongoClientOptions);
    connect(): Promise<MongoClient>;
    close(): Promise<void>;
    db(name: string): Db;
    topology?: {
      isConnected(): boolean;
    };
  }
} 