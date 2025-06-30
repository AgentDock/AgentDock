/**
 * @fileoverview BatchPerformanceMonitor - Advanced Memory Performance Tracking
 * 
 * Tracks comprehensive performance metrics for the advanced memory batch processing system.
 * Provides insights into extraction efficiency, cost optimization, and system performance.
 * 
 * @author AgentDock Core Team
 */

import { StorageProvider } from '../../../storage/types';
import { LogCategory, logger } from '../../../logging';

/**
 * Performance metrics for batch processing operations.
 * Tracks efficiency, costs, and system resource utilization.
 * 
 * @interface BatchPerformanceMetrics
 */
export interface BatchPerformanceMetrics {
  /** Agent identifier */
  agentId: string;
  
  /** Number of messages in the batch */
  batchSize: number;
  
  /** Number of memories successfully extracted */
  memoriesCreated: number;
  
  /** Processing time in milliseconds */
  processingTimeMs: number;
  
  /** Extraction method used */
  extractionMethod: string;
  
  /** Total cost in USD */
  costUsd: number;
  
  /** Extraction efficiency (memories per message) */
  efficiency: number;
  
  /** Timestamp of processing */
  timestamp: Date;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Advanced Memory Performance Monitor
 * 
 * Tracks and analyzes batch processing performance to optimize
 * extraction strategies and identify bottlenecks.
 * 
 * @class BatchPerformanceMonitor
 * @example
 * ```typescript
 * const monitor = new BatchPerformanceMonitor(storage);
 * 
 * await monitor.trackBatchProcessing('agent1', {
 *   inputMessages: 50,
 *   outputMemories: 12,
 *   processingTimeMs: 850,
 *   extractionMethod: 'rules+small_llm',
 *   cost: 0.025
 * });
 * 
 * const stats = await monitor.getPerformanceStats('agent1', '24h');
 * ```
 */
export class BatchPerformanceMonitor {
  private readonly storage: StorageProvider;

  /**
   * Creates a new BatchPerformanceMonitor instance.
   * 
   * @param storage - Storage provider for persisting metrics
   */
  constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  /**
   * Track batch processing performance metrics.
   * Records comprehensive performance data for analysis and optimization.
   * 
   * @param agentId - Agent identifier
   * @param batchResult - Batch processing results to track
   */
  async trackBatchProcessing(agentId: string, batchResult: {
    inputMessages: number;
    outputMemories: number;
    processingTimeMs: number;
    extractionMethod: string;
    cost: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const metrics: BatchPerformanceMetrics = {
        agentId,
        batchSize: batchResult.inputMessages,
        memoriesCreated: batchResult.outputMemories,
        processingTimeMs: batchResult.processingTimeMs,
        extractionMethod: batchResult.extractionMethod,
        costUsd: batchResult.cost,
        efficiency: batchResult.inputMessages > 0 
          ? batchResult.outputMemories / batchResult.inputMessages 
          : 0,
        timestamp: new Date(),
        metadata: batchResult.metadata
      };

      // Store metrics with timestamp-based key
      const metricsKey = `batch_metrics:${agentId}:${Date.now()}`;
      await this.storage.set(metricsKey, metrics);

      // TODO: Replace with AgentDock observability integration
      // Refer to AgentDock observability documentation when available
      logger.info(LogCategory.STORAGE, 'BatchPerformanceMonitor', 'Performance metrics tracked', {
        agentId,
        efficiency: metrics.efficiency,
        cost: metrics.costUsd,
        processingTime: metrics.processingTimeMs
      });

    } catch (error) {
      logger.error(LogCategory.STORAGE, 'BatchPerformanceMonitor', 'Failed to track performance', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get performance statistics for an agent over a time period.
   * Aggregates metrics to provide insights into extraction performance.
   * 
   * @param agentId - Agent identifier
   * @param period - Time period ('1h', '24h', '7d', '30d')
   * @returns Promise resolving to performance statistics
   */
  async getPerformanceStats(agentId: string, period: string): Promise<{
    totalBatches: number;
    totalMessages: number;
    totalMemories: number;
    totalCost: number;
    averageEfficiency: number;
    averageProcessingTime: number;
    extractionMethodBreakdown: Record<string, number>;
  }> {
    try {
      // Calculate time range
      const now = Date.now();
      const periodMs = this.parsePeriod(period);
      const startTime = now - periodMs;

      // TODO: Replace with AgentDock observability integration
      // Refer to AgentDock observability documentation when available
      // For now, return placeholder data structure
      return {
        totalBatches: 0,
        totalMessages: 0,
        totalMemories: 0,
        totalCost: 0,
        averageEfficiency: 0,
        averageProcessingTime: 0,
        extractionMethodBreakdown: {}
      };

    } catch (error) {
      logger.error(LogCategory.STORAGE, 'BatchPerformanceMonitor', 'Failed to get performance stats', {
        agentId,
        period,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Get real-time performance dashboard data.
   * Provides current system performance metrics for monitoring.
   * 
   * @param agentId - Agent identifier (optional, for all agents if not provided)
   * @returns Promise resolving to dashboard data
   */
  async getDashboardData(agentId?: string): Promise<{
    activeAgents: number;
    batchesPerHour: number;
    averageCostPerBatch: number;
    systemEfficiency: number;
    errorRate: number;
  }> {
    try {
      // TODO: Replace with AgentDock observability integration
      // Refer to AgentDock observability documentation when available
      // For now, return placeholder data structure for dashboard
      return {
        activeAgents: 0,
        batchesPerHour: 0,
        averageCostPerBatch: 0,
        systemEfficiency: 0,
        errorRate: 0
      };

    } catch (error) {
      logger.error(LogCategory.STORAGE, 'BatchPerformanceMonitor', 'Failed to get dashboard data', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Alert on performance anomalies.
   * Checks metrics against thresholds and triggers alerts.
   * 
   * @param metrics - Performance metrics to check
   * @param thresholds - Alert thresholds
   * @returns Array of triggered alerts
   */
  async checkPerformanceAlerts(
    metrics: BatchPerformanceMetrics,
    thresholds: {
      maxProcessingTime?: number;
      minEfficiency?: number;
      maxCost?: number;
    }
  ): Promise<string[]> {
    const alerts: string[] = [];

    try {
      // Check processing time threshold
      if (thresholds.maxProcessingTime && metrics.processingTimeMs > thresholds.maxProcessingTime) {
        alerts.push(`High processing time: ${metrics.processingTimeMs}ms (threshold: ${thresholds.maxProcessingTime}ms)`);
      }

      // Check efficiency threshold
      if (thresholds.minEfficiency && metrics.efficiency < thresholds.minEfficiency) {
        alerts.push(`Low efficiency: ${metrics.efficiency.toFixed(3)} (threshold: ${thresholds.minEfficiency})`);
      }

      // Check cost threshold
      if (thresholds.maxCost && metrics.costUsd > thresholds.maxCost) {
        alerts.push(`High cost: $${metrics.costUsd.toFixed(4)} (threshold: $${thresholds.maxCost})`);
      }

      if (alerts.length > 0) {
        logger.warn(LogCategory.STORAGE, 'BatchPerformanceMonitor', 'Performance alerts triggered', {
          agentId: metrics.agentId,
          alerts
        });
      }

    } catch (error) {
      logger.error(LogCategory.STORAGE, 'BatchPerformanceMonitor', 'Failed to check performance alerts', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return alerts;
  }

  /**
   * Parse period string into milliseconds.
   * Supports common time periods for performance analysis.
   * 
   * @param period - Period string ('1h', '24h', '7d', '30d')
   * @returns Time period in milliseconds
   * @private
   */
  private parsePeriod(period: string): number {
    const periodMap: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    return periodMap[period] || periodMap['24h']; // Default to 24h
  }
} 