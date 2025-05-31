# Cerebras Provider Integration

## Configuration

### Environment Variables
- `CEREBRAS_API_KEY`: Your Cerebras API key (required, format: `csk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
- `CEREBRAS_API_URL`: Custom API endpoint URL (optional, defaults to "https://api.cerebras.ai/v1")

### Provider Configuration
```typescript
{
  provider: "cerebras",
  model: "llama-3.3-70b",
  apiKey: process.env.CEREBRAS_API_KEY,
  // Optional configuration
  temperature: 0.7,
  maxTokens: 2048,
  apiEndpoint: process.env.CEREBRAS_API_URL
}
```

## API Endpoints

### Base Configuration
- Base URL: `https://api.cerebras.ai/v1`
- Models endpoint: `/models`
- Chat completion endpoint: `/chat/completions`

### Error Codes
- `INVALID_API_KEY`: Invalid or missing API key
- `API_ERROR`: Issues with the Cerebras API (rate limits, server errors)
- `MODEL_ERROR`: Issues with model availability or configuration

## Available Models

The provider supports the following models:

| Model | Context Window | Capabilities |
|-------|---------------|--------------|
| `llama3.1-8b` | 8192 | text-generation, chat, completion |
| `llama-3.3-70b` | 16384 | text-generation, chat, completion |
| `llama-4-scout-17b-16e-instruct` | 32768 | text-generation, chat, completion, instruction-following |

Each model supports:
- Text generation
- Chat completions
- Context window management
- Temperature control
- Token limit configuration

## Usage Examples

### Basic Usage
```typescript
import { createCerebrasModel } from '../model-utils';

const model = createCerebrasModel({
  provider: 'cerebras',
  apiKey: process.env.CEREBRAS_API_KEY,
  model: 'llama3.1-8b'
});
```

### Advanced Configuration
```typescript
const model = createCerebrasModel({
  provider: 'cerebras',
  apiKey: process.env.CEREBRAS_API_KEY,
  model: 'llama-3.3-70b',
  temperature: 0.8,
  maxTokens: 4096,
  topP: 0.9,
  frequencyPenalty: 0.5,
  presencePenalty: 0.5
});
```

## Testing

### Unit Tests
```typescript
import { validateCerebrasApiKey, fetchCerebrasModels } from './providers/cerebras-adapter';

describe('Cerebras Provider', () => {
  const apiKey = process.env.CEREBRAS_API_KEY;

  it('should validate API key', async () => {
    const isValid = await validateCerebrasApiKey(apiKey);
    expect(isValid).toBe(true);
  });

  it('should fetch available models', async () => {
    const models = await fetchCerebrasModels(apiKey);
    expect(models).toHaveLength(3);
    expect(models[0].id).toBe('llama3.1-8b');
    expect(models[0].capabilities).toContain('text-generation');
  });
});
```

## Error Handling

### Common Errors
1. Invalid API Key
```typescript
try {
  await model.chat({ messages: [{ role: "user", content: "Hello" }] });
} catch (error) {
  if (error.code === 'INVALID_API_KEY') {
    console.error('Please check your API key configuration');
  }
}
```

2. Rate Limiting
```typescript
try {
  await model.chat({ messages: [{ role: "user", content: "Hello" }] });
} catch (error) {
  if (error.code === 'API_ERROR' && error.status === 429) {
    console.error('Rate limit exceeded. Please try again later.');
  }
}
```

## Best Practices

1. **API Key Management**
   - Store API keys in environment variables
   - Rotate keys regularly
   - Use different keys for development and production
   - API keys are validated through direct API calls
   - Keep your API key secure and never commit it to version control

2. **Error Handling**
   - Implement proper error handling for all API calls
   - Add retry logic for transient errors
   - Log errors appropriately
   - Check for API key validity before making requests
   - Handle rate limiting appropriately

3. **Model Selection**
   - Choose models based on your context window needs
   - Consider token usage and costs
   - Test models with your specific use case
   - Monitor token usage
   - Check network connectivity
   - Verify request payload size

4. **Security**
   - Never expose API keys in client-side code
   - Use HTTPS for all API calls
   - Implement proper authentication

## Troubleshooting

Common issues and solutions:

1. **API Key Issues**
   - Verify the API key is valid and active
   - Check for any rate limiting
   - Ensure the key has proper permissions

2. **Model Access**
   - Verify the model is available in your region
   - Check if the model is currently operational
   - Ensure your account has access to the model

3. **Performance Issues**
   - Monitor token usage
   - Check network connectivity
   - Verify request payload size

## Support

For issues with the Cerebras provider:
1. Check the [Cerebras API Documentation](https://docs.cerebras.ai)
2. Review error logs for specific issues
3. Contact Cerebras support for API-specific issues

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License
