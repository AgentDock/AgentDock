/**
 * @fileoverview Core state management types for the AgentDock application.
 * This module defines the type system for our React Context-based store.
 * 
 * @module lib/store/types
 */

export interface NodeMetadata {
  category?: string;
  label?: string;
  description?: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  [key: string]: any;
}

export interface BaseNode {
  id: string;
  type: string;
  metadata: Record<string, any>;
}

export interface ChatNode extends BaseNode {
  type: 'CHAT';
  metadata: {
    created: number;
    messages: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: number;
    }>;
    [key: string]: any;
  };
}

export interface AgentTemplate {
  agentId: string;
  name: string;
  description: string;
  personality: string;
  modules: string[];
  nodeConfigurations: {
    [key: string]: any;
  };
  chatSettings: {
    initialMessages?: string[];
    historyPolicy?: 'none' | 'lastN' | 'all';
    historyLength?: number;
  };
  instructions?: string;
}

export interface AgentRuntimeSettings {
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface Agent extends AgentTemplate {
  id: string;
  state: AgentState;
  nodes: BaseNode[];
  runtimeSettings: AgentRuntimeSettings;
  metadata: {
    created: number;
    lastStateChange: number;
    error?: {
      message: string;
      code?: string;
    };
    chatWindow?: {
      url: string;
    };
  };
  start?: () => Promise<void>;
  pause?: () => Promise<void>;
  resume?: () => Promise<void>;
  stop?: () => Promise<void>;
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
  activeAgentId: string | null;
  isInitialized: boolean;
}

export interface AppActions {
  addAgent: (agent: Omit<Agent, "id" | "state" | "metadata" | "start" | "pause" | "resume" | "stop">) => void;
  removeAgent: (id: string) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  setActiveAgent: (id: string | null) => void;
  initialize: () => void;
  reset: () => void;
}

export interface Store extends AppState, AppActions {
  initialize: () => Promise<void>;
  updateAgentRuntime: (agentId: string, settings: Partial<AgentRuntimeSettings>) => Promise<void>;
} 