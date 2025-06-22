# Getting Started with Storage

This guide will help you set up storage for your AgentDock application.

## Quick Start

### 1. Default Setup (Memory Storage)

No configuration needed! AgentDock uses in-memory storage by default.

```bash
# Just run the app
pnpm dev
```

⚠️ **Note**: Memory storage resets when the server restarts.

### 2. Local Development (SQLite)

For persistent local storage:

```bash
# In your .env.local file
KV_STORE_PROVIDER=sqlite
```

SQLite will automatically create a database file at `./agentdock.db`.

### 3. Production Setup (PostgreSQL)

For production deployments:

```bash
# In your .env.local file
KV_STORE_PROVIDER=postgresql
DATABASE_URL=postgresql://user:password@localhost:5432/agentdock
```

### 4. Redis for Real-time Apps

For agent chat applications with real-time features:

```bash
# In your .env.local file
KV_STORE_PROVIDER=redis
REDIS_URL=redis://localhost:6379
```

## Step-by-Step Setup

### Setting up PostgreSQL

1. **Install PostgreSQL**
   ```bash
   # macOS
   brew install postgresql
   brew services start postgresql

   # Ubuntu/Debian
   sudo apt install postgresql
   sudo systemctl start postgresql
   ```

2. **Create Database**
   ```bash
   createdb agentdock
   ```

3. **Set Environment Variable**
   ```bash
   # .env.local
   KV_STORE_PROVIDER=postgresql
   DATABASE_URL=postgresql://localhost:5432/agentdock
   ```

### Setting up Redis

1. **Install Redis**
   ```bash
   # macOS
   brew install redis
   brew services start redis

   # Ubuntu/Debian
   sudo apt install redis-server
   sudo systemctl start redis
   ```

2. **Configure AgentDock**
   ```bash
   # .env.local
   KV_STORE_PROVIDER=redis
   REDIS_URL=redis://localhost:6379
   ```

### Using Upstash Redis (Serverless)

1. **Create Upstash Account**
   - Go to [upstash.com](https://upstash.com)
   - Create a Redis database

2. **Get Credentials**
   - Copy the REST URL and token

3. **Configure**
   ```bash
   # .env.local
   KV_STORE_PROVIDER=redis
   REDIS_URL=https://your-instance.upstash.io
   REDIS_TOKEN=your-token-here
   ```

### Enabling MongoDB (Optional)

1. **Install MongoDB**
   ```bash
   # macOS
   brew tap mongodb/brew
   brew install mongodb-community
   brew services start mongodb-community

   # Ubuntu/Debian
   sudo apt install mongodb
   sudo systemctl start mongodb
   ```

2. **Enable in AgentDock**
   ```bash
   # .env.local
   ENABLE_MONGODB=true
   MONGODB_URI=mongodb://localhost:27017/agentdock
   ```

## Where to Set Environment Variables

### Local Development

Create a `.env.local` file in the **root directory** (not in agentdock-core):

```
/agentdock_cursor_starter/
├── .env.local          ← Create this file here
├── package.json
├── agentdock-core/
└── ...
```

### Production (Vercel)

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add the variables without the `.env.local` file

### Production (Other Platforms)

- **Heroku**: Use `heroku config:set KEY=value`
- **Railway**: Use the environment variables UI
- **Docker**: Use `-e KEY=value` or env file

## Verifying Your Setup

Run this in your project root to test:

```bash
# Check which storage is being used
pnpm dev
# Look for log: "Using [Storage Type] Storage Provider"
```

## Common Configurations

### For a ChatGPT Clone
```bash
KV_STORE_PROVIDER=redis
REDIS_URL=redis://localhost:6379
```

### For a Local AI Assistant
```bash
KV_STORE_PROVIDER=sqlite
```

### For a Production SaaS
```bash
KV_STORE_PROVIDER=postgresql
DATABASE_URL=postgresql://user:pass@db.example.com:5432/agentdock
```

### For Vercel Deployment
```bash
# Vercel KV is auto-configured
# Just enable KV in Vercel dashboard
```

## Next Steps

- Learn about [Message Persistence](./message-persistence.md)
- Explore [Message History](./message-history.md)
- Understand the [Storage Architecture](./README.md) 