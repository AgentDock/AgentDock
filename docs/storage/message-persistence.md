# Message Persistence in AgentDock

This document outlines the current approach to message persistence in the AgentDock reference implementation.

## Current Implementation

The current implementation uses a client-side persistence approach with browser localStorage:

```typescript
// Inside a React component using useChat from AI SDK
const {
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  // ... other hooks
} = useChat({
  id: agentId,
  api: `/api/chat/${agentId}`,
  initialMessages: loadSavedMessages(), // Load from storage
  onFinish: async (message) => {
    // Save completed message to storage
    localStorage.setItem(`chat-${agentId}`, JSON.stringify(messages));

    // Update tracking reference
    prevMessageLengthRef.current = messages.length;
  },
  // ... other options
});

// Additional effect to handle saves outside of completion
React.useEffect(() => {
  // Skip if no agent or no messages
  if (!agentId || messages.length === 0) return;

  // Only save if message length changed and not currently streaming
  if (messages.length !== prevMessageLengthRef.current && !isLoading) {
    localStorage.setItem(`chat-${agentId}`, JSON.stringify(messages));
    prevMessageLengthRef.current = messages.length;
  }
}, [agentId, messages, isLoading]);
```

### Advantages

- Simple implementation with direct control
- Works without server infrastructure
- Provides offline support
- Low latency (no network requests)
- Easy to debug with browser devtools

### Limitations

- Limited to browser localStorage (size limits, browser-specific)
- No cross-device synchronization
- Limited to client-side storage

## Future Considerations

Future versions of AgentDock may implement server-side persistence for more robust message storage, but this is not currently implemented.

## Best Practices for Current Implementation

1. **Strategic Save Points**

   - Save after message completion (onFinish)
   - Save before navigation/tab close
   - Avoid saving during streaming

2. **Proper Error Handling**

   - Handle storage quota exceeded errors
   - Provide fallbacks when localStorage is not available
   - Consider clearing old messages when approaching quota limits

3. **Disconnection Handling**
   - Implement basic reconnection logic
   - Consider local backup strategies
