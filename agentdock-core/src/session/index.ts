/**
 * @fileoverview Session management for AgentDock core.
 *
 * This file implements a session management system that ensures state isolation
 * between concurrent sessions. It provides a clean, centralized way to manage
 * session-scoped state across the application.
 */

import { LogCategory, logger } from '../logging';
import { getStorageFactory } from '../storage/factory';
import { StorageProvider } from '../storage/types';
import {
  CreateSessionOptions,
  SessionId,
  SessionMetadata,
  SessionResult,
  SessionState
} from '../types/session';

/**
 * Structure for storing session data via StorageProvider
 */
interface StoredSessionData<T extends SessionState> {
  state: T;
  metadata: SessionMetadata;
  ttlMs: number;
}

/**
 * Session manager that provides isolation between concurrent sessions
 * Generic over the type of state stored for each session
 */
export class SessionManager<T extends SessionState> {
  /** Storage provider for persistence */
  private storage: StorageProvider;

  /** Default state generator function */
  private defaultStateGenerator: (sessionId: SessionId) => T;

  /** Namespace for storage keys */
  private storageNamespace: string;

  /** Default TTL for sessions in milliseconds */
  private defaultTtlMs: number;

  /**
   * Creates a new session manager
   *
   * @param defaultStateGenerator Function to generate initial state for new sessions
   * @param storageProvider Optional storage provider instance. Defaults to memory provider.
   * @param storageNamespace Optional namespace for storage keys. Defaults to 'sessions'.
   * @param options Options for configuring the session manager
   */
  constructor(
    defaultStateGenerator: (sessionId: SessionId) => T,
    storageProvider?: StorageProvider,
    storageNamespace: string = 'sessions',
    options: { defaultTtlMs?: number } = {}
  ) {
    // Use provided storage provider or get default memory provider
    this.storage =
      storageProvider ||
      getStorageFactory().getProvider({
        type: 'memory',
        namespace: storageNamespace
      });

    this.defaultStateGenerator = defaultStateGenerator;
    this.storageNamespace = storageNamespace;

    // Set the default TTL, falling back if not provided
    this.defaultTtlMs = options.defaultTtlMs || 30 * 60 * 1000; // Fallback to 30 mins if needed

    // Set up automatic cleanup interval
    this.setupCleanupInterval();

    logger.debug(
      LogCategory.SESSION,
      'SessionManager',
      'Initialized with storage provider',
      {
        providerType: this.storage.constructor.name,
        namespace: this.storageNamespace
      }
    );
  }

  /**
   * Creates a storage key for a session
   */
  private getStorageKey(sessionId: SessionId): string {
    return `${this.storageNamespace}:${sessionId}`;
  }

  /**
   * Creates a new session or returns an existing one
   *
   * @param options Options for creating the session
   * @returns The session state
   */
  async createSession(
    options: CreateSessionOptions = {}
  ): Promise<SessionResult<T>> {
    try {
      // Create a session ID if not provided
      const sessionId = options.sessionId || this.generateSessionId();
      const storageKey = this.getStorageKey(sessionId);

      // If session already exists in storage, return it
      const existingSession = await this.getSession(sessionId);
      if (existingSession.success) {
        return existingSession;
      }

      // Generate default session metadata
      const now = new Date();
      const metadata: SessionMetadata = {
        createdAt: now,
        lastAccessedAt: now,
        ...(options.metadata || {})
      };

      // Generate initial state
      const state = this.defaultStateGenerator(sessionId);

      // Prepare data for storage
      const sessionData: StoredSessionData<T> = {
        state,
        metadata,
        ttlMs: this.defaultTtlMs // Use configured/default TTL
      };

      // Store the session using the storage provider
      await this.storage.set(storageKey, sessionData, {
        ttlSeconds:
          sessionData.ttlMs > 0
            ? Math.floor(sessionData.ttlMs / 1000)
            : undefined // Use ttlSeconds
      });

      logger.debug(
        LogCategory.SESSION,
        'SessionManager',
        'Created new session in storage',
        { sessionId, storageKey }
      );

      return {
        success: true,
        sessionId,
        data: state
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        LogCategory.SESSION,
        'SessionManager',
        'Error creating session',
        { error: errorMessage }
      );

      return {
        success: false,
        sessionId: options.sessionId || '',
        error: errorMessage
      };
    }
  }

  /**
   * Gets an existing session from storage
   *
   * @param sessionId The session ID
   * @returns The session state
   */
  async getSession(sessionId: SessionId): Promise<SessionResult<T>> {
    const storageKey = this.getStorageKey(sessionId);
    try {
      // Attempt to get session data from storage
      const storedData =
        await this.storage.get<StoredSessionData<T>>(storageKey);

      // If session doesn't exist in storage, return error
      if (!storedData) {
        // --- BEGIN LOGGING ---
        logger.debug(
          LogCategory.SESSION,
          'SessionManager.getSession',
          'Session not found in storage (expected for new session)',
          {
            sessionId: sessionId?.substring(0, 8) + '...',
            storageKey
          }
        );
        // --- END LOGGING ---
        return {
          success: false,
          sessionId,
          error: 'Session not found in storage'
        };
      }

      // --- BEGIN FIX: Ensure metadata dates are Date objects ---
      // When retrieving from JSON-based storage like Redis, Dates might be strings.
      if (typeof storedData.metadata.createdAt === 'string') {
        storedData.metadata.createdAt = new Date(storedData.metadata.createdAt);
      }
      if (typeof storedData.metadata.lastAccessedAt === 'string') {
        storedData.metadata.lastAccessedAt = new Date(
          storedData.metadata.lastAccessedAt
        );
      }
      // --- END FIX ---

      // Update last accessed time (potentially write back to storage)
      const now = new Date();
      let needsUpdate = false;
      // Ensure we have a valid Date object before calling getTime()
      if (
        storedData.metadata.lastAccessedAt instanceof Date &&
        !isNaN(storedData.metadata.lastAccessedAt.getTime()) &&
        storedData.metadata.lastAccessedAt.getTime() !== now.getTime()
      ) {
        storedData.metadata.lastAccessedAt = now;
        needsUpdate = true;
      } else if (
        !(storedData.metadata.lastAccessedAt instanceof Date) ||
        isNaN(storedData.metadata.lastAccessedAt.getTime())
      ) {
        // If lastAccessedAt was invalid or couldn't be parsed, set it to now and update
        logger.warn(
          LogCategory.SESSION,
          'SessionManager',
          'Invalid lastAccessedAt found, resetting.',
          { sessionId, storageKey }
        );
        storedData.metadata.lastAccessedAt = now;
        needsUpdate = true;
      }

      // Optionally update the stored session with the new access time
      // This adds overhead but keeps lastAccessedAt fresh.
      // Consider if this is strictly necessary for your use case.
      if (needsUpdate) {
        await this.storage.set(storageKey, storedData, {
          ttlSeconds:
            this.defaultTtlMs > 0
              ? Math.floor(this.defaultTtlMs / 1000)
              : undefined // Use configured TTL
        });
      }

      // --- BEGIN LOGGING ---
      logger.debug(
        LogCategory.SESSION,
        'SessionManager.getSession',
        'Returning success',
        {
          sessionId: sessionId?.substring(0, 8) + '...',
          stateKeys: storedData?.state ? Object.keys(storedData.state) : 'null'
        }
      );
      // --- END LOGGING ---
      return {
        success: true,
        sessionId,
        data: storedData.state
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        LogCategory.SESSION,
        'SessionManager',
        'Error getting session from storage',
        { sessionId, storageKey, error: errorMessage }
      );

      // --- BEGIN LOGGING ---
      logger.warn(
        LogCategory.SESSION,
        'SessionManager.getSession',
        'Returning failure (error catch block)',
        {
          sessionId: sessionId?.substring(0, 8) + '...',
          error: errorMessage
        }
      );
      // --- END LOGGING ---
      return {
        success: false,
        sessionId,
        error: errorMessage
      };
    }
  }

  /**
   * Updates a session's state in storage
   *
   * @param sessionId The session ID
   * @param updateFn Function that updates the state
   * @returns The updated session state
   */
  async updateSession(
    sessionId: SessionId,
    updateFn: (state: T) => T
  ): Promise<SessionResult<T>> {
    const storageKey = this.getStorageKey(sessionId);
    try {
      // Get the current stored data
      const storedData =
        await this.storage.get<StoredSessionData<T>>(storageKey);

      // If session doesn't exist, return error
      if (!storedData) {
        return {
          success: false,
          sessionId,
          error: 'Session not found for update'
        };
      }

      // Update the state using the provided function
      const updatedState = updateFn(storedData.state);

      // Prepare updated data for storage
      const updatedSessionData: StoredSessionData<T> = {
        ...storedData,
        state: updatedState,
        metadata: {
          ...storedData.metadata,
          lastAccessedAt: new Date()
        }
      };

      // Store the updated state using the storage provider
      await this.storage.set(storageKey, updatedSessionData, {
        ttlSeconds:
          updatedSessionData.ttlMs > 0
            ? Math.floor(updatedSessionData.ttlMs / 1000)
            : undefined // Use ttlSeconds
      });

      return {
        success: true,
        sessionId,
        data: updatedState
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        LogCategory.SESSION,
        'SessionManager',
        'Error updating session in storage',
        { sessionId, storageKey, error: errorMessage }
      );

      return {
        success: false,
        sessionId,
        error: errorMessage
      };
    }
  }

  /**
   * Deletes a session from storage
   *
   * @param sessionId The session ID
   * @returns Whether the deletion was successful
   */
  async deleteSession(sessionId: SessionId): Promise<SessionResult<boolean>> {
    const storageKey = this.getStorageKey(sessionId);
    try {
      // Attempt to delete the session from storage
      const deleted = await this.storage.delete(storageKey);

      logger.debug(
        LogCategory.SESSION,
        'SessionManager',
        'Deleted session from storage',
        { sessionId, storageKey, deleted }
      );

      return {
        success: true,
        sessionId,
        data: deleted
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        LogCategory.SESSION,
        'SessionManager',
        'Error deleting session from storage',
        { sessionId, storageKey, error: errorMessage }
      );

      return {
        success: false,
        sessionId,
        error: errorMessage
      };
    }
  }

  /**
   * Generates a unique session ID
   * TODO: Use a more robust UUID library if needed
   */
  private generateSessionId(): SessionId {
    // Simple random ID for now
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * Sets up an interval for cleaning up expired sessions
   * Note: This might be redundant if the storage provider handles TTL automatically.
   * Consider provider capabilities. For MemoryStorageProvider without persistence, this is needed.
   */
  private setupCleanupInterval(): void {
    // Check if storage provider has its own cleanup or TTL mechanism
    // If so, this interval might not be necessary or could conflict.
    // For now, keep it, assuming it might be needed for some providers or configurations.
    const cleanupIntervalMs = 5 * 60 * 1000; // 5 minutes - Define interval directly
    setInterval(() => {
      this.cleanupExpiredSessions(); // This method needs to be adapted if storage handles TTL
    }, cleanupIntervalMs);
  }

  /**
   * Cleans up expired sessions (implementation depends heavily on StorageProvider)
   * Placeholder: Needs adaptation based on how TTL is managed by the provider.
   * If the provider handles TTL automatically (e.g., Redis), this might do nothing.
   * If using MemoryStorageProvider without persistence, it needs to iterate keys.
   */
  private async cleanupExpiredSessions(): Promise<void> {
    logger.debug(
      LogCategory.SESSION,
      'SessionManager',
      'Running session cleanup (placeholder - requires provider-specific logic)'
    );
    // Implementation depends heavily on the storage provider.
    // - If provider handles TTL (Redis, Vercel KV): This function might be unnecessary.
    // - If provider is simple (Memory): Would need to list keys (if possible),
    //   get each session, check metadata.lastAccessedAt + ttlMs, and delete if expired.
    // This is complex and potentially slow. Relying on provider TTL is preferred.
  }
}
