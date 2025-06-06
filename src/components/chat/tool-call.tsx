'use client';

import * as React from 'react';
import type { ToolState } from 'agentdock-core';
import {
  ChevronDown,
  ChevronUp,
  Code2,
  ImageIcon,
  Terminal
} from 'lucide-react';

import { ChatMarkdown } from '@/components/chat/chat-markdown';
import { ImageResultDisplay } from '@/components/chat/image-result';
import type { ToolInvocation } from '@/components/chat/types';
import { CopyButton } from '@/components/ui/copy-button';
import {
  heartbeatGradientProps,
  timerDisplayProps,
  useElapsedTime
} from '@/lib/heartbeat';
import { cn } from '@/lib/utils';
import {
  CognitiveToolLoadingIndicator,
  getToolLoadingUI
} from '@/nodes/cognitive-tools/components/loading';

// Function to get high-precision timestamp
function getClientTimestamp(): string {
  const now = performance.now();
  return `${Math.floor(now)}.${Math.floor((now % 1) * 1000)}ms`;
}

// Log tool visibility with timestamp
function logToolVisibility(toolName: string, toolId: string, state: string) {
  console.log(
    `[CLIENT][TOOL-TIMING] Tool "${toolName}" (${toolId}) ${state} at ${getClientTimestamp()}`
  );
}

interface ToolCallProps {
  toolInvocations: ToolInvocation[];
}

// Separate components for different tool states
const LoadingToolCall = React.memo(
  ({ toolName, toolId }: { toolName: string; toolId: string }) => {
    // Use the shared elapsed time hook
    const [formattedTime] = useElapsedTime();

    // Log when this component is rendered
    React.useEffect(() => {
      logToolVisibility(toolName, toolId, 'LOADING STATE RENDERED');

      // Return cleanup function
      return () => {
        logToolVisibility(toolName, toolId, 'LOADING STATE UNMOUNTED');
      };
    }, [toolName, toolId]);

    // Check if this is a cognitive tool with custom loading UI
    const toolLoadingUI = getToolLoadingUI(toolName);

    if (toolLoadingUI) {
      return (
        <div
          className="relative"
          aria-live="polite"
          aria-busy="true"
        >
          <CognitiveToolLoadingIndicator
            toolName={toolName}
            iconName={toolLoadingUI.icon}
            loadingText={toolLoadingUI.loadingText}
            animationClass={toolLoadingUI.animationClass}
            toolId={toolId}
          />
        </div>
      );
    }

    // Default loading UI for non-cognitive tools with heartbeat animation
    return (
      <div
        className={cn(
          'group/message relative break-words rounded-2xl p-4 text-sm',
          'sm:max-w-[70%] bg-muted text-foreground',
          'flex items-center gap-3 relative overflow-hidden'
        )}
        aria-live="polite"
        aria-busy="true"
      >
        {/* Heartbeat gradient animation */}
        <div
          className={heartbeatGradientProps.className}
          style={heartbeatGradientProps.style}
        />

        <Terminal
          className="h-4 w-4 text-primary animate-pulse"
          aria-hidden="true"
        />

        <div className="flex-1 flex items-center">
          <span className="font-medium animate-[text-pulse_1.5s_ease-in-out_infinite] text-primary">
            Calling {toolName}
            <span className="dots-loader inline-block w-[20px]"></span>
          </span>
        </div>

        {/* Timer */}
        <div
          className={timerDisplayProps.className}
          style={timerDisplayProps.style}
        >
          {formattedTime}
        </div>
      </div>
    );
  }
);

LoadingToolCall.displayName = 'LoadingToolCall';

// Header component for tool results
const ToolHeader = React.memo(
  ({
    toolName,
    isExpanded,
    isImage,
    isNewest,
    toggleExpanded
  }: {
    toolName: string;
    isExpanded: boolean;
    isImage?: boolean;
    isNewest?: boolean;
    toggleExpanded: (e: React.MouseEvent<Element, MouseEvent>) => void;
  }) => {
    // Generate a safe ID for ARIA controls
    const contentId = `tool-content-${toolName.replace(/\W/g, '-')}`;

    return (
      <div
        className={cn(
          'flex items-center justify-between w-full rounded-md hover:bg-muted/50 py-1 px-1',
          'text-muted-foreground transition-colors duration-200',
          isNewest && 'text-foreground font-medium'
        )}
        onClick={toggleExpanded}
        role="button"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpanded(
              e as unknown as React.MouseEvent<Element, MouseEvent>
            );
          }
        }}
      >
        <div className="flex items-center gap-2">
          {isImage ? (
            <ImageIcon
              className={cn('h-4 w-4', isNewest && 'text-primary')}
              aria-hidden="true"
            />
          ) : (
            <Code2
              className={cn('h-4 w-4', isNewest && 'text-primary')}
              aria-hidden="true"
            />
          )}
          <span>
            {isImage ? 'Image from ' : 'Result from '}
            {toolName}
          </span>
          {isNewest && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              newest
            </span>
          )}
        </div>
        <div
          className="p-1 hover:bg-background/50 rounded-md"
          aria-hidden="true"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </div>
    );
  }
);

ToolHeader.displayName = 'ToolHeader';

export function ToolCall({ toolInvocations }: ToolCallProps) {
  const [expandedTools, setExpandedTools] = React.useState<
    Record<string, boolean>
  >({});

  const processedToolsRef = React.useRef<Set<string>>(new Set());
  const toolInvocationsRef = React.useRef(toolInvocations);
  const prevToolCount = React.useRef<number>(0);

  // Log when new tool invocations are received
  React.useEffect(() => {
    if (!toolInvocations?.length) return;

    toolInvocations.forEach((invocation, index) => {
      const toolId = `${invocation.toolName}-${index}`;
      logToolVisibility(
        invocation.toolName,
        toolId,
        `RECEIVED with state=${invocation.state}`
      );
    });
  }, [toolInvocations]);

  // Only update expandedTools when toolInvocations actually change
  React.useEffect(() => {
    // Skip if no tool invocations
    if (!toolInvocations?.length) return;

    // Skip if toolInvocations is the same reference as before
    if (toolInvocationsRef.current === toolInvocations) {
      return;
    }

    // Update the ref
    toolInvocationsRef.current = toolInvocations;

    // Check if we have new tools (more tools than before)
    const hasNewTools = toolInvocations.length > prevToolCount.current;

    if (hasNewTools) {
      // Create a new expanded state object
      const newExpandedState: Record<string, boolean> = {};

      // Collapse all existing tools
      toolInvocations.forEach((invocation, index) => {
        const toolId = `${invocation.toolName}-${index}`;
        // Only the most recent tool should be expanded
        const shouldExpand = index === toolInvocations.length - 1;
        newExpandedState[toolId] = shouldExpand;

        // Track processed tools
        if (!processedToolsRef.current.has(toolId)) {
          processedToolsRef.current.add(toolId);
          logToolVisibility(
            invocation.toolName,
            toolId,
            shouldExpand ? 'ADDED AS EXPANDED' : 'ADDED AS COLLAPSED'
          );
        }
      });

      // Update the expanded state
      setExpandedTools(newExpandedState);

      // Update our count reference
      prevToolCount.current = toolInvocations.length;
    }
  }, [toolInvocations]);

  // Function to toggle expanded state for a tool
  const toggleExpanded = React.useCallback(
    (toolId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedTools((prevState) => ({
        ...prevState,
        [toolId]: !prevState[toolId]
      }));
    },
    []
  );

  if (!toolInvocations || toolInvocations.length === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-3 w-full"
      role="region"
      aria-label="Tool invocation results"
    >
      {toolInvocations.map((invocation, index) => {
        // Generate a reliable unique ID for this tool invocation
        const toolId = `${invocation.toolName.replace(/\W/g, '-')}-${index}`;
        const isExpanded = expandedTools[toolId] !== false;
        const isNewestTool = index === toolInvocations.length - 1;

        logToolVisibility(invocation.toolName, toolId, `RENDERING TOOL`);

        // Handle loading state
        if (
          invocation.state === 'partial-call' ||
          invocation.state === 'call'
        ) {
          return (
            <LoadingToolCall
              key={toolId}
              toolName={invocation.toolName}
              toolId={toolId}
            />
          );
        }

        // Handle result
        if (invocation.state === 'result' && invocation.result !== undefined) {
          let content: any = '';
          let toolType = '';
          let isCognitiveTool = false;
          let isEmptyResult = false;

          // Extract content and type from result
          if (typeof invocation.result === 'object' && invocation.result) {
            if ('content' in invocation.result) {
              content = invocation.result.content as string;
            }
            if ('type' in invocation.result) {
              toolType = invocation.result.type as string;

              // Check if this is a cognitive tool (think or reflect)
              isCognitiveTool =
                toolType === 'think_result' || toolType === 'reflect_result';

              // For cognitive tools, check if this is an empty result or contains only placeholder text
              if (isCognitiveTool && content) {
                // Check for placeholder text that indicates loading state
                const hasPlaceholder =
                  content.includes('Processing thoughts...') ||
                  content.includes('Processing reflection...');

                isEmptyResult = hasPlaceholder;

                // Log detected empty cognitive tool result
                if (isEmptyResult) {
                  logToolVisibility(
                    invocation.toolName,
                    toolId,
                    `DETECTED PLACEHOLDER CONTENT (showing loading state instead)`
                  );
                }
              }
            }
          } else if (typeof invocation.result === 'string') {
            content = invocation.result;
          }

          // If this is a cognitive tool with an empty result, show loading state instead
          if (isCognitiveTool && isEmptyResult) {
            // Get the appropriate loading UI for this cognitive tool
            const toolLoadingUI = getToolLoadingUI(invocation.toolName);

            if (toolLoadingUI) {
              return (
                <CognitiveToolLoadingIndicator
                  key={toolId}
                  toolName={invocation.toolName}
                  iconName={toolLoadingUI.icon}
                  loadingText={toolLoadingUI.loadingText}
                  animationClass={toolLoadingUI.animationClass}
                  toolId={toolId}
                />
              );
            }

            // Fallback to generic loading if no specific UI defined
            return (
              <LoadingToolCall
                key={toolId}
                toolName={invocation.toolName}
                toolId={toolId}
              />
            );
          }

          // If this is an image generation tool, handle specially
          const isImageGeneration = invocation.toolName === 'generate_image';
          if (isImageGeneration && invocation.result) {
            const result = invocation.result;
            const isErrorMessage =
              typeof result === 'string' &&
              !result.startsWith('http') &&
              !result.startsWith('data:');

            let imageData = null;
            let prompt = '';
            let description = null;

            if (!isErrorMessage) {
              // Extract image data based on format
              if (typeof result === 'object') {
                if ('url' in result) {
                  imageData = result.url;
                  prompt = result.prompt || '';
                  description = result.description || null;
                } else if ('image' in result) {
                  imageData = result.image;
                  description = result.description || null;
                } else {
                  imageData = result;
                }
              } else {
                imageData = result;
              }
            }

            // Generate a safe ID for content
            const contentId = `tool-content-${invocation.toolName.replace(/\W/g, '-')}-${index}`;

            return (
              <div
                key={toolId}
                className={cn(
                  'group/message relative break-words rounded-2xl p-4 text-sm',
                  'sm:max-w-[70%] bg-muted text-foreground',
                  isNewestTool && 'border-l-2 border-primary',
                  'transition-all duration-300'
                )}
              >
                <ToolHeader
                  toolName={invocation.toolName}
                  isExpanded={isExpanded}
                  isImage={true}
                  isNewest={isNewestTool}
                  toggleExpanded={(e) => toggleExpanded(toolId, e)}
                />

                {isExpanded && (
                  <div
                    id={contentId}
                    className="text-foreground mt-3 pt-2 border-t border-border/30 transition-all duration-300"
                  >
                    {isErrorMessage ? (
                      <p className="text-sm text-red-500">{result}</p>
                    ) : (
                      <ImageResultDisplay
                        imageData={imageData}
                        prompt={prompt}
                        description={description}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          }

          // Ensure content is a string for rendering in markdown
          const contentToRender =
            typeof content === 'string'
              ? content
              : JSON.stringify(content, null, 2);

          // Generate a safe ID for content
          const contentId = `tool-content-${invocation.toolName.replace(/\W/g, '-')}-${index}`;

          return (
            <div
              key={toolId}
              className={cn(
                'group/message relative break-words rounded-2xl p-4 text-sm',
                'sm:max-w-[70%] bg-muted text-foreground',
                isNewestTool && 'border-l-2 border-primary',
                'transition-all duration-300'
              )}
            >
              <ToolHeader
                toolName={invocation.toolName}
                isExpanded={isExpanded}
                isNewest={isNewestTool}
                toggleExpanded={(e) => toggleExpanded(toolId, e)}
              />

              {isExpanded && (
                <div
                  id={contentId}
                  className="mt-3 pt-2 border-t border-border/30 relative group/tool-content"
                >
                  <ChatMarkdown messageId={toolId}>
                    {contentToRender}
                  </ChatMarkdown>
                  <div className="invisible absolute bottom-0 right-0 -mb-2.5 -mr-2 opacity-0 transition-opacity duration-200 group-hover/tool-content:visible group-hover/tool-content:opacity-100">
                    <CopyButton
                      content={contentToRender}
                      copyMessage="Copied tool result to clipboard"
                      size="small"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        }

        // Fallback for unknown states - add key to prevent React warning
        return (
          <div
            key={toolId}
            className="hidden"
          ></div>
        );
      })}
    </div>
  );
}
