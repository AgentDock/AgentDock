# AgentDock Store

This directory contains the core state management implementation for AgentDock, built with Zustand. It provides a type-safe, lightweight state management solution for managing agents and their runtime settings.

## Features

- Type-safe state management with TypeScript
- Persistent settings using SecureStorage
- Efficient agent lifecycle management
- Automatic template loading from generated templates

## Structure

- `index.ts` - Main store implementation using Zustand
- `hooks.ts` - Custom hooks for accessing store slices
- `types.ts` - TypeScript types and interfaces

## Usage

```tsx
import { useAgents } from '@/lib/store';

function MyComponent() {
  const { agents } = useAgents();
  // Or with the hooks API
  const agents = useAgents();
  const { isInitialized, initialize } = useAppState();
  
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  return (
    <div>
      {agents.map(agent => (
        <div key={agent.id}>
          {agent.name}
        </div>
      ))}
    </div>
  );
}
```

## State Structure

The store manages:
- List of agents
- Initialization state
- Template validation status
- Agent runtime settings (temperature, max tokens, etc.)

## Key Functions

- `initialize()` - Load and validate agent templates
- `updateAgentRuntime()` - Update runtime settings for an agent
- `reset()` - Reset the store state

## Agent Templates

Agent templates are loaded from the generated templates:
```
/generated/templates.ts
```

Each template defines:
- Agent name, ID, and description
- Personality configuration
- Node configurations and model settings
- Tools and chat settings 