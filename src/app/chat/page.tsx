"use client"

import { Suspense, useRef, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ChatContainer } from "@/components/chat"
import { SecureStorage, logger, LogCategory } from 'agentdock-core'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useAgents } from "@/lib/store"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useChat, Message } from 'ai/react'
import { templates, TemplateId, Template } from '@/generated/templates'
import { RefreshCw } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

// Create a single instance for the chat page
const storage = SecureStorage.getInstance('agentdock');

interface AgentSettings {
  name: string;
  description: string;
  model: string;
  tools: string[];
  apiKey: string;
  temperature: string;
  maxTokens: string;
  systemPrompt: string;
  instructions?: string;
}

interface GlobalSettings {
  apiKeys: {
    openai: string;
    anthropic: string;
    serpapi: string;
  };
  core: {
    byokOnly: boolean;
    debugMode?: boolean;
  };
}

interface RuntimeConfig {
  name: string;
  description: string;
  model: string;
  temperature: number;
  maxTokens: number;
  personality?: string;
  chatSettings: {
    initialMessages?: string[];
  };
}

function ChatPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const agentId = searchParams.get('agent')?.split('?')[0] // Clean agentId
  const [agentSettings, setAgentSettings] = useState<AgentSettings | null>(null)
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debugMode, setDebugMode] = useState(false)
  const { initialize } = useAgents()
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);
  const chatContainerRef = useRef<{ handleReset: () => Promise<void> }>(null)

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
    api: agentId ? `/api/chat/${agentId}` : '',
    id: agentId || 'default',
    headers: {
      'x-api-key': globalSettings?.apiKeys?.anthropic || ''
    },
    body: {
      system: runtimeConfig?.personality,
      temperature: runtimeConfig?.temperature,
      maxTokens: runtimeConfig?.maxTokens
    },
    initialMessages: [],
    sendExtraMessageFields: true,
    onResponse: async (response) => {
      if (!response.ok) {
        logger.error(
          LogCategory.API,
          'ChatPage',
          'Failed to send message',
          { status: response.status }
        );
        toast.error('Failed to send message');
      }
    },
    onFinish: async (message) => {
      if (!agentId) return;
      try {
        const updatedMessages = [...messages, message]
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({
            ...m,
            role: m.role === 'system' ? 'assistant' : m.role,
            createdAt: m.createdAt ? new Date(m.createdAt) : new Date()
          }));
        
        const storageKey = `ai-conversation-${agentId}`;
        localStorage.setItem(storageKey, JSON.stringify(updatedMessages));
        setMessages(updatedMessages);
        
        logger.info(
          LogCategory.API,
          'ChatPage',
          'Message processed and saved successfully',
          { 
            messageId: message.id,
            messageCount: updatedMessages.length
          }
        );
      } catch (error) {
        logger.error(
          LogCategory.API,
          'ChatPage',
          'Failed to save messages',
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }
    },
    onError: async (error: Error) => {
      logger.error(
        LogCategory.API,
        'ChatPage',
        'Chat error occurred',
        { error: error.message }
      );
      toast.error(error.message);
    }
  });

  // Handle redirection if no agent is selected
  useEffect(() => {
    if (!agentId) {
      router.replace('/agents')
      return;
    }

    // Validate agentId against available templates
    if (!templates[agentId as TemplateId]) {
      router.replace('/agents')
      toast.error('Invalid agent selected')
    }
  }, [agentId, router])

  // Initialize store and load settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!agentId) return;
      
      try {
        setLoading(true)
        setError(null)

        const bundledTemplate = templates[agentId as TemplateId]
        
        if (!bundledTemplate) {
          throw new Error('Template not found')
        }

        await logger.info(
          LogCategory.SYSTEM,
          'ChatPage',
          'Using bundled template',
          { 
            agentId,
            name: bundledTemplate.name,
            model: bundledTemplate.nodeConfigurations?.['llm.anthropic']?.model
          }
        )

        // Load global settings for API key
        const settings = await storage.get<GlobalSettings>('global_settings');
        if (!settings?.apiKeys?.anthropic) {
          throw new Error('Please add your Anthropic API key in settings to use the chat');
        }
        
        setGlobalSettings(settings);
        setDebugMode(settings.core.debugMode || false);

        // Set runtime config from template
        setRuntimeConfig({
          name: bundledTemplate.name,
          description: bundledTemplate.description,
          model: bundledTemplate.nodeConfigurations?.['llm.anthropic']?.model || "claude-3-opus",
          temperature: bundledTemplate.nodeConfigurations?.['llm.anthropic']?.temperature || 0.7,
          maxTokens: bundledTemplate.nodeConfigurations?.['llm.anthropic']?.maxTokens || 2048,
          personality: bundledTemplate.personality,
          chatSettings: {
            initialMessages: bundledTemplate.chatSettings?.initialMessages ? [...bundledTemplate.chatSettings.initialMessages] : []
          }
        });
        
        setAgentSettings({
          name: bundledTemplate.name,
          description: bundledTemplate.description,
          model: bundledTemplate.nodeConfigurations?.['llm.anthropic']?.model || "claude-3-opus",
          tools: [...(bundledTemplate.modules || [])],
          apiKey: "",
          temperature: bundledTemplate.nodeConfigurations?.['llm.anthropic']?.temperature?.toString() || "0.7",
          maxTokens: bundledTemplate.nodeConfigurations?.['llm.anthropic']?.maxTokens?.toString() || "2048",
          systemPrompt: bundledTemplate.personality || "",
          instructions: ""
        })

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load agent settings'
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [agentId])

  // Load saved messages
  useEffect(() => {
    if (!agentId) return;
    
    try {
      const storageKey = `ai-conversation-${agentId}`;
      const savedMessages = localStorage.getItem(storageKey);
      
      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages)
          .filter((m: Message) => m.role === 'user' || m.role === 'assistant')
          .map((m: Message) => ({
            ...m,
            role: m.role === 'system' ? 'assistant' : m.role,
            createdAt: m.createdAt ? new Date(m.createdAt) : new Date()
          }));
        
        setMessages(parsedMessages);
        
        logger.debug(
          LogCategory.SYSTEM,
          'ChatPage',
          'Loaded saved messages',
          {
            agentId,
            messageCount: parsedMessages.length,
            timestamp: Date.now()
          }
        );
      }
    } catch (error) {
      logger.error(
        LogCategory.SYSTEM,
        'ChatPage',
        'Failed to load saved messages',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }, [agentId, setMessages]);

  // Early return for redirection
  if (!agentId) {
    return null
  }

  const handleReset = async () => {
    try {
      if (chatContainerRef.current) {
        await chatContainerRef.current.handleReset();
        toast.success('Chat reset successfully');
      }
    } catch (error) {
      console.error('Failed to reset chat:', error);
      toast.error('Failed to reset chat');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-[600px]">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">Loading settings...</span>
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
            <CardTitle>Error Loading Chat Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-destructive">{error}</p>
            <div className="flex gap-4">
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                className="w-full mb-4"
                onClick={async () => {
                  try {
                    await storage.reset();
                    toast.success('Storage reset successfully');
                    window.location.reload();
                  } catch (error) {
                    console.error('Failed to reset storage:', error);
                    toast.error('Failed to reset storage');
                  }
                }}
              >
                Reset Storage
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              If you keep seeing errors, try using the "Reset Storage" button to clear cached data.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="bg-background px-8 py-3">
        <div className="mx-auto max-w-4xl flex items-center gap-3">
          {loading || !runtimeConfig?.name ? (
            <Skeleton className="h-7 w-32" />
          ) : (
            <h1 className="text-xl font-semibold">{runtimeConfig.name}</h1>
          )}
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
      </header>

      <main className="relative flex-1 overflow-hidden px-4">
        <div className="mx-auto max-w-4xl h-full">
          <ChatContainer
            ref={chatContainerRef}
            className="h-full"
            agentId={agentId}
          />
        </div>
      </main>

      {debugMode && runtimeConfig && (
        <footer className="border-t bg-muted/50">
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
                    <p className="text-muted-foreground">{runtimeConfig.model}</p>
                  </div>
                  <div>
                    <p className="font-medium">Temperature</p>
                    <p className="text-muted-foreground">{runtimeConfig.temperature}</p>
                  </div>
                  <div>
                    <p className="font-medium">Max Tokens</p>
                    <p className="text-muted-foreground">{runtimeConfig.maxTokens}</p>
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