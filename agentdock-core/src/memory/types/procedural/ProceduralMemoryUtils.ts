import {
  ProceduralMemoryData,
  ProceduralOutcome,
  ProceduralPattern
} from './ProceduralMemoryTypes';

/**
 * Utility functions for ProceduralMemory operations
 */

/**
 * Generate unique procedural memory ID
 */
export function generateProceduralMemoryId(): string {
  return `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get table name for namespace
 */
export function getProceduralTableName(namespace: string): string {
  return `procedural_memory_${namespace.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Extract patterns from action sequences
 */
export function extractActionPattern(
  trigger: string,
  action: string,
  context: Record<string, any>
): string {
  // Create a pattern signature from trigger-action-context
  const contextKeys = Object.keys(context).sort();
  const contextSig = contextKeys
    .map((k) => `${k}:${typeof context[k]}`)
    .join(',');

  return `${trigger}→${action}|${contextSig}`;
}

/**
 * Calculate pattern confidence based on success rate and usage
 */
export function calculatePatternConfidence(
  successCount: number,
  totalCount: number,
  usageRecency: number
): number {
  if (totalCount === 0) return 0.5;

  const successRate = successCount / totalCount;
  const recencyFactor = Math.max(
    0.1,
    1 - usageRecency / (30 * 24 * 60 * 60 * 1000)
  ); // 30 days decay
  const experienceFactor = Math.min(1.0, totalCount / 10); // More experience = higher confidence

  return Math.min(
    0.95,
    successRate * 0.6 + recencyFactor * 0.2 + experienceFactor * 0.2
  );
}

/**
 * Determine if a pattern should be learned based on outcomes
 */
export function shouldLearnPattern(
  outcomes: Array<{ success: boolean; timestamp: number }>,
  minSuccessRate: number = 0.6,
  minAttempts: number = 3
): boolean {
  if (outcomes.length < minAttempts) return false;

  const recentOutcomes = outcomes
    .filter((o) => Date.now() - o.timestamp < 7 * 24 * 60 * 60 * 1000) // Last 7 days
    .slice(-10); // Last 10 attempts

  if (recentOutcomes.length === 0) return false;

  const successRate =
    recentOutcomes.filter((o) => o.success).length / recentOutcomes.length;
  return successRate >= minSuccessRate;
}

/**
 * Check if two patterns are similar enough to merge
 */
export function arePatternsSimilar(
  pattern1: ProceduralMemoryData,
  pattern2: ProceduralMemoryData,
  threshold: number = 0.8
): boolean {
  // Compare triggers
  const triggerSimilarity = calculateStringSimilarity(
    pattern1.trigger,
    pattern2.trigger
  );

  // Compare actions
  const actionSimilarity = calculateStringSimilarity(
    pattern1.action,
    pattern2.action
  );

  // Compare contexts
  const contextSimilarity = calculateContextSimilarity(
    pattern1.metadata,
    pattern2.metadata
  );

  const overallSimilarity =
    triggerSimilarity * 0.4 + actionSimilarity * 0.4 + contextSimilarity * 0.2;

  return overallSimilarity >= threshold;
}

/**
 * Merge two similar patterns
 */
export function mergePatterns(
  primary: ProceduralMemoryData,
  secondary: ProceduralMemoryData
): ProceduralMemoryData {
  return {
    ...primary,
    successCount: primary.successCount + secondary.successCount,
    totalCount: primary.totalCount + secondary.totalCount,
    confidence: Math.max(primary.confidence, secondary.confidence),
    lastUsed: Math.max(primary.lastUsed, secondary.lastUsed),
    outcomes: [...primary.outcomes, ...secondary.outcomes]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50), // Keep last 50 outcomes
    metadata: {
      ...primary.metadata,
      ...secondary.metadata,
      mergedFrom: [primary.id, secondary.id],
      mergedAt: Date.now()
    }
  };
}

/**
 * Generate conditions from context
 */
export function extractConditions(
  trigger: string,
  context: Record<string, any>
): string[] {
  const conditions: string[] = [];

  // Extract conditions from trigger
  if (trigger.includes('if ')) {
    const conditionMatch = trigger.match(/if (.+)/);
    if (conditionMatch) {
      conditions.push(conditionMatch[1]);
    }
  }

  // Extract conditions from context
  Object.entries(context).forEach(([key, value]) => {
    if (typeof value === 'boolean') {
      conditions.push(`${key} is ${value}`);
    } else if (typeof value === 'string' && value.length < 50) {
      conditions.push(`${key} = "${value}"`);
    } else if (typeof value === 'number') {
      conditions.push(`${key} = ${value}`);
    }
  });

  return conditions.slice(0, 5); // Limit to 5 conditions
}

/**
 * Check if current context matches pattern conditions
 */
export function matchesConditions(
  conditions: string[],
  currentContext: Record<string, any>
): number {
  if (conditions.length === 0) return 1.0;

  let matchScore = 0;
  let totalConditions = conditions.length;

  for (const condition of conditions) {
    if (evaluateCondition(condition, currentContext)) {
      matchScore++;
    }
  }

  return matchScore / totalConditions;
}

/**
 * Evaluate a single condition against context
 */
function evaluateCondition(
  condition: string,
  context: Record<string, any>
): boolean {
  try {
    // Simple condition evaluation
    if (condition.includes(' is ')) {
      const [key, value] = condition.split(' is ');
      const contextValue = context[key.trim()];
      const expectedValue =
        value.trim() === 'true'
          ? true
          : value.trim() === 'false'
            ? false
            : value.trim();
      return contextValue === expectedValue;
    }

    if (condition.includes(' = ')) {
      const [key, value] = condition.split(' = ');
      const contextValue = context[key.trim()];
      const expectedValue = value.replace(/"/g, '').trim();
      return String(contextValue) === expectedValue;
    }

    // Default: check if key exists in context
    return Object.prototype.hasOwnProperty.call(context, condition.trim());
  } catch (error) {
    return false;
  }
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  const matrix = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(null));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLen = Math.max(len1, len2);
  return 1 - matrix[len1][len2] / maxLen;
}

/**
 * Calculate context similarity
 */
function calculateContextSimilarity(
  context1: Record<string, any>,
  context2: Record<string, any>
): number {
  const keys1 = Object.keys(context1);
  const keys2 = Object.keys(context2);
  const allKeys = new Set([...keys1, ...keys2]);

  if (allKeys.size === 0) return 1.0;

  let matches = 0;
  for (const key of Array.from(allKeys)) {
    if (context1[key] === context2[key]) {
      matches++;
    }
  }

  return matches / allKeys.size;
}

/**
 * Validate procedural memory configuration
 */
export function validateProceduralConfig(config: any): boolean {
  return (
    config.minSuccessRate >= 0 &&
    config.minSuccessRate <= 1 &&
    config.maxPatternsPerCategory > 0 &&
    config.decayRate >= 0 &&
    config.decayRate <= 1 &&
    config.confidenceThreshold >= 0 &&
    config.confidenceThreshold <= 1 &&
    typeof config.adaptiveLearning === 'boolean' &&
    typeof config.patternMerging === 'boolean'
  );
}

/**
 * Apply decay to pattern confidence based on time since last use
 */
export function applyPatternDecay(
  pattern: ProceduralMemoryData,
  decayRate: number
): number {
  const daysSinceUse = (Date.now() - pattern.lastUsed) / (24 * 60 * 60 * 1000);
  const decayFactor = Math.exp(-decayRate * daysSinceUse);

  return Math.max(0.1, pattern.confidence * decayFactor);
}

/**
 * Check if pattern is worth keeping
 */
export function isPatternWorthy(
  pattern: ProceduralMemoryData,
  minConfidence: number = 0.3,
  maxAgeDays: number = 90
): boolean {
  const ageDays = (Date.now() - pattern.createdAt) / (24 * 60 * 60 * 1000);
  const daysSinceUse = (Date.now() - pattern.lastUsed) / (24 * 60 * 60 * 1000);

  return (
    pattern.confidence >= minConfidence &&
    pattern.totalCount >= 2 &&
    (ageDays <= maxAgeDays || daysSinceUse <= 30)
  );
}

/**
 * Generate pattern key for efficient lookup
 */
export function generatePatternKey(trigger: string, action: string): string {
  return `${trigger.toLowerCase().replace(/\s+/g, '_')}→${action.toLowerCase().replace(/\s+/g, '_')}`;
}

/**
 * Categorize procedural pattern
 */
export function categorizePattern(trigger: string, action: string): string {
  const triggerLower = trigger.toLowerCase();
  const actionLower = action.toLowerCase();

  if (triggerLower.includes('error') || actionLower.includes('fix')) {
    return 'error_handling';
  }
  if (triggerLower.includes('user') || triggerLower.includes('request')) {
    return 'user_interaction';
  }
  if (actionLower.includes('code') || actionLower.includes('implement')) {
    return 'code_generation';
  }
  if (actionLower.includes('search') || actionLower.includes('find')) {
    return 'information_retrieval';
  }
  if (actionLower.includes('analyze') || actionLower.includes('check')) {
    return 'analysis';
  }

  return 'general';
}
