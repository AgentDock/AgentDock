/**
 * @fileoverview Type exports
 */

export * from './llm';
export * from './storage';
export * from './messages';
export * from './node-category';

export interface AgentDockConfig {
  /** Whether to only use BYOK (no fallback to service key) */
  byokOnly?: boolean;
  /** Default namespace for storage */
  defaultNamespace?: string;
  /** Minimum log level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** Maximum retry count for operations */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Service key endpoint URL */
  serviceKeyEndpoint?: string;
}

export * from './agent-config'; 
// test change