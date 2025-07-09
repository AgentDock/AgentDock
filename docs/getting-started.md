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

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/AgentDock/AgentDock.git
   cd AgentDock
   ```

2. **Install pnpm** (if not already installed):

   ```bash
   corepack enable
   corepack prepare pnpm@latest --activate
   ```

3. **Install Dependencies**:

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

   Create an environment file (`.env` or `.env.local`) in the root directory:

   ```bash
   # Option 1: Create .env.local
   cp .env.example .env.local
   
   # Option 2: Create .env
   cp .env.example .env
   ```

   Edit your environment file:
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
   OPENAI_API_KEY=sk-xxxxxxx
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

Create a new directory in the `agents` folder for your agent:

```
agents/my-first-agent/
```

Create a `template.json` file in this directory with your agent configuration:

```json
{
  "version": "1.0",
  "agentId": "my-first-agent",
  "name": "My First Agent",
  "description": "A simple example agent",
  "personality": [
    "You are a helpful assistant that provides concise answers.",
    "You are designed to be helpful and informative.",
    "You can help users with weather information and web searches.",
    "Use the weather tool to get current conditions and forecasts for any location worldwide.",
    "Use the search tool to find information on any topic. The tool will return relevant web search results that you can use to answer user questions.",
  ],
  "nodes": [
    "llm.anthropic",
    "weather",
    "search"
  ],
  "nodeConfigurations": {
    "llm.anthropic": {
      "model": "gpt-4.1-mini",
      "temperature": 0.7,
      "maxTokens": 4096,
      "useCustomApiKey": false
    },
    "weather": {
      "maxResults": 5
    },
    "search": {
      "maxResults": 8
    }
  },
  "chatSettings": {
    "historyPolicy": "lastN",
    "historyLength": 50,
    "initialMessages": [
      "Hello! I'm your new agent. I can help you with weather information and web searches. How can I assist you today?"
    ],
    "chatPrompts": [
      "What's the weather like in New York?",
      "Search for information about climate change"
    ]
  },
  "tags": ["Personal", "Weather", "Research"]
}
```

### 2. Start the Development Server

Simply run the development server which will automatically bundle your templates:

```bash
pnpm dev
```

The `predev` script will automatically run before starting the server, bundling all templates in the `agents` directory.

### 3. Test Your Agent

Navigate to [http://localhost:3000/chat?agentId=my-first-agent](http://localhost:3000/chat?agentId=my-first-agent) to interact with your agent. Your agent will also appear in the agent selection page.

## Customizing Your Agent

Agent customization is done entirely through the `template.json` file. The file supports the following key fields:

- `version`: Template version (optional)
- `agentId`: Unique identifier for your agent
- `name`: Display name for your agent
- `description`: Brief description of what your agent does
- `personality`: Array of personality traits that guide your agent's behavior
- `nodes`: Array of node types used by the agent. Each node represents a capability:
  - LLM nodes (e.g., "llm.anthropic", "llm.openai", "llm.gemini") - Provide language model capabilities
  - Tool nodes - Provide specific functionality:
    - "weather" - Get weather forecasts for locations
    - "search" - Search the web for information
    - "stock-price" - Get stock market data
    - "crypto-price" - Get cryptocurrency prices
    - "image-generation" - Generate images
    - "deep-research" - Perform in-depth research
    - "science" - Access scientific papers and data
    - "cognitive-tools" - Advanced cognitive capabilities
- `nodeConfigurations`: Configuration for specific nodes
  - For LLM nodes, specify the model and parameters (temperature, maxTokens, etc.)
  - For tool nodes, configure their specific settings (e.g., maxResults for search)
  - Each node type may have its own configuration options
- `chatSettings`: Controls chat behavior
  - `historyPolicy`: How chat history is managed ("none", "lastN", "all")
  - `historyLength`: Number of messages to keep if using "lastN"
  - `initialMessages`: Messages shown when chat starts
  - `chatPrompts`: Suggested prompts shown in UI
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
       apiKey: process.env.OPENAI_API_KEY,
provider: 'openai'
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

### Start Development Server

```bash
pnpm dev
```

This will start the Next.js reference client application.

### Using AgentDock Core in Other Backends

While this guide focuses on the reference Next.js client, `agentdock-core` is designed as a standalone library for Node.js environments. You can integrate it into any Node.js backend framework (like Express, Fastify, Hono, NestJS, etc.):

1.  **Install:** Add `@agentdock/core` (once published) or link the local `agentdock-core` package to your backend project.
2.  **Import:** Import necessary classes and functions (e.g., `AgentNode`, `NodeRegistry`, `registerCoreNodes`, configuration loaders).
3.  **Initialize:** Register core nodes (`registerCoreNodes()`) and any custom nodes/tools.
4.  **Integrate:** Create API endpoints (e.g., `/api/chat/:agentId`) in your chosen framework.
5.  **Handle Requests:** Within your endpoint handlers, instantiate `AgentNode`, manage sessions (using core session/storage managers or your own), handle message processing via `agentNode.handleMessage`, and stream responses back to the client.

### Using AgentDock from Other Languages (Python, Rust, etc.)

You cannot directly use the `agentdock-core` TypeScript library in non-JavaScript/TypeScript environments. However, you can interact with AgentDock agents from *any* language or platform:

1.  **Build an API:** Create a backend service using Node.js and `agentdock-core` (as described above) that exposes an HTTP API (e.g., REST).
2.  **Consume the API:** From your Python, Rust, Java, frontend application, or any other client, make standard HTTP requests to your AgentDock backend API endpoints to interact with your agents.

This API-centric approach allows AgentDock's core capabilities to be leveraged across diverse technology stacks.

## Next Steps

-   Explore the [Agent Templates](agent-templates.md) to understand configuration.
-   Learn about the [Node System](../nodes/README.md) in detail.
-   Dive into the [Core Architecture](../architecture/README.md). 