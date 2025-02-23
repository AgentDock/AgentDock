"use client"

import * as React from "react"
import { useChat, Message } from 'ai/react'
import { useAgents } from "@/lib/store"
import { Chat } from "@/components/ui/chat"
import { toast } from "sonner"
import { logger, LogCategory } from 'agentdock-core'
import { APIError, ErrorCode, SecureStorage } from 'agentdock-core'
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useRouter } from "next/navigation"
import { templates, TemplateId } from '@/generated/templates'
import type { GlobalSettings, RuntimeConfig } from '@/lib/types/settings'

// ============================================================================
// TEMPORARY IMPLEMENTATION FOR V1
// This is a simplified implementation using direct message handling.
// TODO: MIGRATION - This will be replaced with:
// 1. Full CoreMessage type support
// 2. Multi-part message handling
// 3. Provider abstraction
// Reference: plan_refactor.md Phase 1
// ============================================================================

interface ChatContainerProps {
  className?: string
  agentId?: string
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

const ChatContainer = React.forwardRef<{ handleReset: () => Promise<void> }, ChatContainerProps>(({ className, agentId = 'default' }, ref) => {
  const { agents } = useAgents()
  const [isInitializing, setIsInitializing] = React.useState(true)
  const [apiKey, setApiKey] = React.useState<string>('')
  const [runtimeConfig, setRuntimeConfig] = React.useState<RuntimeConfig | null>(null)
  const [savedMessages, setSavedMessages] = React.useState<Message[]>([])
  const storage = React.useMemo(() => SecureStorage.getInstance('agentdock'), []);
  const [error, setError] = React.useState<Error | null>(null);

  // Load saved messages and config on mount
  React.useEffect(() => {
    const loadData = async () => {
      try {
        // Load settings and API key
        const settings = await storage.get<GlobalSettings>('global_settings');
        const apiKey = settings?.apiKeys?.anthropic;

        if (!apiKey) {
          throw new APIError(
            'Please add your Anthropic API key in settings to use the chat',
            ErrorCode.CONFIG_NOT_FOUND,
            'ChatContainer',
            'loadData',
            { agentId }
          );
        }

        setApiKey(apiKey);

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

        // Set runtime config from template
        setRuntimeConfig({
          personality: template.personality,
          temperature: template.nodeConfigurations?.['llm.anthropic']?.temperature,
          maxTokens: template.nodeConfigurations?.['llm.anthropic']?.maxTokens
        });

        // Load saved messages
        const storageKey = `ai-conversation-${agentId}`;
        const savedMessages = localStorage.getItem(storageKey);
        if (savedMessages) {
          const messages = JSON.parse(savedMessages) as Message[];
          setSavedMessages(messages);
        }

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
      setError(error);
      setIsInitializing(false);
    });
  }, [agentId, storage]);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error: chatError,
    reload,
    stop,
    append,
    setMessages
  } = useChat({
    api: `/api/chat/${agentId}`,
    id: agentId,
    initialMessages: savedMessages,
    headers: {
      'x-api-key': apiKey
    },
    body: {
      system: runtimeConfig?.personality,
      temperature: runtimeConfig?.temperature,
      maxTokens: runtimeConfig?.maxTokens
    },
    sendExtraMessageFields: true,
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
        await logger.info(
          LogCategory.API,
          'ChatContainer',
          'Message processed successfully',
          { 
            messageId: message.id,
            messageCount: messages.length + 1,
            role: message.role
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

  // Enhanced reset functionality
  const handleReset = React.useCallback(async () => {
    try {
      // First stop any ongoing generation
      if (isLoading) {
        await stop();
      }

      // Track reset progress
      let progress = 0;
      const updateProgress = (step: string) => {
        progress += 1;
        logger.debug(
          LogCategory.API,
          'ChatContainer',
          `Reset progress: ${step}`,
          { progress, total: 3 }
        );
      };

      // Clear React state
      setSavedMessages([]);
      setMessages([]);
      updateProgress('Cleared component state');

      // Clear localStorage
      const storageKey = `ai-conversation-${agentId}`;
      localStorage.removeItem(storageKey);
      updateProgress('Cleared localStorage');

      // Reset Vercel AI SDK state
      reload();
      updateProgress('Reset AI SDK state');

      await logger.info(
        LogCategory.API,
        'ChatContainer',
        'Chat session reset successfully',
        { agentId }
      );

      // Show success message
      toast.success('Chat session reset successfully');
    } catch (error) {
      await logger.error(
        LogCategory.API,
        'ChatContainer',
        'Failed to reset chat session',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      toast.error('Failed to reset chat session. Please try reloading the page.');
    }
  }, [isLoading, stop, setMessages, setSavedMessages, agentId, reload]);

  // Expose handleReset through ref
  React.useImperativeHandle(ref, () => ({
    handleReset
  }), [handleReset]);

  // Effect to save messages whenever they change
  React.useEffect(() => {
    if (messages.length > 0) {
      const storageKey = `ai-conversation-${agentId}`;
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, agentId]);

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

  const suggestions = [
    "What can you help me with?",
    "How do I use the chat interface?",
    "Tell me about AgentDock."
  ];

  // Handle loading states
  if (isInitializing) {
    return <ChatLoading />;
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
          stop={async () => {
            try {
              await stop();
              await logger.info(
                LogCategory.API,
                'ChatContainer',
                'Generation stopped by user'
              );
            } catch (error) {
              await logger.error(
                LogCategory.API,
                'ChatContainer',
                'Failed to stop generation',
                { error: error instanceof Error ? error.message : 'Unknown error' }
              );
              throw error;
            }
          }}
          append={append}
          suggestions={suggestions}
          className="h-full"
        />
      </div>
    </ErrorBoundary>
  );
});

ChatContainer.displayName = 'ChatContainer';

export { ChatContainer }; 