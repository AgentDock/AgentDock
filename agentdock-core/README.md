# AgentDock Core

AgentDock Core is the foundation library that powers the AgentDock platform, providing essential functionality for building AI agent applications.

## Overview

This library provides a set of tools and abstractions for working with Large Language Models (LLMs), managing agent configurations, and building interactive AI experiences. It's designed to be flexible, extensible, and easy to use.

AgentDock Core can be used:
- As a standalone library in your own projects
- With any JavaScript framework or runtime environment
- In both server and client environments (where supported)

## Key Features

- **Unified LLM Integration**: Built-in support for multiple LLM providers (Anthropic, OpenAI, Gemini) with a single, consistent interface
- **Agent Framework**: Tools for building conversational AI agents with memory and context
- **Tool LLM Integration**: Tools can leverage the agent's LLM capabilities for enhanced functionality
- **Streaming Support**: First-class support for streaming responses
- **Type Safety**: Comprehensive TypeScript types for all components
- **Error Handling**: Robust error handling and logging
- **Secure Storage**: Utilities for securely storing sensitive information
- **AI SDK Integration**: Direct integration with Vercel AI SDK for building AI-powered UIs
- **React Hooks**: Built-in hooks for chat and completion interfaces in React applications

## Directory Structure

```
agentdock-core/
├── src/
│   ├── client/       # Client-side React components and hooks
│   ├── config/       # Configuration management
│   ├── errors/       # Error definitions and handling
│   ├── llm/          # LLM provider integrations
│   ├── logging/      # Logging utilities
│   ├── messaging/    # Message handling
│   ├── nodes/        # Agent node system
│   ├── storage/      # Storage utilities
│   ├── types/        # TypeScript type definitions
│   └── utils/        # Utility functions
├── index.d.ts        # Type definitions
└── package.json      # Package configuration
```

## Usage

AgentDock Core is designed to be used as a library in your applications. Here are some examples:

### Server-Side Usage

```typescript
import { 
  AgentNode, 
  loadAgentConfig, 
  SecureStorage 
} from 'agentdock-core';

// Load agent configuration
const config = await loadAgentConfig(templateConfig, apiKey);

// Create an agent
const agent = new AgentNode('my-agent', {
  agentConfig: config,
  apiKey,
  provider: 'anthropic'
});

// Handle a message
const result = await agent.handleMessage({
  messages: [{ role: 'user', content: 'Hello, how can you help me?' }]
});

// Process the response
console.log(result.text);

// Or work with the stream
const stream = await agent.handleMessageStream({
  messages: [{ role: 'user', content: 'Tell me a story' }]
});

for await (const chunk of stream) {
  console.log(chunk.text);
}
```

### Client-Side Usage with React Hooks

AgentDock Core now includes direct integration with Vercel's AI SDK, providing React hooks for building chat interfaces:

```tsx
import { useChat } from 'agentdock-core/client';
import { useState } from 'react';

function ChatComponent() {
  const { 
    messages, 
    input, 
    handleInputChange, 
    handleSubmit, 
    isLoading 
  } = useChat({
    api: '/api/chat',
    // Optional configuration for the chat interface
    initialMessages: [],
    // Works with server-side streaming
    streamProtocol: 'data',
    // Pass additional body data
    body: {
      system: "You are a helpful assistant."
    }
  });

  return (
    <div>
      <div className="messages">
        {messages.map(message => (
          <div key={message.id} className={message.role}>
            {message.content}
          </div>
        ))}
        {isLoading && <div className="loading">AI is thinking...</div>}
      </div>
      
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={e => handleInputChange(e.target.value)}
          placeholder="Say something..."
        />
        <button type="submit" disabled={isLoading}>
          Send
        </button>
      </form>
    </div>
  );
}
```

## Architecture & Design Philosophy

AgentDock Core follows these key architectural principles:

### 1. Environment-Agnostic Design

The core library is designed to work seamlessly in different environments:

- **Framework Independence**: Works with any JavaScript framework
- **Runtime Flexibility**: Compatible with Node.js, Edge, and browser environments
- **Deployment Versatility**: Supports various deployment models (serverless, containers, etc.)
- **Environment Compatibility**: Node metadata tracks compatibility across different environments

### 2. Adapter Pattern for Extensibility

Core functionality is exposed through adapter interfaces that can be extended:

```typescript
// Example of the adapter pattern in AgentDock Core
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: StorageOptions): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

// Implementations can vary while maintaining the same interface
export class FileStorageAdapter implements StorageAdapter {
  // File-based implementation
}
```

### 3. Provider Registry System

The core includes a provider registry system for managing LLM providers:

```typescript
// Provider registry manages metadata for different LLM providers
const DEFAULT_PROVIDERS: Record<LLMProvider, ProviderMetadata> = {
  'anthropic': {
    id: 'anthropic',
    displayName: 'Anthropic',
    description: 'Claude models by Anthropic',
    defaultModel: 'claude-3-7-sonnet-20250219',
    validateApiKey: (key: string) => key.startsWith('sk-ant-')
  },
  'openai': {
    id: 'openai',
    displayName: 'OpenAI',
    description: 'GPT models by OpenAI',
    defaultModel: 'gpt-4',
    validateApiKey: (key: string) => key.startsWith('sk-') && !key.startsWith('sk-ant-')
  }
};
```

### 4. Progressive Enhancement

Core features are designed with a "progressive enhancement" approach:

- **Basic Functionality**: Always available in the core
- **Advanced Capabilities**: Available through optional extensions
- **Graceful Degradation**: Falls back to simpler implementations when needed
- **Compatibility Tracking**: Node metadata includes environment compatibility information:
  ```typescript
  compatibility: {
    environments: string[];  // List of compatible environments
    custom: boolean;         // Available for custom implementations
  }
  ```

## Current Capabilities

### Node System

The node system is the foundation of AgentDock Core:

- **BaseNode**: Abstract base class for all nodes
- **AgentNode**: Specialized node for LLM-powered agents
- **NodeRegistry**: Central registry for node types and metadata
- **ToolRegistry**: Registry for tools that can be used by agents

### LLM Integration

The LLM system provides a consistent interface for different providers:

- **CoreLLM**: Unified implementation for all LLM providers (Anthropic, OpenAI, Gemini)
- **Provider-Specific Model Creation**: Functions for creating models from different providers
- **ProviderRegistry**: Central registry for provider metadata and configuration
- **Direct SDK Integration**: Direct integration with the Vercel AI SDK
- **Tool LLM Integration**: Tools can access the agent's LLM instance for enhanced functionality
- **Extensible Design**: Easy to add new providers (see docs/adding-new-provider.md)

### AI SDK Integration

AgentDock Core now integrates directly with Vercel's AI SDK, offering:

- **Client-Side Hooks**: React hooks for chat and completion interfaces (`useChat`, `useCompletion`)
- **Streaming Support**: First-class support for streaming responses with various protocols
- **Type Safety**: Comprehensive TypeScript types for all components
- **Provider Integration**: Seamless integration with all supported LLM providers
- **Tool Calling**: Support for tool calling and function invocation

### Storage System

The current storage system focuses on secure data storage:

- **SecureStorage**: Encrypted key-value storage for sensitive data
- **Web Crypto API**: Uses modern browser crypto for encryption
- **Namespacing**: Logical separation of stored data

## Storage System Development

We're actively developing enhancements to the storage system, including:

- **Storage Adapter Interface**: A consistent interface for different storage backends
- **Vector Storage**: Support for embedding-based similarity search
- **Pluggable Backends**: Easily swap storage implementations
- **Composable Adapters**: Layer storage capabilities (encryption, compression, etc.)
- **Working Memory**: Maintain and update contextual information for agents

These enhancements aim to make it easier to build memory-enabled agents while maintaining our pluggable architecture.

## Contributing to AgentDock Core

When contributing to AgentDock Core, please keep these guidelines in mind:

### Design Considerations

- **Maintain Compatibility**: Ensure changes work in all supported environments
- **Respect Interfaces**: Extend existing interfaces rather than breaking them
- **Consider Performance**: Optimize for both speed and resource usage
- **Test Thoroughly**: Include tests for all new functionality

### Contribution Process

1. **Discuss First**: Open an issue to discuss significant changes before implementing
2. **Follow Standards**: Adhere to the project's coding standards and patterns
3. **Document Changes**: Update documentation to reflect your changes
4. **Include Tests**: Add tests for new functionality
5. **Submit PR**: Create a pull request with a clear description of changes

## Versioning and Stability

AgentDock Core follows semantic versioning:

- **Major Versions (x.0.0)**: May include breaking changes
- **Minor Versions (0.x.0)**: Add new features in a backward-compatible manner
- **Patch Versions (0.0.x)**: Bug fixes and minor improvements

We maintain stability by:
- Clearly documenting breaking changes
- Providing migration guides between major versions
- Maintaining LTS (Long Term Support) for specific versions

## License

AgentDock Core is licensed under the MIT License. See the LICENSE file in the root directory for details. 