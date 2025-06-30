/**
 * @fileoverview Research Agent Configuration - Balanced research memory management
 * 
 * Example configuration for research agents that need to balance preserving
 * important findings while allowing preliminary research to decay naturally.
 * 
 * Copy-paste template for research and academic applications.
 * 
 * @author AgentDock Core Team
 */

import { LifecycleConfig } from '../types';

/**
 * Research agent lifecycle configuration.
 * 
 * Key features:
 * - Published findings preserved indefinitely
 * - Research hypotheses decay based on validation
 * - Literature reviews maintained longer
 * - Preliminary notes decay naturally
 */
export const researchAgentConfig: LifecycleConfig = {
  decayConfig: {
    agentId: 'research_agent',
    rules: [
      // Rule 1: Published research never decays
      {
        id: 'published_research_preservation',
        name: 'Published Research Preservation',
        condition: "keywords.includes('published') || keywords.includes('paper') || keywords.includes('journal')",
        decayRate: 0.0,
        minImportance: 0.9,
        neverDecay: true,
        enabled: true,
        description: 'Published research findings are permanent scholarly contributions'
      },
      
      // Rule 2: Peer-reviewed content preserved
      {
        id: 'peer_reviewed_preservation',
        name: 'Peer-Reviewed Content Preservation',
        condition: "keywords.includes('peer-review') || keywords.includes('reviewed') || keywords.includes('accepted')",
        decayRate: 0.005, // 0.5% per day - very slow decay
        minImportance: 0.8,
        neverDecay: false,
        enabled: true,
        description: 'Peer-reviewed content has high scholarly value'
      },
      
      // Rule 3: Validated hypotheses preserved longer
      {
        id: 'validated_hypothesis_preservation',
        name: 'Validated Hypothesis Preservation',
        condition: "keywords.includes('hypothesis') && keywords.includes('validated') || keywords.includes('confirmed')",
        decayRate: 0.01, // 1% per day
        minImportance: 0.7,
        neverDecay: false,
        enabled: true,
        description: 'Validated research hypotheses have medium-term value'
      },
      
      // Rule 4: Literature reviews maintain relevance
      {
        id: 'literature_review_maintenance',
        name: 'Literature Review Maintenance',
        condition: "keywords.includes('literature') || keywords.includes('review') || keywords.includes('survey')",
        decayRate: 0.02, // 2% per day
        minImportance: 0.6,
        neverDecay: false,
        enabled: true,
        description: 'Literature reviews provide context and should be maintained'
      },
      
      // Rule 5: Experimental data preserved based on success
      {
        id: 'experimental_data_conditional',
        name: 'Experimental Data Conditional Preservation',
        condition: "keywords.includes('experiment') || keywords.includes('data') || keywords.includes('results')",
        decayRate: 0.05, // 5% per day for unsuccessful experiments
        minImportance: 0.4,
        neverDecay: false,
        enabled: true,
        description: 'Experimental data decays unless marked as significant'
      },
      
      // Rule 6: Failed hypotheses decay faster
      {
        id: 'failed_hypothesis_decay',
        name: 'Failed Hypothesis Decay',
        condition: "keywords.includes('hypothesis') && (keywords.includes('failed') || keywords.includes('rejected'))",
        decayRate: 0.2, // 20% per day - faster decay for failed approaches
        minImportance: 0.2,
        neverDecay: false,
        enabled: true,
        description: 'Failed hypotheses should decay but be kept for learning'
      },
      
      // Rule 7: Preliminary notes decay naturally
      {
        id: 'preliminary_notes_decay',
        name: 'Preliminary Notes Decay',
        condition: "keywords.includes('preliminary') || keywords.includes('draft') || keywords.includes('notes')",
        decayRate: 0.15, // 15% per day
        minImportance: 0.3,
        neverDecay: false,
        enabled: true,
        description: 'Preliminary work should decay to make room for refined research'
      }
    ],
    defaultDecayRate: 0.08, // 8% per day for general research content
    decayInterval: 24 * 60 * 60 * 1000, // Run daily
    deleteThreshold: 0.08, // Delete memories below 8% resonance
    verbose: true // Log decay operations for research audit trail
  },
  
  promotionConfig: {
    episodicToSemanticDays: 21, // Promote after 3 weeks for thorough research cycles
    minImportanceForPromotion: 0.6,
    minAccessCountForPromotion: 3,
    preserveOriginal: true, // Keep both versions for research integrity
    customPromotionRules: [
      {
        id: 'significant_finding_promotion',
        name: 'Significant Finding Promotion',
        condition: "keywords.includes('significant') || keywords.includes('breakthrough') || keywords.includes('discovery')",
        fromType: 'episodic',
        toType: 'semantic',
        enabled: true
      },
      {
        id: 'methodology_promotion',
        name: 'Methodology Promotion',
        condition: "keywords.includes('method') || keywords.includes('approach') || keywords.includes('technique')",
        fromType: 'episodic',
        toType: 'semantic',
        enabled: true
      }
    ]
  },
  
  cleanupConfig: {
    deleteThreshold: 0.08, // Moderate threshold for research content
    archiveEnabled: true, // Archive for research integrity and reproducibility
    maxMemoriesPerAgent: 100000, // High limit for comprehensive research history
    archiveKeyPattern: 'archive:research:{agentId}:{memoryId}',
    archiveTTL: 10 * 365 * 24 * 60 * 60, // 10 years for research archival
    compressArchive: true // Compress to save storage space
  }
};

/**
 * Procedural memory configuration for research agents.
 * Learns successful research methodologies and processes.
 */
export const researchProceduralConfig = {
  minSuccessRate: 0.5, // Lower threshold - research often involves failures
  minExecutionsToLearn: 4, // Need more data points for research patterns
  maxPatternsPerCategory: 300,
  learnFromFailures: true, // Critical for research - learn from what doesn't work
  contextSimilarityThreshold: 0.75, // Moderate-high similarity for research contexts
  autoMergePatterns: false, // Manual review important for research integrity
  decayRate: 0.03 // Research methodologies evolve slowly
};

/**
 * Scheduling configuration for research agents.
 * Balanced scheduling that respects research timelines.
 */
export const researchScheduleConfig = {
  decayInterval: 24 * 60 * 60 * 1000, // Daily decay checks
  promotionInterval: 7 * 24 * 60 * 60 * 1000, // Weekly promotion reviews
  cleanupInterval: 3 * 24 * 60 * 60 * 1000, // Every 3 days cleanup
  enabled: true,
  maxConcurrentOperations: 2, // Moderate concurrency for research operations
  runOnStartup: false, // Don't interfere with research startup
  retryConfig: {
    maxRetries: 5,
    backoffMs: 60000, // 1 minute backoff for research operations
    exponential: true
  }
};

/**
 * Specialized research configurations for different domains.
 */
export const researchDomainConfigs = {
  // Medical research with strict preservation requirements
  medicalResearch: {
    ...researchAgentConfig,
    decayConfig: {
      ...researchAgentConfig.decayConfig,
      rules: [
        {
          id: 'clinical_trial_preservation',
          name: 'Clinical Trial Preservation',
          condition: "keywords.includes('clinical') || keywords.includes('trial') || keywords.includes('patient')",
          decayRate: 0.0,
          minImportance: 0.9,
          neverDecay: true,
          enabled: true,
          description: 'Clinical trial data must be preserved for regulatory compliance'
        },
        ...researchAgentConfig.decayConfig.rules
      ],
      deleteThreshold: 0.05, // Very conservative for medical research
      verbose: true
    },
    cleanupConfig: {
      ...researchAgentConfig.cleanupConfig,
      archiveTTL: 25 * 365 * 24 * 60 * 60 // 25 years for medical records
    }
  },
  
  // Fast-moving fields like AI/ML research
  aiResearch: {
    ...researchAgentConfig,
    decayConfig: {
      ...researchAgentConfig.decayConfig,
      defaultDecayRate: 0.12, // Faster decay for rapidly evolving field
      rules: [
        {
          id: 'model_architecture_preservation',
          name: 'Model Architecture Preservation',
          condition: "keywords.includes('model') || keywords.includes('architecture') || keywords.includes('algorithm')",
          decayRate: 0.03,
          minImportance: 0.7,
          neverDecay: false,
          enabled: true,
          description: 'Successful model architectures have medium-term value'
        },
        ...researchAgentConfig.decayConfig.rules
      ]
    }
  },
  
  // Historical or archaeological research
  historicalResearch: {
    ...researchAgentConfig,
    decayConfig: {
      ...researchAgentConfig.decayConfig,
      defaultDecayRate: 0.02, // Very slow decay for historical research
      rules: [
        {
          id: 'artifact_preservation',
          name: 'Artifact Information Preservation',
          condition: "keywords.includes('artifact') || keywords.includes('historical') || keywords.includes('archaeological')",
          decayRate: 0.0,
          minImportance: 0.8,
          neverDecay: true,
          enabled: true,
          description: 'Historical artifacts and findings are permanently valuable'
        },
        ...researchAgentConfig.decayConfig.rules
      ]
    }
  }
}; 
 
 
 