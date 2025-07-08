/**
 * @fileoverview Procedural Memory Types - Tool pattern learning interfaces
 *
 * Provides type definitions for the procedural memory system that learns
 * from successful tool usage patterns and suggests optimal tool sequences.
 *
 * @author AgentDock Core Team
 */

/**
 * Represents a single tool call in a sequence.
 */
export interface ToolCall {
  /** Name of the tool that was called */
  tool: string;

  /** Parameters passed to the tool */
  params: Record<string, unknown>;

  /** How long the tool took to execute (in milliseconds) */
  duration: number;

  /** Result of the tool call */
  result?: 'success' | 'failure' | 'partial';

  /** Any error message if the call failed */
  error?: string;

  /** Timestamp when the tool was called */
  timestamp?: number;
}

/**
 * Represents a learned tool usage pattern.
 */
export interface ToolPattern {
  /** Human-readable name for this pattern */
  name: string;

  /** Sequence of tool calls that make up this pattern */
  sequence: ToolCall[];

  /** Context description when this pattern is useful */
  context: string;

  /** Average execution time for the entire pattern */
  avgExecutionTime: number;

  /** Pattern confidence score (0.0 to 1.0) */
  confidence?: number;

  /** Keywords that help identify when to use this pattern */
  keywords?: string[];

  /** Pattern category or domain */
  category?: string;
}

/**
 * Extended memory interface for procedural memories.
 */
export interface ProceduralMemory {
  /** Unique identifier */
  id: string;

  /** Agent this memory belongs to */
  agentId: string;

  /** Memory type (always 'procedural') */
  type: 'procedural';

  /** Description of what this pattern does */
  content: string;

  /** The learned tool pattern */
  pattern: ToolPattern;

  /** Success rate (0.0 to 1.0) based on historical usage */
  successRate: number;

  /** Number of times this pattern has been used */
  useCount: number;

  /** Importance score (0.0 to 1.0) */
  importance: number;

  /** How well this memory resonates with current context */
  resonance: number;

  /** Number of times this memory has been accessed */
  accessCount: number;

  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;

  /** Last time this pattern was accessed */
  lastAccessedAt: number;

  /** Keywords for search and categorization */
  keywords: string[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for procedural memory behavior.
 */
export interface ProceduralConfig {
  /** Minimum success rate before suggesting a pattern */
  minSuccessRate: number;

  /** Minimum number of successful executions before learning */
  minExecutionsToLearn: number;

  /** Maximum number of patterns to store per category */
  maxPatternsPerCategory: number;

  /** Whether to learn from failed executions */
  learnFromFailures: boolean;

  /** Context similarity threshold for pattern matching */
  contextSimilarityThreshold: number;

  /** Whether to automatically merge similar patterns */
  autoMergePatterns: boolean;

  /** Pattern decay rate (patterns lose relevance over time) */
  decayRate?: number;
}

/**
 * Result of pattern learning operation.
 */
export interface LearningResult {
  /** Whether a new pattern was learned */
  patternLearned: boolean;

  /** ID of the learned or updated pattern */
  patternId?: string;

  /** Whether an existing pattern was updated */
  patternUpdated: boolean;

  /** New success rate if pattern was updated */
  newSuccessRate?: number;

  /** Reason for the learning result */
  reason: string;
}

/**
 * Context for tool pattern suggestions.
 */
export interface SuggestionContext {
  /** Current task description */
  task: string;

  /** Available tools */
  availableTools?: string[];

  /** Current context or conversation state */
  context?: string;

  /** User preferences */
  preferences?: Record<string, unknown>;

  /** Time constraints */
  timeConstraints?: {
    maxDuration?: number;
    urgency?: 'low' | 'medium' | 'high';
  };
}

/**
 * Tool sequence suggestion.
 */
export interface ToolSuggestion {
  /** Suggested tool sequence */
  toolSequence: ToolCall[];

  /** Confidence in this suggestion (0.0 to 1.0) */
  confidence: number;

  /** Expected execution time */
  estimatedDuration: number;

  /** Success rate based on historical data */
  expectedSuccessRate: number;

  /** Reasoning for this suggestion */
  reasoning: string;

  /** Alternative suggestions */
  alternatives?: ToolSuggestion[];
}

/**
 * Statistics about procedural memory usage.
 */
export interface ProceduralStats {
  /** Total number of patterns learned */
  totalPatterns: number;

  /** Patterns by category */
  patternsByCategory: Record<string, number>;

  /** Average success rate across all patterns */
  avgSuccessRate: number;

  /** Most frequently used patterns */
  topPatterns: Array<{
    patternId: string;
    name: string;
    useCount: number;
    successRate: number;
  }>;

  /** Learning effectiveness metrics */
  learningMetrics: {
    patternsLearnedThisWeek: number;
    avgTimeToLearn: number; // Days
    improvementRate: number; // How much success rates improve over time
  };
}
