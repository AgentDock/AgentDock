# Cerebras Insight

A demonstration agent showcasing the capabilities of Cerebras' optimized LLaMA 3.3 70B model, highlighting its performance in reasoning, inference speed, and long-context understanding.

## Configuration

### Environment Variables
- `CEREBRAS_API_KEY`: Your Cerebras API key (required, format: `csk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
- `SEARCH_API_KEY`: API key for up-to-date information (optional)

### Agent Configuration
```typescript
const cerebrasAgent = new CerebrasInsight({
  provider: "cerebras",
  model: "llama-3.3-70b",
  apiKey: process.env.CEREBRAS_API_KEY,
  // Optional configuration
  temperature: 0.6,
  maxTokens: 4096
});
```

## Features

### Core Capabilities
- Fast and efficient inference
- Deep reasoning capabilities
- Long-context understanding
- Technical performance analysis
- Benchmark comparisons
- Hardware optimization insights
- Real-time model evaluation
- Performance metrics analysis

### Model Capabilities
- Long-context processing (16384 tokens)
- Fast inference
- Consistent responses
- Deep reasoning
- Technical accuracy
- Benchmark performance
- Resource efficiency
- Scalability

## Usage Examples

### Basic Usage
```typescript
// Initialize the agent
const cerebrasAgent = new CerebrasInsight({
  provider: "cerebras",
  model: "llama-3.3-70b",
  apiKey: process.env.CEREBRAS_API_KEY
});

// Example: Deep reasoning
const reasoning = await cerebrasAgent.analyzeReasoning(
  "Solve this multi-step reasoning problem..."
);

// Example: Performance analysis
const performance = await cerebrasAgent.analyzePerformance(
  "Compare inference speed with other providers"
);

// Example: Technical capabilities
const capabilities = await cerebrasAgent.evaluateCapabilities(
  "What are the technical advantages of Cerebras' implementation?"
);
```

## Best Practices

1. **Performance Testing**
   - Benchmark comparison
   - Speed evaluation
   - Resource analysis
   - Scalability testing

2. **Capability Assessment**
   - Reasoning depth
   - Context handling
   - Response quality
   - Technical accuracy

3. **Integration Testing**
   - API compatibility
   - System requirements
   - Resource needs
   - Performance tuning

## Error Handling

### Common Errors
1. Invalid API Key
```typescript
try {
  await cerebrasAgent.analyzeReasoning("Example problem");
} catch (error) {
  if (error.code === 'INVALID_API_KEY') {
    console.error('Please check your API key configuration');
  }
}
```

2. Rate Limiting
```typescript
try {
  await cerebrasAgent.analyzePerformance("Example analysis");
} catch (error) {
  if (error.code === 'API_ERROR' && error.status === 429) {
    console.error('Rate limit exceeded. Please try again later.');
  }
}
```

## Troubleshooting

Common issues and solutions:

1. **API Key Issues**
   - Verify the API key is valid and active
   - Check for any rate limiting
   - Ensure the key has proper permissions

2. **Performance Issues**
   - Monitor token usage
   - Check network connectivity
   - Verify request payload size

3. **Model Access**
   - Verify the model is available in your region
   - Check if the model is currently operational
   - Ensure your account has access to the model

## Support

For issues with the Cerebras Insight agent:
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