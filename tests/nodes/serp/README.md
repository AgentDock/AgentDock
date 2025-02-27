# SERP Node Tests

This directory contains tests for the SERP Node and FirecrawlAdapter implementation.

## Test Files

- `firecrawl-adapter.test.ts`: Unit tests for the FirecrawlAdapter
- `serp-node.test.ts`: Unit tests for the SerpNode
- `integration.test.ts`: Integration tests for the SerpNode and FirecrawlAdapter

## Running Tests

To run all tests in this directory:

```bash
pnpm test tests/nodes/serp/
```

To run a specific test file:

```bash
pnpm test tests/nodes/serp/firecrawl-adapter.test.ts
pnpm test tests/nodes/serp/serp-node.test.ts
pnpm test tests/nodes/serp/integration.test.ts
```

## Test Coverage

The tests cover the following functionality:

### FirecrawlAdapter Tests
- Constructor validation
- Configuration validation
- API key validation
- Search functionality
- Error handling
- Rate limiting
- Caching

### SerpNode Tests
- Initialization
- Execution with different input types
- Error handling
- Cleanup
- Provider configuration

### Integration Tests
- End-to-end search flow
- Search with options
- Error handling and recovery
- Caching
- Performance considerations

## Notes

- The rate limit test in `performance.test.ts` is currently skipped due to timing issues.
- The retry test in `performance.test.ts` is also skipped due to inconsistent behavior in the number of fetch calls.
- All tests use mocked API responses to avoid making actual API calls.
- The integration tests verify the end-to-end flow of the SerpNode with the FirecrawlAdapter. 