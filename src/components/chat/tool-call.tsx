"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Code2, Loader2, Terminal, ChevronDown, ChevronUp, ImageIcon } from "lucide-react"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import type { ToolState } from 'agentdock-core'
import type { ToolInvocation } from "@/components/chat/types"
import { ImageResultDisplay } from "@/components/chat/image-result"
import { CognitiveToolLoadingIndicator, getToolLoadingUI } from "@/nodes/cognitive-tools/components/loading"
import { CopyButton } from "@/components/ui/copy-button"

const chatBubbleVariants = "group/message relative break-words rounded-2xl p-4 text-sm sm:max-w-[70%] bg-muted text-foreground";

// Special class for the most recent tool
const recentToolClass = "border-l-2 border-primary transition-all duration-300";

interface ToolCallProps {
  toolInvocations: ToolInvocation[];
}

// Function to get high-precision timestamp
function getClientTimestamp(): string {
  const now = performance.now();
  return `${Math.floor(now)}.${Math.floor((now % 1) * 1000)}ms`;
}

// Log tool visibility with timestamp
function logToolVisibility(toolName: string, toolId: string, state: string) {
  console.log(`[CLIENT][TOOL-TIMING] Tool "${toolName}" (${toolId}) ${state} at ${getClientTimestamp()}`);
}

// Separate components for different tool states
const LoadingToolCall = React.memo(({ toolName, toolId }: { toolName: string, toolId: string }) => {
  // Log when this component is rendered
  React.useEffect(() => {
    logToolVisibility(toolName, toolId, "LOADING STATE RENDERED");
    
    // Return cleanup function
    return () => {
      logToolVisibility(toolName, toolId, "LOADING STATE UNMOUNTED");
    };
  }, [toolName, toolId]);
  
  // Check if this is a cognitive tool with custom loading UI
  const toolLoadingUI = getToolLoadingUI(toolName);
  
  if (toolLoadingUI) {
    return (
      <CognitiveToolLoadingIndicator
        toolName={toolName}
        iconName={toolLoadingUI.icon}
        loadingText={toolLoadingUI.loadingText}
        animationClass={toolLoadingUI.animationClass}
        toolId={toolId}
      />
    );
  }
  
  // Default loading UI for non-cognitive tools
  return (
    <div className={cn(chatBubbleVariants, "flex items-center gap-2 text-muted-foreground")}>
      <Terminal className="h-4 w-4" aria-hidden="true" />
      <span>Calling {toolName}...</span>
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
    </div>
  );
});

LoadingToolCall.displayName = "LoadingToolCall";

// Header component for tool results
const ToolHeader = React.memo(({ 
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
  toggleExpanded: (e: React.MouseEvent) => void;
}) => (
  <div 
    className={cn(
      "flex items-center justify-between text-muted-foreground cursor-pointer w-full",
      "transition-all duration-300",
      isNewest && "text-foreground font-medium" 
    )}
    onClick={toggleExpanded}
  >
    <div className="flex items-center gap-2">
      {isImage ? (
        <ImageIcon className={cn("h-4 w-4", isNewest && "text-primary")} aria-hidden="true" />
      ) : (
        <Code2 className={cn("h-4 w-4", isNewest && "text-primary")} aria-hidden="true" />
      )}
      <span>{isImage ? "Image from " : "Result from "}{toolName}</span>
      {isNewest && (
        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
          newest
        </span>
      )}
    </div>
    <div 
      className="p-1 hover:bg-background/50 rounded-md ml-4"
      aria-label={isExpanded ? "Collapse" : "Expand"}
    >
      {isExpanded ? (
        <ChevronUp className="h-4 w-4" aria-hidden="true" />
      ) : (
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      )}
    </div>
  </div>
));

ToolHeader.displayName = "ToolHeader";

export function ToolCall({ toolInvocations }: ToolCallProps) {
  const [expandedTools, setExpandedTools] = React.useState<Record<string, boolean>>({});
  
  const processedToolsRef = React.useRef<Set<string>>(new Set());
  const toolInvocationsRef = React.useRef(toolInvocations);
  const prevToolCount = React.useRef<number>(0);

  // Log when new tool invocations are received
  React.useEffect(() => {
    if (!toolInvocations?.length) return;
    
    toolInvocations.forEach((invocation, index) => {
      const toolId = `${invocation.toolName}-${index}`;
      logToolVisibility(invocation.toolName, toolId, `RECEIVED with state=${invocation.state}`);
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
          logToolVisibility(invocation.toolName, toolId, 
            shouldExpand ? "ADDED AS EXPANDED" : "ADDED AS COLLAPSED");
        }
      });
      
      // Update the expanded state
      setExpandedTools(newExpandedState);
      
      // Update our count reference
      prevToolCount.current = toolInvocations.length;
    }
  }, [toolInvocations]);

  const toggleExpanded = React.useCallback((toolId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTools(prev => ({
      ...prev,
      [toolId]: !prev[toolId]
    }));
  }, []);

  if (!toolInvocations?.length) return null;

  return (
    <div 
      className="flex flex-col gap-3 w-full"
      role="region"
      aria-label="Tool invocation results"
    >
      {toolInvocations.map((invocation, index) => {
        const toolId = `${invocation.toolName}-${index}`;
        const isExpanded = expandedTools[toolId] !== false;
        const isImageGeneration = invocation.toolName === 'generate_image';
        const isNewestTool = index === toolInvocations.length - 1;

        // Handle loading state
        if (invocation.state === "partial-call" || invocation.state === "call") {
          return <LoadingToolCall key={toolId} toolName={invocation.toolName} toolId={toolId} />;
        }

        // Handle result state
        if (invocation.state === "result") {
          // Process image generation results
          if (isImageGeneration && invocation.result) {
            const result = invocation.result;
            const isErrorMessage = typeof result === 'string' && !result.startsWith('http') && !result.startsWith('data:');
            
            let imageData = null;
            let prompt = "";
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
            
            return (
              <div
                key={toolId}
                className={cn(
                  chatBubbleVariants,
                  isNewestTool && recentToolClass,
                  "transition-all duration-300"
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
                  <div className="text-foreground mt-2 transition-all duration-300">
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
          
          // For all other tools with results
          let content = '';
          let toolType = '';
          let isCognitiveTool = false;
          let isEmptyResult = false;
          
          // Extract content and type from result
          if (typeof invocation.result === 'object' && invocation.result) {
            if ('content' in invocation.result) {
              content = invocation.result.content;
            }
            if ('type' in invocation.result) {
              toolType = invocation.result.type;
              
              // Check if this is a cognitive tool (think or reflect)
              isCognitiveTool = toolType === 'think_result' || toolType === 'reflect_result';
              
              // For cognitive tools, check if this is an empty result or contains only placeholder text
              if (isCognitiveTool && content) {
                // Check for placeholder text that indicates loading state
                const hasPlaceholder = content.includes('Processing thoughts...') || 
                                      content.includes('Processing reflection...');
                
                isEmptyResult = hasPlaceholder;
                
                // Log detected empty cognitive tool result
                if (isEmptyResult) {
                  logToolVisibility(invocation.toolName, toolId, 
                    `DETECTED PLACEHOLDER CONTENT (showing loading state instead)`);
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
            return <LoadingToolCall key={toolId} toolName={invocation.toolName} toolId={toolId} />;
          }
          
          return (
            <div
              key={toolId}
              className={cn(
                chatBubbleVariants,
                isNewestTool && recentToolClass,
                "transition-all duration-300"
              )}
            >
              <ToolHeader 
                toolName={invocation.toolName}
                isExpanded={isExpanded}
                isNewest={isNewestTool}
                toggleExpanded={(e) => toggleExpanded(toolId, e)}
              />
              
              {isExpanded && (
                <div className="mt-3 relative group/tool-content">
                  <MarkdownRenderer>{content}</MarkdownRenderer>
                  <div className="invisible absolute bottom-0 right-0 -mb-2.5 -mr-2 opacity-0 transition-all duration-200 group-hover/tool-content:visible group-hover/tool-content:opacity-100">
                    <CopyButton content={content} copyMessage="Copied tool result to clipboard" size="small" />
                  </div>
                </div>
              )}
            </div>
          );
        }
        
        // Fallback for unknown states
        return null;
      })}
    </div>
  );
} 