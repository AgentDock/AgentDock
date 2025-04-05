"use client"

import { Suspense, useRef, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ChatContainer } from "@/components/chat"
import { logger, LogCategory } from 'agentdock-core'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RefreshCw } from "lucide-react"
import { templates, TemplateId } from '@/generated/templates'
import { useChatSettings } from '@/hooks/use-chat-settings'
import { ChatSkeleton } from "@/components/chat/ChatSkeleton"
import { useChatProgressiveLoading } from "@/hooks/use-chat-progressive-loading"
import { useChatFirstLoad } from "@/hooks/use-chat-first-load"

// Note: generateMetadata is removed from here

function ChatPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawAgentId = searchParams?.get('agent')?.split('?')[0] // Clean agentId
  const agentId = rawAgentId || null // Keep as null for type compatibility
  const chatContainerRef = useRef<{ handleReset: () => Promise<void> }>(null)
  
  // Use our progressive loading hook
  const {
    isLoading: progressiveLoading,
    error: progressiveError,
    layoutReady,
    isFirstLoad
  } = useChatProgressiveLoading(agentId);
  
  // Get agent name for the skeleton if possible
  const agentName = agentId ? templates[agentId as TemplateId]?.name : undefined;
  
  // Use the enhanced useChatSettings hook - but only after initial verification
  const { 
    chatSettings, 
    isLoading: settingsLoading, 
    error: settingsError, 
    debugMode 
  } = useChatSettings(layoutReady ? agentId : null);
  
  // Log debug mode for troubleshooting
  useEffect(() => {
    if (debugMode) {
      console.log('Debug mode in chat page:', debugMode);
      console.log('URL debug param:', searchParams?.get('debug'));
    }
  }, [debugMode, searchParams]);
  
  // State for debug information only
  const [messagesCount, setMessagesCount] = useState(0);
  const [orchestrationDebug, setOrchestrationDebug] = useState<{ 
    sessionId?: string, 
    activeStep?: string, 
    recentlyUsedTools?: string[] 
  }>({});

  // Combine errors
  const error = progressiveError || settingsError;

  // Handle message count and orchestration state updates from the chat container
  const handleStateUpdate = (state: {
    messagesCount?: number;
    orchestration?: {
      sessionId?: string;
      activeStep?: string;
      recentlyUsedTools?: string[];
    }
  }) => {
    if (state.messagesCount !== undefined) {
      setMessagesCount(state.messagesCount);
    }
    if (state.orchestration) {
      setOrchestrationDebug(state.orchestration);
    }
  };

  const handleReset = async () => {
    try {
      if (chatContainerRef.current) {
        await chatContainerRef.current.handleReset();
        setMessagesCount(0); // Reset count for debug display
        setOrchestrationDebug({}); // Reset orchestration debug info
      }
    } catch (error) {
      toast.error('Failed to reset chat');
      logger.error(
        LogCategory.API, 
        'ChatPage', 
        'Failed to reset chat', 
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };

  // Only show loading state for first load of this agent
  if (isFirstLoad && (progressiveLoading || settingsLoading)) {
    return <ChatSkeleton agentName={agentName} />
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
  <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] md:-mx-8 overflow-hidden">      
    <ChatContainer
      ref={chatContainerRef}
      className="flex-1"
        header={
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{chatSettings?.name}</h1>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleReset}
                className="h-8 w-8"
                title="Reset Chat"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              {/* Always render the debug button container */}
              <div id="debug-button-container" className="inline-block"></div>
            </div>
          </div>
        }
        agentId={agentId || undefined}
        onStateUpdate={handleStateUpdate}
      />
    </div>
  )
}

// Renamed the component that wraps Suspense
export default function ChatClientPage() { 
  const searchParams = useSearchParams();
  const rawAgentId = searchParams?.get('agent')?.split('?')[0];
  const agentId = rawAgentId || null;
  
  // Get agent name for the skeleton if possible
  const agentName = agentId && templates[agentId as TemplateId] ? templates[agentId as TemplateId].name : undefined;
  
  // Use our first load hook to determine if we should show the skeleton
  const { isFirstLoad } = useChatFirstLoad();
  
  // Only show skeleton on the very first load of the chat interface
  const fallback = isFirstLoad ? (
    <ChatSkeleton agentName={agentName} />
  ) : <ChatSkeleton />; // Provide a default skeleton if not first load but still suspending
  
  return (
    <Suspense fallback={fallback}>
      <ChatPageContent />
    </Suspense>
  )
} 