# Vercel AI SDK Adapter for AgentDock

This module provides a lightweight adapter for integrating the Vercel AI SDK with AgentDock. It handles the conversion between AgentDock message types and Vercel AI SDK message types, allowing for seamless integration with various LLM providers supported by the Vercel AI SDK.

## Features

- Converts between AgentDock message types and Vercel AI SDK message types
- Supports both streaming and non-streaming completions
- Handles multipart messages (text, images, tool calls, tool results)
- Compatible with Vercel AI SDK v4.1+

## Usage

### Basic Usage

```typescript
import { ThinVercelAIAdapter } from '@agentdock/core/llm/vercel-ai';
import { v4 as uuidv4 } from 'uuid';

// Create a new adapter instance
const adapter = new ThinVercelAIAdapter({
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 1000,
  apiKey: process.env.OPENAI_API_KEY,
});

// Create some messages
const messages = [
  {
    id: uuidv4(),
    role: 'system',
    content: 'You are a helpful assistant.',
    createdAt: new Date()
  },
  {
    id: uuidv4(),
    role: 'user',
    content: 'Hello, how are you?',
    createdAt: new Date()
  }
];

// Generate a completion
const result = await adapter.generateCompletion(messages);
console.log(result.message.content);
```

### Streaming Completions

```typescript
// Generate a streaming completion
const stream = await adapter.generateCompletionStream(messages);

// Process the stream
const reader = stream.getReader();
const decoder = new TextDecoder();
let done = false;

while (!done) {
  const { value, done: doneReading } = await reader.read();
  done = doneReading;
  
  if (value) {
    const text = decoder.decode(value);
    process.stdout.write(text);
  }
}
```

### Multipart Messages

```typescript
// Create a multipart message with text and image
const messages = [
  {
    id: uuidv4(),
    role: 'system',
    content: 'You are a helpful assistant that can analyze images.',
    createdAt: new Date()
  },
  {
    id: uuidv4(),
    role: 'user',
    content: [
      {
        type: 'text',
        text: 'What can you tell me about this image?'
      },
      {
        type: 'image',
        url: 'https://example.com/image.jpg',
        alt: 'Example image'
      }
    ],
    createdAt: new Date()
  }
];

// Generate a completion
const result = await adapter.generateCompletion(messages);
console.log(result.message.content);
```

## API Reference

### `ThinVercelAIAdapter`

The main adapter class that implements the `LLMAdapter` interface.

#### Constructor

```typescript
constructor(options: ThinVercelAIAdapterOptions)
```

- `options`: Configuration options for the adapter
  - `model`: The model to use (e.g., 'gpt-4')
  - `temperature`: The temperature to use for generation (0-1)
  - `maxTokens`: The maximum number of tokens to generate
  - `apiKey`: The API key for authentication
  - `baseUrl`: The base URL for the API (optional)
  - `headers`: Additional headers to include in the request (optional)

#### Methods

##### `generateCompletion`

```typescript
async generateCompletion(messages: Message[]): Promise<LLMAdapterResponse>
```

Generates a completion for the given messages.

##### `generateCompletionStream`

```typescript
async generateCompletionStream(messages: Message[]): Promise<ReadableStream<Uint8Array>>
```

Generates a streaming completion for the given messages.

##### `createStreamingResponse`

```typescript
createStreamingResponse(stream: ReadableStream<Uint8Array>): StreamingTextResponse
```

Creates a `StreamingTextResponse` from a `ReadableStream`.

### Message Type Conversion

The adapter includes utilities for converting between AgentDock message types and Vercel AI SDK message types:

- `toVercelMessage`: Converts an AgentDock message to a Vercel AI SDK message
- `fromVercelMessage`: Converts a Vercel AI SDK message to an AgentDock message
- `toVercelMessages`: Converts an array of AgentDock messages to Vercel AI SDK messages
- `fromVercelMessages`: Converts an array of Vercel AI SDK messages to AgentDock messages

## Examples

See the `examples` directory for more detailed examples of how to use the adapter. 