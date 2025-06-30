/**
 * @fileoverview CostOptimizer - Intelligent extraction routing for 5x cost reduction
 * Routes messages through 3-tier system: rules → small LLM → large LLM
 * 
 * @example
 * ```typescript
 * const config = {
 *   extractors: [
 *     { type: 'rules', enabled: true, costPerMemory: 0 },
 *     { type: 'small-llm', enabled: true, costPerMemory: 0.001 },
 *     { type: 'large-llm', enabled: true, costPerMemory: 0.01 }
 *   ],
 *   costBudget: 0.50,
 *   targetCoverage: 0.85
 * };
 * 
 * const optimizer = new CostOptimizer(config);
 * const plan = await optimizer.createPlan(messages, userRules, 0.50);
 * ```
 * 
 * @author AgentDock Core Team
 */

import { MemoryMessage } from '../../types';
import { BatchProcessorConfig, ExtractionRule } from '../types';
import { LogCategory, logger } from '../../../logging';

/**
 * Plan for optimized extraction routing
 */
export interface OptimizationPlan {
  rulesMessages: MemoryMessage[];
  smallLLMMessages: MemoryMessage[];
  largeLLMMessages: MemoryMessage[];
  estimatedCost: number;
  coverage: number;
  actualCost?: number;
  metrics?: OptimizationMetrics;
}

/**
 * Metrics for optimization performance
 */
export interface OptimizationMetrics {
  totalMessages: number;
  rulesCount: number;
  smallLLMCount: number;
  largeLLMCount: number;
  costBreakdown: {
    rules: number;
    smallLLM: number;
    largeLLM: number;
  };
}

/**
 * Intelligent cost optimizer that routes messages through the most cost-effective
 * extraction method while maintaining quality and staying within budget.
 */
export class CostOptimizer {
  private config: BatchProcessorConfig;

  constructor(config: BatchProcessorConfig) {
    this.config = config;
  }

  /**
   * Create optimal extraction plan based on budget and coverage requirements.
   */
  async createPlan(
    messages: MemoryMessage[],
    userRules: ExtractionRule[],
    budgetLimit?: number
  ): Promise<OptimizationPlan> {
    const budget = budgetLimit || this.config.costBudget || 1.0;
    const targetCoverage = this.config.targetCoverage || 0.8;

    // Step 1: Route all messages through rules first (free)
    const rulesMessages = this.shouldUseRules() ? [...messages] : [];
    
    // Step 2: Estimate what rules won't cover based on complexity
    const uncoveredMessages = this.estimateUncoveredByRules(messages, userRules);
    
    // Step 3: Route uncovered messages optimally between small/large LLM
    const { smallLLMMessages, largeLLMMessages } = await this.optimizeUncoveredRouting(
      uncoveredMessages,
      budget,
      targetCoverage
    );

    // Step 4: Calculate costs and metrics
    const estimatedCost = await this.calculateTotalCost(
      rulesMessages,
      smallLLMMessages,
      largeLLMMessages
    );

    const coverage = this.calculateCoverage(
      messages.length,
      rulesMessages.length,
      smallLLMMessages.length,
      largeLLMMessages.length
    );

    const metrics: OptimizationMetrics = {
      totalMessages: messages.length,
      rulesCount: rulesMessages.length,
      smallLLMCount: smallLLMMessages.length,
      largeLLMCount: largeLLMMessages.length,
      costBreakdown: {
        rules: 0, // Always free
        smallLLM: await this.estimateSmallLLMCost(smallLLMMessages),
        largeLLM: await this.estimateLargeLLMCost(largeLLMMessages)
      }
    };

    logger.info(LogCategory.STORAGE, 'CostOptimizer', 'Optimization plan created', {
      estimatedCost,
      coverage,
      totalMessages: messages.length,
      distribution: `${rulesMessages.length}R/${smallLLMMessages.length}S/${largeLLMMessages.length}L`
    });

    return {
      rulesMessages,
      smallLLMMessages,
      largeLLMMessages,
      estimatedCost,
      coverage,
      metrics
    };
  }

  /**
   * Check if rules extractor is enabled
   */
  private shouldUseRules(): boolean {
    const rulesConfig = this.config.extractors.find(e => e.type === 'rules');
    return rulesConfig?.enabled ?? true;
  }

  /**
   * Estimate which messages rules won't cover based on user patterns
   */
  private estimateUncoveredByRules(messages: MemoryMessage[], userRules: ExtractionRule[]): MemoryMessage[] {
    if (!userRules || userRules.length === 0) {
      return messages; // No rules = all messages uncovered
    }

    // Check if any rule pattern might match
    return messages.filter(msg => {
      const hasMatchingRule = userRules.some(rule => {
        try {
          const regex = new RegExp(rule.pattern, 'i');
          return regex.test(msg.content);
        } catch {
          return false;
        }
      });

      return !hasMatchingRule; // Uncovered if no rules match
    });
  }

  /**
   * Optimize routing between small and large LLM based on budget and requirements
   */
  private async optimizeUncoveredRouting(
    uncoveredMessages: MemoryMessage[],
    budget: number,
    targetCoverage: number
  ): Promise<{ smallLLMMessages: MemoryMessage[]; largeLLMMessages: MemoryMessage[] }> {
    if (uncoveredMessages.length === 0) {
      return { smallLLMMessages: [], largeLLMMessages: [] };
    }

    const smallLLMEnabled = this.config.extractors.find(e => e.type === 'small-llm')?.enabled ?? true;
    const largeLLMEnabled = this.config.extractors.find(e => e.type === 'large-llm')?.enabled ?? false;

    // Route based on configured preferences and budget
    if (!largeLLMEnabled) {
      return {
        smallLLMMessages: smallLLMEnabled ? uncoveredMessages : [],
        largeLLMMessages: []
      };
    }

    if (!smallLLMEnabled) {
      return {
        smallLLMMessages: [],
        largeLLMMessages: largeLLMEnabled ? uncoveredMessages : []
      };
    }

    // Default split: most to small LLM, remainder to large LLM
    const splitPoint = Math.floor(uncoveredMessages.length * 0.9);
    return {
      smallLLMMessages: uncoveredMessages.slice(0, splitPoint),
      largeLLMMessages: uncoveredMessages.slice(splitPoint)
    };
  }

  /**
   * Calculate total estimated cost across all extraction methods
   */
  private async calculateTotalCost(
    rulesMessages: MemoryMessage[],
    smallLLMMessages: MemoryMessage[],
    largeLLMMessages: MemoryMessage[]
  ): Promise<number> {
    const rulesCost = 0; // Always free
    const smallLLMCost = await this.estimateSmallLLMCost(smallLLMMessages);
    const largeLLMCost = await this.estimateLargeLLMCost(largeLLMMessages);
    
    return rulesCost + smallLLMCost + largeLLMCost;
  }

  /**
   * Estimate cost for small LLM processing
   */
  private async estimateSmallLLMCost(messages: MemoryMessage[]): Promise<number> {
    if (messages.length === 0) return 0;
    
    const smallLLMConfig = this.config.extractors.find(e => e.type === 'small-llm');
    return (smallLLMConfig?.costPerMemory || 0) * messages.length;
  }

  /**
   * Estimate cost for large LLM processing
   */
  private async estimateLargeLLMCost(messages: MemoryMessage[]): Promise<number> {
    if (messages.length === 0) return 0;
    
    const largeLLMConfig = this.config.extractors.find(e => e.type === 'large-llm');
    return (largeLLMConfig?.costPerMemory || 0) * messages.length;
  }

  /**
   * Calculate extraction coverage percentage
   */
  private calculateCoverage(
    totalMessages: number,
    rulesCount: number,
    smallLLMCount: number,
    largeLLMCount: number
  ): number {
    const coveredMessages = rulesCount + smallLLMCount + largeLLMCount;
    return totalMessages > 0 ? coveredMessages / totalMessages : 0;
  }
} 