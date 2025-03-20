# Message Persistence in AI Chat Applications

This document outlines approaches to implementing message persistence in AI chat applications and provides a roadmap for future implementations in the AgentDock framework.

## Current Implementation

AgentDock currently uses a client-side persistence approach with localStorage:

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

## Future Roadmap: Server-Side Persistence

The AI SDK provides a server-focused approach to message persistence that we can adopt:

### Client-side Implementation
```typescript
// UI component
const { input, handleInputChange, handleSubmit, messages } = useChat({
  id, // chat ID
  initialMessages, // loaded from server
});

// Optional: only send the last message to reduce payload
useChat({
  // ...
  experimental_prepareRequestBody({ messages, id }) {
    return { message: messages[messages.length - 1], id };
  },
});
```

### Server-side Implementation
```typescript
// API route
export async function POST(req: Request) {
  const { messages, id } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
    async onFinish({ response }) {
      // Save to database/storage
      await saveChat({
        id,
        messages: appendResponseMessages({
          messages,
          responseMessages: response.messages,
        }),
      });
    },
  });

  // Handle client disconnects
  result.consumeStream(); // no await

  return result.toDataStreamResponse();
}
```

### Advantages
- Cross-device synchronization
- Resilient against client disconnects
- Server-side storage can be more reliable and scalable
- Clear separation of concerns
- Built-in handling for various edge cases

## Best Practices for Message Persistence

1. **Strategic Save Points**
   - Save after message completion (onFinish)
   - Save before navigation/tab close
   - Avoid saving during streaming

2. **Proper Error Handling**
   - Handle storage failures gracefully
   - Provide retry mechanisms
   - Inform users of persistence status

3. **Tool Results Handling**
   - Ensure proper JSON serialization of tool results
   - Wait for completion before saving
   - Consider specialized storage for binary data (e.g., images)

4. **Disconnection Handling**
   - Implement reconnection logic with history loading
   - Use `consumeStream()` to ensure completion regardless of client connection

## Recommended Hybrid Approach for AgentDock

For the AgentDock framework, we recommend a hybrid approach that combines the benefits of both methods:

1. **Create a Storage Abstraction in agentdock-core:**
   ```typescript
   // In agentdock-core
   export class MessageStorage {
     constructor(options: StorageOptions) {
       // Initialize with configurable backend
     }
     
     async saveMessages(chatId: string, messages: Message[]): Promise<void> {
       // Implementation varies by backend
     }
     
     async loadMessages(chatId: string): Promise<Message[]> {
       // Implementation varies by backend
     }
     
     // Additional methods as needed
   }
   ```

2. **Support Multiple Storage Backends:**
   - localStorage for simple use cases
   - IndexedDB for larger client-side storage
   - Server database for multi-device support
   - Hybrid approaches for offline-capable applications

3. **Implement Proper Save Points:**
   - On message completion (onFinish)
   - Before navigation/tab close
   - After user interactions (not during streaming)
   - With proper debouncing and batching

4. **Handle Edge Cases:**
   - Client disconnections
   - Storage quota exceeded
   - Conflict resolution for concurrent edits

## Implementation Example

```typescript
// In your component
import { MessageStorage } from 'agentdock-core';

const storage = useMemo(() => new MessageStorage({
  backend: 'localStorage', // or 'server', 'indexedDB', etc.
  prefix: 'chat-'
}), []);

const {
  messages,
  // ... other state
} = useChat({
  id: agentId,
  initialMessages: await storage.loadMessages(agentId),
  onFinish: async (message) => {
    await storage.saveMessages(agentId, messages);
    // Other completion logic
  },
});

// Optional backup save for navigation away
useEffect(() => {
  const handleBeforeUnload = () => {
    if (messages.length > 0) {
      storage.saveMessages(agentId, messages);
    }
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [agentId, messages]);
```

## Conclusion

Message persistence is critical for AI chat applications. By adopting the approaches outlined in this document, AgentDock will provide reliable message persistence across different environments and use cases.

The storage abstraction in agentdock-core will allow for flexible backend configuration while maintaining a consistent API for application developers. This approach balances the simplicity of client-side storage with the capabilities of server-side persistence.

We welcome community contributions to improve the message persistence system in AgentDock! 