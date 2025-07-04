/**
 * @fileoverview MemoryConsolidator - Language-agnostic memory consolidation
 *
 * Converts episodic memories to semantic, merges similar memories,
 * and optimizes memory storage through intelligent consolidation.
 * Uses LLM for language-agnostic analysis, following batch processing patterns.
 *
 * @author AgentDock Core Team
 */

import { z } from 'zod';

import { CoreLLM } from '../../../llm/core-llm';
import { createLLM } from '../../../llm/create-llm';
import { LogCategory, logger } from '../../../logging';
import { generateId } from '../../../storage/utils';
import { ConsolidationResult } from '../../base-types';
import { MemoryType } from '../../types';
import { Memory } from '../../types/common';
import { ConsolidationConfig } from '../types';

/**
 * Storage interface for MemoryConsolidator operations
 */
interface ConsolidatorStorage {
  setMemory?: (memory: Memory) => Promise<void>;
  deleteMemory?: (
    userId: string,
    agentId: string,
    type: string,
    id: string
  ) => Promise<void>;
  vectorSearch?: (
    content: string,
    options: {
      limit: number;
      threshold: number;
      exclude: string[];
    }
  ) => Promise<Array<{ id: string; score: number }>>;
  memory?: {
    getByType: (
      userId: string,
      agentId: string,
      type: string,
      options?: { cutoffTime?: number; createdBefore?: number }
    ) => Promise<Memory[]>;
  };
}

// Zod schema for LLM-based consolidation analysis
const ConsolidationAnalysisSchema = z.object({
  shouldConsolidate: z.boolean(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  suggestedStrategy: z.enum(['merge', 'synthesize', 'summarize'])
});

type ConsolidationAnalysis = z.infer<typeof ConsolidationAnalysisSchema>;

/**
 * Cost tracker interface - following batch processing pattern
 */
interface CostTracker {
  trackExtraction(
    agentId: string,
    data: {
      extractorType: string;
      cost: number;
      memoriesExtracted: number;
      messagesProcessed: number;
      metadata: Record<string, unknown>;
    }
  ): Promise<void>;

  checkBudget(agentId: string, monthlyBudget: number): Promise<boolean>;
}

/**
 * Language-agnostic memory consolidation using LLM intelligence
 */
export class MemoryConsolidator {
  private llm?: CoreLLM;
  private costTracker: CostTracker;

  constructor(
    private storage: ConsolidatorStorage,
    private config: ConsolidationConfig,
    costTracker?: CostTracker
  ) {
    // Only create LLM if summarization is enabled
    if (config.enableLLMSummarization && config.llmConfig) {
      this.llm = createLLM({
        provider: config.llmConfig.provider as any,
        model: config.llmConfig.model,
        apiKey:
          process.env[`${config.llmConfig.provider.toUpperCase()}_API_KEY`] ||
          ''
      });
    }

    // Use provided cost tracker or create mock
    this.costTracker = costTracker || this.createMockCostTracker();

    logger.debug(
      LogCategory.STORAGE,
      'MemoryConsolidator',
      'Initialized memory consolidator',
      {
        llmEnabled: !!this.llm,
        strategies: config.strategies,
        similarityThreshold: config.similarityThreshold
      }
    );
  }

  /**
   * Consolidate memories for an agent using language-agnostic approach
   */
  async consolidateMemories(
    userId: string,
    agentId: string,
    customConfig?: Partial<ConsolidationConfig>
  ): Promise<ConsolidationResult[]> {
    if (!userId?.trim()) {
      throw new Error('userId is required for memory consolidation operations');
    }

    const activeConfig: ConsolidationConfig = {
      ...this.config,
      ...customConfig
    };

    try {
      logger.info(
        LogCategory.STORAGE,
        'MemoryConsolidator',
        'Starting language-agnostic consolidation',
        {
          userId: userId.substring(0, 8),
          agentId: agentId.substring(0, 8),
          strategies: activeConfig.strategies,
          llmEnabled: !!this.llm
        }
      );

      const results: ConsolidationResult[] = [];

      // 1. Convert old episodic memories to semantic (language-agnostic)
      const conversionResults = await this.convertEpisodicToSemantic(
        userId,
        agentId,
        activeConfig
      );
      results.push(...conversionResults);

      // 2. Find and merge similar memories using embeddings + optional LLM
      const mergeResults = await this.findAndMergeSimilar(
        userId,
        agentId,
        activeConfig
      );
      results.push(...mergeResults);

      // 3. Create hierarchical abstractions (if strategy enabled)
      if (activeConfig.strategies.includes('hierarchy')) {
        const hierarchyResults = await this.createHierarchicalAbstractions(
          userId,
          agentId,
          activeConfig
        );
        results.push(...hierarchyResults);
      }

      logger.info(
        LogCategory.STORAGE,
        'MemoryConsolidator',
        'Language-agnostic consolidation completed',
        {
          userId: userId.substring(0, 8),
          agentId: agentId.substring(0, 8),
          totalResults: results.length,
          totalMemoriesProcessed: results.reduce(
            (sum, r) => sum + r.original.length,
            0
          ),
          totalConsolidated: results.length
        }
      );

      return results;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'MemoryConsolidator',
        'Error during consolidation',
        {
          userId: userId.substring(0, 8),
          agentId: agentId.substring(0, 8),
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  /**
   * Convert old episodic memories to semantic using LLM for language-agnostic content extraction
   */
  private async convertEpisodicToSemantic(
    userId: string,
    agentId: string,
    config: ConsolidationConfig
  ): Promise<ConsolidationResult[]> {
    try {
      // Get old episodic memories
      const cutoffTime = Date.now() - config.maxAge;
      const episodicMemories = await this.getEpisodicMemories(
        userId,
        agentId,
        cutoffTime
      );

      if (episodicMemories.length === 0) {
        return [];
      }

      logger.debug(
        LogCategory.STORAGE,
        'MemoryConsolidator',
        'Converting episodic to semantic (language-agnostic)',
        {
          userId: userId.substring(0, 8),
          agentId: agentId.substring(0, 8),
          episodicCount: episodicMemories.length,
          cutoffAge: config.maxAge / (24 * 60 * 60 * 1000) + ' days'
        }
      );

      const results: ConsolidationResult[] = [];

      // Process in batches
      for (let i = 0; i < episodicMemories.length; i += config.batchSize) {
        const batch = episodicMemories.slice(i, i + config.batchSize);

        for (const episodic of batch) {
          if (episodic.importance >= 0.5) {
            // Only convert important episodic memories
            const semantic = await this.createSemanticFromEpisodic(
              episodic,
              config
            );

            // Store the new semantic memory
            await this.storage.setMemory?.(semantic);

            // Archive or delete original if not preserving
            if (!config.preserveOriginals) {
              await this.storage.deleteMemory?.(
                userId,
                agentId,
                episodic.type,
                episodic.id
              );
            }

            results.push({
              original: [episodic],
              consolidated: semantic,
              strategy: 'synthesize', // Using synthesize for episodic to semantic conversion
              confidence: 0.8
            });
          }
        }
      }

      return results;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'MemoryConsolidator',
        'Error converting episodic to semantic',
        {
          userId: userId.substring(0, 8),
          agentId: agentId.substring(0, 8),
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return [];
    }
  }

  /**
   * Find and merge similar memories using embeddings and optional LLM enhancement
   */
  private async findAndMergeSimilar(
    userId: string,
    agentId: string,
    config: ConsolidationConfig
  ): Promise<ConsolidationResult[]> {
    try {
      // Get all semantic memories for similarity analysis
      const semanticMemories = await this.getSemanticMemories(userId, agentId);

      if (semanticMemories.length < 2) {
        return [];
      }

      logger.debug(
        LogCategory.STORAGE,
        'MemoryConsolidator',
        'Finding similar memories (language-agnostic)',
        {
          userId: userId.substring(0, 8),
          agentId: agentId.substring(0, 8),
          semanticCount: semanticMemories.length,
          threshold: config.similarityThreshold
        }
      );

      const results: ConsolidationResult[] = [];
      const processed = new Set<string>();

      // Find similar memory clusters using embeddings
      for (const memory of semanticMemories) {
        if (processed.has(memory.id)) continue;

        const similar = await this.findSimilarMemories(
          memory,
          semanticMemories,
          config.similarityThreshold
        );

        if (similar.length > 1) {
          // Including the original memory
          const consolidated = await this.mergeMemories(similar, config);

          // Store consolidated memory
          await this.storage.setMemory?.(consolidated);

          // Mark as processed and optionally remove originals
          similar.forEach((m) => processed.add(m.id));
          if (!config.preserveOriginals) {
            for (const mem of similar) {
              await this.storage.deleteMemory?.(
                userId,
                agentId,
                mem.type,
                mem.id
              );
            }
          }

          results.push({
            original: similar,
            consolidated,
            strategy: config.strategies.includes('merge')
              ? 'merge'
              : 'synthesize',
            confidence: this.calculateMergeConfidence(similar)
          });
        }
      }

      return results;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'MemoryConsolidator',
        'Error finding similar memories',
        {
          userId: userId.substring(0, 8),
          agentId: agentId.substring(0, 8),
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return [];
    }
  }

  /**
   * Create semantic memory from episodic using LLM for language-agnostic extraction
   */
  private async createSemanticFromEpisodic(
    episodic: Memory,
    config: ConsolidationConfig
  ): Promise<Memory> {
    // Use LLM to extract semantic content if available
    let semanticContent = episodic.content;

    if (this.llm && config.enableLLMSummarization) {
      semanticContent = await this.extractSemanticContentLLM(episodic.content);
    } else {
      // Simple fallback - just use original content
      semanticContent = episodic.content;
    }

    const semantic: Memory = {
      id: generateId(),
      userId: episodic.userId, // Preserve userId from original memory
      agentId: episodic.agentId,
      content: semanticContent,
      type: 'semantic' as MemoryType,
      importance: Math.min(1.0, episodic.importance + 0.1), // Boost importance slightly
      resonance: episodic.resonance || 0, // Preserve resonance or default to 0
      accessCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now(),
      metadata: {
        ...episodic.metadata,
        convertedFrom: episodic.id,
        originalType: 'episodic',
        conversionDate: new Date().toISOString(),
        extractionMethod: this.llm
          ? 'llm_semantic_extraction'
          : 'simple_conversion'
      },
      keywords: episodic.keywords
    };

    return semantic;
  }

  /**
   * Use LLM to extract semantic content from episodic content (language-agnostic)
   */
  private async extractSemanticContentLLM(
    episodicContent: string
  ): Promise<string> {
    if (!this.llm) return episodicContent;

    try {
      const { object: result } = await this.llm.generateObject({
        schema: z.object({
          semanticContent: z.string(),
          reasoning: z.string().optional()
        }),
        messages: [
          {
            role: 'user',
            content: `Extract the core semantic meaning from this episodic memory, removing temporal references and personal context:

"${episodicContent}"

Extract the general knowledge or pattern that can be applied beyond this specific instance. Focus on the underlying concept, fact, or insight.`
          }
        ],
        temperature: 0.3
      });

      return result.semanticContent;
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'MemoryConsolidator',
        'LLM semantic extraction failed, using original content',
        { error: error instanceof Error ? error.message : String(error) }
      );
      return episodicContent;
    }
  }

  /**
   * Find similar memories using embedding similarity (language-agnostic)
   */
  private async findSimilarMemories(
    targetMemory: Memory,
    candidates: Memory[],
    threshold: number
  ): Promise<Memory[]> {
    const similar: Memory[] = [targetMemory]; // Always include the target memory

    // Use vector-based similarity if available, otherwise content-based
    if (this.storage.vectorSearch) {
      const results = await this.storage.vectorSearch(targetMemory.content, {
        limit: 10,
        threshold: threshold,
        exclude: [targetMemory.id]
      });

      // Filter results to only include candidates
      const candidateIds = new Set(candidates.map((c) => c.id));
      for (const result of results) {
        if (candidateIds.has(result.id)) {
          const candidate = candidates.find((c) => c.id === result.id);
          if (candidate) {
            similar.push(candidate);
          }
        }
      }
    } else {
      // Content-based similarity fallback
      for (const candidate of candidates) {
        if (candidate.id === targetMemory.id) continue;

        // Calculate content similarity using multiple approaches
        const similarities = {
          keyword: this.calculateKeywordSimilarity(targetMemory, candidate),
          content: this.calculateContentSimilarity(
            targetMemory.content,
            candidate.content
          ),
          metadata: this.calculateMetadataSimilarity(targetMemory, candidate)
        };

        // Weighted similarity score
        const weightedSimilarity =
          similarities.keyword * 0.4 +
          similarities.content * 0.5 +
          similarities.metadata * 0.1;

        if (weightedSimilarity >= threshold) {
          similar.push(candidate);
        }
      }
    }

    logger.debug(
      LogCategory.STORAGE,
      'MemoryConsolidator',
      'Found similar memories',
      {
        targetMemoryId: targetMemory.id.substring(0, 8),
        candidatesCount: candidates.length,
        similarCount: similar.length - 1, // Exclude target memory
        threshold
      }
    );

    return similar;
  }

  /**
   * Calculate keyword-based similarity between two memories
   */
  private calculateKeywordSimilarity(memory1: Memory, memory2: Memory): number {
    const keywords1 = new Set(memory1.keywords || []);
    const keywords2 = new Set(memory2.keywords || []);

    if (keywords1.size === 0 && keywords2.size === 0) {
      return 0.5; // Neutral score when no keywords
    }

    const intersection = new Set(
      [...keywords1].filter((k) => keywords2.has(k))
    );
    const union = new Set([...keywords1, ...keywords2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate content-based similarity using simple text comparison
   */
  private calculateContentSimilarity(
    content1: string,
    content2: string
  ): number {
    // Normalize content
    const normalize = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);

    const words1 = new Set(normalize(content1));
    const words2 = new Set(normalize(content2));

    if (words1.size === 0 && words2.size === 0) {
      return 1.0; // Both empty
    }

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate metadata-based similarity
   */
  private calculateMetadataSimilarity(
    memory1: Memory,
    memory2: Memory
  ): number {
    const meta1 = memory1.metadata || {};
    const meta2 = memory2.metadata || {};

    const keys1 = new Set(Object.keys(meta1));
    const keys2 = new Set(Object.keys(meta2));
    const commonKeys = [...keys1].filter((k) => keys2.has(k));

    if (commonKeys.length === 0) {
      return 0.5; // Neutral when no common metadata
    }

    let matches = 0;
    for (const key of commonKeys) {
      if (meta1[key] === meta2[key]) {
        matches++;
      }
    }

    return matches / commonKeys.length;
  }

  /**
   * Merge multiple memories using LLM for intelligent synthesis
   */
  private async mergeMemories(
    memories: Memory[],
    config: ConsolidationConfig
  ): Promise<Memory> {
    // Sort by importance and recency
    const sorted = memories.sort((a, b) => {
      const importanceDiff = b.importance - a.importance;
      if (Math.abs(importanceDiff) > 0.1) return importanceDiff;
      return b.createdAt - a.createdAt;
    });

    const primary = sorted[0];
    let mergedContent: string;

    // Use LLM for intelligent merging if available
    if (this.llm && config.enableLLMSummarization) {
      mergedContent = await this.synthesizeContentLLM(memories);
    } else {
      // Simple concatenation fallback
      mergedContent = this.synthesizeContentSimple(memories);
    }

    const merged: Memory = {
      id: generateId(),
      userId: primary.userId, // Preserve userId from primary memory
      agentId: primary.agentId,
      content: mergedContent,
      type: primary.type,
      importance: Math.max(...memories.map((m) => m.importance)),
      resonance: Math.max(...memories.map((m) => m.resonance || 0)), // Take max resonance
      accessCount: memories.reduce((sum, m) => sum + m.accessCount, 0),
      createdAt: Math.min(...memories.map((m) => m.createdAt)),
      updatedAt: Date.now(),
      lastAccessedAt: Math.max(...memories.map((m) => m.lastAccessedAt)),
      metadata: {
        mergedFrom: memories.map((m) => m.id),
        mergeDate: new Date().toISOString(),
        mergeStrategy: config.strategies[0] || 'merge',
        mergeMethod: this.llm ? 'llm_synthesis' : 'simple_concatenation'
      },
      keywords: this.mergeKeywords(memories)
    };

    return merged;
  }

  /**
   * Use LLM for intelligent content synthesis (language-agnostic)
   */
  private async synthesizeContentLLM(memories: Memory[]): Promise<string> {
    if (!this.llm) return this.synthesizeContentSimple(memories);

    try {
      const contents = memories
        .map((m, i) => `${i + 1}. ${m.content}`)
        .join('\n');

      const { object: result } = await this.llm.generateObject({
        schema: z.object({
          synthesizedContent: z.string(),
          reasoning: z.string().optional()
        }),
        messages: [
          {
            role: 'user',
            content: `Synthesize these related memories into a single coherent summary that captures all key information:

${contents}

Create a comprehensive summary that preserves all important details while eliminating redundancy.`
          }
        ],
        temperature: 0.3
      });

      return result.synthesizedContent;
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'MemoryConsolidator',
        'LLM synthesis failed, using simple concatenation',
        { error: error instanceof Error ? error.message : String(error) }
      );
      return this.synthesizeContentSimple(memories);
    }
  }

  /**
   * Simple content synthesis fallback
   */
  private synthesizeContentSimple(memories: Memory[]): string {
    const contents = memories.map((m) => m.content);
    const uniqueContents = Array.from(new Set(contents));

    if (uniqueContents.length === 1) {
      return uniqueContents[0];
    }

    return uniqueContents.join('. ');
  }

  /**
   * Merge keywords from multiple memories
   */
  private mergeKeywords(memories: Memory[]): string[] {
    const allKeywords = new Set<string>();

    memories.forEach((memory) => {
      if (memory.keywords) {
        memory.keywords.forEach((keyword) => allKeywords.add(keyword));
      }
    });

    return Array.from(allKeywords).slice(0, 20); // Limit to 20 keywords
  }

  /**
   * Calculate confidence for memory merge
   */
  private calculateMergeConfidence(memories: Memory[]): number {
    // Base confidence on number of memories and their importance
    const avgImportance =
      memories.reduce((sum, m) => sum + m.importance, 0) / memories.length;
    const countFactor = Math.min(1, memories.length / 5); // Boost for more memories

    return Math.min(0.95, avgImportance * 0.7 + countFactor * 0.3);
  }

  /**
   * Create hierarchical abstractions (placeholder)
   */
  private async createHierarchicalAbstractions(
    userId: string,
    agentId: string,
    config: ConsolidationConfig
  ): Promise<ConsolidationResult[]> {
    // This would implement hierarchical clustering and abstraction
    // For now, return empty array
    return [];
  }

  /**
   * Get episodic memories older than cutoff
   */
  private async getEpisodicMemories(
    userId: string,
    agentId: string,
    cutoffTime: number
  ): Promise<Memory[]> {
    if (!userId?.trim()) {
      throw new Error('userId is required for memory retrieval operations');
    }

    // Use storage memory operations if available
    if (this.storage.memory?.getByType) {
      return this.storage.memory.getByType(userId, agentId, 'episodic', {
        createdBefore: cutoffTime
      });
    }

    // Fallback: return empty array (would need proper storage query implementation)
    logger.warn(
      LogCategory.STORAGE,
      'MemoryConsolidator',
      'No memory operations available for episodic memories - returning empty array',
      { userId: userId.substring(0, 8), agentId: agentId.substring(0, 8) }
    );
    return [];
  }

  /**
   * Get semantic memories for an agent
   */
  private async getSemanticMemories(
    userId: string,
    agentId: string
  ): Promise<Memory[]> {
    if (!userId?.trim()) {
      throw new Error('userId is required for memory retrieval operations');
    }

    // Use storage memory operations if available
    if (this.storage.memory?.getByType) {
      return this.storage.memory.getByType(userId, agentId, 'semantic');
    }

    // Fallback: return empty array (would need proper storage query implementation)
    logger.warn(
      LogCategory.STORAGE,
      'MemoryConsolidator',
      'No memory operations available for semantic memories - returning empty array',
      { userId: userId.substring(0, 8), agentId: agentId.substring(0, 8) }
    );
    return [];
  }

  /**
   * Create mock cost tracker for testing
   */
  private createMockCostTracker(): CostTracker {
    return {
      async trackExtraction() {
        // Mock implementation
      },
      async checkBudget() {
        return true; // Always within budget for mock
      }
    };
  }
}
