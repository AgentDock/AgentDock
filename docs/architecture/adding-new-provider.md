# Adding a New LLM Provider

This guide explains how to add a new LLM provider to the AgentDock Core framework.

## Overview

AgentDock Core uses a unified LLM implementation that integrates with the Vercel AI SDK (version 4.2.0). The framework provides standardized interfaces and conversion utilities to maintain compatibility between internal message formats and the AI SDK.

Adding a new provider involves:

1. Adding provider-specific configuration types
2. Creating a provider-specific model creation function
3. Updating the provider registry
4. Updating the `createLLM` function
5. Testing the new provider integration

## Step 1: Add Provider Configuration Types

First, add the provider-specific configuration types to `src/llm/types.ts`:

```typescript
// Add a new provider to the LLMProvider type
export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'deepseek' | 'groq' | 'your-provider';

// Add provider-specific configuration
export interface YourProviderConfig extends LLMConfig {
  // Add provider-specific properties here
  someProviderSpecificOption?: boolean;
}

// Update the ProviderConfig type
export type ProviderConfig = AnthropicConfig | OpenAIConfig | GeminiConfig | DeepSeekConfig | GroqConfig | YourProviderConfig;
```

## Step 2: Add Provider SDK Dependency

Add the provider's SDK to the project's dependencies in `package.json`. If the provider has an official AI SDK integration, use that; otherwise, you'll need to use the provider's native SDK and create an adapter.

```json
{
  "dependencies": {
    // Existing dependencies
    "@ai-sdk/anthropic": "^1.0.7",
    "@ai-sdk/google": "^1.1.26",
    "@ai-sdk/openai": "^1.0.14",
    "@ai-sdk/groq": "^1.0.0",
    
    // Add your provider's SDK
    "@ai-sdk/your-provider": "^1.0.0",
    // Or the native SDK if no AI SDK integration exists
    "your-provider-sdk": "^1.0.0"
  }
}
```

Note: Some providers like DeepSeek use OpenAI-compatible APIs, so they can utilize the OpenAI SDK with a custom base URL.

## Step 3: Create a Model Creation Function

Next, create a model creation function in `src/llm/model-utils.ts`. This function should use the AI SDK's integration for the provider if available:

```typescript
import { YourProvider } from '@ai-sdk/your-provider';
// Or import the native SDK
// import { YourProviderClient } from 'your-provider-sdk';

/**
 * Create a YourProvider model
 */
export function createYourProviderModel(config: LLMConfig): LanguageModel {
  // Validate API key
  if (!config.apiKey) {
    throw createError('llm', 'API key is required', ErrorCode.LLM_API_KEY);
  }

  // Add any provider-specific validation here
  if (!config.apiKey.startsWith('your-prefix-')) {
    throw createError('llm', 'Invalid API key format for Your Provider', ErrorCode.LLM_API_KEY);
  }
  
  // Create the provider using the AI SDK integration
  const provider = YourProvider({
    apiKey: config.apiKey,
    // Any other provider-specific initialization options
  });
  
  // Create model options
  const modelOptions: any = {};
  
  // Add provider-specific options if needed
  const yourProviderConfig = config as YourProviderConfig;
  if (yourProviderConfig.someProviderSpecificOption !== undefined) {
    modelOptions.someOption = yourProviderConfig.someProviderSpecificOption;
  }
  
  // Create and return the model with options
  return provider.LanguageModel({
    model: config.model,
    ...modelOptions
  });
}
```

### Alternative: Creating a Custom Adapter

If the provider doesn't have an AI SDK integration, you'll need to create a custom adapter that implements the `LanguageModel` interface:

```typescript
import { LanguageModel } from 'ai';
import { YourProviderClient } from 'your-provider-sdk';

export function createYourProviderModel(config: LLMConfig): LanguageModel {
  // Initialize the native client
  const client = new YourProviderClient({
    apiKey: config.apiKey,
    // Other initialization options
  });
  
  // Create a custom adapter that implements the LanguageModel interface
  return {
    generate: async (options) => {
      // Convert messages from CoreMessage format to provider format
      const providerMessages = options.messages.map(message => {
        // Implement conversion logic here
        return {
          role: message.role === 'data' ? 'tool' : message.role,
          content: message.content,
          // Other provider-specific fields
        };
      });
      
      // Call the provider's API
      const response = await client.createCompletion({
        model: config.model,
        messages: providerMessages,
        temperature: options.temperature,
        // Map other options
      });
      
      // Return formatted response
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: response.text
          }
        }]
      };
    },
    
    // Implement streaming support if the provider supports it
    generateStream: async (options) => {
      // Similar to generate, but return a ReadableStream
      // See the AI SDK documentation for details
    }
  };
}
```

## Step 4: Update the Provider Registry

Update the provider registry in `src/llm/provider-registry.ts`:

```typescript
// Add your provider to the DEFAULT_PROVIDERS object
const DEFAULT_PROVIDERS: Record<LLMProvider, ProviderMetadata> = {
  // ... existing providers ...
  'your-provider': {
    id: 'your-provider',
    displayName: 'Your Provider',
    description: 'Description of your provider',
    defaultModel: 'default-model-id',
    validateApiKey: (key: string) => key.startsWith('your-prefix-'), // Add proper validation logic
    
    // Add function to fetch models if supported
    fetchModels: async (apiKey: string) => {
      try {
        // Initialize client with API key
        const client = new YourProviderClient({ apiKey });
        
        // Fetch models from the provider
        const models = await client.listModels();
        
        // Convert to standardized format
        return models.map(model => ({
          id: model.id,
          name: model.name,
          contextLength: model.contextLength || 4096,
          pricingInfo: {
            inputPrice: model.inputPrice || 0,
            outputPrice: model.outputPrice || 0,
            unit: model.pricingUnit || '1M tokens'
          }
        }));
      } catch (error) {
        logger.error(LogCategory.LLM, 'fetchModels', `Error fetching models for your-provider: ${error.message}`);
        return [];
      }
    }
  }
};
```

## Step 5: Update the createLLM Function

Next, update the `createLLM` function in `src/llm/create-llm.ts`:

```typescript
// Import your model creation function
import { 
  createAnthropicModel, 
  createOpenAIModel, 
  createGeminiModel, 
  createDeepSeekModel,
  createGroqModel,
  createYourProviderModel 
} from './model-utils';

export function createLLM(config: LLMConfig): CoreLLM {
  logger.debug(
    LogCategory.LLM,
    'createLLM',
    'Creating LLM instance',
    {
      provider: config.provider,
      model: config.model
    }
  );

  // Create the appropriate model based on the provider
  let model;
  switch (config.provider) {
    case 'anthropic':
      model = createAnthropicModel(config);
      break;
    case 'openai':
      model = createOpenAIModel(config);
      break;
    case 'gemini':
      model = createGeminiModel(config);
      break;
    case 'deepseek':
      model = createDeepSeekModel(config);
      break;
    case 'groq':
      model = createGroqModel(config);
      break;
    case 'your-provider':
      model = createYourProviderModel(config);
      break;
    default:
      throw createError('llm', `Unsupported provider: ${config.provider}`, ErrorCode.LLM_EXECUTION);
  }

  // Create and return the CoreLLM instance
  return new CoreLLM({ model, config });
}
```

## Step 6: Update Exports

Update the exports in `src/llm/index.ts` to include your new provider:

```typescript
// Export your model creation function
export { 
  createAnthropicModel, 
  createOpenAIModel, 
  createGeminiModel,
  createDeepSeekModel,
  createGroqModel,
  createYourProviderModel 
} from './model-utils';
```

If needed, also update the main exports in `src/index.ts` to include any provider-specific types or classes that should be accessible to clients:

```typescript
//=============================================================================
// Provider-specific imports for re-export
//=============================================================================

/**
 * Re-export provider-specific classes and types
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GroqAPI } from '@ai-sdk/groq';
import { YourProviderClient } from 'your-provider-sdk'; // If needed
export { GoogleGenerativeAI, GroqAPI, YourProviderClient };
```

## Step 7: Message Format Compatibility

The AgentDock Core framework already provides utilities for converting between internal message formats and the AI SDK's format in `src/types/messages.ts`:

- `toAIMessage`: Converts from AgentDock's internal `Message` format to the AI SDK's `AIMessage` format
- `fromAIMessage`: Converts from AI SDK's `AIMessage` format to AgentDock's internal `Message` format

If your provider requires special message handling, you may need to update these functions or create provider-specific utilities.

## Step 8: Provider-Specific Features (Optional)

If your provider has specific features that aren't covered by the standard LLM interface, you can add them to the provider-specific configuration and handle them in the model creation function.

For example, if your provider supports a special "creativity" setting:

```typescript
// In types.ts
export interface YourProviderConfig extends LLMConfig {
  creativity?: number;
}

// In model-utils.ts
export function createYourProviderModel(config: LLMConfig): LanguageModel {
  const yourProviderConfig = config as YourProviderConfig;
  
  // Create model options
  const modelOptions: any = {};
  
  // Add provider-specific options
  if (yourProviderConfig.creativity !== undefined) {
    modelOptions.creativity = yourProviderConfig.creativity;
  }
  
  // Create and return the model with options
  return YourProvider({
    apiKey: config.apiKey
  }).LanguageModel({
    model: config.model,
    ...modelOptions
  });
}
```

## Step 9: Testing

Create tests for your new provider implementation in `src/llm/__tests__/your-provider.test.ts`:

```typescript
import { createLLM } from '../create-llm';
import { CoreLLM } from '../core-llm';

// Consider using Jest's mock system to avoid actual API calls
jest.mock('your-provider-sdk', () => {
  return {
    YourProviderClient: jest.fn().mockImplementation(() => {
      return {
        createCompletion: jest.fn().mockResolvedValue({
          text: 'Mock response'
        }),
        // Mock other methods
      };
    })
  };
});

describe('YourProvider integration', () => {
  it('creates a YourProvider LLM instance', () => {
    const llm = createLLM({
      provider: 'your-provider',
      apiKey: 'your-test-api-key',
      model: 'your-test-model'
    });
    
    expect(llm).toBeInstanceOf(CoreLLM);
    expect(llm.config.provider).toBe('your-provider');
  });
  
  it('generates text correctly', async () => {
    const llm = createLLM({
      provider: 'your-provider',
      apiKey: 'your-test-api-key',
      model: 'your-test-model'
    });
    
    const result = await llm.generateText({
      messages: [{ role: 'user', content: 'Hello' }]
    });
    
    expect(result.text).toBeDefined();
  });
  
  // Test streaming and other features
});
```

You should also manually test your provider with a real API key to ensure it works correctly with the actual service:

```typescript
const llm = createLLM({
  provider: 'your-provider',
  apiKey: process.env.YOUR_PROVIDER_API_KEY,
  model: 'your-provider-model',
  // Provider-specific options
  someProviderSpecificOption: true
});

// Test text generation
const result = await llm.generateText({
  messages: [{ role: 'user', content: 'Hello' }]
});

console.log(result.text);

// Test streaming
const stream = await llm.streamText({
  messages: [{ role: 'user', content: 'Tell me a story' }],
  onFinish: (text) => console.log('Finished:', text)
});

for await (const chunk of stream) {
  console.log('Chunk:', chunk.text);
}
```

## Embedding Support

When adding a new LLM provider, consider whether it supports embeddings for memory connections:

### **Providers with Embedding Support**
- ✅ **OpenAI** - `text-embedding-3-small`, `text-embedding-3-large` 
- ✅ **Google** - `text-embedding-004`
- ✅ **Mistral** - `mistral-embed` (when AI SDK package available)

### **Providers without Embedding Support**  
- ❌ **Anthropic, Groq, Cerebras, DeepSeek** - No embedding models available

### **Implementation Notes**
- Embedding support is **optional** - agents work perfectly without memory connections
- Missing embedding support gracefully disables memory connection features
- The LLM layer handles provider validation and throws clear error messages
- Update the provider list in `createEmbedding()` when new embedding providers are added

### **Adding Embedding Support**

If your provider supports embeddings, add it to `src/llm/create-embedding.ts`:

```typescript
export function createEmbedding(config: EmbeddingConfig): EmbeddingModel<string> {
  switch (config.provider) {
    case 'openai':
      // OpenAI implementation
      break;
    case 'google':
      // Google implementation
      break;
    case 'your-provider':
      if (!config.apiKey) {
        throw createError('llm', 'Your Provider API key is required for embeddings', ErrorCode.LLM_API_KEY);
      }
      
      const provider = createYourProvider({ apiKey: config.apiKey });
      return provider.embedding(config.model || 'your-embedding-model');
    
    case 'your-provider-without-embeddings':
      throw createError('llm', 'Your Provider does not currently support embeddings', ErrorCode.LLM_EXECUTION);
      
    default:
      throw createError('llm', `Provider ${config.provider} does not support embeddings`, ErrorCode.LLM_EXECUTION);
  }
}
```

## Conclusion

By following these steps, you can add a new LLM provider to the AgentDock Core framework. The unified implementation makes it easy to add new providers while maintaining a consistent interface for all LLM operations. 

The framework's architecture separates the AI SDK integration from client applications, allowing them to use a consistent interface regardless of the underlying provider. This design makes it easy to switch providers or update the AI SDK version without changing client code.

When implementing a new provider, focus on:

1. **Compatibility**: Ensure your implementation aligns with the existing message and model interfaces
2. **Error handling**: Implement proper error handling and validation
3. **Performance**: Consider caching and efficiency in your implementation
4. **Testing**: Create comprehensive tests for your provider

## Tool Integration

The AgentDock Core framework provides a mechanism for tools to access the agent's LLM instance. This allows tools to leverage the LLM capabilities without having to create their own LLM instances.

When an agent calls a tool, it passes its LLM instance via the `options.llmContext` parameter. Tools can check for this parameter and use it if available.

Key best practices for tool integration:

1. **Always check if LLM is available**: Use `if (options.llmContext?.llm)` to check if the LLM instance is available.
2. **Implement fallbacks**: Always have a fallback mechanism in case the LLM is not available or encounters an error.
3. **Use proper error handling**: Wrap LLM calls in try/catch blocks to handle errors gracefully.
4. **Keep messages focused**: Create clear system and user messages that focus on the specific task.
5. **Use appropriate temperature**: Set the temperature based on the task requirements (lower for factual tasks, higher for creative tasks). 