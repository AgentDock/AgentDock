# Response Streaming in AgentDock

AgentDock's response streaming system extends the Vercel AI SDK to provide enhanced functionality for orchestration, error handling, and state management.

## AgentDockStreamResult

The core of AgentDock's streaming capabilities is the `AgentDockStreamResult` interface, which extends Vercel AI SDK's `StreamTextResult`:

```typescript
export interface AgentDockStreamResult<T extends ToolSet = ToolSet, R = unknown>
  extends VercelStreamTextResult<T, R> {
  _orchestrationState?: {
    recentlyUsedTools?: string[];
    cumulativeTokenUsage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    [key: string]: unknown;
  } | null;

  _hasStreamingError?: boolean;
  _streamingErrorMessage?: string;
}
```

### Key Enhancements

1. **Orchestration State Tracking**

   - Maintains a record of recently used tools
   - Tracks cumulative token usage across multiple requests
   - Supports arbitrary state properties for extensibility

2. **Enhanced Error Handling**

   - Includes flags to indicate streaming errors
   - Preserves error messages for client-side handling
   - Overrides `toDataStreamResponse` to properly include error information

3. **Backward Compatibility**
   - Provides a type alias (`StreamTextResult`) for backward compatibility
   - Maintains the same streaming interface as Vercel AI SDK

## Integration with LLMOrchestrationService

The `AgentDockStreamResult` is primarily returned by the `LLMOrchestrationService.streamWithOrchestration` method, which:

1. Wraps the CoreLLM's `streamText` method
2. Injects orchestration-specific callbacks
3. Updates token usage in session state
4. Tracks tool usage for subsequent requests

## Usage in AgentNode

The `AgentNode` returns the `AgentDockStreamResult` from its `handleMessage` method, allowing:

1. Clients to consume the stream directly
2. Error handling at the adapter/route level
3. Access to orchestration state for complex flows

## Benefits

- **Enhanced Reliability**: Better error propagation and handling
- **Improved State Management**: Automatic tracking of tokens and tools
- **Seamless Integration**: Works with the existing Vercel AI SDK patterns

For more information about the AgentNode implementation, see [Agent Node Documentation](../agent-node.md).
