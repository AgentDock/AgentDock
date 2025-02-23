"use client"

import { Suspense, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ChatContainer } from "@/components/chat"
import { logger, LogCategory } from 'agentdock-core'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useAgents } from "@/lib/store"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RefreshCw } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { templates, TemplateId } from '@/generated/templates'
import { useChat, Message } from 'ai/react'
import { useChatSettings } from '@/hooks/use-chat-settings'

function ChatPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const rawAgentId = searchParams.get('agent')?.split('?')[0] // Clean agentId
  const agentId = rawAgentId || null // Convert undefined to null
  const chatContainerRef = useRef<{ handleReset: () => Promise<void> }>(null)
  
  // Single hook for all chat settings
  const { 
    settings, 
    isLoading, 
    error, 
    debugMode 
  } = useChatSettings(agentId);

  // Redirect if no agent or invalid agent
  if (!agentId || !templates[agentId as TemplateId]) {
    router.replace('/agents');
    return null;
  }

  const {
    messages,
    setMessages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading: chatIsLoading,
    error: chatError,
    reload,
    stop,
    append
  } = useChat({
    api: `/api/chat/${agentId}`,
    id: agentId,
    headers: {
      'x-api-key': settings?.apiKey || ''
    },
    body: {
      system: settings?.personality,
      temperature: settings?.temperature,
      maxTokens: settings?.maxTokens
    },
    initialMessages: settings?.initialMessages ? 
      settings.initialMessages.map(msg => ({ 
        id: crypto.randomUUID(),
        role: 'assistant' as const, 
        content: msg,
        createdAt: new Date()
      })) : 
      [],
    sendExtraMessageFields: true,
    onResponse: (response) => {
      if (!response.ok) {
        toast.error('Failed to send message');
      }
    },
    onFinish: (message) => {
      try {
        const storageKey = `ai-conversation-${agentId}`;
        localStorage.setItem(storageKey, JSON.stringify(messages));
      } catch (error) {
        logger.error(LogCategory.API, 'ChatPage', 'Failed to save messages');
      }
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const handleReset = async () => {
    try {
      if (chatContainerRef.current) {
        await chatContainerRef.current.handleReset();
      }
    } catch (error) {
      toast.error('Failed to reset chat');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-[600px]">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">Loading chat...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Error Loading Chat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col -m-8 overflow-hidden">
      <ChatContainer
        ref={chatContainerRef}
        className="flex-1"
        header={
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{settings?.name}</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              className="h-8 w-8"
              title="Reset Chat"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
        agentId={agentId}
      />

      {debugMode && settings && (
        <footer className="flex-none border-t bg-muted/50">
          <div className="mx-auto max-w-4xl">
            <ScrollArea className="h-40">
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Debug Information</h3>
                  <Badge variant="outline">Debug Mode</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Model</p>
                    <p className="text-muted-foreground">{settings.model}</p>
                  </div>
                  <div>
                    <p className="font-medium">Temperature</p>
                    <p className="text-muted-foreground">{settings.temperature}</p>
                  </div>
                  <div>
                    <p className="font-medium">Max Tokens</p>
                    <p className="text-muted-foreground">{settings.maxTokens}</p>
                  </div>
                  <div>
                    <p className="font-medium">Message Count</p>
                    <p className="text-muted-foreground">{messages.length}</p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </footer>
      )}
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatPageContent />
    </Suspense>
  )
} 