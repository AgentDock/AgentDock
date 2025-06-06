/**
 * @fileoverview Core agent configuration types for the AgentDock framework.
 * This file defines the configuration interface for agents while maintaining
 * backward compatibility with existing implementations.
 */

import { z } from 'zod';

import { OrchestrationConfig, OrchestrationSchema } from './orchestration';

/**
 * Personality schema with validation and transformation
 * Uses branded types for type safety
 */
export const PersonalitySchema = z
  .union([z.string(), z.array(z.string()).transform((arr) => arr.join('\n'))])
  .brand<'validated-personality'>();

/**
 * Infer the type for use in interfaces
 */
export type ValidatedPersonality = z.infer<typeof PersonalitySchema>;

/**
 * Helper function to ensure a value is a string
 * If it's an array, joins it with newlines
 */
function ensureString(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join('\n');
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value || '');
}

/**
 * Core agent configuration interface
 */
export interface AgentConfig {
  /** Version of the agent configuration format */
  version: string;

  /** Unique identifier for the agent */
  agentId: string;

  /** Display name of the agent */
  name: string;

  /** Optional description */
  description: string;

  /** Agent personality/system prompt - validated string */
  personality: ValidatedPersonality;

  /** Enabled nodes/capabilities */
  nodes: string[];

  /** Node-specific configurations */
  nodeConfigurations: {
    [nodeType: string]: any;
  };

  /** Chat-specific settings */
  chatSettings: {
    /** Initial messages to send when chat starts */
    initialMessages?: string[];
    /** Message history retention policy */
    historyPolicy?: 'none' | 'lastN' | 'all';
    /** Number of messages to retain if historyPolicy is 'lastN' */
    historyLength?: number;
    /** Chat prompt suggestions to display when chat is empty */
    chatPrompts?: string[];
  };

  /** Agent orchestration configuration for structured tool usage */
  orchestration?: OrchestrationConfig;

  /** Maximum concurrent node executions */
  maxConcurrency?: number;

  /** Custom configuration options */
  options?: Record<string, unknown>;
}

/**
 * Zod schema for validating agent configurations
 */
export const AgentConfigSchema = z.object({
  version: z.string(),
  agentId: z.string(),
  name: z.string(),
  description: z.string(),
  personality: PersonalitySchema,
  nodes: z.array(z.string()),
  nodeConfigurations: z.record(z.any()),
  chatSettings: z.object({
    initialMessages: z.array(z.string()).optional(),
    historyPolicy: z.enum(['none', 'lastN', 'all']).optional(),
    historyLength: z.number().optional(),
    chatPrompts: z.array(z.string()).optional()
  }),
  orchestration: OrchestrationSchema.optional(),
  maxConcurrency: z.number().optional(),
  options: z.record(z.unknown()).optional()
});

/**
 * Type guard to check if an object is a valid AgentConfig
 */
export function isAgentConfig(obj: unknown): obj is AgentConfig {
  return AgentConfigSchema.safeParse(obj).success;
}

/**
 * Helper to create a new agent configuration
 */
export function createAgentConfig(config: Partial<AgentConfig>): AgentConfig {
  const defaultConfig: Partial<AgentConfig> = {
    version: '1.0',
    agentId: '',
    name: '',
    description: '',
    personality: PersonalitySchema.parse(''),
    nodes: [],
    nodeConfigurations: {},
    chatSettings: {}
  };

  // Create a merged config with defaults
  const mergedConfig = { ...defaultConfig, ...config };

  // Ensure personality is validated
  if (config.personality !== undefined) {
    mergedConfig.personality = PersonalitySchema.parse(config.personality);
  }

  // Validate the entire config
  return AgentConfigSchema.parse(mergedConfig);
}
