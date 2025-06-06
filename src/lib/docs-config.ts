/**
 * Documentation Sidebar Configuration
 *
 * This file controls:
 * 1. What sections appear in the sidebar
 * 2. The order of those sections
 * 3. Which files are loaded automatically vs. manually specified
 *
 * How to use:
 * - title: The heading displayed in the sidebar
 * - basePath: Folder to automatically load .md files from (titles extracted from markdown heading)
 * - items: Manually specify file locations and titles
 */

export interface DocSection {
  title: string; // Section heading shown in sidebar
  basePath?: string; // Auto-load .md files from this directory
  items?: {
    // Manually specify items
    path: string; // Path to file (without .md), relative to docs folder
    title: string; // Link text shown in sidebar
  }[];
}

// This array controls the order of sections in the sidebar
export const docSections: DocSection[] = [
  // Main page
  {
    title: 'Overview',
    items: [
      { path: '/', title: 'Introduction' },
      { path: 'getting-started', title: 'Getting Started' },
      { path: 'agent-templates', title: 'Agent Templates' },
      { path: 'agentdock-pro', title: 'AgentDock Pro' },
      { path: 'roadmap/workflow-nodes', title: 'Workflows & Node Types' },
      { path: 'roadmap', title: 'Roadmap' }
    ]
  },

  // Architecture section with specific items
  {
    title: 'Architecture',
    items: [
      { path: 'architecture/', title: 'Architecture Overview' },
      { path: 'architecture/agent-node', title: 'Agent Node' },
      {
        path: 'architecture/provider-agnostic-api',
        title: 'Provider-Agnostic API'
      },
      {
        path: 'architecture/adding-new-provider',
        title: 'Adding a New LLM Provider'
      },
      { path: 'architecture/model-system', title: 'Model Architecture' },
      { path: 'architecture/core/overview', title: 'Core Architecture' },
      { path: 'architecture/core/request-flow', title: 'Request Flow' },
      { path: 'architecture/core/technology-stack', title: 'Technology Stack' },
      {
        path: 'architecture/core/response-streaming',
        title: 'Response Streaming'
      }
    ]
  },

  // Nodes section
  {
    title: 'Node System',
    items: [
      { path: 'nodes/', title: 'Node System Overview' },
      {
        path: 'nodes/custom-node-development',
        title: 'Custom Node Development'
      },
      {
        path: 'nodes/custom-tool-development',
        title: 'Custom Tool Development'
      }
    ]
  },

  // Storage section - Consolidated
  {
    title: 'Storage & Memory',
    items: [
      { path: 'storage/', title: 'Storage Overview' },
      { path: 'storage/message-persistence', title: 'Message Persistence' },
      { path: 'storage/message-history', title: 'Message History Management' },
      {
        path: 'roadmap/storage-abstraction',
        title: 'Storage Abstraction Layer'
      },
      { path: 'roadmap/advanced-memory', title: 'Advanced Memory Systems' },
      { path: 'roadmap/vector-storage', title: 'Vector Storage Integration' }
    ]
  },

  // Evaluation Framework section - NEW
  {
    title: 'Evaluation Framework',
    items: [
      { path: 'evaluations/', title: 'Framework Overview' },
      { path: 'evaluations/custom-evaluators', title: 'Custom Evaluators' },
      {
        path: 'evaluations/evaluators/llm-judge',
        title: 'LLM Judge Evaluator'
      },
      {
        path: 'evaluations/evaluators/nlp-accuracy',
        title: 'NLP Accuracy Evaluator'
      },
      {
        path: 'evaluations/evaluators/rule-based',
        title: 'Rule-Based Evaluator'
      },
      {
        path: 'evaluations/evaluators/tool-usage',
        title: 'Tool Usage Evaluator'
      },
      {
        path: 'evaluations/evaluators/lexical-evaluators',
        title: 'Lexical Evaluators Overview'
      },
      {
        path: 'evaluations/evaluators/lexical-similarity',
        title: 'Lexical Similarity'
      },
      {
        path: 'evaluations/evaluators/keyword-coverage',
        title: 'Keyword Coverage'
      },
      { path: 'evaluations/evaluators/sentiment', title: 'Sentiment Analysis' },
      { path: 'evaluations/evaluators/toxicity', title: 'Toxicity Check' }
    ]
  },

  // Error Handling section - Consolidated
  {
    title: 'Error Handling',
    items: [
      { path: 'error-handling/overview', title: 'Error Handling Overview' },
      { path: 'error-handling/llm-errors', title: 'LLM Error Handling' },
      {
        path: 'error-handling/core-implementation',
        title: 'Implementation Details'
      }
    ]
  },

  // Sessions & Orchestration combined
  {
    title: 'Sessions & Orchestration',
    items: [
      // Session Section
      {
        path: 'architecture/sessions/session-management',
        title: 'Session Management'
      },
      {
        path: 'architecture/sessions/nextjs-integration',
        title: 'Next.js Integration'
      },
      // Orchestration Section
      {
        path: 'architecture/orchestration/orchestration-overview',
        title: 'Orchestration Overview'
      },
      {
        path: 'architecture/orchestration/orchestration-config',
        title: 'Orchestration Configuration'
      },
      {
        path: 'architecture/orchestration/state-management',
        title: 'State Management'
      },
      {
        path: 'architecture/orchestration/conditional-transitions',
        title: 'Conditional Transitions'
      },
      {
        path: 'architecture/orchestration/step-sequencing',
        title: 'Step Sequencing'
      },
      {
        path: 'architecture/orchestration/llm-orchestration',
        title: 'LLM Orchestration'
      }
    ]
  },

  // Request For Agents (RFA) section
  {
    title: 'Request For Agents',
    items: [
      { path: 'rfa/', title: 'RFA Overview' },
      { path: 'rfa/add-agent', title: 'Contributing Agents' }
    ]
  },

  // Additional Features section
  {
    title: 'Additional Features',
    items: [
      { path: 'token-usage-tracking', title: 'Token Usage Tracking' },
      { path: 'analytics', title: 'Analytics' }
    ]
  },

  // Open Source Client section
  {
    title: 'Open Source Client',
    items: [
      {
        path: 'oss-client/nextjs-implementation',
        title: 'Next.js Implementation'
      },
      { path: 'oss-client/byok-mode', title: 'BYOK Mode' },
      { path: 'oss-client/image-generation', title: 'Image Generation' },
      { path: 'oss-client/diagram-example', title: 'Diagram Examples' }
    ]
  },

  // Roadmap Items section
  {
    title: 'Roadmap Features',
    items: [
      { path: 'roadmap/evaluation-framework', title: 'Evaluation Framework' },
      { path: 'roadmap/platform-integration', title: 'Platform Integration' },
      {
        path: 'roadmap/multi-agent-collaboration',
        title: 'Multi-Agent Collaboration'
      },
      { path: 'roadmap/mcp-integration', title: 'MCP Integration' },
      { path: 'roadmap/voice-agents', title: 'Voice AI Agents' },
      { path: 'roadmap/telemetry', title: 'Telemetry & Traceability' },
      {
        path: 'roadmap/workflow-nodes',
        title: 'Workflow Runtime & Node Types'
      },
      { path: 'roadmap/code-playground', title: 'Code Playground' },
      { path: 'roadmap/generalist-agent', title: 'Generalist AI Agent' },
      {
        path: 'roadmap/nl-agent-builder',
        title: 'Natural Language Agent Builder'
      },
      { path: 'roadmap/agent-marketplace', title: 'Agent Marketplace' }
    ]
  },

  // i18n Section
  {
    title: 'README Translations',
    items: [{ path: 'i18n/', title: 'Available Languages' }]
  }
];
