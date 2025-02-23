'use client';

import { useEffect, useState } from 'react';
import { NodeRegistry } from 'agentdock-core';
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorInfo } from "react";
import { logger, LogCategory } from 'agentdock-core';

function BaseCoreInitializer() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      try {
        // Check if core nodes are registered
        const metadata = NodeRegistry.getNodeMetadata();
        const registeredNodes = metadata.nodes.map(n => n.type);
        
        if (registeredNodes.length === 0) {
          throw new Error('No core nodes registered');
        }

        // Log successful initialization
        logger.info(
          LogCategory.SYSTEM,
          'CoreInitializer',
          'Core nodes registered successfully',
          { nodes: registeredNodes }
        );

        setIsInitialized(true);
      } catch (error) {
        logger.error(
          LogCategory.SYSTEM,
          'CoreInitializer',
          'Failed to initialize core nodes',
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }
    }
  }, [isInitialized]);

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