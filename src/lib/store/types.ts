/**
 * @fileoverview Core state management types for the AgentDock application.
 * This module defines the type system for our React Context-based store.
 * 
 * @module lib/store/types
 */

import type { BaseNode, NodeMetadata } from 'agentdock-core';
import type { ValidatedPersonality } from 'agentdock-core/types/agent-config';
export type { BaseNode };

export interface ChatNodeConfig {
  personality?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface ChatNodeMetadata {
  created: number;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
}

export interface ChatNode extends BaseNode<ChatNodeConfig> {
  type: 'CHAT';
  metadata: NodeMetadata;
  chatMetadata: ChatNodeMetadata;
}

// Base chat settings interface
interface BaseChatSettings {
  initialMessages: string[];
}

// Template-specific chat settings
export interface TemplateChatSettings extends BaseChatSettings {
  historyPolicy: 'lastN' | 'all';
  historyLength?: number; // Optional in template
  chatPrompts?: string[]; // Chat prompt suggestions
}

// Runtime chat settings
export interface ChatSettings extends BaseChatSettings {
  historyPolicy: 'none' | 'lastN' | 'all';
  historyLength: number; // Required at runtime
  chatPrompts?: string[]; // Chat prompt suggestions
}

export interface AgentTemplate {
  version?: string;
  agentId: string;
  name: string;
  description: string;
  personality: ValidatedPersonality;
  nodes: string[];
  nodeConfigurations: {
    'llm.anthropic'?: {
      model: string;
      temperature: number;
      maxTokens: number;
      useCustomApiKey?: boolean;
    };
    [key: string]: unknown;
  };
  tools?: string[];
  chatSettings: TemplateChatSettings;
  instructions?: string;
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
  INITIALIZING = 'INITIALIZING',
  READY = 'READY',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR'
}

export interface AppState {
  agents: Agent[];
  isInitialized: boolean;
  templatesValidated: boolean;
  templatesError: string | null;
}

export interface AppActions {
  addAgent: (agent: Omit<Agent, "id" | "state" | "metadata" | "start" | "pause" | "resume" | "stop">) => void;
  removeAgent: (id: string) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  setActiveAgent: (id: string | null) => void;
  initialize: () => void;
  reset: () => void;
}

export interface Store extends AppState {
  initialize: () => Promise<void>;
  updateAgentRuntime: (agentId: string, settings: Partial<AgentRuntimeSettings>) => Promise<void>;
  reset: () => void;
} 