# DeepResearchNode Tests

This directory contains tests for the `DeepResearchNode` implementation, which provides advanced research capabilities by combining web search functionality with LLM-powered summarization.

## Test Files

- **deep-research-node.test.ts**: Unit tests for the `DeepResearchNode` class, testing initialization, execution, error handling, and cleanup.
- **integration.test.ts**: Integration tests for the `DeepResearchNode` with `SerpNode` and LLM, testing end-to-end research flow.
- **types.test.ts**: Type validation tests for the `DeepResearchNode` types and schemas.

## Running Tests

To run all tests for the `DeepResearchNode`:

```bash
pnpm test tests/nodes/deep-research/
```

To run a specific test file:

```bash
pnpm test tests/nodes/deep-research/deep-research-node.test.ts
```

## Test Coverage

The tests cover the following aspects of the `DeepResearchNode`:

### Unit Tests

- Initialization and configuration validation
- Node creation and dependency injection
- Query execution with various input formats
- Error handling and retry logic
- LLM response parsing
- Resource cleanup
- Metadata properties

### Integration Tests

- End-to-end research flow
- Option handling and parameter passing
- Error recovery and retries
- Empty result handling
- Performance considerations

### Type Tests

- Configuration schema validation
- Research options validation
- Query format validation
- Result structure validation
- Type inference from schemas

## Mocking Strategy

The tests use Jest's mocking capabilities to isolate the `DeepResearchNode` from its dependencies:

- `NodeRegistry` is mocked to return controlled instances of `SerpNode` and LLM nodes
- `SerpNode` and LLM node execution is mocked to return predefined results
- Error scenarios are simulated by rejecting promises

## Test Data

The tests use a variety of test data to simulate different scenarios:

- Valid and invalid configurations
- Different query formats
- Various search results
- Different LLM responses
- Error conditions

## Adding New Tests

When adding new tests, follow these guidelines:

1. Place unit tests in `deep-research-node.test.ts`
2. Place integration tests in `integration.test.ts`
3. Place type validation tests in `types.test.ts`
4. Use descriptive test names that explain what is being tested
5. Mock dependencies appropriately to isolate the test subject
6. Clean up resources in `afterEach` or `afterAll` blocks if necessary 