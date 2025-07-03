/**
 * @fileoverview Therapy Agent Configuration - Trauma memory preservation
 *
 * Example configuration for therapy agents that need to preserve critical
 * trauma-related memories indefinitely while allowing routine memories to decay.
 *
 * Copy-paste template for therapy and mental health applications.
 *
 * @author AgentDock Core Team
 */

import { LifecycleConfig } from '../../memory/lifecycle/types';

/**
 * Therapy agent lifecycle configuration.
 *
 * Key features:
 * - Critical trauma memories never decay
 * - Suicide risk indicators preserved indefinitely
 * - Routine session notes decay normally
 * - Privacy-focused archival settings
 */
export const therapyAgentConfig: LifecycleConfig = {
  decayConfig: {
    agentId: 'therapy_agent',
    rules: [
      // Rule 1: Critical trauma memories never decay
      {
        id: 'trauma_preservation',
        name: 'Trauma Memory Preservation',
        condition:
          "keywords.includes('trauma') || keywords.includes('abuse') || keywords.includes('ptsd')",
        decayRate: 0.0,
        minImportance: 0.9,
        neverDecay: true,
        enabled: true,
        description:
          'Preserve trauma-related memories indefinitely for continuity of care'
      },

      // Rule 2: Suicide risk indicators never decay
      {
        id: 'suicide_risk_preservation',
        name: 'Suicide Risk Preservation',
        condition:
          "keywords.includes('suicide') || keywords.includes('self-harm') || keywords.includes('ideation')",
        decayRate: 0.0,
        minImportance: 1.0,
        neverDecay: true,
        enabled: true,
        description: 'Critical safety information must never be lost'
      },

      // Rule 3: Medication and diagnosis information preserved
      {
        id: 'medical_info_preservation',
        name: 'Medical Information Preservation',
        condition:
          "keywords.includes('medication') || keywords.includes('diagnosis') || keywords.includes('prescription')",
        decayRate: 0.01, // Very slow decay (1% per day)
        minImportance: 0.8,
        neverDecay: false,
        enabled: true,
        description: 'Medical information decays very slowly'
      },

      // Rule 4: Session goals and treatment plans persist
      {
        id: 'treatment_plan_persistence',
        name: 'Treatment Plan Persistence',
        condition:
          "keywords.includes('goal') || keywords.includes('plan') || keywords.includes('objective')",
        decayRate: 0.02, // Slow decay (2% per day)
        minImportance: 0.6,
        neverDecay: false,
        enabled: true,
        description:
          'Treatment plans and goals decay slowly to maintain therapeutic continuity'
      },

      // Rule 5: High importance memories decay slowly
      {
        id: 'high_importance_slow_decay',
        name: 'High Importance Slow Decay',
        condition: 'importance > 0.7',
        decayRate: 0.03, // 3% per day
        minImportance: 0.5,
        neverDecay: false,
        enabled: true,
        description: 'Important memories decay more slowly than routine ones'
      }
    ],
    defaultDecayRate: 0.1, // 10% per day for routine memories
    decayInterval: 24 * 60 * 60 * 1000, // Run daily
    deleteThreshold: 0.05, // Only delete memories below 5% resonance
    verbose: true // Log decay operations for compliance
  },

  promotionConfig: {
    episodicToSemanticDays: 14, // Promote after 2 weeks for pattern recognition
    minImportanceForPromotion: 0.6,
    minAccessCountForPromotion: 2,
    preserveOriginal: true, // Keep both episodic and semantic versions
    customPromotionRules: [
      {
        id: 'trauma_pattern_promotion',
        name: 'Trauma Pattern Promotion',
        condition: "keywords.includes('pattern') && importance > 0.7",
        fromType: 'episodic',
        toType: 'semantic',
        enabled: true
      }
    ]
  },

  cleanupConfig: {
    deleteThreshold: 0.05, // Very conservative deletion threshold
    archiveEnabled: true, // Archive for compliance and backup
    maxMemoriesPerAgent: 50000, // High limit for comprehensive care history
    archiveKeyPattern: 'archive:therapy:{agentId}:{memoryId}',
    archiveTTL: 7 * 365 * 24 * 60 * 60, // 7 years for legal compliance
    compressArchive: true // Compress archived memories to save space
  }
};

/**
 * Procedural memory configuration for therapy agents.
 * Learns therapeutic intervention patterns and successful techniques.
 */
export const therapyProceduralConfig = {
  minSuccessRate: 0.7, // High threshold for therapeutic interventions
  minExecutionsToLearn: 3, // Learn after 3 successful interventions
  maxPatternsPerCategory: 200,
  learnFromFailures: true, // Learn what doesn't work
  contextSimilarityThreshold: 0.8, // High similarity for therapeutic contexts
  autoMergePatterns: false, // Manual review for therapeutic patterns
  decayRate: 0.01 // Therapeutic techniques decay very slowly
};

/**
 * Scheduling configuration for therapy agents.
 * Conservative scheduling to avoid disrupting sessions.
 */
export const therapyScheduleConfig = {
  decayInterval: 24 * 60 * 60 * 1000, // Daily at off-hours
  promotionInterval: 7 * 24 * 60 * 60 * 1000, // Weekly promotion checks
  cleanupInterval: 7 * 24 * 60 * 60 * 1000, // Weekly cleanup
  enabled: true,
  maxConcurrentOperations: 1, // Conservative to avoid performance impact
  runOnStartup: false, // Don't run during session startup
  retryConfig: {
    maxRetries: 5,
    backoffMs: 30000, // 30 second backoff
    exponential: true
  }
};
