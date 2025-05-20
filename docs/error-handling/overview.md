# Error Handling in AgentDock

This document outlines our approach to error handling in the AgentDock application using React ErrorBoundary components and specialized error handlers.

## Core Components

### ErrorBoundary

We use a comprehensive ErrorBoundary component located at `src/components/error-boundary.tsx` that provides robust error handling throughout the application. This component:

1. Catches and handles errors in React component trees
2. Provides a consistent error UI experience throughout the application
3. Includes special handling for different error types (NetworkError, SecurityError, ValidationError, StorageError)
4. Shows detailed error information in development mode
5. Provides retry functionality to recover from errors when possible

### ChatErrorOverlay

For handling runtime errors in the chat interface, we use the `ChatErrorOverlay` component located at `src/components/chat/chat-error-overlay.tsx`. This component:

1. Displays user-friendly error messages for chat-specific errors
2. Categorizes errors according to our standard error types (Security, Network, Validation, Storage)
3. Provides appropriate recovery actions based on error type
4. Integrates with the core error handling architecture

## Vercel AI SDK Integration

We integrate with Vercel AI SDK's error handling system to ensure proper error propagation from LLM providers to the UI:

### Agent Adapter Error Handling

The agent adapter in `src/lib/agent-adapter.ts` enhances the stream result to properly handle errors:

```typescript
// In agent-adapter.ts
const enhancedResult = {
  ...result,
  toDataStreamResponse(options = {}) {
    return result.toDataStreamResponse({
      ...options,
      getErrorMessage: (error: unknown) => {
        // Extract streaming error message
        if (error && typeof error === 'object' && '_hasStreamingError' in error) {
          const streamError = error as any;
          if (streamError._streamingErrorMessage) {
            return streamError._streamingErrorMessage;
          }
        }

        // Standard error handling
        if (error instanceof Error) {
          return error.message;
        }

        return typeof error === 'string' ? error : 'Unknown error occurred';
      },
    });
  },
};
```

This approach:

1. Uses Vercel's recommended `getErrorMessage` pattern
2. Extracts detailed error information from CoreLLM
3. Ensures consistent error display in the UI

### Error Flow Architecture

Our error handling follows a layered architecture:

1. **CoreLLM** - Detects streaming errors and sets error flags
2. **Agent Adapter** - Converts errors to Vercel AI SDK format
3. **API Route** - Passes enhanced results without modification
4. **Client Components** - Displays user-friendly error messages

See the detailed documentation in [LLM Error Handling](./llm-error-handling.md).

## Error Categories

All errors in AgentDock are categorized into these standard types:

| Category   | Description                          | Examples                                |
| ---------- | ------------------------------------ | --------------------------------------- |
| Security   | Permission and authentication issues | Missing API keys, invalid credentials   |
| Network    | API and connectivity problems        | Rate limits, service unavailable        |
| Validation | Input validation failures            | Invalid inputs, context window exceeded |
| Storage    | Local storage access issues          | Failed to access secure storage         |
| Unknown    | Fallback for other errors            | Unexpected exceptions                   |
| LLM        | Model-specific errors                | Quota exceeded, model unavailable       |

## Using the ErrorBoundary

When implementing new features that need error handling:

```tsx
import { ErrorBoundary } from "@/components/error-boundary";

// Basic usage
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>

// With custom fallback UI
<ErrorBoundary
  fallback={<YourCustomErrorComponent />}
>
  <YourComponent />
</ErrorBoundary>

// With error callback
<ErrorBoundary
  onError={(error, errorInfo) => {
    // Log or handle the error
    console.error("Component error:", error);
  }}
  resetOnPropsChange={true}
>
  <YourComponent />
</ErrorBoundary>
```

## Using the ChatErrorOverlay

For handling API errors in chat interfaces:

```tsx
import { ChatErrorOverlay } from '@/components/chat/chat-error-overlay';

// Basic usage within chat components
<ChatErrorOverlay error={error} onRetry={handleRetry} onDismiss={clearError} open={!!error} />;
```

## Best Practices

1. Wrap top-level feature components with ErrorBoundary
2. Use specific error types when throwing errors to enable specialized handling
3. Consider using resetOnPropsChange for components that should retry on prop changes
4. Provide meaningful error messages to help users understand what went wrong
5. Use ChatErrorOverlay for runtime API errors in chat interfaces
6. Follow the established error categories when classifying errors
7. Ensure all error messages are user-friendly and actionable
8. Use Vercel AI SDK's error handling pattern for LLM errors
9. Keep error handling logic in the appropriate layer (adapter, not API route)

## Specialized Error Handling

The ErrorBoundary component provides specialized handling for different types of errors:

### Network Errors

- Displays connectivity-related information
- Provides reload options
- Shows troubleshooting tips

### Security Errors

- Handles permission-related issues
- Provides clear guidance on fixing permissions

### Validation Errors

- Shows detailed information about data validation failures
- Provides guidance on fixing input data

### Storage Errors

- Handles issues with browser storage
- Suggests clearing cache or using a different browser

### LLM Errors

- Shows detailed information from the LLM provider
- Differentiates between quota issues, rate limits, and other errors
- Provides relevant recovery actions

## API Error Handling

For API errors, particularly in chat interfaces:

1. Backend uses a normalized error system (`parseProviderError` and `normalizeError` functions)
2. Chat components display errors using the ChatErrorOverlay
3. Errors are categorized and displayed with appropriate actions
4. Streaming errors are handled through the Vercel AI SDK framework
5. Development mode shows additional error details for debugging

## Future Roadmap

### 1. Error Tracking and Analytics

- Implement integration with error tracking services
- Add anonymous error reporting to improve the application
- Create an error dashboard for administrators

### 2. Enhanced Recovery Strategies

- Implement more sophisticated retry mechanisms
- Add circuit breaker patterns for external services
- Provide user-controlled recovery options

### 3. Context-Aware Error Boundaries

- Create specialized error boundaries for different parts of the application
- Implement context-aware error handling based on component type
- Add custom recovery strategies for specific errors
