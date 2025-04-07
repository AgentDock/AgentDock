# AgentDock Core Error Handling

This document describes the error handling architecture in the agentdock-core library.

## Error Categories

AgentDock Core defines standard error categories that help organize and handle errors consistently:

- **API Errors** - Issues with provider API communication
- **Authentication Errors** - Problems with API keys or credentials
- **Validation Errors** - Invalid inputs or parameters
- **Resource Errors** - Issues with resource availability or limitations
- **System Errors** - Internal failures within the core library

## Core Error Classes

The library provides a set of standardized error classes:

```typescript
// Example of the error types (conceptual, not actual implementation)
class AgentError extends Error { /* Base error class */ }
class APIError extends AgentError { /* API-related errors */ }
class ValidationError extends AgentError { /* Input validation errors */ }
```

## Provider Error Handling

A key feature of agentdock-core is consistent error handling across different LLM providers:

1. **Provider Pattern Detection**
   - Each provider returns errors in different formats
   - Core library maps these to standardized patterns
   - Pattern detection uses string matching and error codes

2. **Error Normalization**
   - All provider errors are normalized to a consistent format
   - Error messages are made user-friendly
   - Status codes and error types are standardized

3. **Error Context Preservation**
   - Original error details are preserved when needed for debugging
   - Error stack traces are maintained
   - Provider-specific details are available when required

## Error Response Format

Normalized errors follow this structure:

```typescript
{
  error: string;        // Human-readable error message
  code: string;         // Standard error code (e.g., "LLM_API_KEY_ERROR")
  status: number;       // HTTP status code equivalent
  provider?: string;    // Provider that generated the error (if applicable)
  details?: unknown;    // Additional error details (if available)
}
```

## Using Error Handling in Applications

Applications that use agentdock-core can leverage this error system:

1. **Detecting Error Types**
   ```typescript
   try {
     // Use agentdock-core functionality
   } catch (error) {
     if (error instanceof APIError && error.code === "LLM_API_KEY_ERROR") {
       // Handle API key errors
     }
   }
   ```

2. **Error Events**
   - The library emits error events that applications can listen to
   - Provides hooks for logging, monitoring, and user feedback

## Logging Integration

Error handling is integrated with the core logging system:

1. Errors are automatically logged at appropriate levels
2. Sensitive information in errors is automatically redacted
3. Contextual information is included with error logs