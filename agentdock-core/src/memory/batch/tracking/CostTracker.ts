/**
 * @fileoverview CostTracker - Real-time Memory Extraction Cost Monitoring
 * 
 * Tracks costs across all extraction methods to enable budget optimization
 * and transparent cost reporting for users. Fully configurable without
 * hardcoded business logic.
 * 
 * @author AgentDock Core Team
 */

import { LogCategory, logger } from '../../../logging';
import { StorageProvider } from '../../../storage';
import { generateId } from '../../../storage/utils';

/**
 * Cost tracking record for memory extraction operations.
 * 
 * @interface CostRecord
 */
export interface CostRecord {
  /** Unique identifier for this cost record */
  id: string;
  
  /** Agent ID this cost applies to */
  agentId: string;
  
  /** Type of extraction that incurred the cost */
  extractorType: string; // Configurable, not hardcoded
  
  /** Cost in USD */
  cost: number;
  
  /** Number of memories extracted for this cost */
  memoriesExtracted: number;
  
  /** Number of messages processed */
  messagesProcessed: number;
  
  /** When this cost was incurred */
  timestamp: Date;
  
  /** Additional metadata about the extraction */
  metadata?: Record<string, any>;
}

/**
 * Cost summary for reporting and budget management.
 * 
 * @interface CostSummary
 */
export interface CostSummary {
  /** Total cost across all extractors */
  totalCost: number;
  
  /** Cost breakdown by extractor type */
  costByExtractor: Record<string, number>;
  
  /** Total memories extracted */
  totalMemories: number;
  
  /** Average cost per memory */
  avgCostPerMemory: number;
  
  /** Time period for this summary */
  period: { start: Date; end: Date };
}

/**
 * Configuration for CostTracker behavior.
 * Allows full customization of storage patterns and TTLs.
 * 
 * @interface CostTrackerConfig
 */
export interface CostTrackerConfig {
  /** Storage key pattern for cost records (default: 'cost-record:{agentId}:{recordId}') */
  recordKeyPattern?: string;
  
  /** Storage key pattern for daily totals (default: 'cost-daily:{agentId}:{date}') */
  dailyKeyPattern?: string;
  
  /** TTL for daily totals in seconds (default: 604800 = 7 days) */
  dailyTotalTTL?: number;
  
  /** Custom time period definitions */
  timePeriods?: Record<string, number>; // period name -> hours
  
  /** Default time period if not specified (default: '24h') */
  defaultPeriod?: string;
}

/**
 * Real-time cost tracking for memory extraction operations.
 * Provides transparent cost monitoring and budget enforcement.
 * 
 * @class CostTracker
 * @example
 * ```typescript
 * const tracker = new CostTracker(storage, {
 *   recordKeyPattern: 'my-cost:{agentId}:{recordId}',
 *   dailyTotalTTL: 1209600, // 14 days
 *   timePeriods: {
 *     '1h': 1,
 *     '8h': 8,
 *     '1d': 24,
 *     '1w': 168
 *   }
 * });
 * 
 * // Track extraction cost
 * await tracker.trackExtraction(agentId, {
 *   extractorType: 'my-custom-extractor', // Any string, not hardcoded
 *   cost: 0.05,
 *   memoriesExtracted: 3,
 *   messagesProcessed: 10
 * });
 * 
 * // Check budget status
 * const withinBudget = await tracker.checkBudget(agentId, 1.00);
 * 
 * // Get cost report
 * const summary = await tracker.getCostSummary(agentId, '7d');
 * ```
 */
export class CostTracker {
  private readonly storage: StorageProvider;
  private readonly config: Required<CostTrackerConfig>;
  
  // Default time periods (in hours)
  private static readonly DEFAULT_TIME_PERIODS = {
    '1h': 1,
    '24h': 24,
    '7d': 168,
    '30d': 720
  };

  /**
   * Creates a new CostTracker instance.
   * 
   * @param storage - Storage provider for persisting cost records
   * @param config - Optional configuration for customizing behavior
   */
  constructor(storage: StorageProvider, config: CostTrackerConfig = {}) {
    this.storage = storage;
    this.config = {
      recordKeyPattern: config.recordKeyPattern || 'cost-record:{agentId}:{recordId}',
      dailyKeyPattern: config.dailyKeyPattern || 'cost-daily:{agentId}:{date}',
      dailyTotalTTL: config.dailyTotalTTL || 604800, // 7 days
      timePeriods: config.timePeriods || CostTracker.DEFAULT_TIME_PERIODS,
      defaultPeriod: config.defaultPeriod || '24h'
    };
  }

  /**
   * Track a memory extraction cost.
   * Records the cost and updates running totals.
   * 
   * @param agentId - Agent identifier
   * @param record - Cost record details
   * @returns Promise that resolves when cost is tracked
   */
  async trackExtraction(
    agentId: string, 
    record: Omit<CostRecord, 'id' | 'agentId' | 'timestamp'>
  ): Promise<void> {
    const costRecord: CostRecord = {
      id: generateId(),
      agentId,
      timestamp: new Date(),
      ...record
    };

    // Store individual cost record
    const recordKey = this.formatKey(this.config.recordKeyPattern, {
      agentId,
      recordId: costRecord.id
    });
    await this.storage.set(recordKey, costRecord);

    // Update running totals
    await this.updateRunningTotals(agentId, costRecord);

    logger.info(LogCategory.STORAGE, 'CostTracker', 'Cost tracked', {
      agentId,
      extractorType: record.extractorType,
      cost: record.cost,
      memoriesExtracted: record.memoriesExtracted
    });
  }

  /**
   * Check if agent is within budget limits.
   * 
   * @param agentId - Agent identifier
   * @param budgetLimit - Budget limit in USD
   * @param period - Time period to check (default: '24h')
   * @returns Promise resolving to true if within budget
   */
  async checkBudget(
    agentId: string, 
    budgetLimit: number, 
    period: string = '24h'
  ): Promise<boolean> {
    const summary = await this.getCostSummary(agentId, period);
    return summary.totalCost <= budgetLimit;
  }

  /**
   * Get cost summary for a specific time period.
   * 
   * @param agentId - Agent identifier
   * @param period - Time period ('1h', '24h', '7d', '30d')
   * @returns Promise resolving to cost summary
   */
  async getCostSummary(agentId: string, period: string): Promise<CostSummary> {
    const { start, end } = this.parsePeriod(period);
    
    // Get all cost records for the period
    const records = await this.getCostRecords(agentId, start, end);
    
    // Calculate summary
    const totalCost = records.reduce((sum, record) => sum + record.cost, 0);
    const totalMemories = records.reduce((sum, record) => sum + record.memoriesExtracted, 0);
    
    const costByExtractor: Record<string, number> = {};
    for (const record of records) {
      costByExtractor[record.extractorType] = 
        (costByExtractor[record.extractorType] || 0) + record.cost;
    }

    return {
      totalCost,
      costByExtractor,
      totalMemories,
      avgCostPerMemory: totalMemories > 0 ? totalCost / totalMemories : 0,
      period: { start, end }
    };
  }

  /**
   * Update running cost totals for quick budget checks.
   * 
   * @private
   */
  private async updateRunningTotals(agentId: string, record: CostRecord): Promise<void> {
    const dailyKey = this.formatKey(this.config.dailyKeyPattern, {
      agentId,
      date: this.getDateKey(record.timestamp)
    });
    
    const dailyTotal = await this.storage.get<number>(dailyKey) || 0;
    await this.storage.set(dailyKey, dailyTotal + record.cost, { 
      ttlSeconds: this.config.dailyTotalTTL 
    });
  }

  /**
   * Get cost records for a specific time period.
   * 
   * @private
   */
  private async getCostRecords(
    agentId: string, 
    start: Date, 
    end: Date
  ): Promise<CostRecord[]> {
    // Create prefix by replacing agentId and leaving recordId as wildcard
    const prefix = this.config.recordKeyPattern
      .replace('{agentId}', agentId)
      .replace('{recordId}', '');
    
    const keys = await this.storage.list(prefix) || [];
    
    const records: CostRecord[] = [];
    for (const key of keys) {
      const record = await this.storage.get<CostRecord>(key);
      if (record && record.timestamp >= start && record.timestamp <= end) {
        records.push(record);
      }
    }
    
    return records;
  }

  /**
   * Parse time period string into start/end dates.
   * 
   * @private
   */
  private parsePeriod(period: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();
    
    const hours = this.config.timePeriods[period];
    if (hours) {
      start.setHours(start.getHours() - hours);
    } else {
      // Fallback to default period
      const defaultHours = this.config.timePeriods[this.config.defaultPeriod] || 24;
      start.setHours(start.getHours() - defaultHours);
    }
    
    return { start, end };
  }

  /**
   * Generate date key for daily totals.
   * 
   * @private
   */
  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * Format storage key by replacing placeholders.
   * 
   * @private
   */
  private formatKey(pattern: string, params: Record<string, string>): string {
    let key = pattern;
    for (const [param, value] of Object.entries(params)) {
      key = key.replace(`{${param}}`, value);
    }
    return key;
  }
}
