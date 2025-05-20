/**
 * @fileoverview Type declarations for the logging system
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export enum LogCategory {
  AGENT = 'agent',
  NODE = 'node',
  CONFIG = 'config',
  LLM = 'llm',
  API = 'api',
  STORAGE = 'storage',
  SYSTEM = 'system',
}

export interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  component: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export type CommonOperation =
  | 'initialize'
  | 'execute'
  | 'cleanup'
  | 'validate'
  | 'process'
  | 'request'
  | 'response'
  | 'stream'
  | 'load'
  | 'save'
  | 'delete';

export interface BaseMetadata {
  operationId?: string;
  duration?: number;
  success?: boolean;
  error?: unknown;
}

export class Logger {
  static getInstance(): Logger;

  logOperation(
    level: LogLevel,
    category: LogCategory,
    component: string,
    operation: CommonOperation,
    metadata?: BaseMetadata & Record<string, unknown>,
  ): Promise<void>;

  logAPI(
    level: LogLevel,
    method: string,
    path: string,
    metadata?: BaseMetadata & {
      status?: number;
      requestId?: string;
      duration?: number;
    },
  ): Promise<void>;

  logError(
    category: LogCategory,
    component: string,
    error: unknown,
    metadata?: BaseMetadata & Record<string, unknown>,
  ): Promise<void>;

  debug(
    category: LogCategory,
    component: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  info(
    category: LogCategory,
    component: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  warn(
    category: LogCategory,
    component: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  error(
    category: LogCategory,
    component: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
}

export const logger: Logger;
