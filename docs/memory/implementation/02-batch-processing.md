# Phase 2: Batch Processing Implementation

**Goal**: 5x cost efficiency through batch processing and three-tier extraction.

**Cross-Reference**: [Advanced Memory](../../roadmap/advanced-memory.md) sections 7-9

## Batch Processing Core

```typescript
// agentdock-core/src/memory/batch/batch-processor.ts

interface BatchConfig {
  maxBatchSize: number;     // Process after N messages
  timeoutMinutes: number;   // Or after N minutes
  minBatchSize: number;     // Need at least N messages
  extractionRate: number;   // 0.2 = 20% of messages get memory extraction
}

interface BatchMetadata {
  batchId: string;
  sourceMessageIds: string[];
  processingStats: {
    startTime: Date;
    endTime: Date;
    messagesProcessed: number;
    memoriesCreated: number;
    extractionMethods: string[];
    tokensUsed?: number;
  };
}

export class BatchMemoryProcessor {
  private messageBuffer = new Map<string, Message[]>();
  
  constructor(private config: BatchConfig) {}
  
  generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }
  
  async addMessage(agentId: string, message: Message): Promise<Memory[]> {
    const buffer = this.messageBuffer.get(agentId) || [];
    buffer.push(message);
    this.messageBuffer.set(agentId, buffer);
    
    if (this.shouldProcessBatch(buffer)) {
      const memories = await this.processBatchWithTracking(agentId, buffer);
      this.messageBuffer.delete(agentId);
      return memories;
    }
    return [];
  }
  
  private shouldProcessBatch(buffer: Message[]): boolean {
    if (buffer.length >= this.config.maxBatchSize) return true;
    
    const lastMessage = buffer[buffer.length - 1];
    const timeSinceLastMessage = Date.now() - lastMessage.timestamp.getTime();
    const timeoutReached = timeSinceLastMessage > this.config.timeoutMinutes * 60 * 1000;
    
    return timeoutReached && buffer.length >= this.config.minBatchSize;
  }
  
  async processBatchWithTracking(agentId: string, messages: Message[]): Promise<Memory[]> {
    const batchId = this.generateBatchId();
    const startTime = new Date();
    const sourceMessageIds = messages.map(m => m.id || this.generateMessageId());
    
    try {
      // Filter noise
      const meaningful = this.filterNoise(messages);
      
      // Apply extraction rate
      const shouldExtract = Math.random() < this.config.extractionRate;
      if (!shouldExtract) {
        await this.saveBatchMetadata({
          batchId,
          sourceMessageIds,
          processingStats: {
            startTime,
            endTime: new Date(),
            messagesProcessed: messages.length,
            memoriesCreated: 0,
            extractionMethods: ['skipped']
          }
        });
        return [];
      }
      
      // Three-tier extraction
      const memories: Memory[] = [];
      const extractionMethods: string[] = [];
      
      // Tier 1: Rules (always runs, zero cost)
      const rulesMemories = await this.extractWithRules(meaningful, agentId);
      memories.push(...rulesMemories);
      if (rulesMemories.length > 0) extractionMethods.push('rules');
      
      // Tier 2: Small model (optional, budget)
      if (this.config.enableSmallModel && meaningful.length > 3) {
        const smallModelMemories = await this.extractWithSmallModel(meaningful, agentId);
        memories.push(...smallModelMemories);
        if (smallModelMemories.length > 0) extractionMethods.push('small_model');
      }
      
      // Tier 3: Premium model (optional, high-value)
      if (this.config.enablePremiumModel && meaningful.length > 5) {
        const premiumMemories = await this.extractWithPremiumModel(meaningful, agentId);
        memories.push(...premiumMemories);
        if (premiumMemories.length > 0) extractionMethods.push('premium_model');
      }
      
      const finalMemories = this.deduplicateMemories(memories);
      
      // Add batch metadata to memories
      finalMemories.forEach(memory => {
        memory.batchId = batchId;
        memory.sourceMessageIds = sourceMessageIds;
      });
      
      // Save batch metadata
      await this.saveBatchMetadata({
        batchId,
        sourceMessageIds,
        processingStats: {
          startTime,
          endTime: new Date(),
          messagesProcessed: messages.length,
          memoriesCreated: finalMemories.length,
          extractionMethods
        }
      });
      
      return finalMemories;
      
    } catch (error) {
      // Save error metadata
      await this.saveBatchMetadata({
        batchId,
        sourceMessageIds,
        processingStats: {
          startTime,
          endTime: new Date(),
          messagesProcessed: messages.length,
          memoriesCreated: 0,
          extractionMethods: ['error'],
          error: error.message
        }
      });
      throw error;
    }
  }
  
  private async saveBatchMetadata(metadata: BatchMetadata): Promise<void> {
    await this.storage.set(`batch_metadata:${metadata.batchId}`, metadata);
  }
  
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }
  
  private filterNoise(messages: Message[]): Message[] {
    return messages.filter(msg => {
      // Skip very short messages
      if (msg.content.length < 10) return false;
      
      // Skip common noise patterns
      const noise = /^(hi|hello|thanks|ok|yes|no|got it|sure|np)\.?$/i;
      if (noise.test(msg.content.trim())) return false;
      
      return true;
    });
  }
}
```

## Three-Tier Extraction

### Tier 1: Rules (Zero Cost)

```typescript
// Users create their own rules via interface
export interface UserDefinedRule {
  id: string;
  name: string;
  pattern: string;        // User enters regex or simple pattern
  memoryType: 'semantic' | 'episodic' | 'procedural';
  importance: number;
  keywords: string[];
  isActive: boolean;
}

export class UserRulesExtractor {
  async extractWithRules(messages: Message[], agentId: string): Promise<Memory[]> {
    const userRules = await this.getUserRules(agentId);
    const batchText = messages.map(m => m.content).join(' ');
    const memories: Memory[] = [];
    
    for (const rule of userRules.filter(r => r.isActive)) {
      try {
        const regex = new RegExp(rule.pattern, 'gi');
        const matches = batchText.match(regex);
        
        if (matches) {
          for (const match of matches) {
            memories.push({
              id: this.generateId(),
              agentId,
              content: match.trim(),
              type: rule.memoryType,
              importance: rule.importance,
              keywords: rule.keywords,
              extractionMethod: 'rules',
              createdAt: new Date(),
              // ... other fields
            });
          }
        }
      } catch (error) {
        // Skip invalid regex patterns
        console.warn(`Invalid pattern in rule ${rule.name}:`, error);
      }
    }
    
    return memories;
  }
}
```

### Tier 2: Small Model (Budget Option)

```typescript
// Uses Mistral Small 3.1 or Gemini Flash for cost efficiency
export class SmallModelExtractor {
  async extractWithSmallModel(messages: Message[], agentId: string): Promise<Memory[]> {
    const prompt = `Extract 1-3 key insights from these messages:

${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Return JSON array with format:
[{"content": "insight text", "type": "semantic|episodic", "importance": 0.1-1.0, "keywords": ["tag1", "tag2"]}]

Focus on:
- User preferences and patterns
- Important factual information
- Emotional context
- Problem areas`;

    const response = await this.callSmallModel(prompt, {
      model: 'mistral-small-3.1',
      max_tokens: 300,
      temperature: 0.3
    });
    
    return this.parseMemoriesFromResponse(response, agentId, 'small_model');
  }
  
  private async callSmallModel(prompt: string, config: any): Promise<string> {
    // Implementation depends on your LLM provider setup
    // Could use AgentDock's existing LLM abstraction
    return await this.llmProvider.complete(prompt, config);
  }
}
```

### Tier 3: Premium Model (High-Value)

```typescript
export class PremiumModelExtractor {
  async extractWithPremiumModel(messages: Message[], agentId: string): Promise<Memory[]> {
    const prompt = `Deep analysis of conversation patterns:

${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Extract sophisticated insights including:
- Subtle behavioral patterns
- Implicit preferences
- Emotional nuances
- Complex relationships between topics
- Meta-cognitive patterns

Return detailed JSON with connections between insights.`;

    const response = await this.callPremiumModel(prompt, {
      model: 'gpt-4o',
      max_tokens: 800,
      temperature: 0.2
    });
    
    return this.parseAdvancedMemories(response, agentId, 'premium_model');
  }
}
```

## Real-World Configuration Examples

### Customer Support Agent

```typescript
const supportBatchConfig: BatchConfig = {
  maxBatchSize: 20,      // Process every 20 messages
  timeoutMinutes: 60,    // Or every hour
  minBatchSize: 5,       // Need at least 5 messages
  extractionRate: 0.3,   // 30% of batches get processed
  enableSmallModel: true,
  enablePremiumModel: false
};

// User-defined rules for support agent
const supportRules: UserDefinedRule[] = [
  {
    id: 'account-issues',
    name: 'Account Problems',
    pattern: '(account|login|password|billing).*(problem|issue|error|failed)',
    memoryType: 'episodic',
    importance: 0.9,
    keywords: ['account', 'technical-issue'],
    isActive: true
  },
  {
    id: 'feature-requests',
    name: 'Feature Requests',
    pattern: '(need|want|wish|request).*(feature|functionality)',
    memoryType: 'semantic',
    importance: 0.7,
    keywords: ['feature-request', 'feedback'],
    isActive: true
  }
];
```

### Therapy Agent

```typescript
const therapyBatchConfig: BatchConfig = {
  maxBatchSize: 8,       // Smaller batches for nuance
  timeoutMinutes: 30,    // More frequent processing
  minBatchSize: 3,
  extractionRate: 0.6,   // Higher extraction rate
  enableSmallModel: true,
  enablePremiumModel: true  // Premium for emotional analysis
};

const therapyRules: UserDefinedRule[] = [
  {
    id: 'emotional-states',
    name: 'Emotional States',
    pattern: '(I feel|feeling|emotion).*(sad|happy|angry|anxious|depressed|excited)',
    memoryType: 'episodic',
    importance: 0.95,
    keywords: ['emotion', 'mental-state'],
    isActive: true
  },
  {
    id: 'coping-strategies',
    name: 'Coping Mechanisms',
    pattern: '(helps me|cope|manage).*(stress|anxiety|depression)',
    memoryType: 'procedural',
    importance: 0.9,
    keywords: ['coping', 'strategy'],
    isActive: true
  }
];
```

## Cost Optimization

```typescript
// Real production costs with batch processing
export class BatchCostAnalyzer {
  calculateCosts(scenario: {
    messagesPerDay: number;
    agents: number;
    days: number;
    config: BatchConfig;
  }) {
    const totalMessages = scenario.messagesPerDay * scenario.agents * scenario.days;
    const batches = Math.ceil(totalMessages / scenario.config.maxBatchSize);
    const processedBatches = Math.ceil(batches * scenario.config.extractionRate);
    
    const costs = {
      // Rules: Always free
      rules: 0,
      
      // Small model (Mistral Small 3.1: $0.10/$0.30 per 1M tokens)
      smallModel: scenario.config.enableSmallModel ? 
        processedBatches * 0.02 : 0, // ~$0.02 per batch
      
      // Premium model (GPT-4o: $2.50/$10 per 1M tokens)
      premiumModel: scenario.config.enablePremiumModel ? 
        processedBatches * 0.15 : 0, // ~$0.15 per batch
    };
    
    return {
      totalCost: costs.rules + costs.smallModel + costs.premiumModel,
      costPerAgent: (costs.rules + costs.smallModel + costs.premiumModel) / scenario.agents,
      breakdown: costs
    };
  }
}

// Example: 1000 support agents, 50 messages/day, 30 days
const supportCosts = analyzer.calculateCosts({
  messagesPerDay: 50,
  agents: 1000,
  days: 30,
  config: supportBatchConfig
});
// Result: ~$450/month total, $0.45/agent/month
```

## Memory Creation Rate Analysis

Different configurations create different amounts of memories based on extraction rates:

### Configuration Scenarios

| Rate | Memories per 1000 Messages | Tokens per Memory | Use Case |
|------|---------------------------|-------------------|----------|
| 20% (Conservative) | 200 memories | ~25 tokens | Production default |
| 40% (Balanced) | 400 memories | ~100 tokens | Active learning |
| 60% (Comprehensive) | 600 memories | ~160 tokens | Research/therapy |
| 80% (Maximum) | 800 memories | ~200 tokens | Complete capture |

### Memory Creation Examples

```typescript
// 20% Rate - Conservative (Recommended)
const conservativeConfig: BatchConfig = {
  maxBatchSize: 20,
  timeoutMinutes: 60,
  minBatchSize: 5,
  extractionRate: 0.2,        // 20% of batches processed
  enableSmallModel: true,
  enablePremiumModel: false,
  filters: {
    minMessageLength: 50,
    skipGreetings: true,
    skipConfirmations: true
  },
  expectedOutput: {
    memoriesPerBatch: 4,
    avgTokensPerMemory: 25,
    focusOn: ['facts', 'preferences', 'goals']
  }
};

// 40% Rate - Balanced
const balancedConfig: BatchConfig = {
  maxBatchSize: 20,
  timeoutMinutes: 60,
  minBatchSize: 5,
  extractionRate: 0.4,        // 40% of batches processed
  enableSmallModel: true,
  enablePremiumModel: false,
  filters: {
    minMessageLength: 30,
    includeEmotions: true
  },
  expectedOutput: {
    memoriesPerBatch: 8,
    avgTokensPerMemory: 100,
    focusOn: ['facts', 'emotions', 'patterns', 'context']
  }
};

// 60% Rate - Comprehensive  
const comprehensiveConfig: BatchConfig = {
  maxBatchSize: 15,           // Smaller batches for more detail
  timeoutMinutes: 30,         // More frequent processing
  minBatchSize: 3,
  extractionRate: 0.6,        // 60% of batches processed
  enableSmallModel: true,
  enablePremiumModel: true,   // Premium for deep analysis
  filters: {
    minMessageLength: 20,
    captureEverything: true
  },
  expectedOutput: {
    memoriesPerBatch: 12,
    avgTokensPerMemory: 160,
    focusOn: ['everything', 'relationships', 'nuance']
  }
};

// 80% Rate - Maximum
const maximumConfig: BatchConfig = {
  maxBatchSize: 10,           // Very small batches
  timeoutMinutes: 15,         // Frequent processing
  minBatchSize: 2,
  extractionRate: 0.8,        // 80% of batches processed
  enableSmallModel: true,
  enablePremiumModel: true,
  filters: {
    minMessageLength: 10,
    noFiltering: true
  },
  expectedOutput: {
    memoriesPerBatch: 16,
    avgTokensPerMemory: 200,
    focusOn: ['complete_record', 'verbatim', 'forensic']
  }
};
```

### Rate Selection Guidelines

```typescript
// Choose extraction rate based on use case
export function selectExtractionRate(useCase: string): number {
  const rateMap = {
    'customer-support': 0.3,      // Balanced, focus on issues
    'therapy': 0.6,               // High detail for emotional patterns
    'education': 0.5,             // Moderate for learning progress
    'research': 0.8,              // Maximum capture for analysis
    'casual-chat': 0.2,           // Minimal for basic preferences
    'business-intelligence': 0.4   // Balanced for facts and trends
  };
  
  return rateMap[useCase] || 0.2; // Default to conservative
}

// Monitor memory creation efficiency
export function analyzeMemoryCreation(stats: {
  batchesProcessed: number;
  memoriesCreated: number;
  avgTokensPerMemory: number;
  totalCost: number;
}) {
  return {
    efficiency: stats.memoriesCreated / stats.batchesProcessed,
    costPerMemory: stats.totalCost / stats.memoriesCreated,
    tokenEfficiency: stats.avgTokensPerMemory < 150 ? 'good' : 'review',
    recommendation: stats.avgTokensPerMemory > 200 ? 'reduce_extraction_rate' : 'current_rate_optimal'
  };
}
```

## Integration with Phase 1

```typescript
// agentdock-core/src/memory/memory-manager.ts (updated)

export class AgentMemoryManager {
  private batchProcessor: BatchMemoryProcessor;
  
  constructor(agentId: string, batchConfig: BatchConfig) {
    // ... existing code from Phase 1
    this.batchProcessor = new BatchMemoryProcessor(batchConfig);
  }
  
  async processMessage(message: Message, sessionId?: string): Promise<Memory[]> {
    // Phase 1: Update working memory
    await this.updateWorkingMemory(message, sessionId);
    
    // Phase 2: Batch processing
    const batchMemories = await this.batchProcessor.addMessage(this.agentId, message);
    
    // Store batch-extracted memories
    for (const memory of batchMemories) {
      memory.sessionId = sessionId;
      await this.longTermMemory.remember(this.agentId, memory.content, {
        type: memory.type,
        importance: memory.importance,
        keywords: memory.keywords,
        extractionMethod: memory.extractionMethod
      });
    }
    
    return batchMemories;
  }
}
```

## Performance Monitoring

```typescript
export class BatchPerformanceMonitor {
  async trackBatchProcessing(agentId: string, batchResult: {
    inputMessages: number;
    outputMemories: number;
    processingTimeMs: number;
    extractionMethod: string;
    cost: number;
  }) {
    const metrics = {
      agent_id: agentId,
      batch_size: batchResult.inputMessages,
      memories_created: batchResult.outputMemories,
      processing_time: batchResult.processingTimeMs,
      extraction_method: batchResult.extractionMethod,
      cost_usd: batchResult.cost,
      efficiency: batchResult.outputMemories / batchResult.inputMessages,
      timestamp: new Date()
    };
    
    // Store metrics using existing storage abstraction
    await this.metricsStorage.set(`batch_metrics:${Date.now()}`, metrics);
  }
}
```

## Implementation Checklist

### Core Components
- [ ] `BatchMemoryProcessor` class with message buffering
- [ ] `UserRulesExtractor` for user-defined patterns
- [ ] `SmallModelExtractor` with cost-efficient models
- [ ] `PremiumModelExtractor` for high-value analysis
- [ ] `BatchCostAnalyzer` for cost tracking

### Integration
- [ ] Update `AgentMemoryManager` with batch processing
- [ ] User interface for creating custom rules
- [ ] Performance monitoring dashboard
- [ ] Cost tracking and budgeting tools

Key advantages:
- **5x cost reduction** through batching
- **User-defined rules** via interface (no hardcoded patterns)
- **Configurable extraction rates** per use case
- **Real-world cost examples** for budgeting 