# Memory Connection System Introduction

## Overview

Most AI systems store information in isolation. AgentDock's memory connection system automatically discovers relationships between memories, enabling agents to understand context and provide more relevant responses.

**Status:** Production-ready implementation

## Connection Types

AgentDock implements five connection types based on cognitive science research:

### Similar Connections
Memories with related semantic content.
```
User: "I need to cook dinner" 
Agent: "You mentioned that pasta recipe last week, and you have Italian herbs."
```

### Causal Connections  
Cause-and-effect relationships between events.
```
User: "My code isn't working"
Agent: "Last time this error occurred, it was due to a dependency conflict."
```

### Hierarchical Connections
Component and part-of relationships.
```
User: "Working on the login system"
Agent: "That's part of your authentication project. Here's the related documentation."
```

### Opposing Connections
Contradictory or conflicting information.
```
User: "I prefer dark mode"
Agent: "Previously you mentioned preferring light mode. Has this changed?"
```

### Related Connections
General associations between topics.
```
User: "Tell me about React"
Agent: "You've been learning JavaScript and mentioned building web applications."
```

## How It Works

The system uses a cost-optimized approach:

1. **Automatic Classification:** Most connections (65%) are identified through similarity analysis without AI costs
2. **AI Analysis:** Complex relationships use AI to determine specific connection types
3. **Smart Storage:** Connections are stored with confidence scores for future retrieval

## Configuration

### Enable (Default)
```typescript
const memory = await createMemorySystem();
// Connections enabled automatically
```

### Disable
```typescript
const memory = await createMemorySystem({
  overrides: {
    intelligence: {
      connectionDetection: { enabled: false }
    }
  }
});
```

### Environment Variables
```bash
CONNECTION_ALWAYS_ADVANCED=true    # Use high-quality models
CONNECTION_MODEL=gpt-4o             # Specify model
```

## Benefits

- **Contextual Responses:** Agents understand relationships between user information
- **Pattern Recognition:** System learns user preferences and workflows over time  
- **Efficient Discovery:** Finds relevant information across conversation history
- **Cost Optimization:** 65% of connections require no AI processing

## Technical Details

For comprehensive implementation details, configuration options, and performance characteristics, see:
- [Memory Connections Technical Guide](./memory-connections.md)
- [Graph Architecture Documentation](./graph-architecture.md)
- [Complete Configuration Guide](./complete-configuration-guide.md)