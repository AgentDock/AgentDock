"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { MessageList } from "@/components/chat/message-list"
import { MessageInput } from "@/components/chat/message-input"
import { PromptSuggestions } from "@/components/chat/prompt-suggestions"
import { Button } from "@/components/ui/button"
import { ArrowDown } from "lucide-react"
import { Message, CreateMessage } from "agentdock-core/client"

// Helper function to create a FileList from an array of Files
function createFileList(files: File[]): FileList {
  const dataTransfer = new DataTransfer()
  files.forEach(file => dataTransfer.items.add(file))
  return dataTransfer.files
}

export interface ChatProps {
  messages: Message[]
  input: string
  handleInputChange: (value: string) => void
  handleSubmit: (event: React.FormEvent<HTMLFormElement>, options?: { experimental_attachments?: FileList }) => void
  isGenerating: boolean
  isTyping: boolean
  stop: () => void
  append: (message: Message | CreateMessage) => void | Promise<string | null | undefined>
  suggestions?: string[]
  className?: string
  header?: React.ReactNode
  agentName: string
  agent: string
}

export function Chat({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isGenerating,
  isTyping,
  stop,
  append,
  suggestions,
  className,
  header,
  agentName,
  agent,
}: ChatProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [isNearBottom, setIsNearBottom] = React.useState(true)
  const [showScrollButton, setShowScrollButton] = React.useState(false)
  const [files, setFiles] = React.useState<File[] | null>(null)
  const messagesRef = React.useRef<Message[]>(messages)
  
  // Memoized values
  const hasSuggestions = React.useMemo(() => {
    return suggestions && suggestions.length > 0 && messages.length === 0
  }, [suggestions, messages.length])

  const hasMessages = React.useMemo(() => {
    return messages.length > 0
  }, [messages.length])

  // Process messages (no special handling for think tool needed)
  const processedMessages = React.useMemo(() => {
    return messages
  }, [messages])

  // Scroll handling functions
  const scrollToBottom = React.useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [])

  // Performance optimized scroll handler with debounce
  const handleScroll = React.useCallback(() => {
    if (!scrollContainerRef.current) return
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    const scrollBottom = scrollHeight - scrollTop - clientHeight
    const threshold = 100 // pixels from bottom to consider "near bottom"
    
    const nearBottom = scrollBottom < threshold
    setIsNearBottom(nearBottom)
    setShowScrollButton(!nearBottom)
  }, [])

  // Handle input change
  const onInputChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e.target.value)
  }, [handleInputChange])

  // Optimized form submission handler
  const onFormSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      
      if (files && files.length > 0) {
        // For file submissions, convert File[] to FileList
        const fileList = createFileList(files)
        handleSubmit(event, { experimental_attachments: fileList })
        // Reset files after submission
        setFiles(null)
      } else {
        // For text-only submissions
        handleSubmit(event)
      }
      
      // When a user submits a message, scroll to bottom and mark as near bottom
      setTimeout(() => {
        scrollToBottom()
        setIsNearBottom(true)
      }, 100)
    },
    [handleSubmit, scrollToBottom, files]
  )

  // Scroll to bottom when new messages arrive if we're near the bottom
  React.useEffect(() => {
    if (isNearBottom && hasMessages) {
      scrollToBottom()
    }
  }, [messages, isNearBottom, hasMessages, scrollToBottom])

  // Update messagesRef when messages change
  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <style jsx global>{`
        .scrollbar-container::-webkit-scrollbar {
          width: 8px;
          height: 100%;
        }
        .scrollbar-container::-webkit-scrollbar-track {
          background: transparent;
          height: 100%;
        }
        .scrollbar-container::-webkit-scrollbar-thumb {
          background-color: rgba(155, 155, 155, 0.9);
          border-radius: 20px;
          height: auto;
        }
        .scrollbar-container::-webkit-scrollbar-thumb:hover {
          background-color: rgba(155, 155, 155, 0.9);
        }
        .scrollbar-container::-webkit-scrollbar-thumb:active {
          background-color: rgba(155, 155, 155, 0.9);
        }
      `}</style>
      
      <div className="flex-none bg-background">
        <div className="mx-auto w-full max-w-4xl px-4 py-3">
          {header}
        </div>
      </div>
      
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-container h-full min-h-0"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(155, 155, 155, 0.9) transparent',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
        aria-label="Chat conversation"
      >
        <div className="mx-auto w-full max-w-4xl px-4 py-4">
          {hasSuggestions ? (
            <div className="flex h-full items-center justify-center py-20">
              <PromptSuggestions 
                label="Try these prompts ✨" 
                suggestions={suggestions!} 
                append={append} 
              />
            </div>
          ) : (
            <MessageList messages={processedMessages} isTyping={isTyping} />
          )}
        </div>
      </div>
      
      {showScrollButton && (
        <div className="fixed bottom-24 md:right-18 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 z-50">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 rounded-full shadow-lg transition-opacity"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <div className="flex-none bg-background sticky bottom-0 left-0 right-0 z-10">
        <div className="mx-auto w-full max-w-4xl px-4 py-2">
          <form onSubmit={onFormSubmit} className="mx-auto">
            <MessageInput
              value={input}
              onChange={onInputChange}
              placeholder="Ask AI..."
              disabled={isGenerating}
              stop={stop}
              isGenerating={isGenerating}
              allowAttachments={true}
              files={files}
              setFiles={setFiles}
              submitOnEnter={true}
            />
          </form>
        </div>
      </div>
    </div>
  )
} 