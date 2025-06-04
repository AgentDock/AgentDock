'use client';

import React, { useEffect, useRef } from 'react';

import type { Message } from 'agentdock-core/client';

import { ChatMessage } from '@/components/chat/chat-message';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { cn } from '@/lib/utils';

// TODO: Improve streaming text animation
// Current implementation relies on server-side smoothStream transform (configured in agentdock-core)
// but doesn't work reliably across different providers or after tool calls.
// Need a better approach that preserves Markdown formatting while animating words.

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading = false }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep a ref to identify the last message as potentially streaming
  const lastMessageIndexRef = useRef<number>(-1);

  // Update scroll position when new messages arrive or loading state changes
  useEffect(() => {
    if (containerRef.current) {
      // Use a small timeout to ensure DOM is updated
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      }, 50);
    }
    // Update the last message index
    lastMessageIndexRef.current = messages.length - 1;
  }, [messages, isLoading]);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col gap-6 bg-background"
    >
      {messages.map((message, index) => {
        // Check if this is the last message (potentially streaming)
        const isStreaming =
          isLoading &&
          index === lastMessageIndexRef.current &&
          message.role === 'assistant';

        return (
          <ChatMessage
            key={index}
            role={message.role}
            content={message.content || ''}
            experimental_attachments={message.experimental_attachments}
            toolInvocations={message.toolInvocations}
            animation={index === messages.length - 1 ? 'fade' : 'none'}
            showTimeStamp
            isStreaming={isStreaming}
          />
        );
      })}

      {/* Show typing indicator when loading and last message is from user */}
      {isLoading &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && <TypingIndicator />}
    </div>
  );
}
