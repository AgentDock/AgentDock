'use client';

import * as React from 'react';
import { LogCategory, logger } from 'agentdock-core';
import {
  Brain,
  Lightbulb,
  RefreshCcw,
  Scale,
  Sparkles,
  Zap
} from 'lucide-react';

import { heartbeatGradientProps, useElapsedTime } from '@/lib/heartbeat';
import { cn } from '@/lib/utils';

// Base styles for cognitive tool loading indicators
const chatBubbleVariants =
  'group/message relative break-words rounded-lg p-3 text-sm sm:max-w-[70%] bg-muted text-foreground';

/**
 * Configuration for tool loading UI
 */
export interface LoadingUIConfig {
  icon: keyof typeof iconMap;
  loadingText: string;
  animationClass: string;
}

/**
 * Map of icon names to their React components
 */
export const iconMap = {
  think: Brain,
  reflect: Lightbulb,
  compare: Scale,
  critique: Sparkles,
  brainstorm: Lightbulb,
  debate: Zap
};

/**
 * Function to log tool visibility with timestamp
 */
function logToolVisibility(toolName: string, toolId: string, state: string) {
  logger.debug(
    LogCategory.NODE,
    '[CognitiveToolLoading]',
    `Tool "${toolName}" (${toolId}) ${state} at ${new Date().toISOString()}`
  );
}

/**
 * Shared loading indicator for cognitive tools
 */
export const CognitiveToolLoadingIndicator = React.memo(
  ({
    toolName,
    iconName,
    loadingText,
    animationClass,
    toolId
  }: {
    toolName: string;
    iconName: keyof typeof iconMap;
    loadingText: string;
    animationClass: string;
    toolId: string;
  }) => {
    // Use shared elapsed time hook
    const [formattedTime] = useElapsedTime();

    React.useEffect(() => {
      logToolVisibility(toolName, toolId, 'LOADING STATE RENDERED');
      return () => {
        logToolVisibility(toolName, toolId, 'LOADING STATE UNMOUNTED');
      };
    }, [toolName, toolId]);

    // Get icon component
    const IconComponent = iconMap[iconName] || Brain;

    return (
      <div
        className={cn(
          chatBubbleVariants,
          'transition-all relative overflow-hidden'
        )}
      >
        {/* Heartbeat gradient animation */}
        <div
          className={heartbeatGradientProps.className}
          style={heartbeatGradientProps.style}
        />

        {/* Timer display */}
        <div className="absolute top-2 right-3 text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full">
          {formattedTime}
        </div>

        <div className="flex flex-col gap-3 relative z-10">
          <div className="flex items-center gap-2 text-foreground">
            <IconComponent
              className="h-5 w-5 text-primary animate-pulse"
              aria-hidden="true"
            />
            <div className="font-medium">
              <span className={`inline-block animate-${animationClass}`}>
                {loadingText.replace('...', '')}
                <span className="dots-loader inline-block w-[20px]"></span>
              </span>
            </div>
          </div>

          <div className="w-full h-2 bg-background/50 rounded-full overflow-hidden">
            <div
              className={`h-full bg-primary rounded-full animate-${animationClass}-progress`}
            ></div>
          </div>
        </div>
      </div>
    );
  }
);

CognitiveToolLoadingIndicator.displayName = 'CognitiveToolLoadingIndicator';

/**
 * Helper function to get the loading UI config for a specific tool
 */
export function getToolLoadingUI(toolName: string): {
  icon: keyof typeof iconMap;
  loadingText: string;
  animationClass: string;
} | null {
  // Default configuration for cognitive tools
  const configs: Record<
    string,
    { icon: keyof typeof iconMap; loadingText: string; animationClass: string }
  > = {
    think: {
      icon: 'think',
      loadingText: 'Thinking deeply...',
      animationClass: 'thinking'
    },
    reflect: {
      icon: 'reflect',
      loadingText: 'Reflecting...',
      animationClass: 'thinking' // Reuse the same animation styles
    },
    compare: {
      icon: 'compare',
      loadingText: 'Comparing options...',
      animationClass: 'thinking' // Reuse the same animation styles
    },
    critique: {
      icon: 'critique',
      loadingText: 'Analyzing critically...',
      animationClass: 'thinking'
    },
    brainstorm: {
      icon: 'brainstorm',
      loadingText: 'Generating ideas...',
      animationClass: 'thinking'
    },
    debate: {
      icon: 'debate',
      loadingText: 'Exploring perspectives...',
      animationClass: 'thinking'
    }
    // Additional tools will be added here as they are implemented
  };

  return configs[toolName] || null;
}
