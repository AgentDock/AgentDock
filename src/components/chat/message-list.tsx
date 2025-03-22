"use client"

import * as React from "react"
import { type Message } from "agentdock-core/client"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { ChatMessage } from "@/components/chat/chat-message"
import { TypingIndicator } from "@/components/chat/typing-indicator"

// TODO: Improve streaming text animation
// Current implementation relies on server-side smoothStream transform (configured in agentdock-core)
// but doesn't work reliably across different providers or after tool calls.
// Need a better approach that preserves Markdown formatting while animating words.

export interface MessageListProps {
  messages: Message[]
  isTyping?: boolean
}

export function MessageList({ messages, isTyping = false }: MessageListProps) {
  // Memoize the message elements to prevent unnecessary rerenders
  const messageElements = React.useMemo(() => {
    if (messages.length === 0) {
      return null
    }

    return messages.map((message, index) => {
      // Format the timestamp for improved readability
      const formattedTime = message.createdAt
        ? formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })
        : undefined

      // Check if the next message is from the same sender to determine whether to show timestamp
      const showTimeStamp = messages[index + 1]?.role !== message.role

      return (
        <ChatMessage
          key={message.id || index}
          {...message}
          showTimeStamp={showTimeStamp}
          animation="fade"
        />
      )
    })
  }, [messages])

  // Memoize the typing indicator to prevent unnecessary rerenders
  const typingIndicator = React.useMemo(() => {
    if (!isTyping) return null
    
    return (
      <div className="group flex items-start gap-x-3">
        <TypingIndicator />
      </div>
    )
  }, [isTyping])

  return (
    <div className="flex flex-col gap-3" role="log" aria-live="polite" aria-atomic="false">
      {messageElements}
      {typingIndicator}
    </div>
  )
} 