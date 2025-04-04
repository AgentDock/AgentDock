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

// Update the orchestrationState interface to match our needs
interface OrchestrationState {
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
>(({ className, agentId = 'default', header, onStateUpdate }, ref) => {
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
      await logDebug('ChatContainer', 'Tool call received', undefined, { 
        toolName: toolCall.toolName,
        toolArgs: toolCall.args
      });
      
      try {
        // Execute tool on the server via the chat API (not a dedicated tool API)
        // This ensures tools have access to server-side environment variables
        const agentUrl = `/api/chat/${agentId}`;
        
        // Include the tool call in the next message to the agent
        const response = await fetch(agentUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'x-api-key': apiKey } : {}),
            'x-byok-mode': byokMode ? 'true' : 'false',
            ...(orchestrationState.sessionId ? { 'x-session-id': orchestrationState.sessionId } : {})
          },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: `Execute tool: ${toolCall.toolName}`
            }],
            executeToolDirectly: {
              toolName: toolCall.toolName,
              toolCallId: toolCall.toolCallId || `tool-${Date.now()}`,
              args: toolCall.args || {}
            }
          })
        });
        
        if (!response.ok) {
          throw new Error(`Tool execution failed: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        await logDebug('ChatContainer', 'Tool result received', undefined, {
          toolName: toolCall.toolName,
          resultType: typeof result
        });
        
        // Return the tool result to be rendered
        return result;
      } catch (error) {
        // Log error
        await logError('ChatContainer', 'Tool execution error', error);
        
        // Return an error message
        return {
          type: 'error',
          content: `Error executing ${toolCall.toolName}: ${error instanceof Error ? error.message : String(error)}`
        };
      }
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
        // Update React state if different
        setOrchestrationState(prev => ({
          ...prev,
          sessionId: sessionIdHeader
        }));
        currentSessionId = sessionIdHeader;
      }
      
      // Persist the potentially updated session ID after processing the response header
      if (currentSessionId) {
        saveData({ messages: messages, sessionId: currentSessionId });
      }
      
      // Extract token usage from header if available (for per-turn display, if needed)
      const tokenUsageHeader = response.headers.get('x-token-usage');
      if (tokenUsageHeader) {
        try {
          const usageData = JSON.parse(tokenUsageHeader);
          setTokenUsage(usageData);
        } catch (error) {
          console.error('Failed to parse token usage header:', error);
        }
      }
      
      // Extract orchestration state from header
      const orchestrationHeader = response.headers.get('x-orchestration-state');
      if (orchestrationHeader) {
        try {
          const orchestration = JSON.parse(orchestrationHeader);
          if (orchestration?.sessionId) {
            // Simple update with received state - no special logic
            setOrchestrationState({
              sessionId: orchestration.sessionId,
              recentlyUsedTools: Array.isArray(orchestration.recentlyUsedTools) ? 
                orchestration.recentlyUsedTools : [],
              activeStep: orchestration.activeStep
            });
          }
        } catch (error) {
          console.error('Failed to parse orchestration state header:', error);
        }
      }
    },
    onFinish: async (message) => {
      try {
        // Save messages (and session ID via saveData) when streaming finishes
        saveData({ messages: messages, sessionId: orchestrationState.sessionId });
        
        await logInfo('ChatContainer', 'Message processing complete', undefined, { 
          messageId: message.id, 
          messageCount: messages.length 
        });
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
    if (!data) return;
    
    // Get orchestration information from stream data
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
      // setOverlayError(error);
    }
    
    // Just pass through the orchestration state from the server
    if (streamData?.orchestrationState?.sessionId) {
      // Log the orchestration state in development
      if (process.env.NODE_ENV === 'development') {
        console.debug('[ORCHESTRATION DEBUG] Received orchestration state:', 
          JSON.stringify(streamData.orchestrationState, null, 2));
      }
    
      const newState: OrchestrationState = {
        sessionId: streamData.orchestrationState.sessionId,
        recentlyUsedTools: Array.isArray(streamData.orchestrationState.recentlyUsedTools) ? 
          streamData.orchestrationState.recentlyUsedTools : [],
        activeStep: streamData.orchestrationState.activeStep
      };
      
      // Add step progress information if available
      if (streamData.orchestrationState.stepProgress) {
        newState.currentStepIndex = streamData.orchestrationState.stepProgress.current;
        newState.totalSteps = streamData.orchestrationState.stepProgress.total;
      } else if (streamData.orchestrationState.sequenceIndex !== undefined) {
        // Fallback to sequence index if available
        newState.currentStepIndex = streamData.orchestrationState.sequenceIndex;
      }
      
      setOrchestrationState(newState);
    }
    
    // Check for token usage in the stream data
    if (streamData.usage) {
      setTokenUsage(streamData.usage);
    }
  }, [data]);
  
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
    return <ChatError error={initError} onRetry={() => window.location.reload()} />;
  }

  if (chatError) {
    // Using reload from useChat for chatError
    return <ChatError error={chatError} onRetry={reload} />;
  }

  if (settingsError) {
    // Using window.location.reload() for settingsError
    return (
      <ChatError 
        error={new Error(settingsError)} 
        onRetry={() => window.location.reload()} 
      />
    );
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