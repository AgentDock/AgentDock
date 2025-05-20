/**
 * @fileoverview Simplified orchestration exports for AgentDock.
 *
 * This file provides the core orchestration functionality with
 * environment-aware configuration for optimal performance.
 */

import { createOrchestrationManager } from './index';
import { OrchestrationManagerOptions } from './index';
import { CleanupOptions } from './state';

/**
 * Determines if the code is running in a serverless environment
 */
function isServerless(): boolean {
  // Check for common serverless environment variables
  return !!(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY ||
    process.env.CLOUDFLARE_WORKER
  );
}

/**
 * Gets the appropriate orchestration manager for the current environment
 */
export function getOrchestrationManager(options?: OrchestrationManagerOptions) {
  // Detect environment
  const serverlessEnv = isServerless();

  // Configure manager based on environment
  const defaultOptions: OrchestrationManagerOptions = {
    // lightweight: serverlessEnv, // REMOVED: Obsolete option
    cleanup: {
      enabled: !serverlessEnv,
      ttlMs: 30 * 60 * 1000, // 30 minutes
      intervalMs: 5 * 60 * 1000, // 5 minutes
      maxSessions: 100, // Limit total sessions
    },
  };

  // Create with provided options merged with defaults
  return createOrchestrationManager({
    ...defaultOptions,
    ...options,
    cleanup: {
      ...defaultOptions.cleanup,
      ...options?.cleanup,
    },
  });
}

/**
 * Default export for direct importing
 */
export default getOrchestrationManager;
