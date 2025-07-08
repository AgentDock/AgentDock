/**
 * @fileoverview TemporalPatternAnalyzer - Language-agnostic temporal pattern recognition
 *
 * Analyzes memory access patterns, temporal clusters, and time-based relationships.
 * Uses progressive enhancement: statistical analysis (free) + optional LLM insights (configurable).
 *
 * @author AgentDock Core Team
 */

import { z } from 'zod';

import { CoreLLM } from '../../../llm/core-llm';
import { createLLM } from '../../../llm/create-llm';
import { LogCategory, logger } from '../../../logging';
import { Memory } from '../../types/common';
import {
  ActivityCluster,
  IntelligenceLayerConfig,
  TemporalPattern
} from '../types';

// Zod schema for LLM temporal analysis validation
const TemporalAnalysisSchema = z.object({
  patterns: z.array(
    z.object({
      type: z.enum(['daily', 'weekly', 'monthly', 'periodic', 'burst']),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      frequency: z.number().optional()
    })
  ),
  insights: z.string().optional()
});

type TemporalAnalysis = z.infer<typeof TemporalAnalysisSchema>;

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
 * Language-agnostic temporal pattern analyzer using progressive enhancement
 */
export class TemporalPatternAnalyzer {
  private llm?: CoreLLM;
  private costTracker: CostTracker;

  constructor(
    private storage: any,
    private config: IntelligenceLayerConfig,
    costTracker?: CostTracker
  ) {
    // Only create LLM if enhancement is enabled and required fields are provided
    if (
      config.connectionDetection.llmEnhancement?.enabled &&
      config.connectionDetection.llmEnhancement.provider &&
      config.connectionDetection.llmEnhancement.model
    ) {
      this.llm = createLLM({
        provider: config.connectionDetection.llmEnhancement.provider as any,
        model: config.connectionDetection.llmEnhancement.model,
        apiKey:
          config.connectionDetection.llmEnhancement.apiKey ||
          process.env[
            `${config.connectionDetection.llmEnhancement.provider.toUpperCase()}_API_KEY`
          ] ||
          ''
      });
    }

    // Use provided cost tracker or create mock
    this.costTracker = costTracker || this.createMockCostTracker();

    logger.debug(
      LogCategory.STORAGE,
      'TemporalPatternAnalyzer',
      'Initialized temporal pattern analyzer',
      {
        llmEnabled: !!this.llm,
        method: config.connectionDetection.method
      }
    );
  }

  /**
   * Analyze temporal patterns for an agent using progressive enhancement
   */
  async analyzePatterns(
    agentId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<TemporalPattern[]> {
    try {
      logger.debug(
        LogCategory.STORAGE,
        'TemporalPatternAnalyzer',
        'Analyzing temporal patterns (language-agnostic)',
        {
          agentId: agentId.substring(0, 8),
          timeRange: timeRange
            ? `${timeRange.start.toISOString()} to ${timeRange.end.toISOString()}`
            : 'all time'
        }
      );

      // Get memories for analysis
      const memories = await this.getMemoriesInTimeRange(agentId, timeRange);

      if (memories.length < 5) {
        logger.info(
          LogCategory.STORAGE,
          'TemporalPatternAnalyzer',
          'Insufficient memories for pattern analysis',
          { agentId: agentId.substring(0, 8), memoryCount: memories.length }
        );
        return [];
      }

      const patterns: TemporalPattern[] = [];

      // Level 1: Statistical analysis (free, language-agnostic)
      const statisticalPatterns = this.analyzeStatisticalPatterns(memories);
      patterns.push(...statisticalPatterns);

      // Level 2: LLM enhancement for deeper insights (optional, cost-aware)
      if (this.shouldUseLLMEnhancement(memories)) {
        const llmPatterns = await this.analyzePatternsWithLLM(
          agentId,
          memories
        );
        patterns.push(...llmPatterns);
      }

      // Sort by confidence and remove duplicates
      const uniquePatterns = this.deduplicatePatterns(patterns);

      logger.info(
        LogCategory.STORAGE,
        'TemporalPatternAnalyzer',
        'Temporal pattern analysis completed',
        {
          agentId: agentId.substring(0, 8),
          memoriesAnalyzed: memories.length,
          patternsFound: uniquePatterns.length,
          llmUsed: !!this.llm && memories.length >= 20
        }
      );

      return uniquePatterns;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'TemporalPatternAnalyzer',
        'Error analyzing temporal patterns',
        {
          agentId: agentId.substring(0, 8),
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return [];
    }
  }

  /**
   * Detect activity clusters (periods of high memory activity)
   */
  async detectActivityClusters(
    agentId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<ActivityCluster[]> {
    try {
      const memories = await this.getMemoriesInTimeRange(agentId, timeRange);

      if (memories.length < 3) {
        return [];
      }

      // Sort memories by timestamp
      const sortedMemories = memories.sort((a, b) => a.createdAt - b.createdAt);

      // Define cluster window (1 hour by default)
      const clusterWindow = 60 * 60 * 1000; // 1 hour in milliseconds
      const clusters: ActivityCluster[] = [];
      let currentCluster: Memory[] = [];
      let clusterStart = sortedMemories[0].createdAt;

      for (const memory of sortedMemories) {
        // If within cluster window, add to current cluster
        if (memory.createdAt - clusterStart <= clusterWindow) {
          currentCluster.push(memory);
        } else {
          // Create cluster from current memories and start new cluster
          if (currentCluster.length >= 3) {
            // Minimum 3 memories for a cluster
            clusters.push(this.createActivityCluster(currentCluster));
          }

          currentCluster = [memory];
          clusterStart = memory.createdAt;
        }
      }

      // Handle final cluster
      if (currentCluster.length >= 3) {
        clusters.push(this.createActivityCluster(currentCluster));
      }

      return clusters.sort((a, b) => b.intensity - a.intensity);
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'TemporalPatternAnalyzer',
        'Error detecting activity clusters',
        {
          agentId: agentId.substring(0, 8),
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return [];
    }
  }

  /**
   * Statistical pattern analysis (free, language-agnostic)
   */
  private analyzeStatisticalPatterns(memories: Memory[]): TemporalPattern[] {
    const patterns: TemporalPattern[] = [];

    // Analyze by hour of day
    const hourlyPattern = this.analyzeHourlyPattern(memories);
    if (hourlyPattern) patterns.push(hourlyPattern);

    // Analyze by day of week
    const weeklyPattern = this.analyzeWeeklyPattern(memories);
    if (weeklyPattern) patterns.push(weeklyPattern);

    // Analyze burst patterns
    const burstPatterns = this.analyzeBurstPatterns(memories);
    patterns.push(...burstPatterns);

    return patterns;
  }

  /**
   * Analyze hourly patterns in memory creation
   */
  private analyzeHourlyPattern(memories: Memory[]): TemporalPattern | null {
    const hourCounts = new Array(24).fill(0);

    memories.forEach((memory) => {
      const hour = new Date(memory.createdAt).getHours();
      hourCounts[hour]++;
    });

    // Find peak hours (hours with activity > 1.5x average)
    const avgActivity = memories.length / 24;
    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(({ count }) => count > avgActivity * 1.5)
      .map(({ hour }) => hour);

    if (peakHours.length === 0) return null;

    // Calculate confidence based on how pronounced the peaks are
    const maxActivity = Math.max(...hourCounts);
    const confidence = Math.min(0.9, maxActivity / avgActivity / 3);

    return {
      type: 'daily',
      confidence,
      memories: memories.map((m) => m.id),
      metadata: {
        peakTimes: peakHours.map((hour) => new Date(2024, 0, 1, hour)),
        description: `Most active during hours: ${peakHours.join(', ')}`
      }
    };
  }

  /**
   * Analyze weekly patterns in memory creation
   */
  private analyzeWeeklyPattern(memories: Memory[]): TemporalPattern | null {
    const dayCounts = new Array(7).fill(0);
    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday'
    ];

    memories.forEach((memory) => {
      const day = new Date(memory.createdAt).getDay();
      dayCounts[day]++;
    });

    // Find peak days
    const avgActivity = memories.length / 7;
    const peakDays = dayCounts
      .map((count, day) => ({ day, count }))
      .filter(({ count }) => count > avgActivity * 1.3)
      .map(({ day }) => day);

    if (peakDays.length === 0) return null;

    const maxActivity = Math.max(...dayCounts);
    const confidence = Math.min(0.85, maxActivity / avgActivity / 2.5);

    return {
      type: 'weekly',
      confidence,
      memories: memories.map((m) => m.id),
      metadata: {
        description: `Most active on: ${peakDays.map((d) => dayNames[d]).join(', ')}`
      }
    };
  }

  /**
   * Analyze burst patterns (periods of unusually high activity)
   */
  private analyzeBurstPatterns(memories: Memory[]): TemporalPattern[] {
    if (memories.length < 10) return [];

    const sorted = memories.sort((a, b) => a.createdAt - b.createdAt);
    const patterns: TemporalPattern[] = [];

    // Define burst as 5+ memories within 30 minutes
    const burstWindow = 30 * 60 * 1000; // 30 minutes
    const minBurstSize = 5;

    let windowStart = 0;

    for (let i = 0; i < sorted.length; i++) {
      // Move window start forward
      while (
        windowStart < i &&
        sorted[i].createdAt - sorted[windowStart].createdAt > burstWindow
      ) {
        windowStart++;
      }

      const windowSize = i - windowStart + 1;

      if (windowSize >= minBurstSize) {
        const burstMemories = sorted.slice(windowStart, i + 1);
        const confidence = Math.min(0.8, windowSize / 10);

        patterns.push({
          type: 'burst',
          confidence,
          memories: burstMemories.map((m) => m.id),
          metadata: {
            description: `Burst of ${windowSize} memories in 30 minutes`,
            interval: burstWindow
          }
        });

        // Skip ahead to avoid overlapping burst detections
        i += Math.floor(windowSize / 2);
        windowStart = i;
      }
    }

    return patterns;
  }

  /**
   * Determine if LLM enhancement should be used
   */
  private shouldUseLLMEnhancement(memories: Memory[]): boolean {
    // Only use LLM for substantial datasets to justify cost
    return !!(
      this.llm &&
      memories.length >= 20 &&
      this.config.costControl.preferEmbeddingWhenSimilar
    );
  }

  /**
   * Use LLM for deeper temporal pattern analysis
   */
  private async analyzePatternsWithLLM(
    agentId: string,
    memories: Memory[]
  ): Promise<TemporalPattern[]> {
    if (!this.llm) return [];

    try {
      // Check budget before proceeding
      const withinBudget = await this.costTracker.checkBudget(
        agentId,
        this.config.costControl.monthlyBudget || Infinity
      );

      if (!withinBudget) {
        logger.info(
          LogCategory.STORAGE,
          'TemporalPatternAnalyzer',
          'Skipping LLM analysis due to budget constraints',
          { agentId: agentId.substring(0, 8) }
        );
        return [];
      }

      // Prepare memory data for LLM analysis (anonymized)
      const timeData = memories.map((m) => ({
        timestamp: new Date(m.createdAt).toISOString(),
        importance: m.importance,
        type: m.type
      }));

      const { object: result } = await this.llm.generateObject({
        schema: TemporalAnalysisSchema,
        messages: [
          {
            role: 'user',
            content: `Analyze these memory creation timestamps for temporal patterns:

${JSON.stringify(timeData, null, 2)}

Identify recurring patterns such as:
- Daily routines (specific times of day)
- Weekly patterns (certain days)
- Monthly cycles
- Periodic intervals
- Burst activities

Focus on statistically significant patterns with confidence scores.`
          }
        ],
        temperature: 0.3
      });

      // Convert LLM results to TemporalPattern format
      return result.patterns.map((pattern: any) => ({
        type: pattern.type,
        confidence: pattern.confidence,
        frequency: pattern.frequency,
        memories: memories.map((m) => m.id),
        metadata: {
          description: pattern.description,
          llmGenerated: true
        }
      }));
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'TemporalPatternAnalyzer',
        'LLM pattern analysis failed',
        { error: error instanceof Error ? error.message : String(error) }
      );
      return [];
    }
  }

  /**
   * Remove duplicate patterns
   */
  private deduplicatePatterns(patterns: TemporalPattern[]): TemporalPattern[] {
    const seen = new Set<string>();
    const unique: TemporalPattern[] = [];

    for (const pattern of patterns) {
      const key = `${pattern.type}_${pattern.frequency || 'none'}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(pattern);
      }
    }

    return unique.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Create activity cluster from memories
   */
  private createActivityCluster(memories: Memory[]): ActivityCluster {
    const times = memories.map((m) => m.createdAt);
    const startTime = new Date(Math.min(...times));
    const endTime = new Date(Math.max(...times));

    // Calculate intensity (memories per hour)
    const durationHours =
      (endTime.getTime() - startTime.getTime()) / (60 * 60 * 1000);
    const intensity = memories.length / Math.max(durationHours, 0.5); // Min 0.5 hours

    // Extract topics from memory content (simplified)
    const topics = this.extractTopics(memories);

    return {
      startTime,
      endTime,
      memoryIds: memories.map((m) => m.id),
      topics,
      intensity: Math.min(1.0, intensity / 10) // Normalize to 0-1
    };
  }

  /**
   * Extract topics from memories (simple keyword extraction)
   */
  private extractTopics(memories: Memory[]): string[] {
    const allKeywords = new Set<string>();

    memories.forEach((memory) => {
      if (memory.keywords) {
        memory.keywords.forEach((keyword) => allKeywords.add(keyword));
      }
    });

    return Array.from(allKeywords).slice(0, 5); // Top 5 topics
  }

  /**
   * Get memories in time range
   */
  private async getMemoriesInTimeRange(
    agentId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<Memory[]> {
    // This would query storage for memories in time range
    // For now, return empty array
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
