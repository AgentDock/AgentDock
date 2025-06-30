export interface ProceduralMemoryData {
  id: string;
  agentId: string;
  trigger: string;
  action: string;
  context: string;
  pattern: string;
  successCount: number;
  totalCount: number;
  confidence: number;
  lastUsed: number;
  createdAt: number;
  metadata: Record<string, any>;
  conditions: string[];
  outcomes: Array<{
    success: boolean;
    timestamp: number;
    context?: Record<string, any>;
  }>;
}

export interface ProceduralMemoryConfig {
  minSuccessRate: number;
  maxPatternsPerCategory: number;
  decayRate: number;
  confidenceThreshold: number;
  adaptiveLearning: boolean;
  patternMerging: boolean;
}

// OpenAI Embedding & Pattern Learning Best Practices (June 2025)
// Based on text-embedding-3 models and procedural AI research
export const PROCEDURAL_MEMORY_DEFAULTS = {
  // OpenAI 2025: 0.7 = high confidence threshold for procedural patterns
  // Procedural learning needs higher confidence than semantic similarity
  confidenceThreshold: 0.7,
  
  // Pattern learning: 60% success rate minimum for reliable patterns
  minSuccessRate: 0.6,
  
  // Pattern organization: reasonable limits per category
  maxPatternsPerCategory: 100,
  
  // Gradual decay for outdated patterns (5% per period)
  decayRate: 0.05,
  
  // Advanced features
  adaptiveLearning: true,
  patternMerging: true
} as const;

export interface ProceduralQuery {
  agentId: string;
  trigger?: string;
  pattern?: string;
  minConfidence?: number;
  minSuccessRate?: number;
  category?: string;
  context?: Record<string, any>;
  limit?: number;
}

export interface ProceduralPattern {
  trigger: string;
  conditions: string[];
  action: string;
  context: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ProceduralOutcome {
  success: boolean;
  executionTime?: number;
  error?: string;
  feedback?: string;
  context?: Record<string, any>;
}

export interface ProceduralMemoryStats {
  totalPatterns: number;
  patternsByCategory: Record<string, number>;
  avgSuccessRate: number;
  avgConfidence: number;
  mostUsedPatterns: Array<{
    pattern: string;
    usageCount: number;
    successRate: number;
  }>;
  recentOutcomes: Array<{
    pattern: string;
    success: boolean;
    timestamp: number;
  }>;
}

export interface StoreProceduralOptions {
  pattern?: string;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
  confidence?: number;
  category?: string;
  conditions?: string[];
}

export interface LearningResult {
  patternId: string;
  learned: boolean;
  confidence: number;
  reason: string;
}

export interface AdaptationResult {
  adapted: number;
  merged: number;
  removed: number;
  created: number;
}

export interface PatternMatchResult {
  pattern: ProceduralMemoryData;
  confidence: number;
  contextMatch: number;
  reason: string;
}