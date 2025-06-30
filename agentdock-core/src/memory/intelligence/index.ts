/**
 * @fileoverview Intelligence Layer API - Language-agnostic memory intelligence
 * 
 * Provides configurable memory intelligence features following CTO's hybrid approach:
 * - Base embedding similarity (free)
 * - Optional user-configurable rules (free)
 * - Optional LLM enhancement (cost-controlled)
 * 
 * @author AgentDock Core Team
 */

// Import types for internal use
import type {
  IntelligenceLayerConfig,
  ConsolidationConfig,
  ConnectionRule
} from './types';

// Core intelligence services
export { EmbeddingService } from './embeddings/EmbeddingService';
export { MemoryConnectionManager } from './connections/MemoryConnectionManager';
export { ConnectionGraph } from './graph/ConnectionGraph';
export { TemporalPatternAnalyzer } from './patterns/TemporalPatternAnalyzer';
export { MemoryConsolidator } from './consolidation/MemoryConsolidator';

// Type definitions - all configuration interfaces from types.ts
export type {
  // Connection types
  ConnectionType,
  MemoryConnection,
  
  // Configuration interfaces (CTO's hybrid approach)
  IntelligenceLayerConfig,
  ConnectionRule,
  
  // Service configurations
  EmbeddingConfig,
  EmbeddingResult,
  ConsolidationConfig,
  ConsolidationResult,
  
  // Pattern analysis types
  TemporalPattern,
  ActivityCluster,
  
  // Graph types
  ConnectionGraph as ConnectionGraphInterface,
  
  // Importance scoring
  ImportanceFactors,
  ImportanceScore
} from './types';

/**
 * Default configuration following CTO's progressive enhancement pattern
 */
export const DEFAULT_INTELLIGENCE_CONFIG: IntelligenceLayerConfig = {
  // Base layer - always enabled, zero cost
  embedding: {
    enabled: true,
    similarityThreshold: 0.7,
    model: 'text-embedding-3-small' // Default embedding model
  },
  
  // Progressive enhancement configuration
  connectionDetection: {
    method: 'hybrid', // Use all available methods
    
    // User rules (free, configurable)
    userRules: {
      enabled: true,
      patterns: [] // Users can add their own patterns
    },
    
    // LLM enhancement (optional, cost-aware)
    llmEnhancement: {
      enabled: false, // Disabled by default - user must opt-in
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307', // Small, cost-effective model
      maxTokensPerAnalysis: 150,
      temperature: 0.2,
      validateResponses: true,
      fallbackToEmbedding: true,
      costPerToken: 0.00000025 // User should configure based on their pricing
    }
  },
  
  // Cost control - following batch processing patterns
  costControl: {
    maxLLMCallsPerBatch: 50,
    monthlyBudget: 10.0, // $10 monthly budget default
    preferEmbeddingWhenSimilar: true, // Skip LLM if embedding > 0.9
    trackTokenUsage: true
  }
};

/**
 * Default consolidation configuration
 */
export const DEFAULT_CONSOLIDATION_CONFIG: ConsolidationConfig = {
  similarityThreshold: 0.85,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for episodic->semantic
  preserveOriginals: false,
  strategies: ['merge', 'synthesize'],
  batchSize: 20,
  enableLLMSummarization: false, // Disabled by default
  llmConfig: {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    costPerToken: 0.00000025,
    maxTokensPerSummary: 200
  }
};

/**
 * Example user-configurable connection rules (language-agnostic examples)
 */
export const EXAMPLE_CONNECTION_RULES: ConnectionRule[] = [
  {
    id: 'contradiction-pattern',
    name: 'Contradiction Detection',
    description: 'Detect contradictory information',
    pattern: '(not|never|opposite|contrary|wrong|incorrect)',
    connectionType: 'contradicts',
    confidence: 0.7,
    caseSensitive: false,
    enabled: true,
    createdBy: 'system',
    createdAt: new Date()
  },
  {
    id: 'reference-pattern',
    name: 'Reference Detection',
    description: 'Detect explicit references',
    pattern: '(mentioned|discussed|said|wrote|stated)',
    connectionType: 'references',
    confidence: 0.6,
    caseSensitive: false,
    enabled: true,
    createdBy: 'system',
    createdAt: new Date()
  },
  {
    id: 'update-pattern',
    name: 'Update Detection',
    description: 'Detect updates and corrections',
    pattern: '(update|updated|changed|modified|corrected|revised)',
    connectionType: 'updates',
    confidence: 0.8,
    caseSensitive: false,
    enabled: true,
    createdBy: 'system',
    createdAt: new Date()
  }
];

/**
 * Helper function to create intelligence layer config with user overrides
 */
export function createIntelligenceConfig(
  overrides: Partial<IntelligenceLayerConfig> = {}
): IntelligenceLayerConfig {
  return {
    ...DEFAULT_INTELLIGENCE_CONFIG,
    ...overrides,
    embedding: {
      ...DEFAULT_INTELLIGENCE_CONFIG.embedding,
      ...overrides.embedding
    },
    connectionDetection: {
      ...DEFAULT_INTELLIGENCE_CONFIG.connectionDetection,
      ...overrides.connectionDetection,
      userRules: overrides.connectionDetection?.userRules ? {
        ...DEFAULT_INTELLIGENCE_CONFIG.connectionDetection.userRules,
        ...overrides.connectionDetection.userRules
      } : DEFAULT_INTELLIGENCE_CONFIG.connectionDetection.userRules,
      llmEnhancement: overrides.connectionDetection?.llmEnhancement ? {
        ...DEFAULT_INTELLIGENCE_CONFIG.connectionDetection.llmEnhancement,
        ...overrides.connectionDetection.llmEnhancement
      } : DEFAULT_INTELLIGENCE_CONFIG.connectionDetection.llmEnhancement
    },
    costControl: {
      ...DEFAULT_INTELLIGENCE_CONFIG.costControl,
      ...overrides.costControl
    }
  };
} 
 
 