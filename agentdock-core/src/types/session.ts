/**
 * @fileoverview Type definitions for session management.
 *
 * This file defines the types for session management across AgentDock.
 * Sessions are used to isolate state between different conversations,
 * ensuring no state leakage between concurrent users.
 */

import { z } from 'zod';

/**
 * Unique identifier for a session
 */
export type SessionId = string;

/**
 * Session metadata with creation and access tracking
 */
export interface SessionMetadata {
  /** When the session was created */
  createdAt: Date;

  /** When the session was last accessed */
  lastAccessedAt: Date;

  /** Session origin information (e.g., user ID, request source) */
  origin?: Record<string, any>;
}

/**
 * Base interface for any session state object
 */
export interface SessionState {
  /** The session ID this state belongs to */
  sessionId: SessionId;
}

/**
 * Options for creating a new session
 */
export interface CreateSessionOptions {
  /** Optional predefined session ID (will be auto-generated if not provided) */
  sessionId?: SessionId;

  /** Optional metadata to associate with the session */
  metadata?: Partial<SessionMetadata>;

  /**
   * Time-to-live in milliseconds
   * After this time without activity, the session may be garbage collected
   * Default: 30 minutes
   */
  ttlMs?: number;
}

/**
 * Default session options
 */
export const DEFAULT_SESSION_OPTIONS: CreateSessionOptions = {
  ttlMs: 30 * 60 * 1000 // 30 minutes
};

/**
 * Session validation schema
 */
export const SessionIdSchema = z.string().min(10).max(100);

/**
 * Result of a session operation
 */
export interface SessionResult<T> {
  /** Operation success status */
  success: boolean;

  /** Session ID */
  sessionId: SessionId;

  /** Optional data returned by the operation */
  data?: T;

  /** Optional error message if operation failed */
  error?: string;
}
