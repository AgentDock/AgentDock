'use client';

/**
 * Core initializer component that bootstraps the application.
 *
 * OPTIMIZATION OPPORTUNITIES:
 * 1. Move system initialization to a server component where possible
 * 2. Split initialization into smaller, targeted operations
 * 3. Implement proper loading UI during initialization
 * 4. Add error recovery mechanisms beyond just logging
 * 5. Use React.lazy and Suspense for more granular initialization
 */

import { useEffect, useState, ErrorInfo } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { logger, LogCategory } from 'agentdock-core';
import { useAgents } from '@/lib/store';
import { initSystem } from '@/lib/core/init';

function BaseCoreInitializer() {
  const { initialize, isInitialized } = useAgents();
  const [isSystemInitialized, setIsSystemInitialized] = useState(false);

  // OPTIMIZATION: Consider moving to a server component or using Next.js lifecycle
  // Init system first
  useEffect(() => {
    try {
      // Initialize the system once we're on the client
      initSystem();

      setIsSystemInitialized(true);
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'CoreInitializer', 'Failed to initialize system', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, []);

  // OPTIMIZATION: Consider using React Suspense instead of manual loading states
  // Then initialize store
  useEffect(() => {
    if (isSystemInitialized && !isInitialized) {
      initialize().catch((error) => {
        logger.error(LogCategory.SYSTEM, 'CoreInitializer', 'Failed to initialize store', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }
  }, [isSystemInitialized, isInitialized, initialize]);

  return null;
}

export function CoreInitializer() {
  return (
    <ErrorBoundary
      onError={(error: Error, errorInfo: ErrorInfo) => {
        logger.error(LogCategory.SYSTEM, 'CoreInitializer', 'Error in CoreInitializer', {
          error: error.message,
          errorInfo,
        });
      }}
      resetOnPropsChange
    >
      <BaseCoreInitializer />
    </ErrorBoundary>
  );
}
