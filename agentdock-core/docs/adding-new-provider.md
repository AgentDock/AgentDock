# Adding a New LLM Provider

This guide explains how to add a new LLM provider to the AgentDock Core framework.

## Overview

AgentDock Core uses a unified LLM implementation that directly integrates with the Vercel AI SDK. Adding a new provider involves:

1. Adding provider-specific configuration types
2. Creating a model creation function
3. Updating the provider registry
4. Updating the `createLLM` function

## Step 1: Add Provider Configuration Types

First, add the provider-specific configuration types to `src/llm/types.ts`:

```typescript
// Add a new provider to the LLMProvider type
export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'your-provider';

// Add provider-specific configuration
export interface YourProviderConfig extends LLMConfig {
  // Add provider-specific properties here
  someProviderSpecificOption?: boolean;
}

// Update the ProviderConfig type
export type ProviderConfig = AnthropicConfig | OpenAIConfig | GeminiConfig | YourProviderConfig;
```

## Step 2: Create a Model Creation Function

Next, create a model creation function in `src/llm/model-utils.ts`:

```typescript
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
  
  // Create the provider
  // This assumes there's a Vercel AI SDK package for your provider
  // If not, you'll need to create a custom adapter
  const provider = createYourProvider({ 
    apiKey: config.apiKey
  });
  
  // Create model options
  const modelOptions: any = {};
  
  // Add provider-specific options if needed
  const yourProviderConfig = config as YourProviderConfig;
  if (yourProviderConfig.someProviderSpecificOption !== undefined) {
    modelOptions.someOption = yourProviderConfig.someProviderSpecificOption;
  }
  
  // Create and return the model with options
  return provider(config.model, modelOptions);
}
```

## Step 3: Update the Provider Registry

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
    validateApiKey: (key: string) => key.startsWith('your-prefix-') // Add proper validation logic
  }
};
```

## Step 4: Update the createLLM Function

Finally, update the `createLLM` function in `src/llm/create-llm.ts`:

```typescript
// Import your model creation function
import { createAnthropicModel, createOpenAIModel, createGeminiModel, createYourProviderModel } from './model-utils';

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
    case 'your-provider':
      model = createYourProviderModel(config);
      break;
    default:
      throw createError('llm', `Unsupported provider: ${config.provider}`, ErrorCode.LLM_PROVIDER);
  }

  // Create and return the CoreLLM instance
  return new CoreLLM({ model, config });
}
```

## Step 5: Export the Model Creation Function

Update the exports in `src/llm/index.ts`:

```typescript
// Export your model creation function
export { createAnthropicModel, createOpenAIModel, createGeminiModel, createYourProviderModel } from './model-utils';
```

## Step 6: Add Provider-Specific Features (Optional)

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
  return createYourProvider({
    apiKey: config.apiKey
  })(config.model, modelOptions);
}
```

## Step 7: Tool Integration

The AgentDock Core framework provides a mechanism for tools to access the agent's LLM instance. This allows tools to leverage the LLM capabilities without having to create their own LLM instances.

When an agent calls a tool, it passes its LLM instance via the `options.llmContext` parameter. Tools can check for this parameter and use it if available:

```typescript
// Example of a tool that uses the agent's LLM instance
import { CoreMessage } from 'ai';

export const myTool = {
  // ... tool definition ...
  
  async execute(params, options) {
    // Check if LLM context is available
    if (options.llmContext?.llm) {
      try {
        // Create messages for LLM
        const messages: CoreMessage[] = [
          {
            role: 'system',
            content: 'You are a helpful assistant that processes data for this tool.'
          },
          {
            role: 'user',
            content: `Process this data: ${JSON.stringify(params)}`
          }
        ];
        
        // Use the agent's LLM instance (which could be using your new provider)
        const result = await options.llmContext.llm.generateText({ 
          messages,
          temperature: 0.7 // You can set request-specific parameters
        });
        
        // Use the generated text
        return processResult(result.text);
      } catch (error) {
        // Handle errors gracefully
        logger.error('Error using LLM in tool:', error);
        // Fall back to non-LLM approach
        return fallbackProcessing(params);
      }
    } else {
      // LLM context not available, use fallback approach
      return fallbackProcessing(params);
    }
  }
};
```

Key best practices for tool integration:

1. **Always check if LLM is available**: Use `if (options.llmContext?.llm)` to check if the LLM instance is available.
2. **Implement fallbacks**: Always have a fallback mechanism in case the LLM is not available or encounters an error.
3. **Use proper error handling**: Wrap LLM calls in try/catch blocks to handle errors gracefully.
4. **Keep messages focused**: Create clear system and user messages that focus on the specific task.
5. **Use appropriate temperature**: Set the temperature based on the task requirements (lower for factual tasks, higher for creative tasks).

## Step 8: Testing

Make sure to test your new provider implementation:

```typescript
const llm = createLLM({
  provider: 'your-provider',
  apiKey: 'your-api-key',
  model: 'your-model',
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

## Conclusion

By following these steps, you can add a new LLM provider to the AgentDock Core framework. The unified implementation makes it easy to add new providers while maintaining a consistent interface for all LLM operations. 