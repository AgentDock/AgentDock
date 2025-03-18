"use client"

import React, { useMemo } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Code2, Loader2, Terminal, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { FilePreview } from "@/components/ui/file-preview"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import type { BaseToolInvocation, ToolState } from 'agentdock-core'

const chatBubbleVariants = cva(
  "group/message relative break-words rounded-lg p-3 text-sm sm:max-w-[70%]",
  {
    variants: {
      isUser: {
        true: "bg-primary text-primary-foreground",
        false: "bg-muted text-foreground",
      },
      animation: {
        none: "",
        slide: "duration-300 animate-in fade-in-0",
        scale: "duration-300 animate-in fade-in-0 zoom-in-75",
        fade: "duration-500 animate-in fade-in-0",
      },
    },
    compoundVariants: [
      {
        isUser: true,
        animation: "slide",
        class: "slide-in-from-right",
      },
      {
        isUser: false,
        animation: "slide",
        class: "slide-in-from-left",
      },
      {
        isUser: true,
        animation: "scale",
        class: "origin-bottom-right",
      },
      {
        isUser: false,
        animation: "scale",
        class: "origin-bottom-left",
      },
    ],
  }
)

type Animation = VariantProps<typeof chatBubbleVariants>["animation"]

interface Attachment {
  name?: string
  contentType?: string
  url: string
}

// Custom ToolInvocation type that extends BaseToolInvocation with the additional properties needed
type ToolInvocation = Omit<BaseToolInvocation, 'state'> & {
  state: ToolState | 'partial-call';
  result?: {
    content?: string;
    [key: string]: any;
  } | any;
}

export interface Message {
  id: string
  role: "user" | "assistant" | (string & {})
  content: string
  createdAt?: Date
  experimental_attachments?: Attachment[]
  toolInvocations?: ToolInvocation[]
}

export interface ChatMessageProps extends Message {
  showTimeStamp?: boolean
  animation?: Animation
  actions?: React.ReactNode
  className?: string
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  role,
  content,
  createdAt,
  showTimeStamp = false,
  animation = "scale",
  actions,
  className,
  experimental_attachments,
  toolInvocations,
}) => {
  const files = useMemo(() => {
    if (!experimental_attachments) return undefined;
    return experimental_attachments.map((attachment) => {
      const dataArray = dataUrlToUint8Array(attachment.url)
      const file = new File([dataArray], attachment.name ?? "Unknown")
      return file
    })
  }, [experimental_attachments]);

  const formattedTime = useMemo(() => {
    if (!createdAt) return null;
    try {
      const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
      return {
        formatted: date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit"
        }),
        iso: date.toISOString()
      };
    } catch (error) {
      console.error('Error formatting time:', error);
      return null;
    }
  }, [createdAt]);

  const isUser = role === "user";

  // Handle messages with tool calls
  if (role === "assistant" && toolInvocations && toolInvocations.length > 0) {
    // If there's no content, just render the tool calls
    if (!content || !content.trim()) {
      return (
        <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
          <ToolCall toolInvocations={toolInvocations} />
          {showTimeStamp && formattedTime ? (
            <time
              dateTime={formattedTime.iso}
              className={cn(
                "mt-1 block px-1 text-xs opacity-50",
                animation !== "none" && "duration-500 animate-in fade-in-0"
              )}
            >
              {formattedTime.formatted}
            </time>
          ) : null}
        </div>
      );
    }
    
    // If there's content, render it as a separate visual element after the tool calls
    return (
      <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
        <div className="flex flex-col gap-4 w-full">
          {/* First render the tool calls */}
          <ToolCall toolInvocations={toolInvocations} />
          
          {/* Then render the content */}
          <div className={cn(chatBubbleVariants({ isUser: false, animation }), className)}>
            <div>
              <MarkdownRenderer>{content}</MarkdownRenderer>
            </div>
            {actions ? (
              <div className="absolute -bottom-4 right-2 flex space-x-1 rounded-lg border bg-background p-1 text-foreground opacity-0 transition-opacity group-hover/message:opacity-100">
                {actions}
              </div>
            ) : null}
          </div>
        </div>
        
        {showTimeStamp && formattedTime ? (
          <time
            dateTime={formattedTime.iso}
            className={cn(
              "mt-1 block px-1 text-xs opacity-50",
              animation !== "none" && "duration-500 animate-in fade-in-0"
            )}
          >
            {formattedTime.formatted}
          </time>
        ) : null}
      </div>
    );
  }

  // Standard message rendering
  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      {files ? (
        <div className="mb-1 flex flex-wrap gap-2">
          {files.map((file, index) => {
            return <FilePreview file={file} key={index} />
          })}
        </div>
      ) : null}

      <div className={cn(chatBubbleVariants({ isUser, animation }), className)}>
        <div>
          <MarkdownRenderer>{content}</MarkdownRenderer>
        </div>

        {role === "assistant" && actions ? (
          <div className="absolute -bottom-4 right-2 flex space-x-1 rounded-lg border bg-background p-1 text-foreground opacity-0 transition-opacity group-hover/message:opacity-100">
            {actions}
          </div>
        ) : null}
      </div>

      {showTimeStamp && formattedTime ? (
        <time
          dateTime={formattedTime.iso}
          className={cn(
            "mt-1 block px-1 text-xs opacity-50",
            animation !== "none" && "duration-500 animate-in fade-in-0"
          )}
        >
          {formattedTime.formatted}
        </time>
      ) : null}
    </div>
  )
}

function dataUrlToUint8Array(data: string) {
  const base64 = data.split(",")[1]
  const buf = Buffer.from(base64, "base64")
  return new Uint8Array(buf)
}

export function ToolCall({
  toolInvocations,
}: Pick<ChatMessageProps, "toolInvocations">) {
  const [expandedTools, setExpandedTools] = React.useState<Record<string, boolean>>({});
  
  const processedToolsRef = React.useRef<Set<string>>(new Set());
  const toolInvocationsRef = React.useRef(toolInvocations);

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
    
    // Use a timeout to debounce updates and prevent rapid state changes
    const timeoutId = setTimeout(() => {
      // Create a new expanded state object without relying on previous state
      const newExpandedState = { ...expandedTools };
      
      let hasNewTools = false;
      
      toolInvocations.forEach((invocation, index) => {
        const toolId = `${invocation.toolName}-${index}`;
        
        // Only set state for new tools, preserve existing state for others
        if (!processedToolsRef.current.has(toolId)) {
          newExpandedState[toolId] = true;
          processedToolsRef.current.add(toolId);
          hasNewTools = true;
        }
      });
      
      // Only update state if we actually have new tools
      if (hasNewTools) {
        setExpandedTools(newExpandedState);
      }
    }, 50); // Small debounce of 50ms
    
    // Clean up the timeout on unmount or when dependencies change
    return () => clearTimeout(timeoutId);
  }, [toolInvocations]); // Remove expandedTools dependency to avoid cascading updates

  const toggleExpanded = React.useCallback((toolId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTools(prev => ({
      ...prev,
      [toolId]: !prev[toolId]
    }));
  }, []);

  if (!toolInvocations?.length) return null

  return (
    <div className="flex flex-col gap-3 w-full">
      {toolInvocations.map((invocation, index) => {
        const toolId = `${invocation.toolName}-${index}`;
        const isExpanded = expandedTools[toolId] !== false;

        switch (invocation.state) {
          case "partial-call":
          case "call":
            return (
              <div
                key={index}
                className={cn(chatBubbleVariants({ isUser: false, animation: "none" }), "flex items-center gap-2 text-muted-foreground")}
              >
                <Terminal className="h-4 w-4" />
                <span>Calling {invocation.toolName}...</span>
                <Loader2 className="h-3 w-3 animate-spin" />
              </div>
            )
          case "result":
            if (invocation.result && typeof invocation.result === 'object' && 'content' in invocation.result) {
              return (
                <div
                  key={index}
                  className={cn(chatBubbleVariants({ isUser: false, animation: "none" }))}
                >
                  <div 
                    className="flex items-center justify-between text-muted-foreground cursor-pointer w-full"
                    onClick={(e) => toggleExpanded(toolId, e)}
                  >
                    <div className="flex items-center gap-2">
                      <Code2 className="h-4 w-4" />
                      <span>Result from {invocation.toolName}</span>
                    </div>
                    <div className="p-1 hover:bg-background/50 rounded-md ml-4">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="text-foreground mt-2">
                      <MarkdownRenderer>{invocation.result.content}</MarkdownRenderer>
                    </div>
                  )}
                </div>
              )
            }
            return (
              <div
                key={index}
                className={cn(chatBubbleVariants({ isUser: false, animation: "none" }))}
              >
                <div 
                  className="flex items-center justify-between text-muted-foreground cursor-pointer w-full"
                  onClick={(e) => toggleExpanded(toolId, e)}
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4" />
                    <span>Result from {invocation.toolName}</span>
                  </div>
                  <div className="p-1 hover:bg-background/50 rounded-md ml-4">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <pre className="overflow-x-auto whitespace-pre-wrap text-foreground mt-2">
                    {JSON.stringify(invocation.result, null, 2)}
                  </pre>
                )}
              </div>
            )
        }
      })}
    </div>
  )
}
