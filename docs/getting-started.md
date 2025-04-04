# Getting Started with AgentDock

This guide will help you set up and run AgentDock on your local machine for development and testing purposes.

## Components

AgentDock consists of two main components:

1. **AgentDock Core** - The foundation library that powers agent functionality
2. **Open Source Client** - A complete reference implementation built with Next.js that provides a web interface for interacting with agents

This repository includes both components, allowing you to use them together or separately.

## Requirements

- Node.js ≥ 20.11.0 (LTS)
- pnpm ≥ 9.15.0 (Required)
- Docker and Docker Compose (Recommended for stateful features)
- API keys for at least one LLM provider (Anthropic, OpenAI, Gemini, etc.)

## Installation & Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/agentdock/agentdock.git
   cd agentdock
   ```

2. **Install pnpm** (if not already installed):

   ```bash
   corepack enable
   corepack prepare pnpm@latest --activate
   ```

3. **Install dependencies**:

   ```bash
   pnpm install
   ```

4. **(Recommended) Start Backend Services (Redis via Docker)**

   For features requiring persistent state across interactions (like session management, orchestration state, and cumulative token usage tracking), running a Redis instance via Docker is highly recommended.

   - **Why Docker/Redis?** AgentDock Core uses a configurable storage layer. By default (without Docker), it uses **in-memory storage**. This means session state, orchestration progress, and cumulative token counts **will be lost** between server restarts or even potentially between requests in some deployment models. While the app might run, stateful features won't work reliably.
   - Using Redis provides a persistent backend store for this data during development.

   - **Using Docker Desktop:** If you're new to Docker, using [Docker Desktop](https://www.docker.com/products/docker-desktop/) provides a graphical interface to easily manage your containers (start, stop, view logs, etc.).

   - **Start Services:**
     Navigate to the root of the cloned repository where `docker-compose.yaml` is located and run:
     ```bash
     docker compose up -d
     ```
     This command starts Redis (and related services like Redis Commander for viewing data) in the background.

   - **Stopping Redis:**
     When you're done developing, you can stop the services:
     ```bash
     docker compose down
     ```

5. **Configure environment variables**:

   Create a `.env.local` file in the root directory:

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local`:
   - Add your LLM provider API keys (at least one is required).
   - **(If using Docker/Redis from step 4)** Choose ONE storage configuration option below:
     
     **Option A: Direct Redis Connection (Recommended for most local development)**
     ```dotenv
     # --- Key-Value Storage --- 
     # Connect directly to the Redis container
     KV_STORE_PROVIDER=redis
     REDIS_URL="redis://localhost:6380" 
     # REDIS_TOKEN=... (Leave commented out unless you set a password in docker-compose.yaml)
     ```
     
     **Option B: Redis HTTP Proxy Connection (For simulating edge/serverless environments locally)**
     The `docker-compose.yaml` also starts `redis-http-proxy` (on port 8079), which provides an HTTP interface to Redis, similar to services like Upstash used in production/edge deployments. Use this if you specifically need to test interaction via an HTTP proxy.
     ```dotenv
     # --- Key-Value Storage --- 
     # Connect via the local Redis HTTP Proxy container
     KV_STORE_PROVIDER=redis 
     REDIS_URL="http://localhost:8079" # Note: Using HTTP URL for the proxy
     REDIS_TOKEN="test_token" # Use the token defined for the proxy in docker-compose.yaml
     ```
   - **(If NOT using Docker/Redis)** The application will default to `KV_STORE_PROVIDER=memory`. Ensure this variable is either set to `memory` or omitted entirely.

   Example snippet for `.env.local` (using Option A - Direct Redis):
   ```dotenv
   # LLM Provider API Keys
   ANTHROPIC_API_KEY=sk-ant-xxxxxxx
   OPENAI_API_KEY=sk-xxxxxxx
   # ... other keys ...

   # Storage Configuration (Using Dockerized Redis)
   KV_STORE_PROVIDER=redis
   REDIS_URL="redis://localhost:6380"
   ```

6. **Start the development server**:

   ```bash
   pnpm dev
   ```

7. **Access the application**:

   Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

## Creating Your First Agent

AgentDock uses agent templates to define agent behavior. Here's how to create your own agent:

### 1. Create Agent Template

Create a new directory in the `src/templates` folder for your agent:

```
src/templates/my-first-agent/
```

Create a `template.json` file in this directory with your agent configuration:

```json
{
  "id": "my-first-agent",
  "name": "My First Agent",
  "description": "A simple example agent",
  "systemPrompt": "You are a helpful assistant that provides concise answers.",
  "personality": ["I'm designed to be helpful and informative.", "I provide concise answers to your questions."],
  "avatar": "/avatars/default.png",
  "tools": ["search", "weather"],
  "provider": "anthropic",
  "model": "claude-3-haiku-20240307",
  "tags": ["Personal"]
}
```

### 2. Start the Development Server

Simply run the development server which will automatically bundle your templates:

```bash
pnpm dev
```

The `predev` script will automatically run before starting the server, bundling all templates in the `src/templates` directory.

### 3. Test Your Agent

Navigate to [http://localhost:3000/chat?agentId=my-first-agent](http://localhost:3000/chat?agentId=my-first-agent) to interact with your agent. Your agent will also appear in the agent selection page.

## Customizing Your Agent

Agent customization is done entirely through the `template.json` file. The file supports the following key fields:

- `id`: Unique identifier for your agent
- `name`: Display name for your agent
- `description`: Brief description of what your agent does
- `systemPrompt`: Instructions that guide your agent's behavior
- `personality`: Array of personality traits (or can be a string)
- `avatar`: Path to avatar image (supported in the configuration but not currently rendered in the interface)
- `tools`: Array of tool IDs the agent can use
- `provider`: LLM provider to use (anthropic, openai, gemini)
- `model`: Specific model to use from the provider
- `tags`: Categories for your agent

## About the Open Source Client

The Open Source Client is the complete web application in this repository that provides a reference implementation of the AgentDock Core. It includes:

- A chat interface for interacting with agents
- Agent selection and management
- Documentation site
- API routes for agent communication
- Image generation capabilities
- Settings management
- And more

The client demonstrates how to build a full-featured application using the AgentDock Core framework.

## Building for Production

To create a production build:

```bash
pnpm build
```

This will create an optimized production build in the `.next` directory.

To preview the production build locally:

```bash
pnpm start
```

## Using AgentDock Core Standalone

If you want to use just the AgentDock Core library in your own project:

1. **Install the package**:

   ```bash
   pnpm add agentdock-core
   ```

2. **Import and use in your code**:

   ```typescript
   import { AgentNode } from 'agentdock-core';
   
   async function createAgent() {
     // Create an agent configuration
     const config = {
       id: "my-agent",
       name: "My Agent",
       systemPrompt: "You are a helpful assistant.",
       tools: ["search"]
     };
     
     // Create an agent
     const agent = new AgentNode('my-agent', {
       agentConfig: config,
       apiKey: process.env.ANTHROPIC_API_KEY,
       provider: 'anthropic'
     });
     
     // Handle a message
     const result = await agent.handleMessage({
       messages: [{ role: 'user', content: 'Hello, how can you help me?' }]
     });
     
     console.log(result.text);
   }
   ```

## Next Steps

Now that you have AgentDock running, you can explore:

- [Agent Templates](agent-templates.md) - Learn more about agent templates and available options
- [Architecture Overview](architecture/README.md) - Understand the system architecture
- [Node System](nodes/README.md) - Learn about the node-based architecture
- [Custom Tool Development](nodes/custom-tool-development.md) - Create your own custom tools
- [Open Source Client](oss-client/image-generation.md) - Explore features in the reference implementation

## Troubleshooting

### Common Issues

1. **"Cannot find module 'pnpm'"**
   - Make sure you have pnpm installed globally or via corepack

2. **API Key Errors**
   - Verify that you've added the correct API keys to your `.env.local` file
   - Check that the API key format is correct for the provider you're using

3. **Agent not appearing after creation**
   - Make sure you restart the development server after creating a new agent
   - Check that your template.json file is valid JSON with all required fields

4. **Dependency Issues**
   - Try running `pnpm clean && pnpm install` to clean and reinstall all dependencies

### Getting Help

If you encounter problems not covered here, please:
- Check existing issues in the GitHub repository
- Open a new issue with detailed information about your problem 