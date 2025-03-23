"use client"

import React from "react"
import { cn } from "@/lib/utils"

/**
 * Animated typing indicator that shows when a message is being generated
 * Uses CSS animations for performance and includes accessibility attributes
 */
export const TypingIndicator = React.memo(() => {
  return (
    <div 
      className={cn(
        "group/message relative break-words rounded-2xl p-4 text-sm sm:max-w-[70%]",
        "bg-muted text-foreground"
      )}
      role="status"
      aria-label="Assistant is typing"
    >
      <div className="flex space-x-1 items-center">
        <div className="h-1.5 w-1.5 rounded-full bg-current opacity-80 animate-typing-1"></div>
        <div className="h-1.5 w-1.5 rounded-full bg-current opacity-80 animate-typing-2"></div>
        <div className="h-1.5 w-1.5 rounded-full bg-current opacity-80 animate-typing-3"></div>
        <span className="sr-only">Assistant is typing...</span>
      </div>
    </div>
  )
})

TypingIndicator.displayName = "TypingIndicator" 