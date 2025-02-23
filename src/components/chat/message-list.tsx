"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Message as CoreMessage, TextContent, isMultipartContent } from "agentdock-core"

// UI-specific message type that excludes system messages
interface UIMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  createdAt?: Date;
}

interface MessageListProps {
  messages: CoreMessage[];
  className?: string;
}

const BOT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0xMiAxNXYyIi8+PHJlY3QgeD0iOSIgeT0iNyIgd2lkdGg9IjYiIGhlaWdodD0iNCIgcng9IjEiLz48cGF0aCBkPSJNNSAyMnYtMmE3IDcgMCAwIDEgMTQgMHYySDV6Ii8+PC9zdmc+';
const USER_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0xOSAyMUg1YTIgMiAwIDAgMS0yLTJWNWEyIDIgMCAwIDEgMi0yaDE0YTIgMiAwIDAgMSAyIDJ2MTRhMiAyIDAgMCAxLTIgMnoiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjkiIHI9IjMiLz48cGF0aCBkPSJNMTcuNSAxN2EzLjUgMy41IDAgMCAwLTctMCIvPjwvc3ZnPg==';

function getMessageContent(message: CoreMessage): string {
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (isMultipartContent(message.content)) {
    return message.content
      .filter((part): part is TextContent => part.type === 'text')
      .map(part => part.text)
      .join('\n');
  }
  return '';
}

export function MessageList({ messages, className }: MessageListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll when messages change
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="flex flex-col gap-4 p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "group relative flex items-start gap-3",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.role === "assistant" && (
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={BOT_AVATAR} alt="AI Assistant" />
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
            )}
            <div
              className={cn(
                "rounded-xl px-4 py-3 max-w-[85%] text-sm",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              <p className="leading-relaxed whitespace-pre-wrap break-words">
                {getMessageContent(message)}
              </p>
              {message.createdAt && (
                <div className="mt-1 select-none text-[10px] opacity-50">
                  {new Date(message.createdAt).toLocaleTimeString()}
                </div>
              )}
            </div>
            {message.role === "user" && (
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={USER_AVATAR} alt="User" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
    </ScrollArea>
  )
} 