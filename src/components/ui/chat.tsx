"use client"

import { forwardRef, useCallback, useState, type ReactElement } from "react"
import { ArrowDown, ThumbsDown, ThumbsUp } from "lucide-react"
import React from "react"

import { cn } from "@/lib/utils"
import { useAutoScroll } from "@/hooks/use-auto-scroll"
import { Button } from "@/components/ui/button"
import { type Message } from "@/components/ui/chat-message"
import { CopyButton } from "@/components/ui/copy-button"
import { MessageInput } from "@/components/ui/message-input"
import { MessageList } from "@/components/ui/message-list"
import { PromptSuggestions } from "@/components/ui/prompt-suggestions"

interface ChatPropsBase {
  handleSubmit: (
    event?: { preventDefault?: () => void },
    options?: { experimental_attachments?: FileList }
  ) => void
  messages: Array<Message>
  input: string
  className?: string
  handleInputChange: React.ChangeEventHandler<HTMLTextAreaElement>
  isGenerating: boolean
  stop?: () => void
  onRateResponse?: (
    messageId: string,
    rating: "thumbs-up" | "thumbs-down"
  ) => void
  header?: React.ReactNode
}

interface ChatPropsWithoutSuggestions extends ChatPropsBase {
  append?: never
  suggestions?: never
}

interface ChatPropsWithSuggestions extends ChatPropsBase {
  append: (message: { role: "user"; content: string }) => void
  suggestions: string[]
}

type ChatProps = ChatPropsWithoutSuggestions | ChatPropsWithSuggestions

export function Chat({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isGenerating,
  stop,
  append,
  suggestions,
  className,
  header
}: ChatProps) {
  const isEmpty = messages.length === 0
  const lastMessage = messages.at(-1)
  const isTyping = lastMessage?.role === "user"
  const {
    containerRef,
    scrollToBottom,
    handleScroll,
    shouldAutoScroll,
    handleTouchStart,
  } = useAutoScroll([messages])

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex-none bg-background">
        <div className="mx-auto w-full max-w-4xl px-4 py-3">
          {header}
        </div>
      </div>
      <div 
        className="flex-1 overflow-y-auto" 
        ref={containerRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
      >
        <div className="mx-auto w-full max-w-4xl px-4 py-4">
          {isEmpty && append && suggestions ? (
            <div className="flex h-full items-center justify-center py-20">
              <PromptSuggestions
                label="Try these prompts ✨"
                append={append}
                suggestions={suggestions}
              />
            </div>
          ) : (
            <MessageList
              messages={messages}
              isTyping={isTyping}
            />
          )}
        </div>
        
        {!shouldAutoScroll && (
          <div className="absolute bottom-4 right-4">
            <Button
              onClick={scrollToBottom}
              size="icon"
              variant="secondary"
              className="h-8 w-8 rounded-full shadow-lg transition-opacity"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <div className="flex-none bg-background">
        <div className="mx-auto w-full max-w-4xl px-4 py-4">
          <ChatForm
            isPending={isGenerating || isTyping}
            handleSubmit={handleSubmit}
          >
            {({ files, setFiles }) => (
              <MessageInput
                value={input}
                onChange={handleInputChange}
                allowAttachments
                files={files}
                setFiles={setFiles}
                stop={stop}
                isGenerating={isGenerating}
                placeholder="Ask AI..."
              />
            )}
          </ChatForm>
        </div>
      </div>
    </div>
  )
}
Chat.displayName = "Chat"

export function ChatMessages({
  messages,
  children,
}: React.PropsWithChildren<{
  messages: Message[]
}>) {
  const {
    containerRef,
    scrollToBottom,
    handleScroll,
    shouldAutoScroll,
    handleTouchStart,
  } = useAutoScroll([messages])

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      ref={containerRef}
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
    >
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

      {!shouldAutoScroll && (
        <div className="absolute bottom-4 right-4">
          <Button
            onClick={scrollToBottom}
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-full shadow-lg transition-opacity"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

export const ChatContainer = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("grid max-h-full w-full grid-rows-[1fr_auto]", className)}
      {...props}
    />
  )
})
ChatContainer.displayName = "ChatContainer"

interface ChatFormProps {
  className?: string
  isPending: boolean
  handleSubmit: (
    event?: { preventDefault?: () => void },
    options?: { experimental_attachments?: FileList }
  ) => void
  children: (props: {
    files: File[] | null
    setFiles: React.Dispatch<React.SetStateAction<File[] | null>>
  }) => ReactElement
}

export const ChatForm = forwardRef<HTMLFormElement, ChatFormProps>(
  ({ children, handleSubmit, isPending, className }, ref) => {
    const [files, setFiles] = useState<File[] | null>(null)

    const onSubmit = (event: React.FormEvent) => {
      if (!files) {
        handleSubmit(event)
        return
      }

      const fileList = createFileList(files)
      handleSubmit(event, { experimental_attachments: fileList })
      setFiles(null)
    }

    return (
      <form ref={ref} onSubmit={onSubmit} className={className}>
        {children({ files, setFiles })}
      </form>
    )
  }
)
ChatForm.displayName = "ChatForm"

function createFileList(files: File[] | FileList): FileList {
  const dataTransfer = new DataTransfer()
  for (const file of Array.from(files)) {
    dataTransfer.items.add(file)
  }
  return dataTransfer.files
}
