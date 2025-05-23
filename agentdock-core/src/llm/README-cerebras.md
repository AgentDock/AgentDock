# Cerebras Integration for AgentDock

This document explains how Cerebras is integrated into AgentDock Core.

## Overview

Cerebras is integrated into AgentDock Core as a dedicated provider with custom model configurations and error handling. Cerebras offers high-performance inference services for language models, similar to other providers like Groq.

## Implementation Details

### Provider Architecture

The Cerebras integration follows the provider adapter pattern used throughout AgentDock:

```typescript
// Provider registration in provider-registry.ts
{
  id: "cerebras",
  displayName: "Cerebras",
  description: "Cerebras AI inference service",
  defaultModel: "cerebras-gpt-13b",
  validateApiKey: validateCerebrasApiKey,
  applyConfig: applyCerebrasConfig,
  fetchModels: fetchCerebrasModels
}
```

### Available Models

Cerebras offers several models with varying parameter sizes:

1. **Cerebras GPT-13B** (`cerebras-gpt-13b`): 13B parameter model optimized for general text generation and reasoning
2. **Cerebras GPT-6.7B** (`cerebras-gpt-6.7b`): 6.7B parameter model with a good balance of performance and speed
3. **Cerebras GPT-2.7B** (`cerebras-gpt-2.7b`): 2.7B parameter model for faster, more efficient processing

All models support a context window of 2048 tokens and are configured with default temperature of 0.7.

### Configuration Options

The `CerebrasConfig` interface extends the base `LLMConfig` with Cerebras-specific options:

```typescript
export interface CerebrasConfig extends LLMConfig {
  provider: "cerebras";
  model: string;
  apiKey: string;
  temperature?: number; // Default: 0.7
  maxTokens?: number; // Default: 2048
  topP?: number; // Default: 1
  frequencyPenalty?: number; // Default: 0
  presencePenalty?: number; // Default: 0
}
```

### API Communication

Cerebras uses a REST API with the following characteristics:

- Base URL: `https://api.cerebras.com/v1`
- Authentication: Bearer token authentication using the API key
- Content-Type: application/json
- Request format: Compatible with OpenAI's API structure

### Error Handling

The Cerebras integration implements custom error handling through the `CerebrasError` class, which captures and categorizes errors:

```typescript
class CerebrasError extends Error {
  constructor(
    message: string,
    public code: "AUTH_ERROR" | "API_ERROR" | "VALIDATION_ERROR",
    public originalError?: Error
  ) {
    super(message);
    this.name = "CerebrasError";
  }
}
```

Error types include:

- `AUTH_ERROR`: API key validation or authentication failures
- `API_ERROR`: Issues with the Cerebras API (rate limits, server errors)
- `VALIDATION_ERROR`: Invalid parameters or configuration

### Environment Variables

Configuration is managed through environment variables:

```bash
# Required
CEREBRAS_API_KEY=your_api_key

# Optional (defaults to https://api.cerebras.com/v1)
CEREBRAS_API_URL=custom_url
```

## Usage Examples

### Basic Integration

```typescript
import { createLLM } from "agentdock-core";

// Configure the Cerebras provider
const config = {
  provider: "cerebras",
  model: "cerebras-gpt-13b",
  apiKey: process.env.CEREBRAS_API_KEY,
  temperature: 0.7,
  maxTokens: 2048,
};

// Create an LLM instance
const llm = createLLM(config);

// Generate text
const response = await llm.generateText([
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "Tell me about Cerebras Systems." },
]);

console.log(response);
```

### Validating API Keys

```typescript
import { validateCerebrasApiKey } from "agentdock-core";

const apiKey = process.env.CEREBRAS_API_KEY;
const isValid = await validateCerebrasApiKey(apiKey);

if (isValid) {
  console.log("API key is valid");
} else {
  console.log("Invalid API key");
}
```

### Error Handling

```typescript
try {
  const llm = createLLM({
    provider: "cerebras",
    model: "cerebras-gpt-13b",
    apiKey: "invalid-key",
  });

  await llm.generateText([{ role: "user", content: "Hello" }]);
} catch (error) {
  if (error instanceof CerebrasError) {
    console.error(`Error type: ${error.code}`);
    console.error(`Message: ${error.message}`);
  } else {
    console.error("Unknown error:", error);
  }
}
```

## Testing

The Cerebras integration includes comprehensive tests covering:

1. API key validation
2. Error handling (rate limits, authentication, server errors)
3. Model registration and properties
4. Configuration options

Tests can be run with the standard test command:

```bash
pnpm test
```
