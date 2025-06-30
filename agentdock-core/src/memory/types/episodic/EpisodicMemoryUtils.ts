import { EpisodicMemoryData } from './EpisodicMemoryTypes'

/**
 * Utility functions for EpisodicMemory operations
 */

/**
 * Generate unique episodic memory ID
 */
export function generateEpisodicMemoryId(): string {
  return `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get table name for namespace
 */
export function getEpisodicTableName(namespace: string): string {
  return `episodic_memory_${namespace.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Calculate memory importance based on content characteristics
 */
export function calculateEpisodicImportance(
  content: string,
  context: string = '',
  tags: string[] = []
): number {
  let importance = 0.4;

  // Content length indicates complexity
  if (content.length > 200) importance += 0.2;
  if (content.length > 500) importance += 0.1;

  // Context adds value
  if (context.length > 50) importance += 0.1;

  // Tags indicate categorization
  importance += Math.min(tags.length * 0.05, 0.2);

  // Problem-solving or learning content
  if (isProblemSolving(content)) importance += 0.3;
  if (isLearningContent(content)) importance += 0.2;

  return Math.min(importance, 1.0);
}

/**
 * Extract tags from content
 */
export function extractTags(content: string): string[] {
  const tags: string[] = [];
  
  const lowerContent = content.toLowerCase();
  
  // Topic-based tags
  if (lowerContent.includes('question')) tags.push('question');
  if (lowerContent.includes('problem')) tags.push('problem');
  if (lowerContent.includes('help')) tags.push('help');
  if (lowerContent.includes('learn')) tags.push('learning');
  if (lowerContent.includes('error')) tags.push('error');
  if (lowerContent.includes('code')) tags.push('coding');
  if (lowerContent.includes('explain')) tags.push('explanation');
  if (lowerContent.includes('example')) tags.push('example');

  return tags;
}

/**
 * Check if content represents problem-solving
 */
function isProblemSolving(content: string): boolean {
  const problemKeywords = ['problem', 'issue', 'error', 'bug', 'fix', 'solve', 'solution'];
  return problemKeywords.some(keyword => 
    content.toLowerCase().includes(keyword)
  );
}

/**
 * Check if content represents learning
 */
function isLearningContent(content: string): boolean {
  const learningKeywords = ['learn', 'understand', 'explain', 'how to', 'tutorial', 'guide'];
  return learningKeywords.some(keyword => 
    content.toLowerCase().includes(keyword)
  );
}

/**
 * Group memories by time window for compression
 */
export function groupByTimeWindow(
  memories: EpisodicMemoryData[],
  windowHours: number = 24
): EpisodicMemoryData[][] {
  const windowMs = windowHours * 60 * 60 * 1000;
  const groups: EpisodicMemoryData[][] = [];
  
  // Sort by creation time
  const sorted = [...memories].sort((a, b) => a.createdAt - b.createdAt);
  
  let currentGroup: EpisodicMemoryData[] = [];
  let groupStartTime = 0;
  
  for (const memory of sorted) {
    if (currentGroup.length === 0) {
      currentGroup = [memory];
      groupStartTime = memory.createdAt;
    } else if (memory.createdAt - groupStartTime <= windowMs) {
      currentGroup.push(memory);
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [memory];
      groupStartTime = memory.createdAt;
    }
  }
  
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
}

/**
 * Convert group of memories to semantic summary
 */
export function convertToSemantic(group: EpisodicMemoryData[]): any {
  if (group.length === 0) return null;

  // Extract key information
  const allTags = new Set<string>();
  let totalImportance = 0;

  group.forEach(m => {
    m.tags.forEach(tag => allTags.add(tag));
    totalImportance += m.importance;
  });

  // Create compressed summary
  const summary = `Session summary (${group.length} memories): Key events and interactions from ${new Date(group[0].createdAt).toISOString()} to ${new Date(group[group.length - 1].createdAt).toISOString()}`;

  return {
    id: `sm_compressed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    agentId: group[0].agentId,
    content: summary,
    category: 'learned_experience',
    importance: Math.min(totalImportance / group.length * 1.2, 1.0), // Boost compressed importance
    confidence: 0.8,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    accessCount: 0,
    sourceIds: group.map(m => m.id),
    keywords: Array.from(allTags),
    metadata: {
      compressed: true,
      originalCount: group.length,
      originalMemoryIds: group.map(m => m.id),
      compressionDate: Date.now()
    },
    facts: [],
    relations: []
  };
}

/**
 * Apply decay formula to memory resonance
 */
export function applyDecayFormula(
  memory: EpisodicMemoryData,
  decayRate: number,
  importanceWeight: number = 0.3
): number {
  const age = Date.now() - memory.lastAccessedAt;
  const ageDays = age / (24 * 60 * 60 * 1000);
  
  // Apply decay formula
  const decayFactor = Math.exp(-decayRate * ageDays);
  const newResonance = memory.resonance * decayFactor;
  
  // Importance affects decay rate
  const importanceBoost = memory.importance * importanceWeight;
  const finalResonance = Math.max(newResonance + importanceBoost, 0);
  
  return finalResonance;
}

/**
 * Calculate relevance score for search results
 */
export function calculateRelevanceScore(
  memory: EpisodicMemoryData,
  query: string,
  sessionMatch: boolean = false
): number {
  let score = 0;

  // Base importance and resonance
  score += memory.importance * 0.3;
  score += memory.resonance * 0.2;

  // Recency bonus
  const age = Date.now() - memory.lastAccessedAt;
  const recencyFactor = Math.exp(-age / (7 * 24 * 60 * 60 * 1000)); // 7 day half-life
  score += recencyFactor * 0.3;

  // Content match
  if (query && memory.content.toLowerCase().includes(query.toLowerCase())) {
    score += 0.2;
  }

  // Session match bonus
  if (sessionMatch) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

/**
 * Validate episodic memory configuration
 */
export function validateEpisodicConfig(config: any): boolean {
  return config.maxMemoriesPerSession > 0 &&
         config.decayRate > 0 &&
         config.importanceThreshold >= 0 &&
         config.compressionAge > 0 &&
         typeof config.encryptSensitive === 'boolean';
}

/**
 * Check if content is suitable for episodic memory
 */
export function isEpisodicWorthy(content: string): boolean {
  return content.length > 20 && 
         content.length < 10000 && 
         !isBoilerplate(content);
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