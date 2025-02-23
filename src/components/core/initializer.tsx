'use client';

import { useEffect } from 'react';
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorInfo } from "react";
import { logger, LogCategory } from 'agentdock-core';
import { useAgents } from '@/lib/store';

function BaseCoreInitializer() {
  const { initialize, isInitialized } = useAgents();

  useEffect(() => {
    if (!isInitialized) {
      initialize().catch((error) => {
        logger.error(
          LogCategory.SYSTEM,
          'CoreInitializer',
          'Failed to initialize store',
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );
      });
    }
  }, [isInitialized, initialize]);

  return null;
}

export function CoreInitializer() {
  return (
    <ErrorBoundary
      onError={(error: Error, errorInfo: ErrorInfo) => {
        logger.error(
          LogCategory.SYSTEM,
          'CoreInitializer',
          'Error in CoreInitializer',
          { error: error.message, errorInfo }
        );
      }}
      resetOnPropsChange
    >
      <BaseCoreInitializer />
    </ErrorBoundary>
  );
} 