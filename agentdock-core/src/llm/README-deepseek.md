# DeepSeek Integration for AgentDock

This document explains how DeepSeek is integrated into AgentDock Core.

## Overview

DeepSeek is integrated into AgentDock Core using OpenAI's client with a custom base URL. This is possible because DeepSeek's API is compatible with OpenAI's format.

## Implementation Details

### API Compatibility

DeepSeek's API follows the OpenAI API format, allowing us to use the OpenAI client with DeepSeek's API endpoint:

```typescript
const provider = createOpenAI({
  apiKey: config.apiKey,
  baseURL: 'https://api.deepseek.com/v1',
});
```

### Available Models

DeepSeek offers two main models:

1. **DeepSeek-V3** (`deepseek-chat`): A general-purpose chat model
2. **DeepSeek-R1** (`deepseek-reasoner`): A specialized reasoning model

### Configuration Options

The `DeepSeekConfig` interface extends the base `LLMConfig` with DeepSeek-specific options:

```typescript
export interface DeepSeekConfig extends LLMConfig {
  provider: 'deepseek';
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
  extractReasoning?: boolean;
}
```

## Usage

To use DeepSeek in your agent, configure it as follows:

```json
{
  "nodes": ["llm.deepseek"],
  "nodeConfigurations": {
    "llm.deepseek": {
      "model": "deepseek-chat", // or "deepseek-reasoner"
      "temperature": 0.7,
      "maxTokens": 4096
    }
  }
}
```

## API Key

You'll need to obtain a DeepSeek API key from the [DeepSeek Platform](https://platform.deepseek.com/api_keys).

## Future Enhancements

Future enhancements could include:

1. **Reasoning Extraction**: Implementing middleware to extract reasoning from DeepSeek-R1 responses
2. **Context Caching**: Adding support for DeepSeek's context caching feature
3. **Advanced Safety Settings**: Providing more granular control over safety settings
4. **Structured Output**: Adding support for generating structured data

## References

- [DeepSeek API Documentation](https://api-docs.deepseek.com/)
- [DeepSeek Platform](https://platform.deepseek.com/)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
