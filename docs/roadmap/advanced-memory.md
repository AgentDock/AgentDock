# Advanced Memory Systems for AI Agents

**Status**: 🔄 In Progress  
**Priority**: High  
**Complexity**: High  
**Target**: Q2 2025

## Overview

Modern AI agents in 2025 are implementing human-like memory systems that intelligently manage context, prioritize information, and adapt to user patterns. With larger context windows (100k+ tokens), the focus shifts from storage to intelligent selection and vertical-specific optimizations.

## System Architecture

```mermaid
graph TD
    subgraph "Human-Like Memory System"
        A[Working Memory<br/>Current Context Window] --> B[Memory Controller]
        C[Episodic Memory<br/>Time-stamped Experiences] --> B
        D[Semantic Memory<br/>Extracted Facts] --> B
        E[Procedural Memory<br/>Tool Usage Patterns] --> B
        
        B --> F[Memory Consolidation]
        F --> G[Token-Aware Context]
        
        H[User Input] --> I[Rule-Based Triggers]
        I --> |"Active Chat"| B
        I --> |"Idle Period"| J[Skip Processing]
        
        style A fill:#f9f,stroke:#333,stroke-width:2px
        style C fill:#9ff,stroke:#333,stroke-width:2px
        style D fill:#ff9,stroke:#333,stroke-width:2px
        style E fill:#9f9,stroke:#333,stroke-width:2px
    end
```

## Memory Layer Interactions

| Layer | Purpose | Without This Layer | With This Layer | Example |
|-------|---------|-------------------|-----------------|---------|
| **Working Memory** | Current context | Agent forgets conversation flow | Maintains coherent dialogue | "As I mentioned earlier..." |
| **Episodic Memory** | Personal history | No personalization | Remembers past interactions | "Last week you asked about..." |
| **Semantic Memory** | Extracted facts | Re-learns every time | Builds knowledge base | "Your preference is dark mode" |
| **Procedural Memory** | Tool patterns | Random tool usage | Optimized tool selection | Uses search before deep_research |

## HTTP Adapter Pattern (Platform Independence)

Memory must work across different applications - open source client and commercial products use different frameworks. Core provides the memory logic, apps provide the HTTP layer.

```typescript
// agentdock-core/src/memory/adapters/base.ts
export interface MemoryAdapter {
  parseRequest(request: unknown): Promise<MemoryRequest>;
  createResponse(data: MemoryResponse): unknown;
  handleError(error: Error): unknown;
}

// agentdock-core/src/memory/adapters/express.ts
export class ExpressMemoryAdapter implements MemoryAdapter {
  async parseRequest(req: Request): Promise<MemoryRequest> {
    return {
      action: req.body.action,
      agentId: req.body.agentId,
      content: req.body.content,
      options: req.body.options
    };
  }
  
  createResponse(data: MemoryResponse): Response {
    return { 
      status: 200, 
      body: data 
    };
  }
  
  handleError(error: Error): Response {
    return { 
      status: 500, 
      body: { error: error.message }
    };
  }
}

// Open Source Client Usage with Express
// routes/memory.js
const express = require('express');
const { MemoryProvider, ExpressMemoryAdapter } = require('agentdock-core');

const router = express.Router();

router.post('/memory', async (req, res) => {
  const memory = new MemoryProvider(storageAdapter, embedder);
  const handler = new MemoryApiHandler(memory, new ExpressMemoryAdapter());
  const response = await handler.handle(req);
  res.status(response.status).json(response.body);
});
```

## Implementation Plan

### Core Memory Interface (AgentDock Insight Engine)

```mermaid
graph LR
    subgraph "AgentDock Insight Engine"
        A[New Message] --> B[Analyze Context]
        B --> C{Is Important?}
        C -->|No| D[Skip]
        C -->|Yes| E[Find Similar]
        E --> F{Match Type}
        F -->|New| G[Add Memory]
        F -->|Similar| H[Merge Facts]
        F -->|Contradicts| I[Replace Old]
        F -->|Duplicate| J[Skip]
    end
```

```typescript
// agentdock-core/src/memory/types.ts
export interface MemoryProvider {
  // AgentDock Insight Engine operations
  remember(agentId: string, content: string, context?: MemoryContext): Promise<Memory>;
  recall(agentId: string, query: string, options?: RecallOptions): Promise<Memory[]>;
  forget(agentId: string, memoryId: string): Promise<void>;
  export(agentId: string): Promise<MemoryExport>;
  
  // Memory lifecycle management
  consolidate(agentId: string): Promise<ConsolidationResult>;
  decay(agentId: string): Promise<DecayResult>;
  
  // Compact summaries for efficiency
  getCompactSummary(agentId: string): Promise<string>;
  updateCompactSummary(agentId: string): Promise<void>;
}

export interface Memory {
  id: string;
  agentId: string;
  content: string;
  embedding: number[]; // Semantic from day 1
  
  // Human memory type
  type: 'working' | 'episodic' | 'semantic' | 'procedural';
  
  // Temporal awareness
  timestamp: Date;
  sessionId?: string;
  
  // Dynamic importance
  importance: number;      // Initial importance
  resonance: number;       // Current relevance after decay
  insightKeys?: string[];  // Semantic tags for clustering
  
  // Access patterns
  accessCount: number;
  lastAccessed: Date;
  
  // Efficiency
  compactForm?: string;    // One-sentence summary
  
  // Token management
  tokenCount: number;
  truncationPriority: number;
  
  // Metadata
  language?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

// AgentDock Memory Operations
export enum MemoryOperation {
  ADD = 'ADD',       // New unique memory
  UPDATE = 'UPDATE', // Merge with existing
  DELETE = 'DELETE', // Remove outdated
  NOOP = 'NOOP'     // Already exists
}
```

### Rule-Based Memory Triggers with AI Enhancement

```typescript
// Memory processing happens through intelligent rules
export interface MemoryTriggerRules {
  // Chat activity triggers
  messagesPerMinute: number;        // Default: 2
  minMessageLength: number;         // Default: 50 chars
  idleTimeoutMinutes: number;       // Default: 30
  
  // Content triggers
  emotionalKeywords: string[];      // ["urgent", "important", "remember"]
  explicitMemoryRequest: boolean;   // "Remember that..."
  
  // Tool usage pattern triggers
  toolUsageThreshold: number;       // 3 tool calls = save pattern
  errorRepetitionThreshold: number; // 2 same errors = save solution
  toolSuccessPattern: boolean;      // Capture successful tool sequences
  
  // AI-enhanced triggers (optional)
  enableLLMAnalysis?: boolean;      // Use LLM for importance detection
  enableSmallModel?: boolean;       // Use small model for quick checks
  dynamicRuleGeneration?: boolean;  // Let LLM create new rules
}

export class IntelligentMemoryController {
  private lastActivity: Date = new Date();
  private messageBuffer: Message[] = [];
  private toolUsagePatterns: Map<string, ToolPattern[]> = new Map();
  
  constructor(
    private llm?: LLMProvider,
    private smallModel?: SmallModelProvider
  ) {}
  
  async shouldProcessMemory(
    message: Message, 
    context: MemoryContext,
    rules: MemoryTriggerRules
  ): Promise<boolean> {
    // Basic rule checks first (fast path)
    const basicTrigger = this.checkBasicRules(message, rules);
    if (basicTrigger) return true;
    
    // AI-enhanced analysis (optional)
    if (rules.enableLLMAnalysis && this.llm) {
      const importance = await this.llm.analyzeImportance(message, context);
      if (importance > 0.7) return true;
    }
    
    // Small model for quick checks
    if (rules.enableSmallModel && this.smallModel) {
      const quickCheck = await this.smallModel.quickImportanceCheck(message);
      if (quickCheck.isImportant) return true;
    }
    
    return false;
  }
  
  // Capture successful tool usage patterns
  async captureToolPattern(
    agentId: string,
    toolCalls: ToolCall[],
    outcome: 'success' | 'failure'
  ): Promise<void> {
    if (outcome === 'success' && toolCalls.length >= 2) {
      const pattern = this.extractToolPattern(toolCalls);
      
      // Store pattern for future use
      const patterns = this.toolUsagePatterns.get(agentId) || [];
      patterns.push({
        sequence: toolCalls,
        successRate: 1,
        useCount: 1,
        context: await this.summarizeContext(toolCalls)
      });
      
      this.toolUsagePatterns.set(agentId, patterns);
    }
  }
  
  // Dynamic rule generation (node-based system capability)
  async generateDynamicRules(
    agentId: string,
    context: MemoryContext
  ): Promise<MemoryTriggerRules> {
    if (!this.llm) return this.getDefaultRules();
    
    // LLM can analyze patterns and suggest new rules
    const analysis = await this.llm.analyzeBehaviorPatterns({
      recentInteractions: context.messages,
      toolUsageHistory: this.toolUsagePatterns.get(agentId),
      currentRules: this.getDefaultRules()
    });
    
    return {
      ...this.getDefaultRules(),
      ...analysis.suggestedRules,
      dynamicRuleGeneration: true
    };
  }
}
```

### User-Configurable Memory Decay

```typescript
// Extended decay configuration with examples
export interface MemoryDecayConfig {
  episodicToSemanticDays: number;  // Default: 30
  decayRate: number;                // Default: 0.1
  minImportanceThreshold: number;   // Default: 0.2
  
  custom?: {
    neverDecay?: string[];          // Patterns to preserve
    acceleratedDecay?: string[];    // Patterns to forget faster
    verticalSpecific?: {
      therapy?: {
        sessionNotesDecay: number;  // 90 days
        traumaEventsDecay: never;   // Never forget
        copingStrategiesDecay: 180; // 6 months
      };
      legal?: {
        caseFactsDecay: never;      // Preserve forever
        proceduralDeadlines: never; // Critical dates
        draftDocuments: 30;         // Clean up drafts
      };
      education?: {
        conceptsLearned: 365;       // 1 year
        practiceProblems: 60;       // 2 months
        examDates: never;           // Keep schedule
      };
      customerSupport?: {
        resolvedIssues: 90;         // 3 months
        productPreferences: 180;    // 6 months
        accountDetails: never;      // Keep forever
      };
    };
  };
}

// Example configurations for different use cases
const therapyConfig: MemoryDecayConfig = {
  episodicToSemanticDays: 7,  // Quick pattern recognition
  decayRate: 0.05,             // Slow decay
  minImportanceThreshold: 0.1, // Keep more memories
  custom: {
    neverDecay: [
      "trauma", "trigger", "medication", "allergy",
      "emergency contact", "crisis plan"
    ],
    acceleratedDecay: [
      "small talk", "weather", "greeting"
    ],
    verticalSpecific: {
      therapy: {
        sessionNotesDecay: 90,
        traumaEventsDecay: never,
        copingStrategiesDecay: 180
      }
    }
  }
};

const legalConfig: MemoryDecayConfig = {
  episodicToSemanticDays: 60,   // Longer consolidation
  decayRate: 0.01,              // Very slow decay
  minImportanceThreshold: 0.3,  // Higher bar
  custom: {
    neverDecay: [
      "deadline", "court date", "case number",
      "settlement", "verdict", "filing"
    ],
    verticalSpecific: {
      legal: {
        caseFactsDecay: never,
        proceduralDeadlines: never,
        draftDocuments: 30
      }
    }
  }
};
```

### Phase 1: Human-Like Memory Foundation (Week 1)

```typescript
// Core memory types matching human cognitive architecture
export class HumanLikeMemoryProvider implements MemoryProvider {
  // Maintain compact summary per agent
  private agentSummaries: Map<string, string> = new Map();
  
  // Intelligent trigger controller
  private triggerController = new IntelligentMemoryController();
  
  constructor(
    private storage: StorageProvider,
    private embedder: EmbeddingProvider,
    private config: MemoryConfig
  ) {}
  
  // AgentDock Insight Engine: Analyze → Act
  async remember(agentId: string, content: string, context?: MemoryContext): Promise<Memory> {
    // Check if we should process based on intelligent rules
    const shouldProcess = await this.triggerController.shouldProcessMemory(
      content, 
      context, 
      this.config.triggers
    );
    
    if (!shouldProcess) return null; // Skip processing
    
    // Phase 1: Analyze context (what matters?)
    const insight = await this.analyzeContext(content, context);
    if (!insight) return null; // Nothing significant
    
    // Phase 2: Act on memory update
    const existingMemories = await this.findSimilar(agentId, insight);
    
    if (existingMemories.length === 0) {
      // ADD: New episodic memory
      return await this.addEpisodicMemory(agentId, insight, context);
    } else if (this.shouldConsolidate(insight, existingMemories)) {
      // UPDATE: Merge into semantic memory
      return await this.consolidateToSemantic(agentId, insight, existingMemories);
    } else if (this.contradicts(insight, existingMemories[0])) {
      // DELETE + ADD: Replace outdated memory
      await this.forget(agentId, existingMemories[0].id);
      return await this.addEpisodicMemory(agentId, insight, context);
    }
    
    // NOOP: Similar memory already exists
    return existingMemories[0];
  }
  
  // Multi-language importance detection with simple fallback
  private async detectImportance(content: string, language?: string): Promise<number> {
    // Try small multi-language model first
    if (this.config.xlmRoberta && language !== 'en') {
      try {
        const analysis = await this.config.xlmRoberta.analyze(content);
        return analysis.importance;
      } catch (error) {
        console.warn('XLM-RoBERTa failed, falling back to LLM');
      }
    }
    
    // Fallback to LLM if available
    if (this.config.llm) {
      return await this.config.llm.analyzeImportance(content, language);
    }
    
    // Final fallback: Return neutral importance
    return 0.5; // Neutral importance when analysis fails
  }
}
```

### Procedural Memory: Tool Usage Patterns

```typescript
// Procedural memory focuses on capturing successful tool usage patterns
export interface ProceduralMemory extends Memory {
  type: 'procedural';
  toolSequence: ToolCall[];
  successRate: number;
  avgExecutionTime: number;
  errorPatterns?: ErrorPattern[];
  userContext?: string; // What the user was trying to achieve
}

export interface ToolCall {
  toolName: string;
  parameters: any;
  result: 'success' | 'failure';
  executionTime: number;
  userIntent?: string; // Captured user goal
}

export class ProceduralMemoryManager {
  // Learn from successful tool usage patterns
  async learnFromExecution(
    agentId: string,
    toolCalls: ToolCall[],
    outcome: 'success' | 'failure',
    userContext?: string
  ): Promise<void> {
    // Capture patterns that work for users
    if (outcome === 'success') {
      const pattern = this.extractPattern(toolCalls);
      const existingPattern = await this.findSimilarPattern(agentId, pattern);
      
      if (existingPattern) {
        // Update success metrics
        existingPattern.successRate = 
          (existingPattern.successRate * existingPattern.useCount + 1) / 
          (existingPattern.useCount + 1);
        existingPattern.useCount++;
        
        await this.storage.update(existingPattern);
      } else if (toolCalls.length >= 2) {
        // Save new successful pattern
        await this.storage.save({
          type: 'procedural',
          agentId,
          pattern,
          successRate: 1,
          useCount: 1,
          toolSequence: toolCalls,
          userContext: userContext || 'Tool usage pattern'
        });
      }
    }
    
    // Also learn from failures to avoid them
    if (outcome === 'failure' && toolCalls.length > 0) {
      await this.captureFailurePattern(agentId, toolCalls, userContext);
    }
  }
  
  // Suggest optimal tool sequence based on past successes
  async suggestToolSequence(
    agentId: string,
    task: string,
    context?: MemoryContext
  ): Promise<ToolCall[]> {
    const patterns = await this.storage.searchPatterns(agentId, task);
    
    // Return highest success rate pattern that matches context
    const bestPattern = patterns
      .filter(p => p.successRate > 0.7)
      .filter(p => this.matchesContext(p, context))
      .sort((a, b) => b.successRate - a.successRate)[0];
    
    return bestPattern?.toolSequence || [];
  }
  
  // Capture what users actually do that works
  private async captureUserSuccess(
    userId: string,
    action: string,
    result: any
  ): Promise<void> {
    // This is where we learn from actual user behavior
    // Not abstract workflows, but real tool usage that worked
    await this.storage.save({
      type: 'user_success_pattern',
      userId,
      action,
      result,
      timestamp: new Date(),
      context: await this.extractContext()
    });
  }
}

// Example: Learning that search → deep_research works better than direct deep_research
const proceduralExample = {
  type: 'procedural',
  pattern: 'information_gathering',
  toolSequence: [
    { toolName: 'search', parameters: { query: '...' }, result: 'success', executionTime: 200 },
    { toolName: 'deep_research', parameters: { topic: '...' }, result: 'success', executionTime: 3000 }
  ],
  successRate: 0.85,
  useCount: 20
};
```

### Customer Support Memory
```typescript
// Customer: "My order hasn't arrived yet, it's been 2 weeks"
// Without Memory: "Can you provide your order number?"
// With Memory: "I see your order #98765 placed on June 3rd, 2025. Let me check the shipping status - it shows delayed at customs. I'll escalate this to our shipping team immediately."

const supportMemory: Memory = {
  type: 'episodic',
  content: 'Customer placed order #98765 for wireless headphones',
  timestamp: new Date('2025-06-03'),
  importance: 0.9,
  metadata: {
    customerId: 'cust_12345',
    orderId: '98765',
    orderValue: 149.99,
    productType: 'electronics',
    shippingMethod: 'international'
  }
};

// System also learns from support patterns
const supportPattern: ProceduralMemory = {
  type: 'procedural',
  pattern: 'delayed_shipping_resolution',
  toolSequence: [
    { toolName: 'check_order_status', result: 'success', executionTime: 100 },
    { toolName: 'identify_delay_reason', result: 'success', executionTime: 150 },
    { toolName: 'create_support_ticket', result: 'success', executionTime: 80 },
    { toolName: 'send_customer_update', result: 'success', executionTime: 50 }
  ],
  successRate: 0.92,
  userContext: 'Customer inquiring about delayed international shipment'
};
```

## Storage Backend Support

### Officially Supported for Memory System

Only these adapters support the advanced memory system with vector search:

#### Development Configuration
```bash
# .env.local
ENABLE_SQLITE=true
ENABLE_SQLITE_VEC=true
KV_STORE_PROVIDER=sqlite
```
- **SQLite + sqlite-vec**: IMPLEMENTED - Zero-config local development
- Auto-registered in development mode
- Full vector search capabilities
- No external dependencies

#### Production Configuration
```bash
# .env.local
DATABASE_URL=postgresql://user:password@host:5432/agentdock
ENABLE_PGVECTOR=true
KV_STORE_PROVIDER=postgresql
```
- **PostgreSQL + pgvector**: Production-ready with full vector capabilities
- **Supabase**: Managed PostgreSQL with pgvector extension
- Auto-registered when DATABASE_URL is set

### Not Supported for Memory System
These adapters can be used for other storage needs but NOT for the memory system:
- **MongoDB**: No native vector search in our adapter
- **Redis**: Session caching only, not persistent memory
- **S3/DynamoDB**: Object/document storage, not optimized for memory
- **Pinecone/Qdrant/ChromaDB**: Could work but not officially supported

### Quick Setup Guide

#### Local Development (Zero Config)

```bash
# Step 1: Just run it
pnpm dev

# That's it! You get:
# SQLite with persistent storage
# sqlite-vec for AI memory (if available)
# Everything saved to ./agentdock.db
```

#### Production with Supabase

**Step 1: Create Supabase Project**
- Go to [supabase.com](https://supabase.com)
- Create new project
- Save your database password

**Step 2: Enable pgvector**
```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
```

**Step 3: Add to .env.local**
```bash
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres
ENABLE_PGVECTOR=true
KV_STORE_PROVIDER=postgresql
```

**Step 4: Deploy**
```bash
pnpm build
pnpm start
```

**Step 5: Verify**
Check logs for: "PostgreSQL Vector adapter registered"

## Performance Benefits

Based on academic research and industry implementations:
- **Improved recall accuracy** through semantic search
- **Reduced latency** via compact summaries
- **Lower token usage** through intelligent selection
- **Better task completion** with procedural patterns
- **Extended conversation coherence** beyond 300 turns

## Future Research Directions

### Academic Papers
- [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560)
- [Reflexion: Language Agents with Verbal Reinforcement Learning](https://arxiv.org/abs/2303.11366)
- [Voyager: An Open-Ended Embodied Agent](https://arxiv.org/abs/2305.16291)

### Industry Research
- [Anthropic's Constitutional AI and Memory Safety](https://www.anthropic.com/index/constitutional-ai-harmlessness-from-ai-feedback)
- [OpenAI's WebGPT with Long-term Memory](https://openai.com/research/webgpt)
- [Google's LaMDA Memory Architecture](https://arxiv.org/abs/2201.08239)

### Emerging Directions
- Hierarchical memory representations
- Multimodal memory (text + images + audio)
- On-device memory for privacy
- Federated memory learning
- Quantum-inspired memory architectures

## Real-World Examples

### Customer Support Memory
```typescript
// Customer: "I called last week about my refund"
// Without Memory: "I don't have any record of previous calls"
// With Memory: "Yes, I see you called on March 15th about order #12345. The refund was processed on March 17th."

const supportMemory: Memory = {
  type: 'episodic',
  content: 'Customer called about refund for order #12345',
  timestamp: new Date('2024-03-15'),
  importance: 0.8,
  metadata: {
    orderId: '12345',
    issueType: 'refund',
    resolved: true,
    resolutionDate: '2024-03-17'
  }
};
```

### Educational Tutor Memory
```typescript
// Student: "Can we review what we learned about photosynthesis?"
// With Semantic Memory: Recalls consolidated facts from multiple sessions

const educationMemory: Memory = {
  type: 'semantic',
  content: 'Student struggles with the light-dependent reactions in photosynthesis',
  importance: 0.9,
  consolidatedFrom: ['episode-1', 'episode-2', 'episode-3'],
  metadata: {
    subject: 'biology',
    topic: 'photosynthesis',
    difficulty: 'light-dependent reactions',
    masteryLevel: 0.6
  }
};
```

### Developer Assistant Memory
```typescript
// Developer: "Use the same error handling pattern as last time"
// With Procedural Memory: Applies previously successful pattern

const developerMemory: ProceduralMemory = {
  type: 'procedural',
  pattern: 'error_handling_setup',
  toolSequence: [
    { toolName: 'analyze_code', parameters: { file: 'api.ts' }, result: 'success', executionTime: 100 },
    { toolName: 'generate_error_handler', parameters: { style: 'try-catch-finally' }, result: 'success', executionTime: 50 },
    { toolName: 'add_logging', parameters: { level: 'error' }, result: 'success', executionTime: 30 }
  ],
  successRate: 0.95,
  avgExecutionTime: 180
};
```

## Conclusion

The AgentDock memory system provides a flexible, human-like approach to agent memory that:
- Works across any HTTP framework through adapters
- Uses rule-based triggers to avoid unnecessary processing
- Provides configurable decay for different verticals
- Focuses on practical tool usage patterns rather than abstract workflows
- Maintains efficiency through compact summaries and token awareness

By combining insights from cognitive science with practical engineering, we create agents that truly remember and improve over time. 