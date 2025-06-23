# Storage Setup Guide

## Quick Start

### Local Development

```bash
# Run the application
pnpm dev

# Storage configuration:
# - SQLite adapter auto-registered
# - Database created at ./agentdock.db
# - Sessions persist across server restarts
```

**No .env.local configuration required for local storage.**

### Production with PostgreSQL/Supabase

#### Step 1: Database Setup
Choose a PostgreSQL provider:
- Supabase (managed PostgreSQL)
- Neon
- Railway
- Self-hosted PostgreSQL 15+

#### Step 2: Configure Environment
Add to `.env.local`:
```bash
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres
ENABLE_PGVECTOR=true  # Optional: for vector operations
KV_STORE_PROVIDER=postgresql
```

#### Step 3: Enable Vector Extension (Optional)
For vector search capabilities:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

#### Step 4: Deploy
```bash
pnpm build
pnpm start
```

**Current capabilities with this setup:**
- Session state persistence
- Storage API with PostgreSQL backend
- Vector operations (if pgvector enabled)

**Not yet implemented:**
- Server-side message persistence (messages remain in browser localStorage)
- User authentication system
- AI memory implementation

## Configuration Examples

### Minimal Local Development
```bash
# No storage configuration needed
# SQLite is automatically enabled in development
```

### Production with PostgreSQL
```bash
# PostgreSQL connection
DATABASE_URL=postgresql://postgres:password@host:5432/database
ENABLE_PGVECTOR=true
KV_STORE_PROVIDER=postgresql
```

## Common Questions

### Do I need Redis?
No. PostgreSQL can handle session storage directly. Redis is optional for caching.

### Do I need MongoDB?
No. MongoDB is not recommended for the memory system. Use PostgreSQL or SQLite.

### What about Vercel deployments?
Options:
- Use external PostgreSQL (Supabase, Neon)
- Use Vercel KV (auto-configured when added via Vercel dashboard)

### Data not persisting locally?
Ensure you're running `pnpm dev` which enables SQLite automatically.

### Can I use my own PostgreSQL?
Yes. Any PostgreSQL 15+ instance works. Add pgvector extension for vector operations.

## Using Additional Storage Adapters

Most applications don't need additional adapters. For specific requirements:

### Step 1: Configure Environment
```bash
# Example: MongoDB (not recommended for memory)
ENABLE_MONGODB=true
MONGODB_URI=mongodb://localhost:27017/agentdock
```

### Step 2: Register in API Route
```typescript
// app/api/route.ts
import { getStorageFactory } from 'agentdock-core';
import { registerMongoDBAdapter } from 'agentdock-core/storage';

export async function POST(req: Request) {
  const factory = getStorageFactory();
  await registerMongoDBAdapter(factory);
  
  const storage = factory.getProvider({ type: 'mongodb' });
  // Use storage...
}
```

## Summary

- **Local Development**: SQLite auto-configured
- **Production**: PostgreSQL recommended
- **Additional adapters**: Available but require manual registration 