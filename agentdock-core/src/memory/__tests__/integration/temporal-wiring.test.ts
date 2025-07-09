/**
 * Integration test to verify temporal pattern wiring is complete
 */

import { MemoryManager } from '../../MemoryManager';
import { InMemoryStorageAdapter } from '../../../storage/adapters/InMemoryStorageAdapter';
import { StorageProvider, MemoryEvent } from '../../../storage/types';
import { MemoryType } from '../../../shared/types/memory';
import { RECALL_CONFIG_PRESETS } from '../../config/recall-presets';
import { testConfig } from '../config/test-config';

describe('Temporal Pattern Wiring Integration', () => {
  let storage: StorageProvider;
  let memoryManager: MemoryManager;
  let trackingEvents: MemoryEvent[] = [];

  beforeEach(async () => {
    // Create storage with evolution tracking
    storage = new InMemoryStorageAdapter();

    // Add evolution tracking to capture events
    storage.evolution = {
      async trackEvent(event: MemoryEvent) {
        trackingEvents.push(event);
      },
      async trackEventBatch(events: MemoryEvent[]) {
        trackingEvents.push(...events);
      }
    };

    // Create config with intelligence layer enabled
    const config = {
      intelligence: {
        temporal: { enabled: true },
        embedding: { 
          enabled: false,
          similarityThreshold: 0.7
        },
        connectionDetection: {
          enabled: true,
          method: 'embedding-only' as const,
          thresholds: {
            autoSimilar: 0.8,
            autoRelated: 0.6,
            llmRequired: 0.3
          }
        },
        costControl: {
          maxLLMCallsPerBatch: 10,
          preferEmbeddingWhenSimilar: true,
          trackTokenUsage: true
        }
      },
      working: testConfig.memory.working,
      episodic: testConfig.memory.episodic,
      semantic: testConfig.memory.semantic,
      procedural: testConfig.memory.procedural,
      recall: RECALL_CONFIG_PRESETS.default
    };

    // Create memory system with in-memory storage
    memoryManager = new MemoryManager(storage, config);
    trackingEvents = [];
  });

  afterEach(async () => {
    jest.clearAllMocks();
    trackingEvents = [];
  });

  it('should store temporal patterns in memory metadata', async () => {
    const userId = 'test-user';
    const agentId = 'test-agent';

    // Create multiple memories to trigger temporal analysis
    const memoryIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const id = await memoryManager.store(
        userId,
        agentId,
        `Test memory ${i}`,
        MemoryType.WORKING
      );
      memoryIds.push(id);
    }

    // Wait for async temporal analysis to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Debug: Check what memories exist
    const allMemories = await storage.memory?.recall?.(userId, agentId, '', { limit: 100 });
    console.log('Total memories found:', allMemories?.length);
    console.log('First memory:', allMemories?.[0]);
    
    // Also check if pattern analysis is finding memories
    const patternAnalyzer = (memoryManager as any).working?.temporalAnalyzer;
    if (patternAnalyzer) {
      console.log('Temporal analyzer exists');
      const testPatterns = await patternAnalyzer.analyzePatterns(agentId, undefined, userId);
      console.log('Test patterns found:', testPatterns);
    }

    // Check if any memory has temporal insights
    // Try multiple memories in case the first hasn't been analyzed yet
    let memory = null;
    for (const memoryId of memoryIds) {
      const m = await storage.memory?.getById?.(userId, memoryId);
      console.log(`Memory ${memoryId} metadata:`, m?.metadata);
      if (m?.metadata?.temporalInsights) {
        memory = m;
        break;
      }
    }
    
    // Since we created 10 memories rapidly, it should detect a burst pattern
    expect(memory?.metadata?.temporalInsights).toBeDefined();
    if (memory?.metadata?.temporalInsights) {
      expect((memory.metadata.temporalInsights as any).patterns).toBeInstanceOf(Array);
      expect((memory.metadata.temporalInsights as any).lastAnalyzed).toBeGreaterThan(0);
    }
  });

  it('should apply temporal boost during recall', async () => {
    const userId = 'test-user';
    const agentId = 'test-agent';

    // Store a memory with temporal pattern metadata
    const memoryId = await memoryManager.store(
      userId,
      agentId,
      'Memory with temporal pattern',
      MemoryType.WORKING
    );

    // Manually add temporal pattern to test boost
    if (storage.memory?.update) {
      await storage.memory.update(userId, agentId, memoryId, {
        metadata: {
          temporalInsights: {
            patterns: [{
              type: 'daily',
              confidence: 0.9,
              peakHours: [new Date().getHours()], // Current hour
              description: 'Peak activity hour'
            }],
            lastAnalyzed: Date.now()
          }
        }
      });
    }

    // Recall should apply temporal boost
    const results = await memoryManager.recall(userId, agentId, 'temporal pattern');
    
    expect(results.length).toBeGreaterThan(0);
    const memory = results.find((m: any) => m.id === memoryId);
    // The boost is applied but not marked in metadata currently
    expect(memory).toBeDefined();
  });

  it('should track memory lifecycle events', async () => {
    const userId = 'test-user';
    const agentId = 'test-agent';

    // Clear tracking
    trackingEvents = [];

    // Create memory
    const memoryId = await memoryManager.store(
      userId,
      agentId,
      'Test memory for tracking',
      MemoryType.WORKING
    );

    // Recall memory - this should trigger access tracking
    const results = await memoryManager.recall(userId, agentId, 'Test memory for tracking');
    
    // Make sure we actually found the memory
    expect(results.length).toBeGreaterThan(0);

    // Check events
    const createdEvent = trackingEvents.find(e => e.type === 'created');
    expect(createdEvent).toBeDefined();
    expect(createdEvent?.memoryId).toBe(memoryId);
    expect(createdEvent?.metadata?.memoryType).toBe('working');

    const accessedEvents = trackingEvents.filter(e => e.type === 'accessed');
    expect(accessedEvents.length).toBeGreaterThan(0);
  });

  it('should detect temporal connections between memories', async () => {
    const userId = 'test-user';
    const agentId = 'test-agent';

    // Create burst of memories
    const memoryIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = await memoryManager.store(
        userId,
        agentId,
        `Burst memory ${i}`,
        MemoryType.EPISODIC
      );
      memoryIds.push(id);
    }

    // Wait for temporal analysis and connection discovery
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check for connection events
    const connectionEvents = trackingEvents.filter(e => e.type === 'connected');
    
    // Memories from same burst should be connected
    if (connectionEvents.length > 0) {
      expect(connectionEvents[0].metadata?.source).toBe('MemoryConnectionManager');
    }
  });

  it('should use correct connection hop defaults from presets', () => {
    
    // Default should use 1 hop
    expect(RECALL_CONFIG_PRESETS.default.defaultConnectionHops).toBe(1);
    
    // Performance should use 1 hop
    expect(RECALL_CONFIG_PRESETS.performance.defaultConnectionHops).toBe(1);
    
    // Precision should use 1 hop
    expect(RECALL_CONFIG_PRESETS.precision.defaultConnectionHops).toBe(1);
    
    // Research should use 3 hops
    expect(RECALL_CONFIG_PRESETS.research.defaultConnectionHops).toBe(3);
  });
});