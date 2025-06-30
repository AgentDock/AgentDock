import { SemanticMemoryData } from './SemanticMemoryTypes'

/**
 * Utility functions for SemanticMemory operations
 */

/**
 * Generate unique semantic memory ID
 */
export function generateSemanticMemoryId(): string {
  return `sm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get table name for namespace
 */
export function getSemanticTableName(namespace: string): string {
  return `semantic_memory_${namespace.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Extract keywords from content using simple frequency analysis
 */
export function extractKeywords(content: string): string[] {
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !isStopWord(word));

  // Count frequency and return top keywords
  const wordCount = new Map<string, number>();
  words.forEach(word => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  });

  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Extract facts from content using simple pattern matching
 */
export function extractFacts(content: string): string[] {
  const facts: string[] = [];
  
  // Simple pattern matching for factual statements
  const factPatterns = [
    /(.+) is (.+)/g,
    /(.+) was (.+)/g,
    /(.+) has (.+)/g,
    /(.+) can (.+)/g,
    /(.+) will (.+)/g
  ];

  for (const pattern of factPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of Array.from(matches)) {
      if (match[0].length > 10 && match[0].length < 200) {
        facts.push(match[0].trim());
      }
    }
  }

  return facts.slice(0, 5); // Limit to 5 facts per content
}

/**
 * Categorize semantic content based on keywords and patterns
 */
export function categorizeContent(content: string): string {
  const lowerContent = content.toLowerCase();
  
  if (lowerContent.includes('code') || lowerContent.includes('programming')) {
    return 'programming';
  }
  if (lowerContent.includes('definition') || isDefinition(content)) {
    return 'definition';
  }
  if (isExplanation(content)) {
    return 'explanation';
  }
  if (lowerContent.includes('fact') || lowerContent.includes('information')) {
    return 'facts';
  }
  if (lowerContent.includes('procedure') || lowerContent.includes('how to')) {
    return 'procedure';
  }
  
  return 'general_knowledge';
}

/**
 * Calculate semantic memory importance based on content characteristics
 */
export function calculateSemanticImportance(
  content: string,
  facts: string[] = [],
  keywords: string[] = []
): number {
  let importance = 0.4;

  // More facts = more important
  importance += Math.min(facts.length * 0.1, 0.3);
  
  // More keywords = more comprehensive
  importance += Math.min(keywords.length * 0.02, 0.2);

  // Definitions and explanations are important
  if (isDefinition(content) || isExplanation(content)) {
    importance += 0.3;
  }

  // Longer content might be more detailed
  if (content.length > 500) {
    importance += 0.1;
  }

  return Math.min(importance, 1.0);
}

/**
 * Calculate confidence based on content quality indicators
 */
export function calculateSemanticConfidence(
  content: string,
  sourceRole: string = 'assistant',
  facts: string[] = []
): number {
  let confidence = 0.5;
  
  // Assistant messages generally more reliable
  if (sourceRole === 'assistant') confidence += 0.2;
  
  // More facts = higher confidence
  confidence += Math.min(facts.length * 0.05, 0.2);
  
  // Definitive language increases confidence
  if (/definitely|certainly|always|never/i.test(content)) {
    confidence += 0.1;
  }
  
  // Uncertain language decreases confidence
  if (/maybe|perhaps|might|could be|possibly/i.test(content)) {
    confidence -= 0.1;
  }
  
  return Math.max(Math.min(confidence, 1.0), 0.1);
}

/**
 * Check if content is a definition
 */
export function isDefinition(content: string): boolean {
  return /(.+) is (a|an|the) (.+)/i.test(content) ||
         /(.+) refers to (.+)/i.test(content) ||
         /(.+) means (.+)/i.test(content) ||
         /define (.+)/i.test(content);
}

/**
 * Check if content is an explanation
 */
export function isExplanation(content: string): boolean {
  return content.includes('because') ||
         content.includes('therefore') ||
         content.includes('as a result') ||
         /this (is|works|happens) because/i.test(content) ||
         /the reason (.+) is/i.test(content);
}

/**
 * Check if word is a stop word
 */
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'this', 'that', 'these', 'those', 'is', 'are',
    'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must'
  ]);
  return stopWords.has(word);
}

/**
 * Find similar content based on keyword overlap
 */
export function calculateContentSimilarity(
  content1: string,
  content2: string,
  keywords1: string[],
  keywords2: string[]
): number {
  // Simple similarity based on keyword overlap
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
  const union = new Set(Array.from(set1).concat(Array.from(set2)));
  
  const jaccardSimilarity = intersection.size / union.size;
  
  // Also consider content length similarity
  const lengthSimilarity = 1 - Math.abs(content1.length - content2.length) / Math.max(content1.length, content2.length);
  
  return (jaccardSimilarity * 0.7) + (lengthSimilarity * 0.3);
}

/**
 * Merge two semantic memories into one
 */
export function mergeSemanticMemories(
  memory1: SemanticMemoryData,
  memory2: SemanticMemoryData
): SemanticMemoryData {
  // Keep the one with higher confidence as base
  const primary = memory1.confidence >= memory2.confidence ? memory1 : memory2;
  const secondary = primary === memory1 ? memory2 : memory1;

  // Merge keywords and facts
  const mergedKeywords = Array.from(new Set([...primary.keywords, ...secondary.keywords]));
  const mergedFacts = Array.from(new Set([...primary.facts, ...secondary.facts]));
  const mergedSourceIds = Array.from(new Set([...primary.sourceIds, ...secondary.sourceIds]));

  return {
    ...primary,
    keywords: mergedKeywords,
    facts: mergedFacts,
    sourceIds: mergedSourceIds,
    importance: Math.max(primary.importance, secondary.importance),
    confidence: Math.max(primary.confidence, secondary.confidence),
    metadata: {
      ...primary.metadata,
      ...secondary.metadata,
      mergedFrom: [primary.id, secondary.id],
      mergedAt: Date.now()
    }
  };
}

/**
 * Validate semantic memory configuration
 */
export function validateSemanticConfig(config: any): boolean {
  return config.deduplicationThreshold >= 0 &&
         config.deduplicationThreshold <= 1 &&
         config.maxMemoriesPerCategory > 0 &&
         config.confidenceThreshold >= 0 &&
         config.confidenceThreshold <= 1 &&
         typeof config.vectorSearchEnabled === 'boolean' &&
         typeof config.encryptSensitive === 'boolean' &&
         typeof config.autoExtractFacts === 'boolean';
}

/**
 * Check if content is suitable for semantic memory
 */
export function isSemanticWorthy(content: string): boolean {
  return content.length > 20 && 
         content.length < 5000 && 
         !isBoilerplate(content) &&
         hasSemanticValue(content);
}

/**
 * Check if content has semantic value
 */
function hasSemanticValue(content: string): boolean {
  // Check for factual indicators
  const factualIndicators = [
    'is', 'are', 'was', 'were', 'means', 'refers to', 'definition',
    'because', 'therefore', 'how to', 'method', 'approach', 'solution'
  ];
  
  const lowerContent = content.toLowerCase();
  return factualIndicators.some(indicator => lowerContent.includes(indicator));
}

/**
 * Check if content is boilerplate
 */
function isBoilerplate(content: string): boolean {
  const boilerplatePatterns = [
    /^(hi|hello|hey|thanks|thank you)$/i,
    /^(ok|okay|yes|no)$/i,
    /^(please|can you|could you)$/i
  ];
  return boilerplatePatterns.some(pattern => pattern.test(content.trim()));
}

/**
 * Generate content hash for deduplication
 */
export function generateContentHash(content: string): string {
  // Simple hash for content deduplication
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}