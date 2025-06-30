import { MemoryType } from '../types/common';
import { 
  RecallQuery, 
  UnifiedMemoryResult, 
  HybridSearchResult,
  VectorSearchResult,
  TextSearchResult,
  ProceduralMatchResult,
  RelatedMemory
} from './RecallServiceTypes'
import { EpisodicMemoryData } from '../types/episodic/EpisodicMemoryTypes'
import { SemanticMemoryData } from '../types/semantic/SemanticMemoryTypes'
import { ProceduralMemoryData } from '../types/procedural/ProceduralMemoryTypes'
import { WorkingMemoryData } from '../types/working/WorkingMemoryTypes'

/**
 * Utility functions for RecallService operations
 */

/**
 * Convert different memory types to unified format
 */
export function convertToUnifiedResult(
  memory: EpisodicMemoryData | SemanticMemoryData | ProceduralMemoryData | WorkingMemoryData,
  type: MemoryType,
  relevance: number = 0.5
): UnifiedMemoryResult {
  const baseResult = {
    id: memory.id,
    type,
    relevance,
    relationships: [],
    metadata: memory.metadata || {}
  };

  switch (type) {
    case MemoryType.WORKING: {
      const workingMemory = memory as WorkingMemoryData;
      return {
        ...baseResult,
        content: workingMemory.content,
        confidence: 1.0, // Working memory is always current
        timestamp: workingMemory.createdAt,
        context: {
          sessionId: workingMemory.sessionId,
          tokenCount: workingMemory.tokenCount,
          contextWindow: workingMemory.contextWindow,
          expiresAt: workingMemory.expiresAt
        }
      };
    }

    case MemoryType.EPISODIC: {
      const episodicMemory = memory as EpisodicMemoryData;
      return {
        ...baseResult,
        content: episodicMemory.content,
        confidence: episodicMemory.resonance,
        timestamp: episodicMemory.createdAt,
        context: {
          sessionId: episodicMemory.sessionId,
          importance: episodicMemory.importance,
          tags: episodicMemory.tags,
          contextData: episodicMemory.context
        }
      };
    }

    case MemoryType.SEMANTIC: {
      const semanticMemory = memory as SemanticMemoryData;
      return {
        ...baseResult,
        content: semanticMemory.content,
        confidence: semanticMemory.confidence,
        timestamp: semanticMemory.createdAt,
        context: {
          category: semanticMemory.category,
          importance: semanticMemory.importance,
          keywords: semanticMemory.keywords,
          facts: semanticMemory.facts
        }
      };
    }

    case MemoryType.PROCEDURAL: {
      const proceduralMemory = memory as ProceduralMemoryData;
      return {
        ...baseResult,
        content: `${proceduralMemory.trigger} → ${proceduralMemory.action}`,
        confidence: proceduralMemory.confidence,
        timestamp: proceduralMemory.lastUsed,
        context: {
          pattern: proceduralMemory.pattern,
          successRate: proceduralMemory.successCount / proceduralMemory.totalCount,
          conditions: proceduralMemory.conditions,
          usageCount: proceduralMemory.totalCount
        }
      };
    }

    default:
      throw new Error(`Unknown memory type: ${type}`);
  }
}

/**
 * Calculate combined relevance score using multiple factors
 */
export function calculateCombinedRelevance(
  vectorScore: number = 0,
  textScore: number = 0,
  temporalScore: number = 0,
  proceduralScore: number = 0,
  weights: { vector: number; text: number; temporal: number; procedural: number }
): number {
  const normalizedWeights = normalizeWeights(weights);
  
  return (
    vectorScore * normalizedWeights.vector +
    textScore * normalizedWeights.text +
    temporalScore * normalizedWeights.temporal +
    proceduralScore * normalizedWeights.procedural
  );
}

/**
 * Calculate temporal relevance based on recency and query time range
 */
export function calculateTemporalRelevance(
  memoryTimestamp: number,
  currentTime: number = Date.now(),
  timeRange?: { start: number; end: number }
): number {
  // If specific time range is requested
  if (timeRange) {
    if (memoryTimestamp < timeRange.start || memoryTimestamp > timeRange.end) {
      return 0; // Outside requested range
    }
    // Full relevance if within range
    return 1.0;
  }

  // Otherwise, use recency decay
  const daysSinceCreation = (currentTime - memoryTimestamp) / (24 * 60 * 60 * 1000);
  
  // Exponential decay with different rates for different memory types
  if (daysSinceCreation <= 1) return 1.0; // Recent memories get full score
  if (daysSinceCreation <= 7) return 0.8; // Last week
  if (daysSinceCreation <= 30) return 0.6; // Last month
  if (daysSinceCreation <= 90) return 0.4; // Last quarter
  
  return Math.max(0.1, 1 / Math.log(daysSinceCreation + 1)); // Logarithmic decay
}

/**
 * Calculate text relevance using keyword matching and content analysis
 */
export function calculateTextRelevance(
  content: string,
  query: string,
  keywords: string[] = []
): number {
  const queryTerms = extractQueryTerms(query);
  const contentTerms = extractContentTerms(content);
  
  let score = 0;
  let maxScore = 0;

  // Exact phrase match (highest score)
  if (content.toLowerCase().includes(query.toLowerCase())) {
    score += 1.0;
  }
  maxScore += 1.0;

  // Individual term matches
  for (const term of queryTerms) {
    if (contentTerms.includes(term.toLowerCase())) {
      score += 0.3;
    }
    maxScore += 0.3;
  }

  // Keyword matches
  for (const keyword of keywords) {
    if (queryTerms.includes(keyword.toLowerCase())) {
      score += 0.2;
    }
    maxScore += 0.2;
  }

  // TF-IDF style scoring for term frequency
  const termFrequencyScore = calculateTermFrequency(content, queryTerms);
  score += termFrequencyScore * 0.5;
  maxScore += 0.5;

  return maxScore > 0 ? Math.min(1.0, score / maxScore) : 0;
}

/**
 * Merge and rank hybrid search results
 */
export function mergeHybridResults(
  vectorResults: VectorSearchResult[],
  textResults: TextSearchResult[],
  proceduralResults: ProceduralMatchResult[],
  weights: { vector: number; text: number; temporal: number; procedural: number }
): UnifiedMemoryResult[] {
  const resultMap = new Map<string, UnifiedMemoryResult>();
  const scoreMap = new Map<string, number>();

  // Process vector results
  for (const result of vectorResults) {
    const id = result.memory.id;
    resultMap.set(id, result.memory);
    scoreMap.set(id, result.similarity * weights.vector);
  }

  // Process text results
  for (const result of textResults) {
    const id = result.memory.id;
    const existing = resultMap.get(id);
    
    if (existing) {
      // Combine scores
      const currentScore = scoreMap.get(id) || 0;
      scoreMap.set(id, currentScore + (result.relevance * weights.text));
    } else {
      resultMap.set(id, result.memory);
      scoreMap.set(id, result.relevance * weights.text);
    }
  }

  // Process procedural results
  for (const result of proceduralResults) {
    const id = result.memory.id;
    const existing = resultMap.get(id);
    const proceduralScore = (result.patternMatch + result.contextMatch + result.usageScore) / 3;
    
    if (existing) {
      const currentScore = scoreMap.get(id) || 0;
      scoreMap.set(id, currentScore + (proceduralScore * weights.procedural));
    } else {
      resultMap.set(id, result.memory);
      scoreMap.set(id, proceduralScore * weights.procedural);
    }
  }

  // Convert to array and sort by combined score
  const results = Array.from(resultMap.entries()).map(([id, memory]) => ({
    ...memory,
    relevance: scoreMap.get(id) || 0
  }));

  return results.sort((a, b) => b.relevance - a.relevance);
}

/**
 * Find relationships between memories
 */
export function findMemoryRelationships(
  memory: UnifiedMemoryResult,
  allMemories: UnifiedMemoryResult[],
  maxRelations: number = 5
): RelatedMemory[] {
  const relationships: RelatedMemory[] = [];

  for (const other of allMemories) {
    if (other.id === memory.id) continue;

    // Same session relationship
    if (memory.type === MemoryType.EPISODIC && other.type === MemoryType.EPISODIC) {
      if (memory.context.sessionId === other.context.sessionId) {
        relationships.push({
          id: other.id,
          type: other.type,
          relationshipType: 'same_session',
          strength: 0.8,
          reason: 'Same conversation session'
        });
      }
    }

    // Semantic similarity
    if (memory.type === MemoryType.SEMANTIC || other.type === MemoryType.SEMANTIC) {
      const similarity = calculateContentSimilarity(memory.content, other.content);
      if (similarity > 0.6) {
        relationships.push({
          id: other.id,
          type: other.type,
          relationshipType: 'semantic_similarity',
          strength: similarity,
          reason: `Content similarity: ${Math.round(similarity * 100)}%`
        });
      }
    }

    // Temporal proximity
    const timeDiff = Math.abs(memory.timestamp - other.timestamp);
    const hoursDiff = timeDiff / (60 * 60 * 1000);
    
    if (hoursDiff <= 24) { // Within 24 hours
      const temporalStrength = Math.max(0.3, 1 - (hoursDiff / 24));
      relationships.push({
        id: other.id,
        type: other.type,
        relationshipType: 'temporal_proximity',
        strength: temporalStrength,
        reason: `Created within ${Math.round(hoursDiff)}h`
      });
    }

    // Pattern relationships for procedural memories
    if (memory.type === MemoryType.PROCEDURAL && other.type === MemoryType.PROCEDURAL) {
      const patternSimilarity = calculatePatternSimilarity(
        memory.context.pattern || '',
        other.context.pattern || ''
      );
      
      if (patternSimilarity > 0.5) {
        relationships.push({
          id: other.id,
          type: other.type,
          relationshipType: 'pattern_similarity',
          strength: patternSimilarity,
          reason: `Similar behavioral pattern`
        });
      }
    }
  }

  // Sort by strength and return top relationships
  return relationships
    .sort((a, b) => b.strength - a.strength)
    .slice(0, maxRelations);
}

/**
 * Optimize query for better recall performance
 */
export function optimizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, 200); // Limit length
}

/**
 * Extract meaningful terms from query
 */
function extractQueryTerms(query: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 2 && !stopWords.has(term));
}

/**
 * Extract terms from content
 */
function extractContentTerms(content: string): string[] {
  return content
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 2);
}

/**
 * Calculate term frequency in content
 */
function calculateTermFrequency(content: string, terms: string[]): number {
  const contentLower = content.toLowerCase();
  let totalMatches = 0;
  
  for (const term of terms) {
    const matches = (contentLower.match(new RegExp(term, 'g')) || []).length;
    totalMatches += matches;
  }
  
  return Math.min(1.0, totalMatches / (content.length / 100));
}

/**
 * Calculate content similarity using simple word overlap
 */
function calculateContentSimilarity(content1: string, content2: string): number {
  const terms1 = new Set(extractContentTerms(content1));
  const terms2 = new Set(extractContentTerms(content2));
  
  const intersection = new Set(
    Array.from(terms1).filter(x => terms2.has(x))
  );
  const union = new Set(Array.from(terms1).concat(Array.from(terms2)));
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Calculate pattern similarity for procedural memories
 */
function calculatePatternSimilarity(pattern1: string, pattern2: string): number {
  if (!pattern1 || !pattern2) return 0;
  
  // Simple Levenshtein-based similarity
  const maxLen = Math.max(pattern1.length, pattern2.length);
  if (maxLen === 0) return 1.0;
  
  const distance = levenshteinDistance(pattern1, pattern2);
  return 1 - (distance / maxLen);
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Normalize weights to sum to 1.0
 */
function normalizeWeights(weights: { vector: number; text: number; temporal: number; procedural: number }): typeof weights {
  const total = weights.vector + weights.text + weights.temporal + weights.procedural;
  
  if (total === 0) {
    return { vector: 0.25, text: 0.25, temporal: 0.25, procedural: 0.25 };
  }
  
  return {
    vector: weights.vector / total,
    text: weights.text / total,
    temporal: weights.temporal / total,
    procedural: weights.procedural / total
  };
}

/**
 * Validate recall query
 */
export function validateRecallQuery(query: RecallQuery): boolean {
  return query.agentId?.length > 0 &&
         query.query?.length > 0 &&
         (query.limit || 0) <= 1000 &&
         (query.minRelevance || 0) >= 0 &&
         (query.minRelevance || 1) <= 1;
}