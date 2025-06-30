/**
 * @fileoverview Business Agent Configuration - Metric decay optimization
 *
 * Example configuration for business agents that need to decay stale metrics
 * and business data while preserving strategic information and client relationships.
 *
 * Copy-paste template for business and analytics applications.
 *
 * @author AgentDock Core Team
 */

import { LifecycleConfig } from '../types';

/**
 * Business agent lifecycle configuration.
 *
 * Key features:
 * - Daily metrics decay quickly to stay current
 * - Strategic decisions and client info preserved
 * - Performance data ages based on relevance
 * - Automated cleanup of outdated reports
 */
export const businessAgentConfig: LifecycleConfig = {
  decayConfig: {
    agentId: 'business_agent',
    rules: [
      // Rule 1: Daily metrics decay quickly (keep data fresh)
      {
        id: 'daily_metrics_decay',
        name: 'Daily Metrics Rapid Decay',
        condition:
          "keywords.includes('daily') || keywords.includes('hourly') || keywords.includes('real-time')",
        decayRate: 0.3, // 30% decay per day - keeps data current
        minImportance: 0.1,
        neverDecay: false,
        enabled: true,
        description:
          'Daily metrics lose relevance quickly, decay fast to maintain current view'
      },

      // Rule 2: Strategic decisions preserve longer
      {
        id: 'strategic_preservation',
        name: 'Strategic Decision Preservation',
        condition:
          "keywords.includes('strategy') || keywords.includes('decision') || keywords.includes('roadmap')",
        decayRate: 0.01, // 1% per day - very slow decay
        minImportance: 0.8,
        neverDecay: false,
        enabled: true,
        description: 'Strategic information has long-term value'
      },

      // Rule 3: Client and customer information preserved
      {
        id: 'client_info_preservation',
        name: 'Client Information Preservation',
        condition:
          "keywords.includes('client') || keywords.includes('customer') || keywords.includes('relationship')",
        decayRate: 0.02, // 2% per day
        minImportance: 0.7,
        neverDecay: false,
        enabled: true,
        description: 'Client relationships are valuable long-term assets'
      },

      // Rule 4: Financial data decays based on time sensitivity
      {
        id: 'financial_time_sensitive',
        name: 'Financial Data Time Sensitivity',
        condition:
          "keywords.includes('revenue') || keywords.includes('cost') || keywords.includes('budget')",
        decayRate: 0.15, // 15% per day - moderately fast
        minImportance: 0.4,
        neverDecay: false,
        enabled: true,
        description:
          'Financial metrics need regular updates, decay moderately fast'
      },

      // Rule 5: Competitive intelligence preserved longer
      {
        id: 'competitive_intelligence',
        name: 'Competitive Intelligence',
        condition:
          "keywords.includes('competitor') || keywords.includes('market') || keywords.includes('analysis')",
        decayRate: 0.05, // 5% per day
        minImportance: 0.6,
        neverDecay: false,
        enabled: true,
        description: 'Market and competitive insights have medium-term value'
      },

      // Rule 6: Temporary reports and drafts decay quickly
      {
        id: 'temporary_reports_decay',
        name: 'Temporary Reports Decay',
        condition:
          "keywords.includes('draft') || keywords.includes('temp') || keywords.includes('scratch')",
        decayRate: 0.5, // 50% per day - very fast decay
        minImportance: 0.1,
        neverDecay: false,
        enabled: true,
        description: 'Temporary and draft content should be cleaned up quickly'
      }
    ],
    defaultDecayRate: 0.1, // 10% per day for general business content
    decayInterval: 6 * 60 * 60 * 1000, // Run every 6 hours (business needs fresh data)
    deleteThreshold: 0.1, // Delete memories below 10% resonance
    verbose: false // Less verbose logging for business operations
  },

  promotionConfig: {
    episodicToSemanticDays: 7, // Promote after 1 week for faster pattern recognition
    minImportanceForPromotion: 0.5, // Lower threshold for business insights
    minAccessCountForPromotion: 3,
    preserveOriginal: false, // Don't preserve episodic versions to save space
    customPromotionRules: [
      {
        id: 'kpi_trend_promotion',
        name: 'KPI Trend Promotion',
        condition:
          "keywords.includes('kpi') || keywords.includes('metric') && accessCount > 5",
        fromType: 'episodic',
        toType: 'semantic',
        enabled: true
      },
      {
        id: 'successful_strategy_promotion',
        name: 'Successful Strategy Promotion',
        condition: "keywords.includes('success') && importance > 0.7",
        fromType: 'episodic',
        toType: 'semantic',
        enabled: true
      }
    ]
  },

  cleanupConfig: {
    deleteThreshold: 0.1, // Business needs aggressive cleanup for fresh data
    archiveEnabled: true, // Archive for compliance and historical analysis
    maxMemoriesPerAgent: 25000, // Moderate limit to maintain performance
    archiveKeyPattern: 'archive:business:{agentId}:{memoryId}',
    archiveTTL: 2 * 365 * 24 * 60 * 60, // 2 years for business records
    compressArchive: true // Compress to save storage costs
  }
};

/**
 * Procedural memory configuration for business agents.
 * Learns successful business processes and decision patterns.
 */
export const businessProceduralConfig = {
  minSuccessRate: 0.6, // Moderate threshold for business processes
  minExecutionsToLearn: 2, // Learn quickly from successful patterns
  maxPatternsPerCategory: 500, // High limit for diverse business processes
  learnFromFailures: true, // Important to learn from business failures
  contextSimilarityThreshold: 0.7, // Moderate similarity for business contexts
  autoMergePatterns: true, // Automatically optimize business processes
  decayRate: 0.05 // Business processes evolve, moderate decay
};

/**
 * Scheduling configuration for business agents.
 * Aggressive scheduling for real-time business needs.
 */
export const businessScheduleConfig = {
  decayInterval: 6 * 60 * 60 * 1000, // Every 6 hours for fresh business data
  promotionInterval: 24 * 60 * 60 * 1000, // Daily promotion checks
  cleanupInterval: 12 * 60 * 60 * 1000, // Twice daily cleanup
  enabled: true,
  maxConcurrentOperations: 3, // Higher concurrency for business operations
  runOnStartup: true, // Clean up stale data on startup
  retryConfig: {
    maxRetries: 3,
    backoffMs: 10000, // 10 second backoff
    exponential: true
  }
};

/**
 * Example usage for different business scenarios.
 */
export const businessScenarioConfigs = {
  // High-frequency trading or real-time analytics
  realTimeAnalytics: {
    ...businessAgentConfig,
    decayConfig: {
      ...businessAgentConfig.decayConfig,
      decayInterval: 60 * 60 * 1000, // Every hour
      defaultDecayRate: 0.4 // Very fast default decay
    }
  },

  // Long-term strategic planning
  strategicPlanning: {
    ...businessAgentConfig,
    decayConfig: {
      ...businessAgentConfig.decayConfig,
      decayInterval: 24 * 60 * 60 * 1000, // Daily
      defaultDecayRate: 0.02 // Very slow default decay
    }
  },

  // Customer service and support
  customerService: {
    ...businessAgentConfig,
    decayConfig: {
      ...businessAgentConfig.decayConfig,
      rules: [
        {
          id: 'customer_issue_tracking',
          name: 'Customer Issue Tracking',
          condition:
            "keywords.includes('issue') || keywords.includes('complaint') || keywords.includes('ticket')",
          decayRate: 0.05,
          minImportance: 0.6,
          neverDecay: false,
          enabled: true,
          description: 'Customer issues need medium-term tracking'
        },
        ...businessAgentConfig.decayConfig.rules
      ]
    }
  }
};
