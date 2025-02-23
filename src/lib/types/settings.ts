/**
 * @fileoverview Centralized settings types for AgentDock
 */

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
  personality?: string;
  chatSettings?: {
    initialMessages?: string[];
  };
} 