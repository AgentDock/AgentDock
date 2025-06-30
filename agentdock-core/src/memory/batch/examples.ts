/**
 * @fileoverview Batch Processing Configuration Examples
 * 
 * Example configurations for different use cases.
 * These are NOT defaults - users should customize for their needs.
 * 
 * @author AgentDock Core Team
 */

import { BatchProcessorConfig, ExtractionRule } from './types';
import { MemoryType } from '../types';

/**
 * Example configuration for cost-conscious deployments.
 * Focuses on zero-cost rule extraction with minimal LLM usage.
 * 
 * @example
 * ```typescript
 * const processor = new BatchProcessor(storage, BUDGET_FRIENDLY_CONFIG);
 * // Achieves 60% coverage at near-zero cost
 * ```
 */
export const BUDGET_FRIENDLY_CONFIG: BatchProcessorConfig = {
  // ADVANCED MEMORY CORE FIELDS - REQUIRED
  maxBatchSize: 50,
  timeoutMinutes: 5,
  minBatchSize: 5,
  extractionRate: 0.2,  // 20% processing = 5x cost reduction
  enableSmallModel: true,
  enablePremiumModel: false,
  
  // NOISE FILTERING
  noiseFiltering: {
    minMessageLength: 10,
    customPatterns: [],  // User defines patterns
    languageAgnostic: false
  },
  
  extractors: [
    { 
      type: 'rules', 
      enabled: true, 
      costPerMemory: 0,
      qualityThreshold: 0.6 
    },
    { 
      type: 'small-llm', 
      enabled: true, 
      costPerMemory: 0.0,          // User configures pricing
      provider: 'your-provider',    // User chooses provider
      model: 'your-model',         // User chooses model
      maxCost: 0.0,               // User sets limits
      qualityThreshold: 0.7
    }
  ],
  costBudget: 0.0,                // User sets budget
  targetCoverage: 0.8,
  batchSize: 20,
  parallelism: 2,
  monitoring: {
    trackCosts: true,
    collectMetrics: true,
    enableLogging: false
  }
};

/**
 * Example configuration for quality-focused deployments.
 * Uses all extraction tiers for maximum coverage and intelligence.
 * 
 * @example
 * ```typescript
 * const processor = new BatchProcessor(storage, PREMIUM_QUALITY_CONFIG);
 * // Achieves 95% coverage with advanced AI extraction
 * ```
 */
export const PREMIUM_QUALITY_CONFIG: BatchProcessorConfig = {
  // ADVANCED MEMORY CORE FIELDS - REQUIRED
  maxBatchSize: 30,
  timeoutMinutes: 3,
  minBatchSize: 3,
  extractionRate: 0.5,  // 50% processing for premium quality
  enableSmallModel: true,
  enablePremiumModel: true,
  
  // NOISE FILTERING
  noiseFiltering: {
    minMessageLength: 5,
    customPatterns: [],  // User defines patterns
    languageAgnostic: true
  },
  
  extractors: [
    { 
      type: 'rules', 
      enabled: true, 
      costPerMemory: 0,
      qualityThreshold: 0.6 
    },
    { 
      type: 'small-llm', 
      enabled: true, 
      costPerMemory: 0.0,          // User configures pricing
      provider: 'your-provider',    // User chooses provider
      model: 'your-model',         // User chooses model
      maxCost: 0.0,               // User sets limits
      qualityThreshold: 0.7
    },
    { 
      type: 'large-llm', 
      enabled: true, 
      costPerMemory: 0.0,          // User configures pricing
      provider: 'your-provider',    // User chooses provider
      model: 'your-model',         // User chooses model
      maxCost: 0.0,               // User sets limits
      qualityThreshold: 0.9
    }
  ],
  costBudget: 0.0,                // User sets budget
  targetCoverage: 0.95,
  batchSize: 10,
  parallelism: 4,
  monitoring: {
    trackCosts: true,
    collectMetrics: true,
    enableLogging: true
  }
};

/**
 * Example configuration for privacy-first deployments.
 * Uses only rule-based extraction with no AI API calls.
 * 
 * @example
 * ```typescript
 * const processor = new BatchProcessor(storage, PRIVACY_FIRST_CONFIG);
 * // Zero external API calls, complete data sovereignty
 * ```
 */
export const PRIVACY_FIRST_CONFIG: BatchProcessorConfig = {
  // ADVANCED MEMORY CORE FIELDS - REQUIRED
  maxBatchSize: 100,
  timeoutMinutes: 10,
  minBatchSize: 10,
  extractionRate: 1.0,  // 100% processing for privacy-first (rules only)
  enableSmallModel: false,
  enablePremiumModel: false,
  
  // NOISE FILTERING
  noiseFiltering: {
    minMessageLength: 15,
    customPatterns: [],  // User defines patterns
    languageAgnostic: false  // No LLM calls for privacy
  },
  
  extractors: [
    { 
      type: 'rules', 
      enabled: true, 
      costPerMemory: 0,
      qualityThreshold: 0.5 
    }
  ],
  costBudget: 0,
  targetCoverage: 0.6,
  batchSize: 50,
  parallelism: 1,
  monitoring: {
    trackCosts: false,
    collectMetrics: true,
    enableLogging: false
  }
};

/**
 * Example user-defined extraction rules.
 * These demonstrate how users can create their own patterns.
 * 
 * @example
 * ```typescript
 * // Users would create rules like this:
 * const myRules = [...EXAMPLE_USER_RULES];
 * await storage.set(`extraction-rules:${agentId}`, myRules);
 * ```
 */
export const EXAMPLE_USER_RULES: ExtractionRule[] = [
  {
    id: 'explicit-memory-requests',
    pattern: '(remember|don\'t forget|note|keep in mind)\\s+(.+)',
    type: MemoryType.SEMANTIC,
    importance: 1.0,
    metadata: { category: 'explicit-request' },
    createdBy: 'user-example',
    createdAt: new Date(),
    tags: ['important', 'explicit'],
    isActive: true
  },
  {
    id: 'user-preferences',
    pattern: 'I\\s+(prefer|like|want|need|hate|dislike)\\s+(.+)',
    type: MemoryType.SEMANTIC,
    importance: 0.8,
    metadata: { category: 'preference' },
    createdBy: 'user-example',
    createdAt: new Date(),
    tags: ['preference', 'personal'],
    isActive: true
  },
  {
    id: 'decisions-made',
    pattern: 'I\\s+(decided|chose|selected)\\s+(.+)',
    type: MemoryType.EPISODIC,
    importance: 0.7,
    metadata: { category: 'decision' },
    createdBy: 'user-example',
    createdAt: new Date(),
    tags: ['decision', 'choice'],
    isActive: true
  },
  {
    id: 'learning-insights',
    pattern: 'I\\s+(learned|discovered|realized)\\s+(.+)',
    type: MemoryType.SEMANTIC,
    importance: 0.9,
    metadata: { category: 'insight' },
    createdBy: 'user-example',
    createdAt: new Date(),
    tags: ['learning', 'insight'],
    isActive: true
  },
  {
    id: 'todo-tasks',
    pattern: '(todo|to-do|task|need to)\\s*:?\\s*(.+)',
    type: MemoryType.PROCEDURAL,
    importance: 0.8,
    metadata: { category: 'task' },
    createdBy: 'user-example',
    createdAt: new Date(),
    tags: ['task', 'todo'],
    isActive: true
  }
];
