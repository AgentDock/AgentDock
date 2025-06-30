/**
 * Test Configuration - NO HARDCODED DEFAULTS
 * 
 * All test configurations must be explicitly defined to verify
 * the system is configuration-driven, not relying on defaults.
 */

import { MemoryType } from '../../types';

export const testConfig = {
  // Test user IDs for isolation testing
  users: {
    alice: 'user-alice-test-123',
    bob: 'user-bob-test-456', 
    charlie: 'user-charlie-test-789'
  },
  
  // Test agent IDs for cross-agent isolation
  agents: {
    shared: 'agent-shared-test-abc',
    personal: 'agent-personal-test-def',
    published: 'agent-published-test-ghi'
  },
  
  // Memory configurations - EXPLICITLY DEFINED (no defaults)
  memory: {
    working: {
      maxContextItems: 50,
      ttlSeconds: 300,
      encryptSensitive: false,
      maxTokens: 1000,
      compressionThreshold: 100
    },
    episodic: {
      maxMemoriesPerSession: 100,
      decayRate: 0.1,
      importanceThreshold: 0.3,
      encryptSensitive: false,
      compressionAge: 30
    },
    semantic: {
      deduplicationThreshold: 0.8,
      maxMemoriesPerCategory: 500,
      confidenceThreshold: 0.5,
      encryptSensitive: false,
      vectorSearchEnabled: false,
      autoExtractFacts: false
    },
    procedural: {
      minSuccessRate: 0.6,
      adaptiveLearning: true,
      maxPatternsPerCategory: 100,
      decayRate: 0.05,
      confidenceThreshold: 0.7,
      patternMerging: true
    }
  },
  
  // Batch processing test configuration
  batch: {
    maxBatchSize: 20,
    minBatchSize: 5,
    timeoutMinutes: 1,
    extractionRate: 0.2, // 5x cost reduction
    enableSmallModel: true,
    enablePremiumModel: false, // Disable for testing to avoid costs
    costBudget: 10.0,
    extractors: [
      {
        type: 'rules',
        enabled: true,
        costPerMemory: 0
      },
      {
        type: 'small-llm',
        enabled: true,
        costPerMemory: 0.001
      },
      {
        type: 'large-llm',
        enabled: false, // Disabled for testing
        costPerMemory: 0.01
      }
    ],
    noiseFiltering: {
      languageAgnostic: false, // Simplified for testing
      minMessageLength: 10
    }
  },
  
  // Performance testing targets
  performance: {
    storeLatencyMs: 50,
    recallLatencyMs: 100,
    batchLatencyPerMemoryMs: 25,
    maxMemoriesForTest: 1000
  },
  
  // Test data patterns
  testData: {
    sampleMemories: [
      { content: 'User prefers dark mode interface', type: MemoryType.SEMANTIC },
      { content: 'Had productive meeting about Q3 planning', type: MemoryType.EPISODIC },
      { content: 'Successfully used git rebase command', type: MemoryType.PROCEDURAL },
      { content: 'Currently working on memory system testing', type: MemoryType.WORKING }
    ],
    sensitiveData: [
      'password123',
      'credit card 1234-5678-9012-3456',
      'SSN 123-45-6789',
      'API key sk-abc123def456'
    ],
    queryTerms: ['password', 'meeting', 'git', 'testing', 'interface']
  }
};

/**
 * Generate test memory data with configurable properties
 */
export function createTestMemory(overrides: any = {}) {
  const now = Date.now();
  return {
    id: `mem_test_${now}_${Math.random().toString(36).substring(2, 9)}`,
    userId: overrides.userId || testConfig.users.alice,
    agentId: overrides.agentId || testConfig.agents.shared,
    type: overrides.type || MemoryType.SEMANTIC,
    content: overrides.content || 'Test memory content',
    importance: overrides.importance ?? 0.7,
    resonance: 1.0,
    accessCount: 0,
    createdAt: overrides.createdAt || now,
    updatedAt: now,
    lastAccessedAt: now,
    keywords: [],
    metadata: {}
  };
}

/**
 * Generate multiple test memories with staggered creation times
 */
export function createTestMemories(count: number, userIdPattern?: (i: number) => string) {
  return Array.from({ length: count }, (_, i) => createTestMemory({
    userId: userIdPattern ? userIdPattern(i) : testConfig.users.alice,
    content: `Test memory ${i + 1}`,
    createdAt: Date.now() - (i * 1000), // Stagger creation times
    importance: 0.5 + (i % 5) * 0.1 // Vary importance 0.5-0.9
  }));
}

/**
 * User isolation test patterns
 */
export const isolationTestPatterns = {
  // Different users, same agent
  multiUserSameAgent: {
    users: [testConfig.users.alice, testConfig.users.bob, testConfig.users.charlie],
    agent: testConfig.agents.shared,
    expectedIsolation: true
  },
  
  // Same user, different agents  
  sameUserMultiAgent: {
    user: testConfig.users.alice,
    agents: [testConfig.agents.personal, testConfig.agents.shared, testConfig.agents.published],
    expectedIsolation: true
  },
  
  // Cross-contamination test data
  contaminationTests: [
    {
      user1: testConfig.users.alice,
      user1Data: 'Alice confidential information',
      user2: testConfig.users.bob,
      user2Data: 'Bob confidential information',
      agent: testConfig.agents.shared,
      shouldNotCrossContaminate: true
    }
  ]
}; 