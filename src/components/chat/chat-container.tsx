"use client"

import * as React from "react"
import { useChat, Message } from 'ai/react'
import { useAgents } from "@/lib/store"
import { Chat } from "@/components/ui/chat"
import { toast } from "sonner"
import { logger, LogCategory, APIError, ErrorCode, SecureStorage, LLMProvider, ProviderRegistry } from 'agentdock-core'
import { ErrorBoundary } from "@/components/ui/error-boundary"
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

// Add provider type to Chat component props
interface ChatProps extends ChatContainerProps {
  messages: Message[]
  isLoading: boolean
  input: string
  setInput: (input: string) => void
  onSubmit: (event?: React.FormEvent<HTMLFormElement>) => void
  suggestions?: string[]
  provider: LLMProvider
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
  
  // Use the enhanced useChatSettings hook
  const { chatSettings, isLoading: isSettingsLoading, error: settingsError } = useChatSettings(agentId);

  // Load saved messages for this agent
  const loadSavedMessages = useCallback(() => {
    if (typeof window !== 'undefined' && agentId) {
      try {
        // Try both storage keys for backward compatibility
        const storageKey = `chat-${agentId}`;
        const legacyStorageKey = `ai-conversation-${agentId}`;
        
        const savedData = localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey);
        
        if (savedData) {
          const parsedMessages = JSON.parse(savedData) as Message[];
          return parsedMessages;
        }
      } catch (error) {
        logger.error(
          LogCategory.SYSTEM,
          'ChatContainer',
          'Failed to load saved messages',
          { error: error instanceof Error ? error.message : 'Unknown error' }
        ).catch(console.error);
      }
    }
    return [];
  }, [agentId]);

  // Initialize with saved messages
  const initialMessages = useMemo(() => loadSavedMessages(), [loadSavedMessages]);

  // Load settings and config on mount
  React.useEffect(() => {
    const loadData = async () => {
      try {
        setIsInitializing(true)
        
        // Get template
        const template = templates[agentId as TemplateId]
        if (!template) {
          throw new APIError(
            'Template not found',
            ErrorCode.CONFIG_NOT_FOUND,
            'ChatContainer',
            'loadData',
            { agentId }
          );
        }

        // Determine provider from template nodes using the core registry
        const provider = ProviderRegistry.getProviderFromNodes((template.nodes || []).slice());
        setProvider(provider);

        // Load settings and API key
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
        if (error instanceof APIError) {
          throw error;
        }
        throw new APIError(
          'Failed to initialize chat',
          ErrorCode.CONFIG_NOT_FOUND,
          'ChatContainer',
          'loadData',
          { agentId }
        );
      }
    };

    loadData().catch((error) => {
      setInitError(error);
      setIsInitializing(false);
    });
  }, [agentId, storage]);

  const {
    messages,
    input,
    handleInputChange,
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
    maxSteps: 5,
    sendExtraMessageFields: true,
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
        // Lightweight debouncing - use a flag to prevent multiple rapid calls
        // for fast-responding models like Qwen
        const finishTime = Date.now();
        const lastFinishRef = (window as any).__lastMessageFinishTime;
        
        // If we've processed a message in the last 100ms, skip additional processing
        if (lastFinishRef && finishTime - lastFinishRef < 100) {
          console.debug('Skipping duplicate onFinish due to rapid response');
          return;
        }
        
        // Update the timestamp for the next potential call
        (window as any).__lastMessageFinishTime = finishTime;
        
        // Log the message completion
        await logger.info(
          LogCategory.API,
          'ChatContainer',
          'Message processed successfully',
          { 
            messageId: message.id,
            messageCount: messages.length + 1,
            role: message.role,
            hasToolInvocations: !!message.toolInvocations && message.toolInvocations.length > 0
          }
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

  // Handle chat reset
  const handleReset = React.useCallback(async () => {
    try {
      // Track reset progress
      let progress = 0;
      const updateProgress = (step: string) => {
        progress += 1;
        // Restore crucial reset progress logging
        logger.info(
          LogCategory.API,
          'ChatContainer',
          `Reset progress: ${step}`,
          { progress, total: 4 }
        ).catch(console.error);
      };
      
      if (isLoading) {
        stop();
        updateProgress('Stopped ongoing request');
      }
      
      // Clear React state
      setMessages([]);
      updateProgress('Cleared component state');
      
      // Clear local storage
      if (agentId) {
        const storageKey = `chat-${agentId}`;
        localStorage.removeItem(storageKey);
        updateProgress('Cleared local storage');
      }
      
      // Reload the chat
      await reload();
      updateProgress('Reloaded chat');
      
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

  // Save messages to local storage whenever they change
  React.useEffect(() => {
    if (agentId && messages.length > 0) {
      try {
        localStorage.setItem(`chat-${agentId}`, JSON.stringify(messages));
        
        // Only log once per session when messages are first saved
        if (messages.length === 1) {
          logger.info(
            LogCategory.SYSTEM,
            'ChatContainer',
            'Started saving messages to local storage',
            { agentId }
          ).catch(console.error);
        }
      } catch (error) {
        logger.error(
          LogCategory.SYSTEM,
          'ChatContainer',
          'Failed to save messages to local storage',
          { error: error instanceof Error ? error.message : 'Unknown error' }
        ).catch(console.error);
      }
    }
  }, [agentId, messages]);

  // Handle user message submission
  const handleUserSubmit = async (event?: { preventDefault?: () => void }, options?: { experimental_attachments?: FileList }) => {
    try {
      if (event?.preventDefault) {
        event.preventDefault();
      }

      await handleSubmit(event, options);
    } catch (error) {
      logger.error(
        LogCategory.API,
        'ChatContainer',
        'Failed to submit user message',
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
      fallback={({ error }) => (
        <ChatError error={error} onRetry={reload} />
      )}
    >
      <div className="flex h-full flex-col">
        <Chat
          messages={messages}
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleUserSubmit}
          isGenerating={isLoading}
          stop={stop}
          append={append}
          suggestions={suggestions}
          className="flex-1"
          header={header}
        />
      </div>
    </ErrorBoundary>
  );
});

ChatContainer.displayName = 'ChatContainer';

export { ChatContainer }; 