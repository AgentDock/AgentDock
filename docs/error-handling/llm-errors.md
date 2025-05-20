# LLM Error Handling

How we handle errors from LLM providers and present them to users.

## Overview

Our error handling system captures and normalizes errors across all LLM providers, converting technical API errors into clear, actionable messages.

## Error Flow Architecture

Error handling follows this layered architecture:

### 1. CoreLLM (Detection Layer)

- Detects errors during streaming in `agentdock-core/src/llm/core-llm.ts`
- Sets error flags: `_hasStreamingError` and `_streamingErrorMessage`
- Adds metadata like error code to the stream result

### 2. Agent Adapter (Conversion Layer)

- Located in `src/lib/agent-adapter.ts`
- Enhances the stream result with Vercel AI SDK's error handling
- Provides `getErrorMessage` implementation to extract detailed errors from CoreLLM
- Properly formats errors for client-side presentation

### 3. API Route (Transport Layer)

- Simple pass-through of the already-enhanced results
- Handles non-streaming errors using standard error response formats

### 4. Client Components (Presentation Layer)

- Display user-friendly error messages from the error handling pipeline
- Provide appropriate actions based on error types

## Implementation Details

### CoreLLM Error Detection

```typescript
// In agentdock-core/src/llm/core-llm.ts
const enhancedResult: StreamTextResult<any, any> = {
  ...streamResult,
  _hasStreamingError: false,
  _streamingErrorMessage: '',

  // When streaming errors are detected
  if (part.type === 'error') {
    enhancedResult._hasStreamingError = true;
    enhancedResult._streamingErrorMessage = parsedError.message;
  }
};
```

### Agent Adapter Error Conversion

```typescript
// In src/lib/agent-adapter.ts
const enhancedResult = {
  ...result,
  toDataStreamResponse(options = {}) {
    return result.toDataStreamResponse({
      ...options,
      getErrorMessage: (error: unknown) => {
        // Extract streaming error message from CoreLLM
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

## Error Categories

Errors are categorized into these types:

| Category              | Description                 | Examples                                  |
| --------------------- | --------------------------- | ----------------------------------------- |
| API Key Errors        | Missing or invalid API keys | No API key provided, invalid key format   |
| Rate Limit Errors     | Provider throttling         | Too many requests, usage limits exceeded  |
| Context Window Errors | Input size limitations      | Message too long for model context window |
| Service Availability  | Provider downtime           | API service unavailable, maintenance      |
| Network Errors        | Connectivity issues         | Connection timeout, network failure       |
| Quota Errors          | Usage quotas exceeded       | "You exceeded your current quota"         |

## User Experience

When errors occur, users see:

1. **Clear error messages** - Technical details translated into understandable language
2. **Actionable guidance** - Instructions on how to resolve the issue
3. **Relevant options** - UI provides appropriate actions based on error type

### API Key Errors

For API key issues, the system:

- Clearly indicates that an API key is required
- Provides a direct link to settings where keys can be added
- Explains which environment variables are needed if applicable

### Rate Limit Errors

When rate limits are hit, users are:

- Informed that usage limits have been reached
- Advised to wait before making additional requests
- Provided retry options when appropriate

### Service and Network Errors

For connectivity issues:

- The system distinguishes between temporary and persistent problems
- Provides retry options for transient failures
- Offers troubleshooting guidance for persistent issues

## BYOK Mode Considerations

In Bring Your Own Keys (BYOK) mode:

- Error messages emphasize that users must provide their own API keys
- The system checks for API keys when the window regains focus
- Clear guidance directs users to the settings page for key management
