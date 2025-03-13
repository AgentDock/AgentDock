import {
  ChatMessage,
  type ChatMessageProps,
  type Message,
} from "@/components/ui/chat-message"
import { TypingIndicator } from "@/components/ui/typing-indicator"
import { CopyButton } from "@/components/ui/copy-button"
import { cn } from "@/lib/utils"
import React from "react"

type AdditionalMessageOptions = Omit<ChatMessageProps, keyof Message>

interface MessageListProps {
  messages: Message[]
  showTimeStamps?: boolean
  isTyping?: boolean
  messageOptions?:
    | AdditionalMessageOptions
    | ((message: Message) => AdditionalMessageOptions)
  className?: string
}

// Memoized message component to prevent unnecessary re-renders
const MemoizedChatMessage = React.memo(ChatMessage);

export function MessageList({
  messages,
  showTimeStamps = true,
  isTyping = false,
  messageOptions,
  className,
}: MessageListProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {messages.map((message, _index) => {
        const defaultOptions = {
          actions: message.role === "assistant" && (
            <div className="flex items-center gap-1">
              <CopyButton
                content={message.content}
                copyMessage="Copied response to clipboard!"
              />
            </div>
          )
        }

        const additionalOptions =
          typeof messageOptions === "function"
            ? messageOptions(message)
            : messageOptions

        return (
          <MemoizedChatMessage
            key={message.id}
            {...message}
            showTimeStamp={showTimeStamps}
            {...defaultOptions}
            {...additionalOptions}
          />
        )
      })}
      {isTyping && (
        <div className="flex items-start">
          <div className={cn(
            "group/message relative break-words rounded-lg p-3 text-sm sm:max-w-[70%]",
            "bg-muted text-foreground",
            "duration-300 animate-in fade-in-0 zoom-in-75",
            "origin-bottom-left"
          )}>
            <TypingIndicator />
          </div>
        </div>
      )}
    </div>
  )
}
