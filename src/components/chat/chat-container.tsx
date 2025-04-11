"use client"

import * as React from "react"
import { useChat } from 'agentdock-core/client'
import { toast } from 'sonner'
import { useSearchParams } from "next/navigation"
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'

import { Chat } from "@/components/chat/chat"
import { ErrorBoundary } from "@/components/error-boundary"
import { useAgents, Agent } from '@/lib/store'
import { APIError, ErrorCode, Message, applyHistoryPolicy } from 'agentdock-core'
import { useChatInitialization } from '@/hooks/use-chat-initialization'
import { useChatSettings } from '@/hooks/use-chat-settings'
import { useChatStorage } from '@/hooks/use-chat-storage'
import { ChatError, ChatLoading } from './chat-status'
import { logError, logInfo, logDebug } from '@/lib/utils/logger-utils'

// Lazy load the debug component
const ChatDebug = dynamic(() => import("@/components/chat/chat-debug").then((mod) => mod.ChatDebug), {
  ssr: false,
  loading: () => null
})

// Add typed interfaces for API error responses
interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

interface ExtendedError extends Error {
  code?: string;
}

// Export the orchestrationState interface so it can be imported elsewhere
export interface OrchestrationState {
  sessionId: string;
  recentlyUsedTools: string[];
  activeStep?: string;
  currentStepIndex?: number;
  totalSteps?: number;
}

// Add interface for session token usage
interface SessionTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  lastUpdateTime: number;
}

export interface ChatContainerProps {
  agentId?: string;
  className?: string;
  header?: React.ReactNode;
  onStateUpdate?: (state: {
    messagesCount?: number;
    orchestration?: OrchestrationState;
  }) => void;
  onChatTurnComplete?: () => void;
}

// Simple function to safely extract agent name
function getAgentName(agents: any, agentId: string): string {
  if (!agents) return 'AI Agent';
  
  try {
    // The agents object structure can vary, so we use a try-catch
    // to safely extract the name if it exists
    const agent = agents[agentId];
    if (agent && typeof agent === 'object' && agent.name) {
      return String(agent.name);
    }
  } catch (err) {
    console.warn('Error getting agent name:', err);
  }
  
  return 'AI Agent';
}

const ChatContainer = React.forwardRef<
  { handleReset: () => Promise<void> },
  ChatContainerProps
>(({ className, agentId = 'default', header, onStateUpdate, onChatTurnComplete }, ref) => {
  const { agents } = useAgents();
  const searchParams = useSearchParams();
  
  // Custom hooks
  const { chatSettings, isLoading: isSettingsLoading, error: settingsError, debugMode } = useChatSettings(agentId);
  const { isInitializing, provider, apiKey, initError, reload: reloadApiKey } = useChatInitialization(agentId);
  const {
    loadSavedData,
    saveData,
    clearSavedData,
    trimMessages,
    getHistorySettings,
    initialMessagesLoadedRef
  } = useChatStorage(agentId);

  // Load initial messages and session ID
  const { messages: initialMessages, sessionId: initialSessionId } = React.useMemo(
    () => loadSavedData(),
    [loadSavedData]
  );
  
  // Get BYOK setting from localStorage for API headers (Re-added)
  const byokMode = React.useMemo(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const byokSetting = localStorage.getItem('byokOnly');
        return byokSetting === 'true';
      }
    } catch (e) {
      console.warn('Error accessing localStorage:', e);
    }
    return false;
  }, []);
  
  // Check if debug mode is enabled via URL parameter or settings
  const isDebugEnabled = React.useMemo(() => {
    // Get debug mode from URL or from settings
    const urlDebug = searchParams?.get('debug') === 'true';
    // Use URL parameter or debug mode from settings
    return urlDebug || debugMode;
  }, [searchParams, debugMode]);
  
  // Basic orchestration state initialized with loaded session ID
  const [orchestrationState, setOrchestrationState] = React.useState<OrchestrationState>({
    sessionId: initialSessionId,
    recentlyUsedTools: []
  });
  
  // Track messages count for debug display
  const [messagesCount, setMessagesCount] = React.useState(0);
  
  // State for errors detected within the data stream
  const [streamError, setStreamError] = React.useState<Error | null>(null);
  
  // Simplified token usage state - only for potential future use, not passed to debug
  const [tokenUsage, setTokenUsage] = React.useState<{
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    provider?: string;
  } | null>(null);
  
  // Get trimmed messages for sending to LLM
  const trimmedInitialMessages = React.useMemo(() => {
    return trimMessages(initialMessages);
  }, [initialMessages, trimMessages]);
  
  // useChat hook with our configuration
  const {
    messages,
    input,
    handleInputChange: setInput,
    handleSubmit,
    isLoading,
    stop,
    error: chatError,
    append,
    setMessages,
    reload,
    data
  } = useChat({
    id: agentId,
    api: `/api/chat/${agentId}`,
    initialMessages: trimmedInitialMessages,
    streamProtocol: 'data',
    headers: {
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
      'x-byok-mode': byokMode ? 'true' : 'false',
      ...(orchestrationState.sessionId ? { 'x-session-id': orchestrationState.sessionId } : {})
    },
    body: {
      system: chatSettings?.personality,
      temperature: chatSettings?.temperature,
      maxTokens: chatSettings?.maxTokens,
      sessionId: orchestrationState.sessionId || undefined
    },
    maxSteps: 10,
    sendExtraMessageFields: true,
    experimental_throttle: 50,
    experimental_prepareRequestBody: ({ messages: requestMessages, ...otherProps }) => {
      // Get history settings from the local hook right before use
      const historySettings = getHistorySettings();
      
      // Apply message trimming policy to request messages using agentdock-core's function directly
      const trimmedMessages = applyHistoryPolicy(requestMessages, {
        historyPolicy: historySettings.historyPolicy,
        historyLength: historySettings.historyLength,
        preserveSystemMessages: true
      });
      
      // Return in the format expected by Vercel AI SDK
      return {
        messages: trimmedMessages,
        ...otherProps
      };
    },
    onToolCall: async ({ toolCall }) => {
      // Log tool call for debugging
      await logDebug('ChatContainer', 'Tool call received by client', undefined, { 
        toolName: toolCall.toolName,
        toolArgs: toolCall.args,
        toolCallId: toolCall.toolCallId
      });
      
      // Return undefined - the UI should rely on stream parts for updates.
      return undefined;
    },
    onResponse: async (response) => {
      if (!response.ok) {
        await logError('ChatContainer', 'Failed to send message', `Status: ${response.status}`);
        toast.error('Failed to send message');
        return;
      }
      
      // Extract session ID from header
      const sessionIdHeader = response.headers.get('x-session-id');
      let currentSessionId = orchestrationState.sessionId;

      if (sessionIdHeader && sessionIdHeader !== currentSessionId) {
        setOrchestrationState(prev => ({ ...prev, sessionId: sessionIdHeader }));
        currentSessionId = sessionIdHeader;
      }
      
      if (currentSessionId) {
        saveData({ messages: messages, sessionId: currentSessionId });
      }
      
      const tokenUsageHeader = response.headers.get('x-token-usage');
      if (tokenUsageHeader) {
        try {
          const usageData = JSON.parse(tokenUsageHeader);
          setTokenUsage(usageData);
        } catch (error) {
          console.error('Failed to parse token usage header:', error);
        }
      }
      
      // --- RESTORED Conditional state update from header --- 
      const orchestrationHeader = response.headers.get('x-orchestration-state');
      if (orchestrationHeader) {
        try {
          const incomingState = JSON.parse(orchestrationHeader) as OrchestrationState;
          if (incomingState?.sessionId) {
              const incomingTools = Array.isArray(incomingState.recentlyUsedTools) ? incomingState.recentlyUsedTools : [];
              // Only update if state actually differs
              const hasStateChanged = 
                  incomingState.sessionId !== orchestrationState.sessionId ||
                  incomingState.activeStep !== orchestrationState.activeStep ||
                  JSON.stringify(incomingTools) !== JSON.stringify(orchestrationState.recentlyUsedTools);
                  
              if (hasStateChanged) {
                  logDebug('ChatContainer', 'Orchestration state changed (via header), updating UI', undefined, {
                      from: { step: orchestrationState.activeStep, tools: orchestrationState.recentlyUsedTools },
                      to: { step: incomingState.activeStep, tools: incomingTools }
                  });
                  setOrchestrationState(incomingState);
              }
          }
        } catch (error) {
          console.error('Failed to parse orchestration state header:', error);
        }
      }
    },
    onFinish: async (message) => {
      try {
        // Save final messages (and session ID via saveData)
        saveData({ messages: messages, sessionId: orchestrationState.sessionId });
        
        await logInfo('ChatContainer', 'Message processing complete (stream finished)', undefined, { 
          messageId: message.id, 
          messageCount: messages.length 
        });

        // Call the completion callback if provided
        onChatTurnComplete?.();

      } catch (error) {
        await logError('ChatContainer', 'Failed to process message onFinish', error);
      }
    },
    onError: async (error: Error) => {
      // Log the error for debugging
      await logError('ChatContainer', 'Chat error occurred', error);
      console.error('Chat error:', error);
      
      // Create a new error with the message from Vercel AI SDK
      // This should now contain the detailed error from our getErrorMessage
      const displayError = new Error(error.message);
      
      // Copy over the error code if available
      if ('code' in error && typeof (error as any).code === 'string') {
        (displayError as any).code = (error as any).code;
      }
      
      // Set the error for display in the overlay
      // setOverlayError(displayError);
      
      // Show toast in development
      if (process.env.NODE_ENV === 'development') {
        toast.error(error.message);
      }
    }
  });
  
  // Only show typing indicator when we're loading but no streaming has started yet
  const showTypingIndicator = React.useMemo(() => {
    const lastMessageIsUser = messages.length > 0 && messages[messages.length - 1]?.role === 'user';
    return isLoading && lastMessageIsUser;
  }, [isLoading, messages]);
  
  // Handle chat reset
  const handleReset = React.useCallback(async () => {
    try {
      if (isLoading) {
        stop();
      }
      
      // Clear React state
      setMessages([]);
      setTokenUsage(null);
      
      // Clear persisted messages AND session ID
      clearSavedData();
      
      // Reset orchestration state in React
      setOrchestrationState({
        sessionId: '',
        recentlyUsedTools: []
      });
      
      // Reload the chat hook (will start fresh without a session ID)
      await reload();
      
      toast.success('Chat session reset successfully');
    } catch (error) {
      console.error('Failed to reset chat:', error);
      toast.error('Failed to reset chat session. Please try reloading the page.');
    }
  }, [isLoading, stop, setMessages, clearSavedData, reload]);
  
  // Expose handleReset through ref
  React.useImperativeHandle(ref, () => ({
    handleReset
  }), [handleReset]);
  
  // Save messages to local storage when they change and update orchestration info
  React.useEffect(() => {
    if (messages.length === 0) return;
    
    // Only save data when not in the middle of streaming
    if (!isLoading) {
      // Debounce localStorage writes to prevent excessive updates
      const savedMessagesJSON = localStorage.getItem(`chat-${agentId}`);
      const currentMessagesJSON = JSON.stringify(messages);
      
      // Only save if the messages have actually changed
      if (savedMessagesJSON !== currentMessagesJSON) {
        // Use saveData to persist both messages and current session ID
        saveData({ messages: messages, sessionId: orchestrationState.sessionId });
        setMessagesCount(messages.length);
        
        // Call onStateUpdate with message count and orchestration state
        onStateUpdate?.({
          messagesCount: messages.length,
          orchestration: orchestrationState
        });
      }
    }
  }, [messages, saveData, isLoading, onStateUpdate, orchestrationState.sessionId, agentId]);
  
  // Set initial full history after initialization if needed
  React.useEffect(() => {
    if (initialMessages.length > trimmedInitialMessages.length && messages.length === trimmedInitialMessages.length) {
      setMessages(initialMessages);
    }
  }, [initialMessages, trimmedInitialMessages, messages.length, setMessages]);
  
  // Initialize messages count when page loads or refreshes
  React.useEffect(() => {
    if (initialMessages.length > 0 && messagesCount === 0) {
      setMessagesCount(initialMessages.length);
    }
  }, [initialMessages.length, messagesCount]);
  
  // Effect to update orchestration state from streaming data
  React.useEffect(() => {
    // Reset stream error at the beginning of processing new data
    setStreamError(null);
    
    if (!data) return;
    
    const streamData = data as unknown as { 
      orchestrationState?: { 
        sessionId: string; 
        recentlyUsedTools: string[]; 
        activeStep?: string;
        // Additional orchestration information
        sequenceIndex?: number;
        stepProgress?: {
          current: number;
          total: number;
        };
      };
      // Check for streaming errors in the data object
      _hasStreamingError?: boolean;
      _streamingErrorMessage?: string;
      _streamingErrorCode?: string;
      // Token usage data might be in the stream data
      usage?: { 
        promptTokens: number; 
        completionTokens: number;
        totalTokens: number;
        provider?: string;
      };
    };
    
    // Check for streaming errors
    if (streamData._hasStreamingError && streamData._streamingErrorMessage) {
      const errorMessage = streamData._streamingErrorMessage;
      const error = new Error(errorMessage);
      if (streamData._streamingErrorCode) {
        (error as any).code = streamData._streamingErrorCode;
      }
      setStreamError(error); // <-- Set the streamError state
      // Prevent further processing of this data chunk if an error was found
      return; 
    }
    
    // Update orchestration state from data stream, ONLY if changed
    if (streamData?.orchestrationState?.sessionId) {
      // Log the received state
      if (process.env.NODE_ENV === 'development') {
        console.debug('[ORCHESTRATION DEBUG] Received orchestration state via data:', 
          JSON.stringify(streamData.orchestrationState, null, 2));
      }
      
      const incomingState = streamData.orchestrationState;
      const incomingTools = Array.isArray(incomingState.recentlyUsedTools) ? incomingState.recentlyUsedTools : [];

      // Check if relevant parts of the state have actually changed
      const hasStateChanged = 
        incomingState.sessionId !== orchestrationState.sessionId ||
        incomingState.activeStep !== orchestrationState.activeStep ||
        JSON.stringify(incomingTools) !== JSON.stringify(orchestrationState.recentlyUsedTools);
        // Add checks for stepProgress/sequenceIndex if needed for flicker

      // --- State update from stream data remains enabled --- 
      if (hasStateChanged) {
         logDebug('ChatContainer', 'Orchestration state changed (via data), updating UI', undefined, { 
            from: { step: orchestrationState.activeStep, tools: orchestrationState.recentlyUsedTools },
            to: { step: incomingState.activeStep, tools: incomingTools }
         });
         
         const newState: OrchestrationState = {
           sessionId: incomingState.sessionId,
           recentlyUsedTools: incomingTools,
           activeStep: incomingState.activeStep
         };
         
         // Add step progress information if available
         if (incomingState.stepProgress) {
           newState.currentStepIndex = incomingState.stepProgress.current;
           newState.totalSteps = incomingState.stepProgress.total;
         } else if (incomingState.sequenceIndex !== undefined) {
           newState.currentStepIndex = incomingState.sequenceIndex;
         }
         
         // Update the state
         setOrchestrationState(newState);
      } else {
        // Log if state received but deemed unchanged (for debugging)
        if (process.env.NODE_ENV === 'development') {
            console.debug('[ORCHESTRATION DEBUG] Received state via data, but no change detected.');
        }
      }
    }
    
    // Check for token usage in the stream data
    if (streamData.usage) {
      setTokenUsage(streamData.usage);
    }
  }, [data, orchestrationState]); // Add orchestrationState to dependency array for comparison
  
  // Fix handleInputChange to match Chat component's expected format (Re-added)
  const handleInputChange = React.useCallback((value: string) => {
    // Create a synthetic event object expected by the useChat hook's setInput
    setInput({ target: { value } } as React.ChangeEvent<HTMLTextAreaElement>);
  }, [setInput]);

  // Restore suggestions calculation from chatSettings
  const suggestions = React.useMemo(() => {
    return chatSettings?.chatPrompts as string[] || [];
  }, [chatSettings]);

  // Restore direct error/loading rendering logic
  if (isInitializing || isSettingsLoading) {
    return <ChatLoading />;
  }

  if (initError) {
    // Using window.location.reload() for initError as per the provided correct code
    return <ChatError error={initError} onRetry={() => window.location.reload()} isOverlay={false} />;
  }

  if (settingsError) {
    // Settings error still replaces the whole screen as it prevents chat loading
    return (
      <ChatError 
        error={new Error(settingsError)} 
        onRetry={() => window.location.reload()} 
        isOverlay={false} // Explicitly not an overlay
      />
    );
  }

  // Prepare error for overlay, checking both chatError and streamError
  // chatError comes from useChat hook (more generic), streamError from data stream (potentially more specific)
  const overlayErrorSource = streamError || chatError; // Prioritize streamError if both exist
  let overlayErrorToDisplay: Error | null = null;

  if (overlayErrorSource) {
    let displayMessage = overlayErrorSource.message; // Default to original message
    // Customize message for specific error codes or content
    if (displayMessage?.includes('Overloaded') || (overlayErrorSource as any).code === 'LLM_OVERLOADED_ERROR') {
      displayMessage = 'The AI model is currently overloaded. Please try again shortly.';
    }
    // Add other specific error messages here if needed, e.g.:
    // else if ((overlayErrorSource as any).code === 'LLM_RATE_LIMIT_ERROR') { ... }

    // DEBUG: Log the actual error details
    console.error('[ChatContainer Error Debug] Raw error source:', overlayErrorSource);
    console.error(`[ChatContainer Error Debug] Message: "${overlayErrorSource.message}", Code: "${(overlayErrorSource as any).code}"`);

    overlayErrorToDisplay = new Error(displayMessage);
    // Preserve original code if possible for debugging or more specific handling
    (overlayErrorToDisplay as any).code = (overlayErrorSource as any).code; 
  }

  return (
    <ErrorBoundary
      onError={(err) => logError('ChatContainer', 'Global Error Boundary Caught:', err)}
      fallback={<p>Something went wrong rendering the chat.</p>}
    >
      <div className={cn("relative flex flex-col h-full", className)}>
        <Chat
          agent={agentId}
          agentName={getAgentName(agents, agentId)}
          header={header}
          messages={messages} 
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isGenerating={isLoading}
          isTyping={false}
          stop={stop}
          append={append}
          suggestions={suggestions}
        />
        
        {overlayErrorToDisplay && (
          <ChatError error={overlayErrorToDisplay} onRetry={reload} isOverlay={true} />
        )}
        
        {isDebugEnabled && (
          <div data-test-id="chat-debug-panel">
            <ChatDebug
              visible={isDebugEnabled}
              sessionId={orchestrationState.sessionId}
              messagesCount={messagesCount}
              model={chatSettings?.model}
              temperature={chatSettings?.temperature}
              maxTokens={chatSettings?.maxTokens}
              agentId={agentId}
              provider={provider}
              activeStep={orchestrationState.activeStep}
              currentStepIndex={orchestrationState.currentStepIndex}
              totalSteps={orchestrationState.totalSteps}
            />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
});

ChatContainer.displayName = "ChatContainer";

export { ChatContainer }; 