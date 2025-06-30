/**
 * @fileoverview ConfigurableDecayEngine - User-defined memory decay system
 *
 * Applies configurable decay rules to memories based on age, access patterns,
 * and user-defined conditions. NO hardcoded business logic - everything is
 * user-configurable through DecayConfiguration.
 *
 * @example
 * ```typescript
 * const therapyConfig: DecayConfiguration = {
 *   agentId: 'therapy_agent',
 *   rules: [
 *     {
 *       id: 'critical_info',
 *       name: 'Critical Information',
 *       condition: "keywords.includes('trauma') || keywords.includes('suicide')",
 *       neverDecay: true,
 *       enabled: true
 *     }
 *   ],
 *   defaultDecayRate: 0.05,
 *   decayInterval: 24 * 60 * 60 * 1000
 * };
 *
 * const engine = new ConfigurableDecayEngine(storage, therapyConfig);
 * const result = await engine.applyDecay('therapy_agent');
 * ```
 *
 * @author AgentDock Core Team
 */

import { LogCategory, logger } from '../../logging';
import { StorageProvider } from '../../storage';
import { Memory } from '../types/common';
import { DecayConfiguration, DecayResult, DecayRule } from './types';

/**
 * Configurable decay engine for automated memory lifecycle management.
 *
 * Key features:
 * - User-defined decay rules with safe JavaScript evaluation
 * - Configurable decay rates and thresholds
 * - Language-agnostic through user configuration
 * - Safe fallback behavior when rules fail
 * - Comprehensive logging and error handling
 */
export class ConfigurableDecayEngine {
  private readonly storage: StorageProvider;
  private readonly config: DecayConfiguration;

  /**
   * Creates a new ConfigurableDecayEngine.
   *
   * @param storage - Storage provider for accessing memories
   * @param config - User-defined decay configuration
   */
  constructor(storage: StorageProvider, config: DecayConfiguration) {
    this.storage = storage;
    this.config = config;

    if (!storage.memory) {
      throw new Error('Storage provider must support memory operations');
    }

    logger.debug(
      LogCategory.STORAGE,
      'ConfigurableDecayEngine',
      'Initialized decay engine',
      {
        agentId: config.agentId,
        rulesCount: config.rules.length,
        defaultDecayRate: config.defaultDecayRate,
        decayInterval: config.decayInterval
      }
    );
  }

  /**
   * Apply decay rules to all memories for the specified agent.
   *
   * @param userId - User identifier
   * @param agentId - Agent identifier
   * @returns Promise resolving to decay operation results
   */
  async applyDecay(userId: string, agentId: string): Promise<DecayResult> {
    const startTime = Date.now();

    logger.info(
      LogCategory.STORAGE,
      'ConfigurableDecayEngine',
      'Starting decay operation',
      {
        userId,
        agentId,
        rulesCount: this.config.rules.length
      }
    );

    try {
      // 1. Get all memories for agent
      const memories = await this.getAgentMemories(userId, agentId);

      if (memories.length === 0) {
        return {
          processed: 0,
          updated: 0,
          deleted: 0,
          timestamp: new Date(),
          ruleResults: []
        };
      }

      // 2. Apply decay rules to memories
      const { updatedMemories, ruleResults } =
        await this.applyDecayRules(memories);

      // 3. Update memories in storage
      const updateCount = await this.updateMemoriesInStorage(updatedMemories);

      // 4. Delete memories below threshold
      const deleteCount = await this.deleteDecayedMemories(
        updatedMemories,
        userId,
        agentId
      );

      const result: DecayResult = {
        processed: memories.length,
        updated: updateCount,
        deleted: deleteCount,
        timestamp: new Date(),
        ruleResults
      };

      const elapsedMs = Date.now() - startTime;
      logger.info(
        LogCategory.STORAGE,
        'ConfigurableDecayEngine',
        'Decay operation completed',
        {
          userId,
          agentId,
          processed: result.processed,
          updated: result.updated,
          deleted: result.deleted,
          elapsedMs
        }
      );

      return result;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'ConfigurableDecayEngine',
        'Decay operation failed',
        {
          userId,
          agentId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  /**
   * Get all memories for the specified agent.
   *
   * @private
   */
  private async getAgentMemories(
    userId: string,
    agentId: string
  ): Promise<Memory[]> {
    // Use storage provider's memory operations to get all memories
    const memories: Memory[] = [];

    try {
      // Get memories using storage pattern - this depends on the storage implementation
      const memoryKeys = await this.storage.list(
        `memory:${userId}:${agentId}:`
      );

      for (const key of memoryKeys) {
        const memory = await this.storage.get<Memory>(key);
        if (memory) {
          memories.push(memory);
        }
      }

      return memories;
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'ConfigurableDecayEngine',
        'Failed to retrieve some memories',
        {
          userId,
          agentId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return memories; // Return what we could get
    }
  }

  /**
   * Apply decay rules to memories and calculate new resonance values.
   *
   * @private
   */
  private async applyDecayRules(memories: Memory[]): Promise<{
    updatedMemories: Memory[];
    ruleResults: Array<{
      ruleId: string;
      ruleName: string;
      memoriesAffected: number;
      avgDecayApplied: number;
    }>;
  }> {
    const updatedMemories: Memory[] = [];
    const ruleResults: Array<{
      ruleId: string;
      ruleName: string;
      memoriesAffected: number;
      avgDecayApplied: number;
    }> = [];

    // Track rule application
    const ruleStats = new Map<
      string,
      { affected: number; totalDecay: number }
    >();

    for (const memory of memories) {
      const originalResonance = memory.resonance || 1.0;
      let newResonance = originalResonance;
      let ruleApplied: DecayRule | null = null;

      // Find applicable rule
      for (const rule of this.config.rules) {
        if (!rule.enabled) continue;

        if (this.evaluateRuleCondition(rule, memory)) {
          ruleApplied = rule;
          break; // Use first matching rule
        }
      }

      // Apply decay
      if (ruleApplied) {
        if (ruleApplied.neverDecay) {
          // No decay for this memory
          newResonance = Math.max(originalResonance, ruleApplied.minImportance);
        } else {
          // Apply rule-specific decay
          newResonance = this.calculateDecayedResonance(
            memory,
            ruleApplied.decayRate,
            ruleApplied.minImportance
          );
        }

        // Track rule usage
        const stats = ruleStats.get(ruleApplied.id) || {
          affected: 0,
          totalDecay: 0
        };
        stats.affected++;
        stats.totalDecay += originalResonance - newResonance;
        ruleStats.set(ruleApplied.id, stats);
      } else {
        // Apply default decay rate
        newResonance = this.calculateDecayedResonance(
          memory,
          this.config.defaultDecayRate,
          0.1 // Default minimum
        );
      }

      // Create updated memory
      const updatedMemory: Memory = {
        ...memory,
        resonance: newResonance,
        lastAccessedAt: memory.lastAccessedAt || memory.createdAt,
        updatedAt: Date.now()
      };

      updatedMemories.push(updatedMemory);
    }

    // Generate rule results
    for (const rule of this.config.rules) {
      const stats = ruleStats.get(rule.id);
      if (stats) {
        ruleResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          memoriesAffected: stats.affected,
          avgDecayApplied:
            stats.affected > 0 ? stats.totalDecay / stats.affected : 0
        });
      }
    }

    return { updatedMemories, ruleResults };
  }

  /**
   * Safely evaluate rule condition against memory.
   * Uses safe evaluation with whitelist instead of Function constructor.
   *
   * @private
   */
  private evaluateRuleCondition(rule: DecayRule, memory: Memory): boolean {
    try {
      // Create safe evaluation context
      const evaluationContext = {
        type: memory.type,
        importance: memory.importance,
        resonance: memory.resonance || 1.0,
        accessCount: memory.accessCount,
        keywords: memory.keywords || [],
        metadata: memory.metadata || {},
        createdAt: memory.createdAt,
        lastAccessedAt: memory.lastAccessedAt,
        // Helper functions
        daysSinceCreated: () =>
          (Date.now() - memory.createdAt) / (24 * 60 * 60 * 1000),
        daysSinceAccessed: () =>
          (Date.now() - (memory.lastAccessedAt || memory.createdAt)) /
          (24 * 60 * 60 * 1000)
      };

      // SECURITY FIX: Use safe expression evaluator instead of Function constructor
      // This prevents arbitrary code execution (RCE vulnerability)
      return this.evaluateSafeExpression(rule.condition, evaluationContext);
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'ConfigurableDecayEngine',
        'Invalid rule condition',
        {
          ruleId: rule.id,
          ruleName: rule.name,
          condition: rule.condition,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return false; // Safe fallback
    }
  }

  /**
   * Safe expression evaluator that only allows whitelisted operations.
   * Prevents code injection by restricting to a safe subset of JavaScript.
   *
   * @private
   */
  private evaluateSafeExpression(expression: string, context: any): boolean {
    // Remove whitespace and normalize
    const normalized = expression.trim();

    // Validate expression against safe patterns only
    const safePatterns = [
      // Simple comparisons
      /^(type|importance|resonance|accessCount)\s*([><=!]+)\s*(['"]?[^'"]*['"]?|\d+\.?\d*)$/,
      // Keywords array checks
      /^keywords\.includes\(['"]([^'"]*)['"]\)$/,
      // Helper function calls
      /^(daysSinceCreated|daysSinceAccessed)\(\)\s*([><=!]+)\s*(\d+\.?\d*)$/,
      // Boolean combinations (AND/OR only)
      /^.+\s+(&&|\|\|)\s+.+$/,
      // Metadata property checks
      /^metadata\.([a-zA-Z_][a-zA-Z0-9_]*)\s*([><=!]+)\s*(['"]?[^'"]*['"]?|\d+\.?\d*)$/
    ];

    // Check if expression matches any safe pattern
    const isSafe = safePatterns.some((pattern) => pattern.test(normalized));

    if (!isSafe) {
      logger.warn(
        LogCategory.STORAGE,
        'ConfigurableDecayEngine',
        'Unsafe expression blocked',
        { expression: normalized }
      );
      return false;
    }

    // Parse and evaluate safely
    return this.parseAndEvaluateExpression(normalized, context);
  }

  /**
   * Parse and evaluate a validated safe expression.
   *
   * @private
   */
  private parseAndEvaluateExpression(
    expression: string,
    context: any
  ): boolean {
    try {
      // Handle simple comparisons
      const simpleCompareMatch = expression.match(/^(\w+)\s*([><=!]+)\s*(.+)$/);
      if (simpleCompareMatch) {
        const [, property, operator, valueStr] = simpleCompareMatch;
        const contextValue = context[property];
        const value = this.parseValue(valueStr);
        return this.compareValues(contextValue, operator, value);
      }

      // Handle keywords.includes()
      const keywordsMatch = expression.match(
        /^keywords\.includes\(['"]([^'"]*)['"]\)$/
      );
      if (keywordsMatch) {
        const keyword = keywordsMatch[1];
        return context.keywords.includes(keyword);
      }

      // Handle helper functions
      const helperMatch = expression.match(
        /^(daysSinceCreated|daysSinceAccessed)\(\)\s*([><=!]+)\s*(\d+\.?\d*)$/
      );
      if (helperMatch) {
        const [, helperName, operator, valueStr] = helperMatch;
        const helperValue = context[helperName]();
        const value = parseFloat(valueStr);
        return this.compareValues(helperValue, operator, value);
      }

      // Handle metadata property access
      const metadataMatch = expression.match(
        /^metadata\.([a-zA-Z_][a-zA-Z0-9_]*)\s*([><=!]+)\s*(.+)$/
      );
      if (metadataMatch) {
        const [, property, operator, valueStr] = metadataMatch;
        const contextValue = context.metadata[property];
        const value = this.parseValue(valueStr);
        return this.compareValues(contextValue, operator, value);
      }

      // Handle boolean combinations
      if (expression.includes('&&')) {
        const parts = expression.split('&&').map((p) => p.trim());
        return parts.every((part) =>
          this.parseAndEvaluateExpression(part, context)
        );
      }

      if (expression.includes('||')) {
        const parts = expression.split('||').map((p) => p.trim());
        return parts.some((part) =>
          this.parseAndEvaluateExpression(part, context)
        );
      }

      return false;
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'ConfigurableDecayEngine',
        'Expression evaluation failed',
        {
          expression,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return false;
    }
  }

  /**
   * Parse a value string to appropriate type.
   *
   * @private
   */
  private parseValue(valueStr: string): any {
    const trimmed = valueStr.trim();

    // String values (quoted)
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1);
    }

    // Numeric values
    if (/^\d+\.?\d*$/.test(trimmed)) {
      return parseFloat(trimmed);
    }

    // Boolean values
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Unquoted strings
    return trimmed;
  }

  /**
   * Compare two values using the given operator.
   *
   * @private
   */
  private compareValues(a: any, operator: string, b: any): boolean {
    switch (operator) {
      case '>':
        return a > b;
      case '>=':
        return a >= b;
      case '<':
        return a < b;
      case '<=':
        return a <= b;
      case '==':
        return a === b; // Use strict equality for safety
      case '===':
        return a === b;
      case '!=':
        return a !== b; // Use strict inequality for safety
      case '!==':
        return a !== b;
      default:
        return false;
    }
  }

  /**
   * Calculate decayed resonance using exponential decay formula.
   *
   * @private
   */
  private calculateDecayedResonance(
    memory: Memory,
    decayRate: number,
    minImportance: number
  ): number {
    const currentResonance = memory.resonance || 1.0;
    const daysSinceAccess = this.daysSince(
      memory.lastAccessedAt || memory.createdAt
    );

    // Exponential decay formula: resonance * e^(-decayRate * days)
    const decayedResonance =
      currentResonance * Math.exp(-decayRate * daysSinceAccess);

    // Ensure we don't go below minimum
    return Math.max(decayedResonance, minImportance);
  }

  /**
   * Calculate days since timestamp.
   *
   * @private
   */
  private daysSince(timestamp: number): number {
    return (Date.now() - timestamp) / (24 * 60 * 60 * 1000);
  }

  /**
   * Update memories in storage with new resonance values.
   *
   * @private
   */
  private async updateMemoriesInStorage(memories: Memory[]): Promise<number> {
    let updateCount = 0;

    for (const memory of memories) {
      try {
        // Update memory using direct storage operation for compatibility
        const memoryKey = `memory:${memory.agentId}:${memory.id}`;
        await this.storage.set(memoryKey, memory);
        updateCount++;
      } catch (error) {
        logger.warn(
          LogCategory.STORAGE,
          'ConfigurableDecayEngine',
          'Failed to update memory',
          {
            memoryId: memory.id,
            error: error instanceof Error ? error.message : String(error)
          }
        );
      }
    }

    return updateCount;
  }

  /**
   * Delete memories that have decayed below the threshold.
   *
   * @private
   */
  private async deleteDecayedMemories(
    memories: Memory[],
    userId: string,
    agentId: string
  ): Promise<number> {
    const deleteThreshold = this.config.deleteThreshold || 0.1;
    let deleteCount = 0;

    for (const memory of memories) {
      if ((memory.resonance || 1.0) < deleteThreshold) {
        try {
          // Delete memory using storage operations
          if (this.storage.memory?.delete) {
            await this.storage.memory.delete(userId, agentId, memory.id);
          } else {
            // Fallback to direct storage deletion
            const memoryKey = `memory:${userId}:${agentId}:${memory.id}`;
            await this.storage.delete(memoryKey);
          }

          deleteCount++;

          if (this.config.verbose) {
            logger.debug(
              LogCategory.STORAGE,
              'ConfigurableDecayEngine',
              'Deleted decayed memory',
              {
                memoryId: memory.id,
                resonance: memory.resonance,
                threshold: deleteThreshold
              }
            );
          }
        } catch (error) {
          logger.warn(
            LogCategory.STORAGE,
            'ConfigurableDecayEngine',
            'Failed to delete memory',
            {
              memoryId: memory.id,
              error: error instanceof Error ? error.message : String(error)
            }
          );
        }
      }
    }

    return deleteCount;
  }
}
