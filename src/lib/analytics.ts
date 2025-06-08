/**
 * @fileoverview Server-side analytics module using PostHog
 */

import { LogCategory, logger } from 'agentdock-core';
import { PostHog } from 'posthog-node';

// Singleton instance of PostHog
let posthogInstance: PostHog | null = null;

// Initialize PostHog instance
function getPostHogInstance(): PostHog | null {
  // If already initialized, return the instance
  if (posthogInstance) {
    return posthogInstance;
  }

  // Get configuration from environment
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_API_KEY;
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';
  const analyticsEnabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true';

  // If not enabled or no API key, return null
  if (!analyticsEnabled || !apiKey) {
    return null;
  }

  try {
    // Create a new PostHog instance with minimal config
    posthogInstance = new PostHog(apiKey, {
      host,
      // Set small batch size to avoid memory issues
      flushAt: 10,
      // Flush at most every 30 seconds to avoid overwhelming the network
      flushInterval: 30000
    });

    logger.info(
      LogCategory.SYSTEM,
      'Analytics',
      'PostHog analytics initialized on server'
    );

    return posthogInstance;
  } catch (error) {
    logger.error(
      LogCategory.SYSTEM,
      'Analytics',
      'Failed to initialize PostHog analytics',
      { error: error instanceof Error ? error.message : String(error) }
    );
    return null;
  }
}

// Types for analytics events
type EventProperties = Record<string, any>;
type UserProperties = Record<string, any>;

/**
 * Capture an analytics event - non-blocking
 * @param eventName Name of the event
 * @param properties Event properties
 * @param distinctId User ID or session ID for tracking
 */
export function captureEvent(
  eventName: string,
  properties: EventProperties = {},
  distinctId: string = 'anonymous'
): void {
  // Run in a non-blocking way
  Promise.resolve().then(() => {
    try {
      const client = getPostHogInstance();
      if (!client) return;

      // Add timestamp if not already present
      const propsWithTimestamp = {
        ...properties,
        timestamp: properties.timestamp || new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      };

      client.capture({
        distinctId,
        event: eventName,
        properties: propsWithTimestamp
      });
    } catch (error) {
      // Just log and continue - never block or throw
      logger.warn(LogCategory.SYSTEM, 'Analytics', 'Failed to capture event', {
        event: eventName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

/**
 * Identify a user with properties - non-blocking
 * @param distinctId User ID
 * @param properties User properties
 */
export function identifyUser(
  distinctId: string,
  properties: UserProperties = {}
): void {
  // Run in a non-blocking way
  Promise.resolve().then(() => {
    try {
      const client = getPostHogInstance();
      if (!client) return;

      client.identify({
        distinctId,
        properties
      });
    } catch (error) {
      // Just log and continue - never block or throw
      logger.warn(LogCategory.SYSTEM, 'Analytics', 'Failed to identify user', {
        userId: distinctId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

/**
 * Flush all pending events to PostHog - non-blocking
 * Returns a promise that resolves when flushing is complete
 */
export async function flushAnalytics(): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      const client = getPostHogInstance();
      if (!client) {
        resolve();
        return;
      }

      client
        .flush()
        .then(() => {
          logger.debug(
            LogCategory.SYSTEM,
            'Analytics',
            'Flushed analytics events'
          );
          resolve();
        })
        .catch((error) => {
          logger.warn(
            LogCategory.SYSTEM,
            'Analytics',
            'Failed to flush analytics events',
            { error: error instanceof Error ? error.message : String(error) }
          );
          resolve(); // Still resolve even on error
        });
    } catch (error) {
      logger.warn(LogCategory.SYSTEM, 'Analytics', 'Error in flush analytics', {
        error: error instanceof Error ? error.message : String(error)
      });
      resolve(); // Always resolve
    }
  });
}
