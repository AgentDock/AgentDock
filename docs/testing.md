# Testing Strategy

This document outlines the testing strategy for the AgentDock project, with a particular focus on the `agentdock-core` framework and its comprehensive unit testing approach.

## Core Principles

1. **Strict Dependency Isolation**: Each unit test must isolate the unit under test from its dependencies using mocks.
2. **Consistent Mocking Patterns**: Use standardized mocking approaches consistently across all tests.
3. **Reusable Test Helpers**: Leverage helper functions to create standardized mocks.
4. **Comprehensive Coverage**: Aim for high test coverage of core functionality.
5. **Clear Test Structure**: Organize tests logically with descriptive names.

## Mocking Strategy

### 1. Direct Dependencies

All direct dependencies of a unit under test MUST be mocked. This includes:

- Other core classes/components
- External clients/APIs
- Utility functions with side effects
- Storage providers

### 2. Mocking Techniques

#### Module Mocking

Use `jest.mock()` to mock entire modules:

```typescript
// Mock the entire logging module
jest.mock('../../logging', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  },
  LogCategory: {
    NODE: 'node'
  }
}));
```

#### Function Mocking

Use `jest.fn()` to create mock functions:

```typescript
const mockFunction = jest.fn().mockReturnValue('mocked result');
// or
const mockAsyncFunction = jest.fn().mockResolvedValue({ success: true });
```

#### Implementation Mocking

Use `mockImplementation()` to define complex mock behavior:

```typescript
const mockFunction = jest.fn().mockImplementation((arg1, arg2) => {
  if (arg1 === 'test') {
    return arg2 * 2;
  }
  return arg2;
});
```

#### Standard Mock Objects

Use the helper functions in `src/test/setup.ts` to create standardized mock objects:

```typescript
import { createMockCoreLLM, createMockOrchestrationManager } from '../../test/setup';

const mockLLM = createMockCoreLLM({
  provider: 'openai',
  modelId: 'gpt-4.1'
});

const mockOrchestrationManager = createMockOrchestrationManager();
```

### 3. Jest Configuration

The Jest configuration for `agentdock-core` is optimized for unit testing:

- Tests are run from the root project using the `jest.config.ts` configuration
- `clearMocks: true` ensures mocks are automatically cleared between tests
- Coverage reporting is enabled to track test coverage

## Test Structure

### File Organization

- Tests are located in `__tests__` directories adjacent to the code they test
- Test files are named with the `.test.ts` suffix
- Helper functions are in `src/test/setup.ts`

### Test Case Structure

```typescript
describe('ComponentName', () => {
  // Setup that applies to all tests
  beforeEach(() => {
    jest.clearAllMocks();
    // Initialize test objects
  });

  describe('methodName', () => {
    it('should handle scenario X', () => {
      // Arrange - set up test conditions
      // Act - call the method
      // Assert - verify the results
    });

    it('should handle error case Y', () => {
      // Test error handling
    });
  });
});
```

## Best Practices

1. **Reset Mocks Between Tests**: Use `jest.clearAllMocks()` in `beforeEach` to reset mocks
2. **Mock Minimal Surface Area**: Only mock what's necessary
3. **Verify Mock Interactions**: Check that mocks were called with expected arguments
4. **Test Edge Cases**: Include tests for error conditions and edge cases
5. **Descriptive Test Names**: Use clear, descriptive names for test cases
6. **Use Helper Functions**: Leverage the helper functions in `src/test/setup.ts` for creating consistent mocks

## Module-Specific Testing Guidelines

### Orchestration Module Testing

The orchestration module (`OrchestrationManager`, `OrchestrationStateManager`, `StepSequencer`) requires comprehensive testing of:

- State transitions and management
- Tool filtering and sequencing
- Conditional logic for step activation
- Error handling and edge cases

Use the `createMockOrchestrationManager()` helper function to create standardized mocks for orchestration components.

### Storage Module Testing

The storage module requires testing of:

- Interface compliance for all provider implementations
- CRUD operations and TTL functionality
- Provider-specific logic and error handling
- Factory instantiation and configuration

Use the `createMockStorageProvider()` helper function to create standardized mocks for storage components.

### Node System Testing

The core node system requires testing of:

- Node registration and retrieval
- Tool registration and filtering
- Metadata validation and port definitions
- Node instantiation and execution

Use the `createMockBaseNode()` helper function to create standardized mocks for node components.

## Helper Functions

The `src/test/setup.ts` file provides helper functions for creating standardized mocks:

- `createMockCoreLLM()`: Creates a mock CoreLLM instance with configurable behavior
- `createMockLLMOrchestrationService()`: Creates a mock LLMOrchestrationService instance
- `createMockOrchestrationManager()`: Creates a mock OrchestrationManager instance
- `createMockStorageProvider()`: Creates a mock StorageProvider instance
- `createMockBaseNode()`: Creates a mock BaseNode instance

These helper functions ensure consistent behavior across tests and facilitate strict dependency isolation.
