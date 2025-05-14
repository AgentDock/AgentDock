# Cerebras Provider

The Cerebras provider allows you to use Cerebras Systems' inference services for open source LLM models.

## Configuration

### Environment Variables

- `CEREBRAS_API_KEY`: Your Cerebras API key (required)
- `CEREBRAS_API_URL`: Custom API endpoint URL (optional, defaults to "https://api.cerebras.ai/v1")

### API Key Format

Cerebras API keys can be in two formats:

- Keys starting with `csk-`
- Keys starting with `csk_`

## Usage

```typescript
import { createLLM } from "@agentdock/core";

const config = {
  provider: "cerebras",
  model: "llama3.1-8b", // or any other available model
  apiKey: process.env.CEREBRAS_API_KEY,
  temperature: 0.7, // optional, default: 0.7
  maxTokens: 2048, // optional, default: 2048
};

const llm = createLLM(config);
```

## Available Models

The Cerebras adapter dynamically fetches available models from the Cerebras API. Currently available models include:

1. **llama3.1-8b**

   - Context Window: 8192 tokens
   - Default Temperature: 0.7
   - Default Max Tokens: 2048
   - Capabilities: text generation, reasoning

2. **llama-3.3-70b**

   - Context Window: 8192 tokens
   - Default Temperature: 0.7
   - Default Max Tokens: 2048
   - Capabilities: text generation, reasoning

3. **llama-4-scout-17b-16e-instruct**
   - Context Window: 8192 tokens
   - Default Temperature: 0.7
   - Default Max Tokens: 2048
   - Capabilities: text generation, reasoning

_Note: Available models may change as Cerebras updates their offerings. The adapter will automatically fetch the current list of models._

## Error Handling

The provider handles various error scenarios:

- Rate limiting (429)
- Invalid API key (401)
- Server errors (500)
- Network errors
- Invalid responses

## Configuration Options

| Option           | Type   | Default | Description                          |
| ---------------- | ------ | ------- | ------------------------------------ |
| temperature      | number | 0.7     | Controls randomness in generation    |
| maxTokens        | number | 2048    | Maximum number of tokens to generate |
| topP             | number | 1       | Nucleus sampling parameter           |
| frequencyPenalty | number | 0       | Penalty for frequent tokens          |
| presencePenalty  | number | 0       | Penalty for new tokens               |

## Example

```typescript
import { createLLM } from "@agentdock/core";

const llm = createLLM({
  provider: "cerebras",
  model: "llama3.1-8b",
  apiKey: process.env.CEREBRAS_API_KEY,
  temperature: 0.8,
  maxTokens: 1024,
});

// Generate text
const response = await llm.generateText([
  { role: "user", content: "What is the capital of France?" },
]);

console.log(response);
// Output: The capital of France is Paris.
```
