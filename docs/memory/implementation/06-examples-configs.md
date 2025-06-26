# Memory System Examples & Configurations

**Status**: 📚 Example Configurations  
**Purpose**: Real-world memory configurations for different agent types  
**Phase**: 6 - Implementation Examples

**Cross-Reference**: [Advanced Memory](../../roadmap/advanced-memory.md) section 13

## Overview

This file provides complete memory system configurations for different agent types, showing how to customize decay rules, extraction rates, and connection patterns for specific use cases.

## Therapy/Mental Health Agent Configuration

```typescript
// agentdock-core/examples/therapy-agent-memory.ts

export const therapyAgentMemoryConfig: MemoryConfig = {
  // Conservative decay - keep memories longer
  decay: {
    decayRate: 0.02,               // Very slow decay
    minThreshold: 0.1,             // Keep more memories
    neverDecay: [],                // USER CONFIGURES - no defaults for liability
    episodicDecayDays: 7,          // Quick pattern recognition
    semanticDecayRate: 0.01,       // Keep facts longer
    proceduralDecayRate: 0.005     // Keep coping strategies
  },
  
  // Gentle extraction rate
  batchProcessing: {
    maxBatchSize: 10,              // Smaller batches
    timeoutMinutes: 5,             // Frequent processing
    minBatchSize: 3,               // Process sooner
    extractionRate: 0.30           // 30% of messages (higher for therapy)
  },
  
  // Prioritize emotional connections
  connections: {
    enableAutoConnections: true,
    connectionThreshold: 0.4,      // Lower threshold = more connections
    maxConnectionsPerMemory: 8,
    prioritizeEmotionalContext: true
  },
  
  // Memory type distribution
  typeDistribution: {
    working: 0.30,    // Active session context
    episodic: 0.40,   // Session events and interactions
    semantic: 0.20,   // Facts about the user's condition/goals
    procedural: 0.10  // Therapeutic techniques that work
  }
};

// Example usage
const therapyAgent = new MemoryProvider(therapyAgentMemoryConfig);
```

## Customer Support Agent Configuration

```typescript
// agentdock-core/examples/support-agent-memory.ts

export const supportAgentMemoryConfig: MemoryConfig = {
  // Faster decay - focus on recent issues
  decay: {
    decayRate: 0.08,               // Faster decay
    minThreshold: 0.2,             // More aggressive cleanup
    neverDecay: [],                // USER CONFIGURES - no hardcoded terms
    episodicDecayDays: 30,         // Monthly pattern analysis
    semanticDecayRate: 0.05,       // Moderate fact retention
    proceduralDecayRate: 0.02      // Keep solution patterns
  },
  
  // Efficient batch processing
  batchProcessing: {
    maxBatchSize: 20,              // Larger batches for efficiency
    timeoutMinutes: 10,            // Less frequent processing
    minBatchSize: 5,               // Wait for more context
    extractionRate: 0.15           // 15% of messages (lower for support)
  },
  
  // Solution-focused connections
  connections: {
    enableAutoConnections: true,
    connectionThreshold: 0.6,      // Higher threshold = fewer, better connections
    maxConnectionsPerMemory: 5,
    prioritizeProblemSolution: true
  },
  
  // Memory type distribution
  typeDistribution: {
    working: 0.20,    // Current ticket context
    episodic: 0.30,   // Support interactions
    semantic: 0.30,   // Product knowledge, user account info
    procedural: 0.20  // Solution patterns and workflows
  }
};
```

## Education/Tutor Agent Configuration

```typescript
// agentdock-core/examples/tutor-agent-memory.ts

export const tutorAgentMemoryConfig: MemoryConfig = {
  // Balanced decay - learning progression focus
  decay: {
    decayRate: 0.05,               // Moderate decay
    minThreshold: 0.15,            // Balanced cleanup
    neverDecay: [],                // USER CONFIGURES
    episodicDecayDays: 14,         // Bi-weekly pattern analysis
    semanticDecayRate: 0.03,       // Keep educational facts
    proceduralDecayRate: 0.01      // Preserve teaching methods
  },
  
  // Learning-optimized batch processing
  batchProcessing: {
    maxBatchSize: 15,              // Medium batches
    timeoutMinutes: 7,             // Regular processing
    minBatchSize: 4,               // Moderate delay
    extractionRate: 0.25           // 25% of messages (learning focus)
  },
  
  // Knowledge-building connections
  connections: {
    enableAutoConnections: true,
    connectionThreshold: 0.5,      // Balanced connection threshold
    maxConnectionsPerMemory: 6,
    prioritizeConceptualLinks: true
  },
  
  // Memory type distribution
  typeDistribution: {
    working: 0.25,    // Current lesson context
    episodic: 0.25,   // Learning interactions and progress
    semantic: 0.35,   // Educational content and student knowledge
    procedural: 0.15  // Teaching methods and student preferences
  }
};
```

## Personal Assistant Agent Configuration

```typescript
// agentdock-core/examples/personal-assistant-memory.ts

export const personalAssistantMemoryConfig: MemoryConfig = {
  // Long-term memory focus
  decay: {
    decayRate: 0.03,               // Slow decay for personal details
    minThreshold: 0.1,             // Keep personal information
    neverDecay: [],                // USER CONFIGURES - personal preferences
    episodicDecayDays: 21,         // Three-week pattern analysis
    semanticDecayRate: 0.02,       // Preserve personal facts
    proceduralDecayRate: 0.01      // Keep user preferences and routines
  },
  
  // Comprehensive batch processing
  batchProcessing: {
    maxBatchSize: 25,              // Larger batches for personal context
    timeoutMinutes: 15,            // Less frequent, comprehensive processing
    minBatchSize: 6,               // Wait for good context
    extractionRate: 0.20           // 20% of messages
  },
  
  // Personal relationship connections
  connections: {
    enableAutoConnections: true,
    connectionThreshold: 0.45,     // Balanced for personal relevance
    maxConnectionsPerMemory: 7,
    prioritizePersonalContext: true
  },
  
  // Memory type distribution
  typeDistribution: {
    working: 0.15,    // Current task/conversation
    episodic: 0.35,   // Personal interactions and events
    semantic: 0.35,   // Personal facts, preferences, relationships
    procedural: 0.15  // User habits and preferred workflows
  }
};
```

## Research Agent Configuration

```typescript
// agentdock-core/examples/research-agent-memory.ts

export const researchAgentMemoryConfig: MemoryConfig = {
  // Fact-preserving decay
  decay: {
    decayRate: 0.04,               // Moderate decay for research facts
    minThreshold: 0.2,             // Keep research findings
    neverDecay: [],                // USER CONFIGURES - research keywords
    episodicDecayDays: 45,         // Monthly+ pattern analysis
    semanticDecayRate: 0.01,       // Preserve research facts strongly
    proceduralDecayRate: 0.03      // Update research methods
  },
  
  // Research-focused batch processing
  batchProcessing: {
    maxBatchSize: 30,              // Large batches for research context
    timeoutMinutes: 20,            // Comprehensive analysis
    minBatchSize: 8,               // Wait for substantial content
    extractionRate: 0.35           // 35% of messages (high for research)
  },
  
  // Knowledge network connections
  connections: {
    enableAutoConnections: true,
    connectionThreshold: 0.3,      // Lower threshold for research connections
    maxConnectionsPerMemory: 10,   // More connections for research
    prioritizeFactualConnections: true
  },
  
  // Memory type distribution
  typeDistribution: {
    working: 0.20,    // Current research focus
    episodic: 0.20,   // Research sessions and discoveries
    semantic: 0.50,   // Research facts, findings, sources
    procedural: 0.10  // Research methods and strategies
  }
};
```

## Configuration Templates

### High-Memory Agent (Therapy, Personal Assistant)
```typescript
export const highMemoryTemplate: Partial<MemoryConfig> = {
  decay: { decayRate: 0.02, minThreshold: 0.1 },
  batchProcessing: { extractionRate: 0.30 },
  connections: { connectionThreshold: 0.4, maxConnectionsPerMemory: 8 }
};
```

### Efficient Agent (Support, Quick Tasks)  
```typescript
export const efficientTemplate: Partial<MemoryConfig> = {
  decay: { decayRate: 0.08, minThreshold: 0.2 },
  batchProcessing: { extractionRate: 0.15 },
  connections: { connectionThreshold: 0.6, maxConnectionsPerMemory: 5 }
};
```

### Balanced Agent (Education, General Use)
```typescript
export const balancedTemplate: Partial<MemoryConfig> = {
  decay: { decayRate: 0.05, minThreshold: 0.15 },
  batchProcessing: { extractionRate: 0.25 },
  connections: { connectionThreshold: 0.5, maxConnectionsPerMemory: 6 }
};
```

## Implementation Example

```typescript
// agentdock-core/src/agents/create-agent-with-memory.ts

import { createAgent } from '../agents/agent-factory';
import { MemoryProvider } from '../memory/memory-provider';

export async function createTherapyAgent(agentId: string): Promise<Agent> {
  // Create memory provider with therapy configuration
  const memoryProvider = new MemoryProvider(therapyAgentMemoryConfig);
  
  // Initialize with existing AgentDock infrastructure
  await memoryProvider.initialize({
    storageAdapter: existingStorageAdapter,
    vectorAdapter: existingVectorAdapter,
    llmProvider: existingLLMProvider
  });
  
  // Create agent with memory
  const agent = await createAgent({
    id: agentId,
    type: 'therapy',
    memory: memoryProvider,
    // ... other agent config
  });
  
  return agent;
}
```

## Testing Configurations

```typescript
// tests/memory/configurations.test.ts

describe('Memory Configurations', () => {
  test('therapy agent preserves important memories longer', async () => {
    const memory = new MemoryProvider(therapyAgentMemoryConfig);
    
    const importantMemory = await memory.remember(agentId, 
      "User mentioned feeling anxious about work presentations", 
      { importance: 0.9 }
    );
    
    // Simulate time passing
    await memory.decay(agentId);
    
    const recalled = await memory.recall(agentId, "anxiety work");
    expect(recalled).toContain(importantMemory);
  });
  
  test('support agent focuses on recent problems', async () => {
    const memory = new MemoryProvider(supportAgentMemoryConfig);
    // ... test support-specific behavior
  });
});
```

## Configuration Guidelines

### Choosing Decay Rates
- **Therapy/Personal**: 0.02 (very slow) - preserve personal context
- **Education**: 0.05 (moderate) - balance learning and cleanup  
- **Support**: 0.08 (fast) - focus on recent issues
- **Research**: 0.04 (moderate-slow) - preserve findings

### Choosing Extraction Rates
- **High context needs**: 30-35% (therapy, research)
- **Balanced**: 20-25% (education, personal assistant)
- **Efficiency focused**: 15-20% (support, quick tasks)

### Connection Thresholds
- **Dense networks**: 0.3-0.4 (research, therapy)
- **Balanced**: 0.5 (education, personal)
- **Sparse, high-quality**: 0.6+ (support, task-focused)

Each configuration is optimized for specific agent behaviors while maintaining cost efficiency and performance. 