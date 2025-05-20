/**
 * @fileoverview Core state management types for the AgentDock application.
 * This module defines the type system for our React Context-based store.
 *
 * @module lib/store/types
 */

import type { BaseNode } from 'agentdock-core';
import type { ValidatedPersonality } from 'agentdock-core/types/agent-config';
import type { TemplateChatSettings, ChatSettings } from '@/lib/types/chat';

export type { BaseNode };

export interface AgentTemplate {
  version?: string;
  agentId: string;
  name: string;
  description: string;
  personality: string[];
  nodes: string[];
  nodeConfigurations: {
    [providerKey: string]: {
      model: string;
      temperature: number;
      maxTokens: number;
      useCustomApiKey?: boolean;
    };
  };
  tools?: string[];
  chatSettings: {
    historyPolicy?: 'none' | 'lastN' | 'all';
    historyLength?: number;
    initialMessages?: string[];
    chatPrompts?: string[];
  };
  instructions?: string;
  tags?: string[];
  priority?: number;
  options?: Record<string, unknown>;
}

export interface AgentRuntimeSettings {
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface Agent {
  id: string;
  agentId: string;
  name: string;
  description: string;
  personality: ValidatedPersonality;
  nodes: string[];
  nodeConfigurations: {
    [nodeType: string]: any;
  };
  tools?: string[];
  chatSettings: {
    initialMessages?: string[];
    historyPolicy?: 'none' | 'lastN' | 'all';
    historyLength?: number;
  };
  state: AgentState;
  metadata: {
    created: number;
    lastStateChange: number;
  };
  runtimeSettings: AgentRuntimeSettings;
  instructions?: string;
}

export enum AgentState {
  CREATED = 'CREATED',
  ERROR = 'ERROR',
  RUNNING = 'RUNNING',
}

export interface AppState {
  agents: Agent[];
  isInitialized: boolean;
  templatesValidated: boolean;
  templatesError: string | null;
}

export interface Store extends AppState {
  initialize: () => Promise<void>;
  updateAgentRuntime: (agentId: string, settings: Partial<AgentRuntimeSettings>) => Promise<void>;
  reset: () => void;
}
