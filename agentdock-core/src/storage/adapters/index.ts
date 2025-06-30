/**
 * @fileoverview Storage adapters - Essential only
 * 
 * This file exports ONLY the essential storage adapters that should be bundled:
 * - SQLite/SQLite-vec for development (zero external dependencies)
 * - PostgreSQL/PostgreSQL-Vector for production (single database solution)
 * 
 * Optional adapters (MongoDB, S3, DynamoDB, CloudflareKV, CloudflareD1, 
 * Pinecone, Qdrant, ChromaDB) are NOT exported here to prevent bundling.
 * They must be imported directly from their specific paths when needed.
 */

// Essential adapters only - these are officially supported and should be bundled
export { SQLiteAdapter } from './sqlite';
export { SQLiteVecAdapter } from './sqlite-vec';
export { PostgreSQLAdapter } from './postgresql';
export { PostgreSQLVectorAdapter } from './postgresql-vector';

// NOTE: Optional adapters are NOT exported here. To use them, import directly:
// import { MongoDBAdapter } from 'agentdock-core/storage/adapters/mongodb';
// import { S3Adapter } from 'agentdock-core/storage/adapters/s3';
// import { DynamoDBAdapter } from 'agentdock-core/storage/adapters/dynamodb';
// import { CloudflareKVAdapter } from 'agentdock-core/storage/adapters/cloudflare-kv';
// import { CloudflareD1Adapter } from 'agentdock-core/storage/adapters/cloudflare-d1';
// import { PineconeAdapter } from 'agentdock-core/storage/adapters/pinecone';
// import { QdrantAdapter } from 'agentdock-core/storage/adapters/qdrant';
// import { ChromaDBAdapter } from 'agentdock-core/storage/adapters/chromadb';
