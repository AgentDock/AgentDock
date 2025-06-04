'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

import { ChatMarkdown } from '@/components/chat/chat-markdown';
import { FilePreview } from '@/components/chat/file-preview';
import { ToolCall } from '@/components/chat/tool-call';
import type { Animation, ChatMessageProps } from '@/components/chat/types';
import { CopyButton } from '@/components/ui/copy-button';
import { cn } from '@/lib/utils';

// Animation variants for different animation types
const messageAnimationVariants = {
  initial: {
    opacity: 0,
    y: 10
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3
    }
  },
  slideIn: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30
    }
  },
  bounce: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 700,
      damping: 25
    }
  }
};

// Helper function to convert data URL to a Uint8Array
function dataUrlToUint8Array(data: string) {
  const base64 = data.split(',')[1];
  const buf = Buffer.from(base64, 'base64');
  return new Uint8Array(buf);
}

// Subcomponent for the timestamp display
const MessageTimestamp = React.memo(
  ({
    createdAt,
    isUser
  }: {
    createdAt?: Date | number | string;
    isUser: boolean;
  }) => {
    // Skip rendering if no createdAt value
    if (!createdAt) return null;

    try {
      const date = new Date(createdAt);
      const formattedTime = date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit'
      });

      return (
        <time
          dateTime={date.toISOString()}
          className="mt-1 block px-1 text-xs text-foreground/50"
          aria-label={`Message sent at ${formattedTime}`}
        >
          {formattedTime}
        </time>
      );
    } catch (error) {
      console.error('Error formatting time:', error);
      return null;
    }
  }
);

MessageTimestamp.displayName = 'MessageTimestamp';

// Message Bubble component to avoid duplication
const MessageBubble = React.memo(
  ({
    children,
    isUser,
    isStreaming,
    messageId,
    content,
    copyButtonContent
  }: {
    children: React.ReactNode;
    isUser: boolean;
    isStreaming?: boolean;
    messageId: string;
    content: string;
    copyButtonContent: string;
  }) => {
    return (
      <div
        className={cn(
          'relative break-words rounded-3xl p-4 text-sm sm:max-w-[70%] group/message',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        <div>
          {content && (
            <ChatMarkdown
              isStreaming={isStreaming}
              messageId={messageId}
            >
              {content}
            </ChatMarkdown>
          )}
        </div>

        {!isUser && content && (
          <div className="absolute -bottom-4 right-2 flex space-x-1 rounded-lg border bg-background p-1 text-foreground opacity-0 transition-opacity group-hover/message:opacity-100">
            <CopyButton
              content={copyButtonContent}
              copyMessage="Message copied to clipboard"
            />
          </div>
        )}
      </div>
    );
  }
);

MessageBubble.displayName = 'MessageBubble';

// Main message component
export const ChatMessage = React.memo(
  React.forwardRef<HTMLDivElement, ChatMessageProps>(
    (
      {
        role,
        content,
        createdAt,
        showTimeStamp = false,
        animation = 'fade',
        actions,
        className,
        experimental_attachments,
        toolInvocations,
        isStreaming = false
      },
      ref
    ) => {
      // Generate a unique ID for this message for mermaid rendering
      const messageId = React.useMemo(
        () => `msg-${Math.random().toString(36).substring(2, 11)}`,
        []
      );

      // Convert attachments to File objects
      const files = useMemo(() => {
        if (!experimental_attachments) return undefined;
        return experimental_attachments.map((attachment) => {
          const dataArray = dataUrlToUint8Array(attachment.url);
          const file = new File([dataArray], attachment.name ?? 'Unknown', {
            type: attachment.contentType
          });
          return file;
        });
      }, [experimental_attachments]);

      const isUser = role === 'user';

      // Shared content for copy button
      const copyButtonContent = useMemo(() => {
        return content || '';
      }, [content]);

      // Select animation variant based on animation prop
      const animationVariant = useMemo(() => {
        switch (animation) {
          case 'slideIn':
            return messageAnimationVariants.slideIn;
          case 'bounce':
            return messageAnimationVariants.bounce;
          case 'fade':
            return messageAnimationVariants.animate;
          default:
            return {};
        }
      }, [animation]);

      // Motion props for consistent animation
      const motionProps = {
        ref,
        className: cn(
          'flex flex-col',
          isUser ? 'items-end' : 'items-start',
          className
        ),
        role: 'group',
        'aria-label': `${isUser ? 'User' : 'Assistant'} message${toolInvocations?.length ? ' with tool calls' : ''}`,
        initial:
          animation !== 'none' ? messageAnimationVariants.initial : undefined,
        animate: animation !== 'none' ? animationVariant : undefined
      };

      // Handle messages with tool calls
      if (
        role === 'assistant' &&
        toolInvocations &&
        toolInvocations.length > 0
      ) {
        // If there's no content, just render the tool calls
        if (!content || !content.trim()) {
          return (
            <motion.div {...motionProps}>
              <ToolCall toolInvocations={toolInvocations} />
              {showTimeStamp && (
                <MessageTimestamp
                  createdAt={createdAt}
                  isUser={isUser}
                />
              )}
              {actions && (
                <div className="mr-2 flex justify-end">{actions}</div>
              )}
            </motion.div>
          );
        }

        // If there's content, render it as a separate visual element after the tool calls
        return (
          <motion.div {...motionProps}>
            <div className="flex flex-col gap-4 w-full">
              {/* First render the tool calls */}
              <ToolCall toolInvocations={toolInvocations} />

              {/* Then render the content */}
              <MessageBubble
                isUser={false}
                isStreaming={isStreaming}
                messageId={messageId}
                content={content}
                copyButtonContent={copyButtonContent}
              >
                <ChatMarkdown
                  isStreaming={isStreaming}
                  messageId={messageId}
                >
                  {content}
                </ChatMarkdown>
              </MessageBubble>
            </div>

            {showTimeStamp && (
              <MessageTimestamp
                createdAt={createdAt}
                isUser={isUser}
              />
            )}
            {actions && <div className="mr-2 flex justify-end">{actions}</div>}
          </motion.div>
        );
      }

      // Standard message rendering
      return (
        <motion.div {...motionProps}>
          {/* Render file previews if attachments are present */}
          {files && files.length > 0 && (
            <div className="mb-1 flex flex-wrap gap-2">
              {files.map((file, index) => {
                if (file.type.startsWith('image/')) {
                  // Special handling for images to make them much larger
                  return (
                    <div
                      key={index}
                      className="relative"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt="Uploaded image"
                        className="max-h-[400px] min-w-[200px] max-w-full h-auto rounded-lg border border-border"
                      />
                    </div>
                  );
                }
                // For non-image files, use the regular FilePreview
                return (
                  <FilePreview
                    file={file}
                    key={index}
                  />
                );
              })}
            </div>
          )}

          {/* Main message bubble */}
          <MessageBubble
            isUser={isUser}
            isStreaming={isStreaming}
            messageId={messageId}
            content={content || ''}
            copyButtonContent={copyButtonContent}
          >
            <ChatMarkdown
              isStreaming={isStreaming}
              messageId={messageId}
            >
              {content || ''}
            </ChatMarkdown>
          </MessageBubble>

          {showTimeStamp && (
            <MessageTimestamp
              createdAt={createdAt}
              isUser={isUser}
            />
          )}
          {actions && <div className="mr-2 flex justify-end">{actions}</div>}
        </motion.div>
      );
    }
  )
);

ChatMessage.displayName = 'ChatMessage';
