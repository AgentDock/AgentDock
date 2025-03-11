/**
 * @fileoverview Centralized settings types for AgentDock
 */

import type { ValidatedPersonality } from 'agentdock-core/types/agent-config';
import type { ChatRuntimeConfig } from '@/lib/types/chat';

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

// Use ChatRuntimeConfig from shared types
export type RuntimeConfig = ChatRuntimeConfig; 