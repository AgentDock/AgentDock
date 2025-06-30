import { WorkingMemoryData } from './WorkingMemoryTypes';

/**
 * Utility functions for WorkingMemory operations
 */

/**
 * Estimate token count for content
 */
export function estimateTokens(content: string): number {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(content.length / 4);
}

/**
 * Generate unique working memory ID
 */
export function generateWorkingMemoryId(): string {
  return `wm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Consolidate similar memories for compression
 */
export function consolidateSimilarMemories(
  memories: WorkingMemoryData[]
): WorkingMemoryData[] {
  // Simple consolidation: group by similar content length and importance
  const groups = new Map<string, WorkingMemoryData[]>();

  memories.forEach((memory) => {
    const key = `${Math.floor(memory.importance * 10)}_${Math.floor(memory.tokenCount / 100)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(memory);
  });

  const consolidated: WorkingMemoryData[] = [];

  for (const group of Array.from(groups.values())) {
    if (group.length === 1) {
      consolidated.push(group[0]);
    } else {
      // Merge group into single memory
      const merged = {
        ...group[0],
        content: group.map((m) => m.content).join('\n\n'),
        tokenCount: group.reduce((sum, m) => sum + m.tokenCount, 0),
        importance: Math.max(...group.map((m) => m.importance)),
        metadata: {
          ...group[0].metadata,
          consolidatedFrom: group.map((m) => m.id),
          originalCount: group.length
        }
      };
      consolidated.push(merged);
    }
  }

  return consolidated;
}

/**
 * Check if content is suitable for working memory
 */
export function isWorkingMemoryWorthy(content: string): boolean {
  return (
    content.length > 10 && content.length < 5000 && !isBoilerplate(content)
  );
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
  return boilerplatePatterns.some((pattern) => pattern.test(content.trim()));
}

/**
 * Calculate importance based on content characteristics
 */
export function calculateImportance(
  content: string,
  position: number = 0
): number {
  let importance = 0.5;

  // Recent messages are more important for working memory
  const recencyBonus = Math.max(0, 0.3 * (1 - position / 10));
  importance += recencyBonus;

  // Questions and requests are important
  if (containsQuestion(content) || containsRequest(content)) {
    importance += 0.2;
  }

  // Complex content is more important
  if (content.length > 200) {
    importance += 0.1;
  }

  return Math.min(importance, 1.0);
}

/**
 * Check if content contains a question
 */
function containsQuestion(content: string): boolean {
  return (
    content.includes('?') ||
    /^(what|how|why|when|where|who|which|can|could|would|should|is|are|do|does|did)/i.test(
      content
    )
  );
}

/**
 * Check if content contains a request
 */
function containsRequest(content: string): boolean {
  return /^(please|can you|could you|would you|help me|i need)/i.test(content);
}

/**
 * Prepare SQL table name for namespace
 */
export function getTableName(namespace: string): string {
  return `working_memory_${namespace.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Validate working memory configuration
 */
export function validateConfig(config: any): boolean {
  return (
    config.maxTokens > 0 &&
    config.ttlSeconds > 0 &&
    config.maxContextItems > 0 &&
    typeof config.encryptSensitive === 'boolean'
  );
}
