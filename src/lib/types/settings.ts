/**
 * @fileoverview Centralized settings types for AgentDock
 */

import type { ValidatedPersonality } from 'agentdock-core/types/agent-config';

export interface AgentSettings {
  // Core settings
  name?: string;
  description?: string;
  model?: string;
  tools?: string[];
  apiKey: string;
  temperature: string;
  maxTokens: string;
  
  // Optional settings
  systemPrompt?: string;
  instructions?: string;
  useCustomApiKey?: boolean;
}

export interface GlobalSettings {
  apiKeys: {
    openai: string;
    anthropic: string;
    serpapi: string;
  };
  core: {
    byokOnly: boolean;
    debugMode?: boolean;
  };
}

export interface RuntimeConfig {
  name?: string;
  description?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  personality?: ValidatedPersonality;
  chatSettings?: {
    initialMessages?: string[];
    chatPrompts?: string[];
  };
} 