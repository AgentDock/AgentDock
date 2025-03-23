"use client"

import * as React from "react"
import { useChat, type Message } from 'agentdock-core/client'
import { useAgents } from "@/lib/store"
import { Chat } from "@/components/chat/chat"
import { toast } from "sonner"
import { logger, LogCategory, APIError, ErrorCode, SecureStorage, LLMProvider, ProviderRegistry, smoothStream } from 'agentdock-core'
import { ErrorBoundary } from "@/components/error-boundary"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useRouter } from "next/navigation"
import { templates, TemplateId } from '@/generated/templates'
import type { GlobalSettings } from '@/lib/types/settings'
import { useChatSettings } from '@/hooks/use-chat-settings'
import { useCallback, useMemo } from "react"

interface ChatContainerProps {
  className?: string
  agentId?: string
  header?: React.ReactNode
}

function ChatError({ error, onRetry }: { error: Error, onRetry: () => void }) {
  const router = useRouter();

  React.useEffect(() => {
    logger.error(
      LogCategory.API,
      'ChatContainer',
      'Chat error occurred',
      { error: error.message }
    );
  }, [error]);

  // Enhanced error type checking
  const isMissingApiKey = error instanceof APIError && 
    error.code === ErrorCode.CONFIG_NOT_FOUND &&
    error.message.toLowerCase().includes('api key');
  
  const isConnectionError = error instanceof Error && 
    (error.message.includes('ECONNRESET') || 
     error.message.includes('Failed to fetch') ||
     error.message.includes('Network error'));

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="p-4 text-sm bg-red-100 rounded">
        <p className="text-red-500 font-medium mb-2">
          {isMissingApiKey ? 'API Key Required' : 'Error'}
        </p>
        <p className="text-red-700">
          {error instanceof APIError ? error.message : 
           isConnectionError ? 'Connection lost. Please check your internet connection and try again.' :
           'An error occurred while processing your request'}
        </p>
      </div>
      {isMissingApiKey ? (
        <div className="flex flex-col gap-2">
          <button 
            onClick={() => router.push('/settings')}
            className="px-4 py-2 text-sm text-white bg-blue-500 rounded hover:bg-blue-600"
          >
            Go to Settings
          </button>
          <p className="text-sm text-gray-600">
            Please add your Anthropic API key in settings to use the chat.
          </p>
        </div>
      ) : (
        <div className="flex gap-2">
          <button 
            onClick={onRetry}
            className="px-4 py-2 text-sm text-white bg-red-500 rounded hover:bg-red-600"
          >
            Try Again
          </button>
          {isConnectionError && (
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm text-white bg-blue-500 rounded hover:bg-blue-600"
            >
              Reload Page
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ChatLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <LoadingSpinner />
      <span className="ml-2 text-sm text-gray-500">Loading chat...</span>
    </div>
  );
}

const ChatContainer = React.forwardRef<{ handleReset: () => Promise<void> }, ChatContainerProps>(({ className, agentId = 'default', header }, ref) => {
  const { agents } = useAgents()
  const [isInitializing, setIsInitializing] = React.useState(true)
  const [apiKey, setApiKey] = React.useState<string>('')
  const [provider, setProvider] = React.useState<LLMProvider>('anthropic')
  const [initError, setInitError] = React.useState<Error | null>(null)
  const storage = React.useMemo(() => SecureStorage.getInstance('agentdock'), [])
  
  // Track the previous message length to avoid unnecessary saves
  const prevMessageLengthRef = React.useRef<number>(0);
  
  // Track if initial messages have been loaded
  const initialMessagesLoadedRef = React.useRef<boolean>(false);
  
  // Use the enhanced useChatSettings hook
  const { chatSettings, isLoading: isSettingsLoading, error: settingsError } = useChatSettings(agentId);

  // Load saved messages for this agent
  const loadSavedMessages = useCallback(() => {
    if (typeof window === 'undefined' || !agentId) return [];
    
    try {
      const storageKey = `chat-${agentId}`;
      const savedData = localStorage.getItem(storageKey);
      
      if (savedData) {
        return JSON.parse(savedData) as Message[];
      }
    } catch (error) {
      logger.error(
        LogCategory.SYSTEM,
        'ChatContainer',
        'Failed to load saved messages',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ).catch(console.error);
    }
    return [];
  }, [agentId]);

  // Initialize with saved messages
  const initialMessages = useMemo(() => {
    // Only load messages once
    if (!initialMessagesLoadedRef.current) {
      const messages = loadSavedMessages();
      initialMessagesLoadedRef.current = true;
      prevMessageLengthRef.current = messages.length;
      return messages;
    }
    return [];
  }, [loadSavedMessages]);

  // Load settings and config on mount
  React.useEffect(() => {
    const loadData = async () => {
      try {
        setIsInitializing(true);
        
        // Get template
        const template = templates[agentId as TemplateId];
        if (!template) {
          throw new APIError(
            'Template not found',
            ErrorCode.CONFIG_NOT_FOUND,
            'ChatContainer',
            'loadData',
            { agentId }
          );
        }

        // Determine provider from template
        const provider = ProviderRegistry.getProviderFromNodes((template.nodes || []).slice());
        setProvider(provider);

        // Load API key
        const settings = await storage.get<GlobalSettings>('global_settings');
        const apiKeys = settings?.apiKeys || {};
        const currentApiKey = apiKeys[provider as keyof typeof apiKeys];

        if (!currentApiKey) {
          const providerMetadata = ProviderRegistry.getProvider(provider);
          const displayName = providerMetadata?.displayName || provider;
          throw new APIError(
            `Please add your ${displayName} API key in settings to use the chat`,
            ErrorCode.CONFIG_NOT_FOUND,
            'ChatContainer',
            'loadData'
          );
        }

        setApiKey(currentApiKey);
        setIsInitializing(false);
      } catch (error) {
        setInitError(error instanceof APIError ? error : new APIError(
          'Failed to initialize chat',
          ErrorCode.CONFIG_NOT_FOUND,
          'ChatContainer',
          'loadData',
          { agentId }
        ));
        setIsInitializing(false);
      }
    };

    loadData();
  }, [agentId, storage]);

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
  } = useChat({
    id: agentId,
    api: `/api/chat/${agentId}`,
    initialMessages: initialMessages,
    streamProtocol: 'data',
    headers: {
      'x-api-key': apiKey
    },
    body: {
      system: chatSettings?.personality,
      temperature: chatSettings?.temperature,
      maxTokens: chatSettings?.maxTokens
    },
    maxSteps: 10,
    sendExtraMessageFields: true,
    experimental_throttle: 50,
    onToolCall: async ({ toolCall }) => {
      // Log tool call for debugging
      await logger.debug(
        LogCategory.SYSTEM,
        'ChatContainer',
        'Tool call received',
        { 
          toolName: toolCall.toolName,
          toolArgs: toolCall.args
        }
      ).catch(console.error);
      
      // Return null to let the server handle the tool call
      return null;
    },
    onResponse: async (response) => {
      if (!response.ok) {
        await logger.error(
          LogCategory.API,
          'ChatContainer',
          'Failed to send message',
          { status: response.status }
        );
        toast.error('Failed to send message');
      }
    },
    onFinish: async (message) => {
      try {
        // Avoid duplicate processing during rapid responses
        const finishTime = Date.now();
        const lastFinishTime = (window as any).__lastMessageFinishTime;
        
        if (lastFinishTime && finishTime - lastFinishTime < 100) {
          return;
        }
        
        // Update timestamp for debouncing
        (window as any).__lastMessageFinishTime = finishTime;
        
        // Save messages to local storage
        if (agentId) {
          try {
            localStorage.setItem(`chat-${agentId}`, JSON.stringify(messages));
            prevMessageLengthRef.current = messages.length;
          } catch (error) {
            logger.error(
              LogCategory.SYSTEM,
              'ChatContainer',
              'Failed to save messages to local storage',
              { error: error instanceof Error ? error.message : 'Unknown error' }
            ).catch(console.error);
          }
        }
        
        // Log success
        await logger.info(
          LogCategory.API,
          'ChatContainer',
          'Message processed',
          { messageId: message.id, messageCount: messages.length }
        );
      } catch (error) {
        await logger.error(
          LogCategory.API,
          'ChatContainer',
          'Failed to process message',
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }
    },
    onError: async (error: Error) => {
      await logger.error(
        LogCategory.API,
        'ChatContainer',
        'Chat error occurred',
        { error: error.message }
      );
      console.error('Chat error:', error);
      toast.error(error.message);
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
      
      // Clear local storage
      if (agentId) {
        localStorage.removeItem(`chat-${agentId}`);
      }
      
      // Reload the chat
      await reload();
      
      toast.success('Chat session reset successfully');
    } catch (error) {
      console.error('Failed to reset chat:', error);
      toast.error('Failed to reset chat session. Please try reloading the page.');
    }
  }, [isLoading, stop, setMessages, agentId, reload]);

  // Expose handleReset through ref
  React.useImperativeHandle(ref, () => ({
    handleReset
  }), [handleReset]);

  // Save messages to local storage when they change
  React.useEffect(() => {
    if (!agentId || messages.length === 0 || isLoading) return;
    
    // Only save if the message count has changed
    if (messages.length !== prevMessageLengthRef.current) {
      try {
        localStorage.setItem(`chat-${agentId}`, JSON.stringify(messages));
        prevMessageLengthRef.current = messages.length;
      } catch (error) {
        logger.error(
          LogCategory.SYSTEM,
          'ChatContainer',
          'Failed to save messages to local storage',
          { error: error instanceof Error ? error.message : 'Unknown error' }
        ).catch(console.error);
      }
    }
  }, [agentId, messages, isLoading]);

  // Handle user message submission
  const handleUserSubmit = async (event?: { preventDefault?: () => void }, options?: { experimental_attachments?: FileList }) => {
    try {
      if (event?.preventDefault) {
        event.preventDefault();
      }
      return await handleSubmit(event, options);
    } catch (error) {
      logger.error(
        LogCategory.API,
        'ChatContainer',
        'Failed to submit message',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      throw error;
    }
  };

  // Get suggestions from chatSettings
  const suggestions = useMemo(() => {
    return chatSettings?.chatPrompts as string[] || [];
  }, [chatSettings]);

  // Handle loading states
  if (isInitializing || isSettingsLoading) {
    return <ChatLoading />;
  }

  if (initError) {
    return <ChatError error={initError} onRetry={() => window.location.reload()} />;
  }

  if (chatError) {
    return <ChatError error={chatError} onRetry={reload} />;
  }

  if (settingsError) {
    return (
      <ChatError 
        error={new Error(settingsError)} 
        onRetry={() => window.location.reload()} 
      />
    );
  }

  // Wrap chat in error boundary
  return (
    <ErrorBoundary
      fallback={
        <ChatError 
          error={new Error("Chat error occurred")} 
          onRetry={reload} 
        />
      }
      onError={(error) => {
        console.error("Chat error:", error);
      }}
      resetOnPropsChange={true}
    >
      <div className="flex h-full flex-col">
        <Chat
          messages={messages}
          input={input}
          handleInputChange={(value: string) => setInput({ target: { value } } as React.ChangeEvent<HTMLTextAreaElement>)}
          handleSubmit={handleUserSubmit}
          isGenerating={isLoading}
          isTyping={showTypingIndicator}
          stop={stop}
          append={append}
          suggestions={suggestions}
          className={className || "flex-1"}
          header={header}
          agentName={typeof agents === 'object' && agentId in agents ? (agents as any)[agentId]?.name : agentId}
          agent={agentId}
        />
      </div>
    </ErrorBoundary>
  );
});

ChatContainer.displayName = 'ChatContainer';

export { ChatContainer }; 