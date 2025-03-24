"use client"

import React, { useMemo } from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { FilePreview } from "@/components/chat/file-preview"
import { ToolCall } from "@/components/chat/tool-call"
import type { ChatMessageProps, Animation } from "@/components/chat/types"
import type { Message } from "agentdock-core/client"
import { CopyButton } from "@/components/ui/copy-button"
import { motion } from "framer-motion"

// Keep the chat bubble styling
const chatBubbleVariants = cva(
  "group/message relative break-words rounded-3xl p-4 text-sm sm:max-w-[70%]",
  {
    variants: {
      isUser: {
        true: "bg-primary text-primary-foreground",
        false: "bg-muted text-foreground",
      },
      animation: {
        none: "",
        fade: "",
        slideIn: "",
        bounce: "",
      },
    },
  }
)

// Animation variants for different animation types
const messageAnimationVariants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
    }
  },
  slideIn: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 500,
      damping: 30,
    }
  },
  bounce: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 700,
      damping: 25,
    }
  }
}

// Helper function to convert data URL to a Uint8Array
function dataUrlToUint8Array(data: string) {
  const base64 = data.split(",")[1]
  const buf = Buffer.from(base64, "base64")
  return new Uint8Array(buf)
}

// Subcomponent for the timestamp display
const MessageTimestamp = React.memo(({ 
  createdAt, 
  isUser, 
  animation 
}: { 
  createdAt?: Date | number | string;
  isUser: boolean;
  animation?: Animation;
}) => {
  // Skip rendering if no createdAt value
  if (!createdAt) return null;
  
  try {
    const date = new Date(createdAt);
    const formattedTime = date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    
    return (
      <time
        dateTime={date.toISOString()}
        className="mt-1 block px-1 text-xs opacity-50"
        aria-label={`Message sent at ${formattedTime}`}
      >
        {formattedTime}
      </time>
    );
  } catch (error) {
    console.error("Error formatting time:", error);
    return null;
  }
});

MessageTimestamp.displayName = "MessageTimestamp";

// Actions container component to avoid duplication
const ActionsContainer = React.memo(({ 
  isUser, 
  content, 
  children 
}: { 
  isUser: boolean;
  content?: string;
  children: React.ReactNode;
}) => {
  if (isUser) return null;
  
  return (
    <div className="absolute -bottom-4 right-2 flex space-x-1 rounded-lg border bg-background p-1 text-foreground opacity-0 transition-opacity group-hover/message:opacity-100">
      {children}
    </div>
  );
});

ActionsContainer.displayName = "ActionsContainer";

// Main message component
export const ChatMessage = React.memo(React.forwardRef<HTMLDivElement, ChatMessageProps>(({
  role,
  content,
  createdAt,
  showTimeStamp = false,
  animation = "fade",
  actions,
  className,
  experimental_attachments,
  toolInvocations,
}, ref) => {
  // Convert attachments to File objects
  const files = useMemo(() => {
    if (!experimental_attachments) return undefined;
    return experimental_attachments.map((attachment) => {
      const dataArray = dataUrlToUint8Array(attachment.url);
      const file = new File([dataArray], attachment.name ?? "Unknown", {
        type: attachment.contentType
      });
      return file;
    });
  }, [experimental_attachments]);

  const isUser = role === "user";
  
  // Shared content for copy button
  const copyButtonContent = useMemo(() => {
    return content || "";
  }, [content]);

  // Select animation variant based on animation prop
  const animationVariant = useMemo(() => {
    switch (animation) {
      case "slideIn": return messageAnimationVariants.slideIn;
      case "bounce": return messageAnimationVariants.bounce;
      case "fade": return messageAnimationVariants.animate;
      default: return {};
    }
  }, [animation]);

  // Handle messages with tool calls
  if (role === "assistant" && toolInvocations && toolInvocations.length > 0) {
    // If there's no content, just render the tool calls
    if (!content || !content.trim()) {
      return (
        <motion.div 
          ref={ref} 
          className={cn("flex flex-col", isUser ? "items-end" : "items-start", className)}
          role="group"
          aria-label={`${isUser ? "User" : "Assistant"} message with tool calls`}
          initial={animation !== "none" ? messageAnimationVariants.initial : {}}
          animate={animation !== "none" ? animationVariant : {}}
        >
          <ToolCall toolInvocations={toolInvocations} />
          {showTimeStamp && <MessageTimestamp createdAt={createdAt} isUser={isUser} animation={animation} />}
          {actions && <div className="mr-2 flex justify-end">{actions}</div>}
        </motion.div>
      );
    }
    
    // If there's content, render it as a separate visual element after the tool calls
    return (
      <motion.div 
        ref={ref} 
        className={cn("flex flex-col", isUser ? "items-end" : "items-start", className)}
        role="group"
        aria-label={`${isUser ? "User" : "Assistant"} message with tool calls and content`}
        initial={animation !== "none" ? messageAnimationVariants.initial : {}}
        animate={animation !== "none" ? animationVariant : {}}
      >
        <div className="flex flex-col gap-4 w-full">
          {/* First render the tool calls */}
          <ToolCall toolInvocations={toolInvocations} />
          
          {/* Then render the content */}
          <div className={cn(chatBubbleVariants({ isUser: false, animation }), "relative")}>
            <div>
              <MarkdownRenderer>{content}</MarkdownRenderer>
            </div>
            {!isUser && content && (
              <ActionsContainer isUser={isUser} content={content}>
                <CopyButton content={copyButtonContent} copyMessage="Message copied to clipboard" />
              </ActionsContainer>
            )}
          </div>
        </div>
        
        {showTimeStamp && <MessageTimestamp createdAt={createdAt} isUser={isUser} animation={animation} />}
        {actions && <div className="mr-2 flex justify-end">{actions}</div>}
      </motion.div>
    );
  }

  // Standard message rendering
  return (
    <motion.div 
      ref={ref} 
      className={cn("flex flex-col", isUser ? "items-end" : "items-start", className)}
      role="group"
      aria-label={`${isUser ? "User" : "Assistant"} message`}
      initial={animation !== "none" ? messageAnimationVariants.initial : {}}
      animate={animation !== "none" ? animationVariant : {}}
    >
      {/* Render file previews if attachments are present */}
      {files && files.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-2">
          {files.map((file, index) => {
            if (file.type.startsWith("image/")) {
              // Special handling for images to make them much larger
              return (
                <div key={index} className="relative">
                  <img
                    src={URL.createObjectURL(file)}
                    alt="Uploaded image"
                    className="max-w-full h-auto rounded-lg border border-border"
                    style={{ 
                      maxHeight: "400px", // Allow large images but cap the maximum height
                      minWidth: "200px"   // Ensure small images are still reasonably sized
                    }}
                  />
                  {/* We don't show a filename for the larger images */}
                </div>
              );
            }
            // For non-image files, use the regular FilePreview
            return <FilePreview file={file} key={index} />;
          })}
        </div>
      )}
      
      <div
        className={cn(chatBubbleVariants({
          isUser,
          animation,
        }), "relative")}
      >
        <div className="[&::-webkit-details-marker]:hidden">
          {content ? (
            <MarkdownRenderer>{content}</MarkdownRenderer>
          ) : null}
        </div>
        {!isUser && content && (
          <ActionsContainer isUser={isUser} content={content}>
            <CopyButton content={copyButtonContent} copyMessage="Message copied to clipboard" />
          </ActionsContainer>
        )}
      </div>
      
      {showTimeStamp && <MessageTimestamp createdAt={createdAt} isUser={isUser} animation={animation} />}
      {actions && <div className="mr-2 flex justify-end">{actions}</div>}
    </motion.div>
  )
}));

ChatMessage.displayName = "ChatMessage"; 