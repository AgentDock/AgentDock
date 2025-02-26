# Vercel AI SDK Adapter Examples

This directory contains examples demonstrating how to use the ThinVercelAIAdapter with different configurations and use cases.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file based on the `.env.example` file:
   ```bash
   cp .env.example .env
   ```

3. Add your API keys to the `.env` file.

## Examples

### Basic Usage

Demonstrates basic usage of the ThinVercelAIAdapter for non-streaming completions:

```bash
npx ts-node basic-usage.ts
```

This example shows:
- How to create a ThinVercelAIAdapter instance
- How to generate a completion from a list of messages
- How to handle the response

### Streaming Completions

Demonstrates how to use the ThinVercelAIAdapter for streaming completions:

```bash
npx ts-node basic-usage.ts streaming
```

This example shows:
- How to generate a streaming completion
- How to process the stream of tokens

### Multipart Messages

Demonstrates how to use the ThinVercelAIAdapter with multipart messages (text and images):

```bash
npx ts-node basic-usage.ts multipart
```

This example shows:
- How to create multipart messages with text and images
- How to generate completions from multipart messages

## Advanced Examples

### Tool Calls

Demonstrates how to use the ThinVercelAIAdapter with tool calls:

```bash
npx ts-node tool-calls.ts
```

This example shows:
- How to create messages with tool calls
- How to handle tool call responses

### Custom API Configuration

Demonstrates how to configure the ThinVercelAIAdapter for different API providers:

```bash
npx ts-node custom-api.ts
```

This example shows:
- How to configure the adapter for different API providers (OpenAI, Anthropic, etc.)
- How to set custom headers and base URLs 