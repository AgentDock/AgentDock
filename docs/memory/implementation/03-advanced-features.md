# Phase 3: Advanced Features Implementation

**Goal**: Memory connections and intelligent patterns discovery.

**Cross-Reference**: [Advanced Memory](../../roadmap/advanced-memory.md) sections 6, 10

## Zettelkasten Memory Connections

```typescript
// agentdock-core/src/memory/connections/connection-manager.ts

export class MemoryConnectionManager {
  async buildConnections(agentId: string, newMemory: Memory): Promise<MemoryConnection[]> {
    const existingMemories = await this.getRecentMemories(agentId, 50);
    const connections: MemoryConnection[] = [];
    
    for (const existing of existingMemories) {
      const similarity = await this.calculateSimilarity(newMemory, existing);
      
      if (similarity > 0.7) {
        const connectionType = this.determineConnectionType(newMemory, existing);
        connections.push({
          targetMemoryId: existing.id,
          connectionType,
          strength: similarity,
          reason: `Content similarity: ${Math.round(similarity * 100)}%`
        });
      }
    }
    
    return connections;
  }
  
  private determineConnectionType(memory1: Memory, memory2: Memory): ConnectionType {
    // Check timestamps for updates
    if (memory1.createdAt > memory2.createdAt) {
      if (this.detectContradiction(memory1.content, memory2.content)) {
        return 'contradicts';
      }
      if (this.detectUpdate(memory1.content, memory2.content)) {
        return 'updates';
      }
    }
    
    return 'related';
  }
}
```

## Memory Consolidation Implementation

```typescript
// agentdock-core/src/memory/consolidation/consolidator.ts

interface ConsolidationConfig {
  episodicToSemanticDays: number;  // When to convert
  similarityThreshold: number;     // For merging similar memories
  minImportance: number;          // Don't consolidate low importance
  enableLLMSummarization: boolean; // Use AI for consolidation
}

interface ConsolidationResult {
  processed: number;
  consolidated: number;
  deleted: number;
  created: number;
}

export class MemoryConsolidator {
  async consolidate(agentId: string, config: ConsolidationConfig): Promise<ConsolidationResult> {
    const memories = await this.getAllMemories(agentId);
    const now = new Date();
    const result: ConsolidationResult = { processed: 0, consolidated: 0, deleted: 0, created: 0 };
    
    // Step 1: Convert old episodic to semantic
    const episodicMemories = memories.filter(m => m.type === 'episodic');
    for (const memory of episodicMemories) {
      const age = (now.getTime() - memory.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (age > config.episodicToSemanticDays && memory.importance > 0.5) {
        memory.type = 'semantic';
        memory.updatedAt = now;
        await this.updateMemory(memory);
        result.consolidated++;
      }
      result.processed++;
    }
    
    // Step 2: Merge similar semantic memories
    const semanticMemories = memories.filter(m => m.type === 'semantic');
    const clusters = await this.findSimilarMemoryClusters(semanticMemories, config.similarityThreshold);
    
    for (const cluster of clusters) {
      if (cluster.length > 1) {
        const mergedMemory = await this.mergeMemories(cluster, config);
        
        // Delete old memories
        for (const oldMemory of cluster) {
          await this.deleteMemory(oldMemory.id);
          result.deleted++;
        }
        
        // Save new consolidated memory
        await this.saveMemory(mergedMemory);
        result.created++;
      }
    }
    
    return result;
  }
  
  private async findSimilarMemoryClusters(memories: Memory[], threshold: number): Promise<Memory[][]> {
    const clusters: Memory[][] = [];
    const processed = new Set<string>();
    
    for (const memory of memories) {
      if (processed.has(memory.id)) continue;
      
      const cluster = [memory];
      processed.add(memory.id);
      
      // Find similar memories
      for (const other of memories) {
        if (processed.has(other.id)) continue;
        
        const similarity = await this.calculateSimilarity(memory, other);
        if (similarity > threshold) {
          cluster.push(other);
          processed.add(other.id);
        }
      }
      
      clusters.push(cluster);
    }
    
    return clusters.filter(cluster => cluster.length > 1);
  }
  
  private async mergeMemories(memories: Memory[], config: ConsolidationConfig): Promise<Memory> {
    const primary = memories.reduce((prev, current) => 
      current.importance > prev.importance ? current : prev
    );
    
    // Merge content
    let mergedContent: string;
    if (config.enableLLMSummarization && memories.length > 2) {
      mergedContent = await this.llmSummarize(memories.map(m => m.content));
    } else {
      mergedContent = memories.map(m => m.content).join('. ');
    }
    
    // Merge importance (weighted average)
    const totalWeight = memories.reduce((sum, m) => sum + m.accessCount + 1, 0);
    const mergedImportance = memories.reduce((sum, m) => 
      sum + (m.importance * (m.accessCount + 1)), 0
    ) / totalWeight;
    
    // Merge keywords
    const allKeywords = new Set<string>();
    memories.forEach(m => {
      if (m.keywords) {
        m.keywords.forEach(k => allKeywords.add(k));
      }
    });
    
    // Merge connections
    const allConnections = new Map<string, MemoryConnection>();
    memories.forEach(m => {
      if (m.connections) {
        m.connections.forEach(conn => {
          const existing = allConnections.get(conn.targetMemoryId);
          if (!existing || conn.strength > existing.strength) {
            allConnections.set(conn.targetMemoryId, conn);
          }
        });
      }
    });
    
    return {
      ...primary,
      content: mergedContent,
      importance: mergedImportance,
      keywords: Array.from(allKeywords),
      connections: Array.from(allConnections.values()),
      accessCount: memories.reduce((sum, m) => sum + m.accessCount, 0),
      updatedAt: new Date(),
      extractionMethod: 'consolidated'
    };
  }
  
  private async llmSummarize(contents: string[]): Promise<string> {
    const prompt = `Consolidate these related memories into a single coherent summary:

${contents.map((content, i) => `${i + 1}. ${content}`).join('\n')}

Provide a concise summary that captures all key information:`;

    return await this.llmProvider.complete(prompt, {
      max_tokens: 200,
      temperature: 0.3
    });
  }
}
```

## Vector Search Integration

```typescript
// Uses existing pgvector/sqlite-vec adapters
export class VectorMemorySearch {
  constructor(private vectorAdapter: VectorAdapter) {}
  
  async findSimilarMemories(query: string, agentId: string, limit = 10): Promise<Memory[]> {
    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Use existing vector adapter
    const results = await this.vectorAdapter.search({
      vector: queryEmbedding,
      filter: { agent_id: agentId },
      limit,
      threshold: 0.7
    });
    
    return results.map(r => r.metadata as Memory);
  }
  
  async generateEmbedding(text: string): Promise<number[]> {
    // Use existing embedding provider from AgentDock
    return await this.embeddingProvider.embed(text);
  }
}
```

## Memory Evolution Tracking

```typescript
export class MemoryEvolutionTracker {
  async trackEvolution(memoryId: string, change: MemoryEvolution): Promise<void> {
    const evolutionRecord = {
      memoryId,
      timestamp: new Date(),
      changeType: change.type,
      previousValue: change.before,
      newValue: change.after,
      reason: change.reason
    };
    
    await this.storage.set(`evolution:${memoryId}:${Date.now()}`, evolutionRecord);
  }
  
  async getEvolutionHistory(memoryId: string): Promise<MemoryEvolution[]> {
    const keys = await this.storage.list(`evolution:${memoryId}:`);
    const evolutions = [];
    
    for (const key of keys) {
      const evolution = await this.storage.get(key);
      if (evolution) evolutions.push(evolution);
    }
    
    return evolutions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}
```

## Configurable Decay Rules

```typescript
export interface DecayConfiguration {
  agentId: string;
  rules: DecayRule[];
}

export interface DecayRule {
  name: string;
  condition: string;          // "type === 'episodic'" or "keywords.includes('trauma')"
  decayRate: number;         // 0.01 = 1% per day
  minImportance: number;     // Don't decay below this importance
  neverDecay: boolean;       // Completely prevent decay
}

export class ConfigurableDecayEngine {
  async applyDecayRules(agentId: string, memories: Memory[]): Promise<Memory[]> {
    const config = await this.getDecayConfig(agentId);
    
    return memories.map(memory => {
      const applicableRule = this.findApplicableRule(memory, config.rules);
      
      if (applicableRule?.neverDecay) {
        return memory; // No decay
      }
      
      const decayRate = applicableRule?.decayRate || 0.05; // Default 5%/day
      const daysSinceAccess = this.daysSince(memory.lastAccessedAt);
      
      memory.resonance = Math.max(
        memory.resonance * Math.exp(-decayRate * daysSinceAccess),
        applicableRule?.minImportance || 0.1
      );
      
      return memory;
    });
  }
}
```

## Procedural Memory: Learning Tool Patterns

The system learns from successful tool usage to optimize future actions.

```typescript
// agentdock-core/src/memory/procedural/procedural-manager.ts

export interface ProceduralMemory extends Memory {
  type: 'procedural';
  pattern: ToolPattern;
  successRate: number;
  useCount: number;
}

export interface ToolPattern {
  name: string;
  sequence: ToolCall[];
  context: string;
  avgExecutionTime: number;
}

export interface ToolCall {
  tool: string;
  params: Record<string, any>;
  duration: number;
  result?: 'success' | 'failure';
}

export class ProceduralMemoryManager {
  async learnFromExecution(
    agentId: string,
    toolCalls: ToolCall[],
    outcome: 'success' | 'failure',
    context: string
  ): Promise<void> {
    if (outcome === 'success' && toolCalls.length >= 2) {
      // This sequence worked - remember it
      const pattern: ToolPattern = {
        name: this.generatePatternName(toolCalls),
        sequence: toolCalls,
        context: this.extractContext(context),
        avgExecutionTime: this.calculateAvgTime(toolCalls)
      };
      
      // Check if we've seen this pattern before
      const existing = await this.findSimilarPattern(agentId, pattern);
      
      if (existing) {
        // Update success rate
        existing.successRate = 
          (existing.successRate * existing.useCount + 1) / 
          (existing.useCount + 1);
        existing.useCount++;
        existing.pattern.avgExecutionTime = 
          (existing.pattern.avgExecutionTime + pattern.avgExecutionTime) / 2;
        await this.updateProceduralMemory(existing);
      } else {
        // New successful pattern
        const proceduralMemory: ProceduralMemory = {
          id: this.generateId(),
          agentId,
          type: 'procedural',
          content: `Successful workflow: ${pattern.name}`,
          pattern,
          successRate: 1.0,
          useCount: 1,
          importance: 0.8,
          resonance: 1.0,
          accessCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
          keywords: this.extractKeywords(context),
          extractionMethod: 'procedural'
        };
        
        await this.saveProceduralMemory(proceduralMemory);
      }
    } else if (outcome === 'failure') {
      // Learn from failures too
      const existingPattern = await this.findSimilarSequence(agentId, toolCalls);
      if (existingPattern) {
        // Decrease success rate
        existingPattern.successRate = Math.max(0, existingPattern.successRate - 0.1);
        await this.updateProceduralMemory(existingPattern);
      }
    }
  }
  
  async suggestTools(agentId: string, task: string, context?: string): Promise<ToolCall[]> {
    // Find patterns that worked for similar tasks
    const patterns = await this.searchProceduralMemories(agentId, task);
    
    // Filter by context similarity if provided
    const contextFiltered = context ? 
      patterns.filter(p => this.calculateContextSimilarity(p.pattern.context, context) > 0.6) :
      patterns;
    
    // Return the most successful pattern
    const best = contextFiltered
      .filter(p => p.successRate > 0.7)
      .sort((a, b) => (b.successRate * b.useCount) - (a.successRate * a.useCount))[0];
      
    if (best) {
      // Update access count
      best.accessCount++;
      best.lastAccessedAt = new Date();
      await this.updateProceduralMemory(best);
      
      return best.pattern.sequence;
    }
    
    return [];
  }
  
  async getProceduralInsights(agentId: string): Promise<ProceduralInsight[]> {
    const patterns = await this.getAllProceduralMemories(agentId);
    
    return patterns.map(p => ({
      patternName: p.pattern.name,
      successRate: p.successRate,
      useCount: p.useCount,
      avgExecutionTime: p.pattern.avgExecutionTime,
      recommendation: p.successRate > 0.8 ? 'highly_recommended' : 
                     p.successRate > 0.6 ? 'recommended' : 'review_needed',
      context: p.pattern.context
    }));
  }
  
  private generatePatternName(toolCalls: ToolCall[]): string {
    const tools = toolCalls.map(tc => tc.tool).join(' → ');
    return `${tools.replace(/[_-]/g, ' ')}`;
  }
  
  private extractContext(context: string): string {
    // Extract key contextual information
    const keywords = context.toLowerCase();
    if (keywords.includes('research')) return 'research_task';
    if (keywords.includes('support') || keywords.includes('help')) return 'support_task';
    if (keywords.includes('analysis')) return 'analysis_task';
    if (keywords.includes('creative') || keywords.includes('write')) return 'creative_task';
    return 'general_task';
  }
  
  private calculateAvgTime(toolCalls: ToolCall[]): number {
    return toolCalls.reduce((sum, tc) => sum + tc.duration, 0) / toolCalls.length;
  }
}

// Example: Learning that search → deep_research works for research tasks
const learnedPattern: ProceduralMemory = {
  id: 'proc_mem_001',
  agentId: 'research_agent',
  type: 'procedural',
  content: 'Successful workflow: search → deep_research',
  pattern: {
    name: 'research workflow',
    sequence: [
      { tool: 'search', params: { query: 'user_query' }, duration: 200, result: 'success' },
      { tool: 'deep_research', params: { topic: 'search_results' }, duration: 3000, result: 'success' }
    ],
    context: 'research_task',
    avgExecutionTime: 1600
  },
  successRate: 0.85,
  useCount: 20,
  importance: 0.9,
  resonance: 1.0,
  accessCount: 15,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastAccessedAt: new Date(),
  keywords: ['research', 'search', 'deep_research'],
  extractionMethod: 'procedural'
};
```

## Real-World Examples

### Therapy Agent Advanced Config

```typescript
const therapyAdvancedConfig = {
  connections: {
    enableZettelkasten: true,
    connectionThreshold: 0.6,  // Lower threshold for emotional patterns
    maxConnections: 20         // More connections for complex cases
  },
  
  decay: {
    rules: [
      {
        name: 'Critical Information',
        condition: "keywords.includes('trauma') || keywords.includes('suicide')",
        neverDecay: true
      },
      {
        name: 'Coping Strategies',
        condition: "type === 'procedural'",
        decayRate: 0.01,        // Very slow decay
        minImportance: 0.3
      },
      {
        name: 'Session Notes',
        condition: "type === 'episodic'",
        decayRate: 0.03,        // Moderate decay
        minImportance: 0.2
      }
    ]
  },
  
  vectorSearch: {
    enabled: true,
    embeddingModel: 'text-embedding-3-small',
    similarityThreshold: 0.7
  }
};
```

### Business Intelligence Agent

```typescript
const businessAdvancedConfig = {
  connections: {
    enableZettelkasten: true,
    connectionThreshold: 0.8,  // Higher threshold for business facts
    focusOnUpdates: true       // Track changing metrics
  },
  
  decay: {
    rules: [
      {
        name: 'Financial Data',
        condition: "keywords.includes('revenue') || keywords.includes('profit')",
        decayRate: 0.1,         // Fast decay for outdated numbers
        minImportance: 0.4
      },
      {
        name: 'Strategic Goals',
        condition: "type === 'semantic' && importance > 0.8",
        decayRate: 0.02,        // Slow decay for strategy
        minImportance: 0.5
      }
    ]
  }
};
```

## Pattern Discovery

```typescript
export class MemoryPatternDiscovery {
  async discoverPatterns(agentId: string): Promise<MemoryPattern[]> {
    const memories = await this.getAllMemories(agentId);
    const patterns: MemoryPattern[] = [];
    
    // Temporal patterns
    patterns.push(...this.findTemporalPatterns(memories));
    
    // Keyword clusters
    patterns.push(...this.findKeywordClusters(memories));
    
    // Connection networks
    patterns.push(...this.analyzeConnectionNetworks(memories));
    
    return patterns;
  }
  
  private findTemporalPatterns(memories: Memory[]): MemoryPattern[] {
    // Group by time periods and find recurring themes
    const timeGroups = this.groupByTimeWindows(memories, '1 week');
    
    return timeGroups
      .filter(group => group.memories.length > 3)
      .map(group => ({
        type: 'temporal',
        description: `Recurring theme: ${this.extractCommonKeywords(group.memories)}`,
        confidence: this.calculateConfidence(group.memories),
        memoryIds: group.memories.map(m => m.id)
      }));
  }
}
```

## Implementation Checklist

### Core Components
- [ ] `MemoryConnectionManager` for Zettelkasten-style linking
- [ ] `VectorMemorySearch` using existing vector adapters
- [ ] `MemoryEvolutionTracker` for change history
- [ ] `ConfigurableDecayEngine` with user-defined rules
- [ ] `MemoryPatternDiscovery` for insights

### Advanced Features
- [ ] Connection visualization interface
- [ ] Pattern discovery dashboard
- [ ] Decay rule configuration UI
- [ ] Memory evolution timeline view
- [ ] Vector similarity search API

### Integration
- [ ] Update storage schemas for connections
- [ ] Integrate with existing vector adapters
- [ ] Performance optimization for large connection graphs
- [ ] Real-time pattern detection

Key advantages:
- **Intelligent connections** reveal hidden insights
- **User-configurable decay** per use case
- **Vector search** for semantic similarity
- **Pattern discovery** identifies trends 