/**
 * @fileoverview LifecycleScheduler - Automated memory lifecycle scheduling
 * 
 * Manages periodic execution of memory lifecycle operations including decay,
 * promotion, and cleanup. Provides configurable scheduling with proper cleanup
 * and error handling.
 * 
 * @example
 * ```typescript
 * const scheduleConfig: ScheduleConfig = {
 *   decayInterval: 24 * 60 * 60 * 1000,    // Run decay daily
 *   promotionInterval: 7 * 24 * 60 * 60 * 1000,  // Check promotions weekly
 *   cleanupInterval: 24 * 60 * 60 * 1000,  // Clean up daily
 *   enabled: true
 * };
 * 
 * const scheduler = new LifecycleScheduler(lifecycleManager, scheduleConfig);
 * scheduler.start('therapy_agent');
 * 
 * // Later...
 * scheduler.stop('therapy_agent');
 * ```
 * 
 * @author AgentDock Core Team
 */

import { LogCategory, logger } from '../../logging';
import { MemoryLifecycleManager } from './MemoryLifecycleManager';

/**
 * Configuration for lifecycle scheduling operations.
 */
export interface ScheduleConfig {
  /** Run decay operations every N milliseconds (0 = disabled) */
  decayInterval: number;
  
  /** Check for memory promotions every N milliseconds (0 = disabled) */
  promotionInterval: number;
  
  /** Run cleanup operations every N milliseconds (0 = disabled) */
  cleanupInterval: number;
  
  /** Whether scheduling is enabled */
  enabled: boolean;
  
  /** Maximum number of operations to run concurrently */
  maxConcurrentOperations?: number;
  
  /** Whether to run operations on startup */
  runOnStartup?: boolean;
  
  /** Error retry configuration */
  retryConfig?: {
    maxRetries: number;
    backoffMs: number;
    exponential: boolean;
  };
}

/**
 * Manages automated scheduling of memory lifecycle operations.
 * 
 * Key features:
 * - Configurable intervals for different operations
 * - Per-agent scheduling management
 * - Automatic error handling and retry logic
 * - Concurrent operation limiting
 * - Clean shutdown and resource management
 */
export class LifecycleScheduler {
  private readonly lifecycleManager: MemoryLifecycleManager;
  private readonly config: ScheduleConfig;
  private readonly intervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly runningOperations: Set<string> = new Set();

  /**
   * Creates a new LifecycleScheduler.
   * 
   * @param lifecycleManager - Manager for executing lifecycle operations
   * @param config - Scheduling configuration
   */
  constructor(
    lifecycleManager: MemoryLifecycleManager,
    config: ScheduleConfig
  ) {
    this.lifecycleManager = lifecycleManager;
    this.config = {
      maxConcurrentOperations: 3,
      runOnStartup: false,
      retryConfig: {
        maxRetries: 3,
        backoffMs: 5000,
        exponential: true
      },
      ...config
    };

    logger.debug(LogCategory.STORAGE, 'LifecycleScheduler', 'Initialized scheduler', {
      decayInterval: this.config.decayInterval,
      promotionInterval: this.config.promotionInterval,
      cleanupInterval: this.config.cleanupInterval,
      enabled: this.config.enabled
    });
  }

  /**
   * Start lifecycle scheduling for an agent.
   * 
   * @param userId - User identifier
   * @param agentId - Agent identifier
   */
  start(userId: string, agentId: string): void {
    if (!this.config.enabled) {
      logger.info(LogCategory.STORAGE, 'LifecycleScheduler', 'Scheduler disabled, not starting', {
        userId,
        agentId
      });
      return;
    }

    // Stop existing schedules for this agent
    this.stop(userId, agentId);

    // Run initial operations if configured
    if (this.config.runOnStartup) {
      this.runLifecycle(userId, agentId, 'startup');
    }

    // Schedule decay operations
    if (this.config.decayInterval > 0) {
      const decayInterval = setInterval(
        () => this.runDecay(userId, agentId),
        this.config.decayInterval
      );
      this.intervals.set(`decay:${userId}:${agentId}`, decayInterval);
    }

    // Schedule promotion checks
    if (this.config.promotionInterval > 0) {
      const promotionInterval = setInterval(
        () => this.runPromotion(userId, agentId),
        this.config.promotionInterval
      );
      this.intervals.set(`promotion:${userId}:${agentId}`, promotionInterval);
    }

    // Schedule cleanup operations
    if (this.config.cleanupInterval > 0) {
      const cleanupInterval = setInterval(
        () => this.runCleanup(userId, agentId),
        this.config.cleanupInterval
      );
      this.intervals.set(`cleanup:${userId}:${agentId}`, cleanupInterval);
    }

    logger.info(LogCategory.STORAGE, 'LifecycleScheduler', 'Started lifecycle scheduler', {
      userId,
      agentId,
      intervals: Array.from(this.intervals.keys()).filter(key => key.includes(`${userId}:${agentId}`))
    });
  }

  /**
   * Stop lifecycle scheduling for an agent.
   * 
   * @param userId - User identifier
   * @param agentId - Agent identifier
   */
  stop(userId: string, agentId: string): void {
    const prefixes = ['decay', 'promotion', 'cleanup'];
    let stoppedCount = 0;

    for (const prefix of prefixes) {
      const key = `${prefix}:${userId}:${agentId}`;
      const interval = this.intervals.get(key);

      if (interval) {
        clearInterval(interval);
        this.intervals.delete(key);
        stoppedCount++;
      }
    }

    logger.info(LogCategory.STORAGE, 'LifecycleScheduler', 'Stopped lifecycle scheduler', {
      userId,
      agentId,
      stoppedIntervals: stoppedCount
    });
  }

  /**
   * Stop all scheduling operations.
   */
  stopAll(): void {
    for (const [key, interval] of Array.from(this.intervals.entries())) {
      clearInterval(interval);
    }
    this.intervals.clear();

    logger.info(LogCategory.STORAGE, 'LifecycleScheduler', 'Stopped all scheduling operations');
  }

  /**
   * Get scheduler status for an agent.
   * 
   * @param userId - User identifier
   * @param agentId - Agent identifier
   * @returns Scheduler status information
   */
  getStatus(userId: string, agentId: string): {
    active: boolean;
    intervals: string[];
    runningOperations: string[];
  } {
    const userAgentKey = `${userId}:${agentId}`;
    const intervals = Array.from(this.intervals.keys())
      .filter(key => key.includes(userAgentKey));
    
    const runningOperations = Array.from(this.runningOperations)
      .filter(op => op.includes(userAgentKey));

    return {
      active: intervals.length > 0,
      intervals,
      runningOperations
    };
  }

  /**
   * Run decay operation for an agent.
   * 
   * @private
   */
  private async runDecay(userId: string, agentId: string): Promise<void> {
    await this.executeWithConcurrencyControl(
      `decay:${userId}:${agentId}`,
      async () => {
        const result = await this.lifecycleManager.runLifecycle(userId, agentId);
        logger.debug(LogCategory.STORAGE, 'LifecycleScheduler', 'Scheduled decay completed', {
          userId,
          agentId,
          updated: result.decay.updated,
          deleted: result.decay.deleted
        });
      }
    );
  }

  /**
   * Run promotion operation for an agent.
   * 
   * @private
   */
  private async runPromotion(userId: string, agentId: string): Promise<void> {
    await this.executeWithConcurrencyControl(
      `promotion:${userId}:${agentId}`,
      async () => {
        const result = await this.lifecycleManager.runLifecycle(userId, agentId);
        logger.debug(LogCategory.STORAGE, 'LifecycleScheduler', 'Scheduled promotion completed', {
          userId,
          agentId,
          promoted: result.promotion.promotedCount
        });
      }
    );
  }

  /**
   * Run cleanup operation for an agent.
   * 
   * @private
   */
  private async runCleanup(userId: string, agentId: string): Promise<void> {
    await this.executeWithConcurrencyControl(
      `cleanup:${userId}:${agentId}`,
      async () => {
        const result = await this.lifecycleManager.runLifecycle(userId, agentId);
        logger.debug(LogCategory.STORAGE, 'LifecycleScheduler', 'Scheduled cleanup completed', {
          userId,
          agentId,
          cleaned: result.cleanup.deletedCount
        });
      }
    );
  }

  /**
   * Run complete lifecycle operation for an agent.
   * 
   * @private
   */
  private async runLifecycle(userId: string, agentId: string, reason: string = 'scheduled'): Promise<void> {
    await this.executeWithConcurrencyControl(
      `lifecycle:${userId}:${agentId}`,
      async () => {
        const result = await this.lifecycleManager.runLifecycle(userId, agentId);
        logger.info(LogCategory.STORAGE, 'LifecycleScheduler', 'Complete lifecycle operation completed', {
          userId,
          agentId,
          reason,
          decayUpdated: result.decay.updated,
          promoted: result.promotion.promotedCount,
          cleaned: result.cleanup.deletedCount,
          durationMs: result.durationMs
        });
      }
    );
  }

  /**
   * Execute operation with concurrency control and error handling.
   * 
   * @private
   */
  private async executeWithConcurrencyControl(
    operationKey: string,
    operation: () => Promise<void>
  ): Promise<void> {
    // Check if operation is already running
    if (this.runningOperations.has(operationKey)) {
      logger.debug(LogCategory.STORAGE, 'LifecycleScheduler', 'Operation already running, skipping', {
        operationKey
      });
      return;
    }

    // Check concurrent operation limit
    if (this.runningOperations.size >= (this.config.maxConcurrentOperations || 3)) {
      logger.warn(LogCategory.STORAGE, 'LifecycleScheduler', 'Max concurrent operations reached, skipping', {
        operationKey,
        currentCount: this.runningOperations.size,
        maxConcurrent: this.config.maxConcurrentOperations
      });
      return;
    }

    // Execute operation with retry logic
    this.runningOperations.add(operationKey);
    
    try {
      await this.executeWithRetry(operation, operationKey);
    } finally {
      this.runningOperations.delete(operationKey);
    }
  }

  /**
   * Execute operation with retry logic.
   * 
   * @private
   */
  private async executeWithRetry(
    operation: () => Promise<void>,
    operationKey: string
  ): Promise<void> {
    const retryConfig = this.config.retryConfig!;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        await operation();
        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < retryConfig.maxRetries) {
          const delay = retryConfig.exponential 
            ? retryConfig.backoffMs * Math.pow(2, attempt)
            : retryConfig.backoffMs;

          logger.warn(LogCategory.STORAGE, 'LifecycleScheduler', 'Operation failed, retrying', {
            operationKey,
            attempt: attempt + 1,
            maxRetries: retryConfig.maxRetries,
            retryInMs: delay,
            error: lastError.message
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    logger.error(LogCategory.STORAGE, 'LifecycleScheduler', 'Operation failed after all retries', {
      operationKey,
      attempts: retryConfig.maxRetries + 1,
      error: lastError?.message || 'Unknown error'
    });
  }
} 
 
 
 