"use client"

import { Suspense, useRef, useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ChatContainer } from "@/components/chat"
import { logger, LogCategory } from 'agentdock-core'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RefreshCw, Info, Loader2 } from "lucide-react"
import { templates, TemplateId } from '@/generated/templates'
import { useChatSettings } from '@/hooks/use-chat-settings'
import { ChatSkeleton } from "@/components/chat/ChatSkeleton"
import { useChatProgressiveLoading } from "@/hooks/use-chat-progressive-loading"
import { useChatFirstLoad } from "@/hooks/use-chat-first-load"
import { useChatStorage } from "@/hooks/use-chat-storage"
import { useSessionInfo, SessionInfoData } from "@/hooks/use-session-info"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { OrchestrationState } from "@/components/chat/chat-container"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { SessionInfoDialog } from "@/components/chat/session-info-dialog"
import { TokenWarningDialog, TokenWarning } from "@/components/chat/token-warning-dialog"

// Note: generateMetadata is removed from here

// Define the type for the state passed to onStateUpdate
interface ChatContainerState {
  messagesCount?: number;
  orchestration?: OrchestrationState;
}

function ChatPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawAgentId = searchParams?.get('agent')?.split('?')[0] // Clean agentId
  const agentId = rawAgentId || null // Keep as null for type compatibility
  const chatContainerRef = useRef<{ handleReset: () => Promise<void> }>(null)
  
  // Get storage functions, specifically loadSavedData
  const { loadSavedData } = useChatStorage(agentId ?? undefined); // Pass agentId as undefined if null
  
  // Initialize state directly from storage
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [messagesCount, setMessagesCount] = useState<number>(0);
  
  // State for token warning dialog
  const [isTokenWarningOpen, setIsTokenWarningOpen] = useState(false);
  // Update state to hold the structured warning object or null
  const [tokenWarning, setTokenWarning] = useState<TokenWarning | null>(null); 
  const [hasShown50kWarning, setHasShown50kWarning] = useState(false);
  const [hasShown100kWarning, setHasShown100kWarning] = useState(false);

  // Effect to initialize state from storage once
  useEffect(() => {
    const savedData = loadSavedData();
    setCurrentSessionId(savedData.sessionId || "");
    setMessagesCount(savedData.messages?.length || 0);
  }, [loadSavedData]);
  
  // Use the new hook to get session info
  const { 
    sessionData, 
    isLoading: isLoadingUsage, // Rename hook's isLoading 
    error: fetchUsageError,   // Rename hook's error
    refresh: fetchCumulativeUsage // Rename hook's refresh
  } = useSessionInfo(currentSessionId);

  // State for session info dialog
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  
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
  const [orchestrationDebug, setOrchestrationDebug] = useState<{ 
    sessionId?: string, 
    activeStep?: string, 
    recentlyUsedTools?: string[] 
  }>({});

  // Combine errors
  const error = progressiveError || settingsError;

  // State update handler to receive data from ChatContainer
  const handleStateUpdate = useCallback((state: ChatContainerState) => {
    if (state.messagesCount !== undefined && state.messagesCount !== messagesCount) {
      setMessagesCount(state.messagesCount);
    }
    if (state.orchestration) {
      setOrchestrationDebug(state.orchestration);
      if (state.orchestration?.sessionId && state.orchestration.sessionId !== currentSessionId) {
        setCurrentSessionId(state.orchestration.sessionId);
        // Reset warning flags when session ID changes
        setHasShown50kWarning(false);
        setHasShown100kWarning(false);
      }
    }
  }, [currentSessionId, messagesCount]);

  const handleReset = useCallback(async () => {
    try {
      if (chatContainerRef.current) {
        await chatContainerRef.current.handleReset();
        setMessagesCount(0); 
        setOrchestrationDebug({}); 
        setCurrentSessionId(""); 
        setTokenWarning(null); // Reset structured warning
        setHasShown50kWarning(false);
        setHasShown100kWarning(false);
        setIsTokenWarningOpen(false); // Explicitly close warning dialog on reset
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
  }, []);

  // Callback function to check tokens and show warning
  const checkTokenWarning = useCallback((data: SessionInfoData | null) => {
    const tokens = data?.cumulativeTokenUsage?.totalTokens;
    if (typeof tokens !== 'number') return;

    // Keep test thresholds
    const THRESHOLD_1 = 50000; 
    const THRESHOLD_2 = 100000;

    // Define structured warnings
    const warning1: TokenWarning = {
      title: `High Token Usage (> ${THRESHOLD_1}):`,
      points: [
        "This open-source client may be utilizing shared AgentDock service API keys by default.",
        "High usage can quickly encounter time-based API rate limits (e.g., Tokens Per Minute).",
        "To ensure fair use and prevent interruptions, consider resetting the chat session soon.",
        "Note: Even personal API keys have usage limits."
      ]
    };

    const warning2: TokenWarning = {
      title: `Very High Token Usage (> ${THRESHOLD_2}):`,
      points: [
        "This chat session has consumed a significant number of tokens.",
        "It is strongly recommended to reset the chat session now.",
        "Continuing may lead to hitting API rate limits (Tokens Per Minute), impacting service availability.",
        "This applies to both shared AgentDock service keys and personal API keys – please verify your key's limits if using your own."
      ]
    };

    // Check thresholds and trigger dialog
    if (tokens > THRESHOLD_2 && !hasShown100kWarning) {
      setTokenWarning(warning2);
      setIsTokenWarningOpen(true);
      setHasShown100kWarning(true); 
      setHasShown50kWarning(true); 
    } else if (tokens > THRESHOLD_1 && !hasShown50kWarning) {
      setTokenWarning(warning1);
      setIsTokenWarningOpen(true);
      setHasShown50kWarning(true);
    }
  }, [hasShown50kWarning, hasShown100kWarning]); // Dependencies for the check logic
  
  // Function called after chat turn completes
  const handleChatTurnComplete = useCallback(async () => {
      if (!currentSessionId) return; // Don't fetch if no session ID
      const freshData = await fetchCumulativeUsage(); // Await the fetch
      checkTokenWarning(freshData); // Check warnings with the fresh data
  }, [currentSessionId, fetchCumulativeUsage, checkTokenWarning]);

  // Effect for checking token warning
  useEffect(() => {
    if (sessionData && hasShown50kWarning && hasShown100kWarning) {
      checkTokenWarning(sessionData);
    }
  }, [sessionData, hasShown50kWarning, hasShown100kWarning, checkTokenWarning]);

  // Effect to fetch usage data WHEN session dialog opens (previously added, still useful here)
  useEffect(() => {
    if (isSessionDialogOpen && currentSessionId) {
        fetchCumulativeUsage(); // Call the refresh function from the hook
    }
  }, [isSessionDialogOpen, currentSessionId, fetchCumulativeUsage]);

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
          <TooltipProvider>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">{chatSettings?.name}</h1>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleReset}
                      className="h-8 w-8"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reset Chat</p>
                  </TooltipContent>
                </Tooltip>

                <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Info className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Show Session ID</p>
                    </TooltipContent>
                  </Tooltip>
                </Dialog>
                
                <div id="debug-button-container" className="inline-block"></div>
              </div>
            </div>
          </TooltipProvider>
        }
        agentId={agentId || undefined}
        onStateUpdate={handleStateUpdate}
        onChatTurnComplete={handleChatTurnComplete}
      />
      
      <SessionInfoDialog
        isOpen={isSessionDialogOpen}
        onOpenChange={setIsSessionDialogOpen}
        sessionId={currentSessionId}
        messagesCount={messagesCount}
        sessionData={sessionData}
        isLoading={isLoadingUsage}
        error={fetchUsageError}
        onRefresh={fetchCumulativeUsage}
      />

      <TokenWarningDialog
        isOpen={isTokenWarningOpen}
        onOpenChange={setIsTokenWarningOpen}
        tokenWarning={tokenWarning}
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