declare module 'agentdock-core/src/nodes/base-node' {
  import { MessageBus } from '../messaging/types';
  import { NodeCategory } from '../types/node-category';

  export interface NodeMetadata {
    readonly category: NodeCategory;
    readonly label: string;
    readonly description: string;
    readonly inputs: readonly NodePort[];
    readonly outputs: readonly NodePort[];
    readonly version: string;
    readonly compatibility: {
      core: boolean;
      pro: boolean;
      custom: boolean;
    };
  }

  export interface NodePort {
    readonly id: string;
    readonly type: string;
    readonly label: string;
    readonly schema?: unknown;
    readonly required?: boolean;
    readonly defaultValue?: unknown;
  }

  export abstract class BaseNode<TConfig = any> {
    readonly id: string;
    abstract readonly type: string;
    protected readonly config: TConfig;
    readonly metadata: NodeMetadata;

    constructor(id: string, config: TConfig);
    
    setMessageBus(messageBus: MessageBus): void;
    abstract execute(input: unknown): Promise<unknown>;
    abstract initialize(): Promise<void>;
    abstract cleanup(): Promise<void>;
  }
}

declare module 'agentdock-core/src/nodes/agent-node' {
  import { BaseNode } from './base-node';
  import { AgentConfig } from '../types/agent-config';

  export interface AgentNodeConfig {
    agentConfig: AgentConfig;
    autoStart?: boolean;
    maxRetries?: number;
    retryDelay?: number;
  }

  export enum AgentState {
    CREATED = 'created',
    INITIALIZING = 'initializing',
    READY = 'ready',
    RUNNING = 'running',
    PAUSED = 'paused',
    ERROR = 'error',
    STOPPED = 'stopped'
  }

  export class AgentNode extends BaseNode<AgentNodeConfig> {
    readonly type: string;
    constructor(id: string, config: AgentNodeConfig);
    execute(input: string): Promise<ReadableStream>;
    initialize(): Promise<void>;
    cleanup(): Promise<void>;
    getState(): AgentState;
    pause(): Promise<void>;
    resume(): Promise<void>;
    stop(): Promise<void>;
  }
}

declare module 'agentdock-core/src/config/agent-config' {
  export function loadAgentConfig(template: any, apiKey?: string): Promise<AgentConfig>;
}

declare module 'agentdock-core/src/logging' {
  export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error'
  }

  export enum LogCategory {
    AGENT = 'agent',
    NODE = 'node',
    CONFIG = 'config',
    LLM = 'llm',
    API = 'api',
    STORAGE = 'storage',
    SYSTEM = 'system'
  }

  export interface LogEntry {
    level: LogLevel;
    category: LogCategory;
    component: string;
    message: string;
    metadata?: Record<string, unknown>;
    timestamp: Date;
  }

  export class Logger {
    static getInstance(): Logger;
    debug(category: LogCategory, component: string, message: string, metadata?: Record<string, unknown>): Promise<void>;
    info(category: LogCategory, component: string, message: string, metadata?: Record<string, unknown>): Promise<void>;
    warn(category: LogCategory, component: string, message: string, metadata?: Record<string, unknown>): Promise<void>;
    error(category: LogCategory, component: string, message: string, metadata?: Record<string, unknown>): Promise<void>;
  }

  export const logger: Logger;
}

declare module 'agentdock-core/src/errors' {
  export enum ErrorCode {
    API_VALIDATION = 'API_VALIDATION',
    INTERNAL = 'INTERNAL'
  }

  export class AgentError extends Error {
    code: ErrorCode;
    details: Record<string, unknown>;
    httpStatus?: number;
    toResponse(): Response;
  }

  export class APIError extends AgentError {
    constructor(
      message: string,
      code: ErrorCode,
      path: string,
      method: string,
      details?: Record<string, unknown>,
      httpStatus?: number
    );
  }
} 