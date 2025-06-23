# Storage Setup Guide

## Overview

AgentDock uses a storage abstraction layer that supports multiple providers. This guide covers setting up storage adapters for development and production environments.

## Local Development

### Default Configuration

By default, local development uses SQLite:

```bash
pnpm dev
```

This automatically configures:
- SQLite database at `./agentdock.db`
- Memory storage provider for ephemeral data
- SQLite-vec for vector operations (if extension available)

No environment configuration required for basic development.

### Advanced Local Setup

For vector search capabilities in development:

```bash
# Enable SQLite with vector extension
ENABLE_SQLITE_VEC=true
```

## Production Configuration

### PostgreSQL (Recommended)

PostgreSQL is the recommended production storage provider.

#### Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Enable the vector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Configure environment variables:
   ```bash
   DATABASE_URL=postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres
   ENABLE_PGVECTOR=true
   KV_STORE_PROVIDER=postgresql
   ```

#### Self-Hosted PostgreSQL

Requirements:
- PostgreSQL 15+
- pgvector extension installed

Configuration:
```bash
DATABASE_URL=postgresql://user:password@host:port/database
ENABLE_PGVECTOR=true
KV_STORE_PROVIDER=postgresql
```

### Vercel KV

For Vercel deployments, Vercel KV is automatically configured when added via the Vercel dashboard. No additional configuration required.

## Optional Storage Adapters

The following adapters require explicit registration and are not part of the core auto-registration:

### MongoDB

MongoDB is optional and not officially supported for the memory system.

```bash
# Enable in environment
ENABLE_MONGODB=true
MONGODB_URI=mongodb://localhost:27017/agentdock

# Register in API route
import { getStorageFactory, registerMongoDBAdapter } from 'agentdock-core/storage';

const factory = getStorageFactory();
await registerMongoDBAdapter(factory);
```

### S3-Compatible Storage

For file storage using S3 or compatible services:

```bash
ENABLE_S3=true
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
S3_BUCKET=agentdock-storage
```

### Additional Adapters

Refer to the [Storage Documentation](./README.md) for configuration details on:
- Cloudflare KV/D1/R2
- Azure Table/Blob Storage
- Google Cloud Storage/Firestore
- DynamoDB
- ChromaDB
- Pinecone
- Qdrant

## Storage Initialization

The application automatically registers necessary adapters based on environment configuration:

1. **Core Auto-Registration** (at factory level):
   - Memory (always available)
   - Redis (if REDIS_URL configured)
   - Vercel KV (if Vercel environment detected)

2. **Application Auto-Registration** (in API routes):
   - SQLite (development or ENABLE_SQLITE=true)
   - SQLite-vec (development or ENABLE_SQLITE_VEC=true)
   - PostgreSQL (if DATABASE_URL configured)
   - PostgreSQL Vector (if ENABLE_PGVECTOR=true)

3. **Manual Registration Required**:
   - MongoDB
   - All cloud storage providers (S3, Azure, GCS, etc.)
   - All vector databases (ChromaDB, Pinecone, Qdrant)

## Environment Variables Reference

### Core Storage Configuration

```bash
# Development
ENABLE_SQLITE=true           # Enable SQLite (auto-enabled in dev)
ENABLE_SQLITE_VEC=true       # Enable SQLite vector extension

# Production - PostgreSQL
DATABASE_URL=postgresql://...
ENABLE_PGVECTOR=true
KV_STORE_PROVIDER=postgresql

# Production - Redis
REDIS_URL=redis://...
REDIS_TOKEN=...              # For Upstash Redis

# Optional Adapters
ENABLE_MONGODB=true
MONGODB_URI=mongodb://...
```

For complete environment variable reference, see `.env.example`.

## Implementation Notes

The storage abstraction layer provides interfaces for:
- Key-value storage
- Session management
- Vector operations (for future memory system implementation)

**Note**: Advanced features like persistent chat history, AI memory, and automatic backups are planned but not yet implemented. The current implementation provides the foundation for these features. 