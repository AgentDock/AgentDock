/**
 * @fileoverview ProceduralMemoryManager - Learn and suggest tool patterns
 *
 * Learns from successful tool usage patterns and provides intelligent suggestions
 * for tool sequences. Key differentiator for AgentDock.
 *
 * @author AgentDock Core Team
 */

import { createLLM } from '../../llm';
import { LogCategory, logger } from '../../logging';
import { StorageProvider } from '../../storage';
import { generateId } from '../../storage/utils';
import {
  LearningResult,
  ProceduralConfig,
  ProceduralMemory,
  SuggestionContext,
  ToolCall,
  ToolPattern,
  ToolSuggestion
} from './types';

/**
 * Manages procedural memory for tool pattern learning and suggestions.
 *
 * Key features:
 * - Learns from successful tool execution patterns
 * - Provides intelligent tool sequence suggestions
 * - Uses configurable learning thresholds
 * - Pattern merging and optimization
 */
export class ProceduralMemoryManager {
  private readonly storage: StorageProvider;
  private readonly config: ProceduralConfig;
  private readonly llm: any;

  constructor(storage: StorageProvider, config: ProceduralConfig) {
    this.storage = storage;
    this.config = config;

    // Initialize LLM for pattern analysis (optional)
    try {
      this.llm = createLLM({
        provider: 'anthropic' as const,
        model: 'claude-3-haiku-20240307',
        apiKey: process.env.ANTHROPIC_API_KEY || ''
      });
    } catch (error) {
      this.llm = null;
    }

    logger.debug(
      LogCategory.STORAGE,
      'ProceduralMemoryManager',
      'Initialized',
      {
        minSuccessRate: config.minSuccessRate
      }
    );
  }

  /**
   * Record a tool execution sequence for learning.
   */
  async recordToolExecution(
    agentId: string,
    toolSequence: ToolCall[],
    context: string,
    success: boolean = true
  ): Promise<LearningResult> {
    try {
      if (!success && !this.config.learnFromFailures) {
        return {
          patternLearned: false,
          patternUpdated: false,
          reason: 'Failed execution not learned (configured)'
        };
      }

      if (toolSequence.length < 2) {
        return {
          patternLearned: false,
          patternUpdated: false,
          reason: 'Sequence too short to learn pattern'
        };
      }

      // Find similar existing pattern
      const existingPatterns = await this.getExistingPatterns(agentId);
      const similarPattern = this.findSimilarPattern(
        toolSequence,
        existingPatterns
      );

      if (similarPattern) {
        return await this.updatePattern(similarPattern, success);
      } else if (success) {
        return await this.learnNewPattern(agentId, toolSequence, context);
      }

      return {
        patternLearned: false,
        patternUpdated: false,
        reason: 'No learning criteria met'
      };
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'ProceduralMemoryManager',
        'Record execution failed',
        {
          agentId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  /**
   * Suggest tool sequences for a given context.
   */
  async suggestToolSequence(
    agentId: string,
    suggestionContext: SuggestionContext
  ): Promise<ToolSuggestion[]> {
    try {
      const patterns = await this.getRelevantPatterns(
        agentId,
        suggestionContext
      );

      if (patterns.length === 0) {
        return [];
      }

      return patterns
        .slice(0, 3)
        .map((pattern) => this.createSuggestionFromPattern(pattern));
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'ProceduralMemoryManager',
        'Suggestion failed',
        {
          agentId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return [];
    }
  }

  /**
   * Get existing patterns for an agent.
   */
  private async getExistingPatterns(
    agentId: string
  ): Promise<ProceduralMemory[]> {
    const patterns: ProceduralMemory[] = [];

    try {
      const patternKeys = await this.storage.list(`procedural:${agentId}:`);

      for (const key of patternKeys) {
        const pattern = await this.storage.get<ProceduralMemory>(key);
        if (pattern) {
          patterns.push(pattern);
        }
      }

      return patterns;
    } catch (error) {
      return patterns;
    }
  }

  /**
   * Find similar pattern using simple sequence matching.
   */
  private findSimilarPattern(
    toolSequence: ToolCall[],
    existingPatterns: ProceduralMemory[]
  ): ProceduralMemory | null {
    for (const pattern of existingPatterns) {
      const similarity = this.calculateSequenceSimilarity(
        toolSequence,
        pattern.pattern.sequence
      );

      if (similarity > this.config.contextSimilarityThreshold) {
        return pattern;
      }
    }
    return null;
  }

  /**
   * Calculate sequence similarity.
   */
  private calculateSequenceSimilarity(
    seq1: ToolCall[],
    seq2: ToolCall[]
  ): number {
    if (seq1.length === 0 && seq2.length === 0) return 1.0;
    if (seq1.length === 0 || seq2.length === 0) return 0.0;

    const tools1 = seq1.map((t) => t.tool);
    const tools2 = seq2.map((t) => t.tool);

    let matches = 0;
    const maxLength = Math.max(tools1.length, tools2.length);

    for (let i = 0; i < Math.min(tools1.length, tools2.length); i++) {
      if (tools1[i] === tools2[i]) {
        matches++;
      }
    }

    return matches / maxLength;
  }

  /**
   * Learn a new pattern.
   */
  private async learnNewPattern(
    agentId: string,
    toolSequence: ToolCall[],
    context: string
  ): Promise<LearningResult> {
    const pattern: ToolPattern = {
      name: this.generatePatternName(toolSequence),
      sequence: toolSequence,
      context,
      avgExecutionTime: toolSequence.reduce(
        (sum, tool) => sum + tool.duration,
        0
      )
    };

    const proceduralMemory: ProceduralMemory = {
      id: generateId('proc'),
      agentId,
      type: 'procedural',
      content: `Pattern: ${pattern.name}`,
      pattern,
      successRate: 1.0,
      useCount: 1,
      importance: 0.5,
      resonance: 1.0,
      accessCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now(),
      keywords: this.extractKeywords(context)
    };

    const patternKey = `procedural:${agentId}:${proceduralMemory.id}`;
    await this.storage.set(patternKey, proceduralMemory);

    return {
      patternLearned: true,
      patternId: proceduralMemory.id,
      patternUpdated: false,
      reason: 'New pattern learned'
    };
  }

  /**
   * Update existing pattern.
   */
  private async updatePattern(
    pattern: ProceduralMemory,
    success: boolean
  ): Promise<LearningResult> {
    const newUseCount = pattern.useCount + 1;
    const successValue = success ? 1.0 : 0.0;
    const newSuccessRate =
      (pattern.successRate * pattern.useCount + successValue) / newUseCount;

    const updatedPattern: ProceduralMemory = {
      ...pattern,
      successRate: newSuccessRate,
      useCount: newUseCount,
      updatedAt: Date.now(),
      lastAccessedAt: Date.now()
    };

    const patternKey = `procedural:${pattern.agentId}:${pattern.id}`;
    await this.storage.set(patternKey, updatedPattern);

    return {
      patternLearned: false,
      patternId: pattern.id,
      patternUpdated: true,
      newSuccessRate,
      reason: 'Pattern updated'
    };
  }

  /**
   * Get relevant patterns for suggestion.
   */
  private async getRelevantPatterns(
    agentId: string,
    context: SuggestionContext
  ): Promise<ProceduralMemory[]> {
    const allPatterns = await this.getExistingPatterns(agentId);

    return allPatterns
      .filter((pattern) => pattern.successRate >= this.config.minSuccessRate)
      .sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Create suggestion from pattern.
   */
  private createSuggestionFromPattern(
    pattern: ProceduralMemory
  ): ToolSuggestion {
    return {
      toolSequence: pattern.pattern.sequence,
      confidence: pattern.successRate,
      estimatedDuration: pattern.pattern.avgExecutionTime,
      expectedSuccessRate: pattern.successRate,
      reasoning: `Based on pattern "${pattern.pattern.name}" with ${pattern.useCount} uses`
    };
  }

  /**
   * Generate pattern name.
   */
  private generatePatternName(toolSequence: ToolCall[]): string {
    const toolNames = toolSequence.map((t) => t.tool).join(' → ');
    return `${toolNames}`;
  }

  /**
   * Extract keywords from context.
   */
  private extractKeywords(context: string): string[] {
    return context
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 5);
  }
}
