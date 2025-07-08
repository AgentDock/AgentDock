# Testing the Memory Connection System

## Overview

The Memory Connection System uses a multi-layered testing approach:

1. **Unit Tests** - Test individual components with mocks
2. **Integration Tests** - Test system behavior without external APIs
3. **E2E Tests** - Test real API interactions and cost optimization

## Running Tests

### Unit/Integration Tests (No API Required)
```bash
# Run all connection tests
npm test -- --testPathPattern=connection

# Run specific test suites
npm test -- connection-graph.test.ts
npm test -- connection-recall.test.ts
```

### E2E Tests (API Key Required)
```bash
# Set up environment
export OPENAI_API_KEY=sk-...
# OR
export ANTHROPIC_API_KEY=sk-ant-...

# Enable and run E2E tests
CONNECTION_E2E_TEST=true npm test -- connection-system.e2e
```

## What the Tests Validate

### Mock Tests (Always Run)
- ✅ Smart triage algorithm works correctly
- ✅ Auto-classification at correct thresholds (0.8, 0.6)
- ✅ Connection graph traversal and analysis
- ✅ Memory clustering and path finding
- ✅ Edge cases (circular refs, isolated nodes)

### E2E Tests (Optional)
- ✅ Real LLM classification into 5 types
- ✅ Actual embedding similarity calculations
- ✅ Cost tracking and optimization
- ✅ Environment variable overrides
- ✅ All 5 connection types can be detected

## Model Configuration

### Recommended Setup for Testing

```bash
# Use small models for cost-effective testing
CONNECTION_PROVIDER=openai
CONNECTION_MODEL=gpt-4o-mini        # $0.15/1M tokens
# CONNECTION_MODEL=gpt-3.5-turbo    # Even cheaper option

# For Anthropic
CONNECTION_PROVIDER=anthropic
CONNECTION_MODEL=claude-3-haiku-20240307  # $0.25/1M tokens
```

### Production Setup

```bash
# Standard configuration (65% auto-classified, 35% use LLM)
CONNECTION_MODEL=gpt-4o-mini              # Efficient model
CONNECTION_ENHANCED_MODEL=gpt-4o          # Quality upgrade

# Aggressive cost savings (less LLM usage)
CONNECTION_AUTO_SIMILAR=0.75              # More auto-classified
CONNECTION_AUTO_RELATED=0.55              # Lower bar
CONNECTION_LLM_REQUIRED=0.25              # Fewer LLM calls
```

## Cost Analysis

With default thresholds:
- 40% connections: FREE (similarity > 0.8)
- 25% connections: FREE (similarity > 0.6)
- 35% connections: ~$0.00015 each (using gpt-4o-mini)

Example costs for 1000 memories:
- Connections found: ~500 (average 0.5 per memory)
- LLM calls: ~175 (35% of 500)
- Total cost: ~$0.026 (2.6 cents)

## Debugging Connection Issues

### Check Thresholds
```typescript
// Add logging to see classification decisions
console.log('Similarity:', embeddingSimilarity);
console.log('Thresholds:', thresholds);
console.log('Classification:', embeddingSimilarity >= thresholds.autoSimilar ? 'auto-similar' : 
                             embeddingSimilarity >= thresholds.autoRelated ? 'auto-related' : 
                             embeddingSimilarity >= thresholds.llmRequired ? 'llm-needed' : 'skip');
```

### Monitor Costs
```typescript
const costs = await costTracker.getCostAnalytics(agentId);
console.log('Connection costs:', {
  total: costs.totalCost,
  llmCalls: costs.extractionStats.byType['connection-classification'],
  avgCostPerCall: costs.totalCost / costs.extractionStats.totalExtractions
});
```

## Best Practices

1. **Development**: Use mock tests only (no API costs)
2. **Staging**: Run E2E tests with small models
3. **Production**: Monitor actual cost/performance metrics
4. **Optimization**: Adjust thresholds based on your data

## Troubleshooting

### "No connections found"
- Check if embeddings are working (need API key)
- Lower similarity threshold in config
- Verify memories have related content

### "Too many LLM calls"
- Increase `autoSimilar` threshold (e.g., 0.75)
- Decrease `llmRequired` threshold (e.g., 0.35)
- Use smaller `maxCandidates` value

### "Wrong connection types"
- LLM prompt may need adjustment for your domain
- Consider using enhanced model for better accuracy
- Add more specific examples to the prompt