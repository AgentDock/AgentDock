"use client"

import * as React from "react"
import { useChat, type Message } from 'agentdock-core/client'
import { useAgents } from "@/lib/store"
import { Chat } from "@/components/chat/chat"
import { toast } from "sonner"
import { APIError, ErrorCode } from 'agentdock-core'
import { ErrorBoundary } from "@/components/error-boundary"
import { templates, TemplateId } from '@/generated/templates'
import { useChatSettings } from '@/hooks/use-chat-settings'
import { useChatInitialization } from '@/hooks/use-chat-initialization'
import { useChatStorage } from '@/hooks/use-chat-storage'
import { ChatError, ChatLoading } from './chat-status'
import { logError, logInfo, logDebug } from '@/lib/utils/logger-utils'

interface ChatContainerProps {
  className?: string
  agentId?: string
  header?: React.ReactNode
}

const ChatContainer = React.forwardRef<{ handleReset: () => Promise<void> }, ChatContainerProps>(({ className, agentId = 'default', header }, ref) => {
  const { agents } = useAgents()
  
  // Use our custom hooks
  const { chatSettings, isLoading: isSettingsLoading, error: settingsError } = useChatSettings(agentId);
  const { isInitializing, provider, apiKey, initError } = useChatInitialization(agentId);
  const { getInitialMessages, saveMessages, clearMessages } = useChatStorage(agentId);

  // Get initial messages
  const initialMessages = React.useMemo(() => getInitialMessages(), [getInitialMessages]);

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
    initialMessages,
    streamProtocol: 'data',
    headers: apiKey ? {
      'x-api-key': apiKey
    } : undefined,
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
      await logDebug('ChatContainer', 'Tool call received', undefined, { 
        toolName: toolCall.toolName,
        toolArgs: toolCall.args
      });
      
      // Return null to let the server handle the tool call
      return null;
    },
    onResponse: async (response) => {
      if (!response.ok) {
        await logError('ChatContainer', 'Failed to send message', `Status: ${response.status}`);
        toast.error('Failed to send message');
      }
    },
    onFinish: async (message) => {
      try {
        // Save completed messages to local storage once the stream is fully complete
        // This ensures we only save the final state, not partial streaming states
        saveMessages(messages);
        
        // Log success
        await logInfo('ChatContainer', 'Message processing complete', undefined, { 
          messageId: message.id, 
          messageCount: messages.length 
        });
      } catch (error) {
        await logError('ChatContainer', 'Failed to process message', error);
      }
    },
    onError: async (error: Error) => {
      await logError('ChatContainer', 'Chat error occurred', error);
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
      clearMessages();
      
      // Reload the chat
      await reload();
      
      toast.success('Chat session reset successfully');
    } catch (error) {
      console.error('Failed to reset chat:', error);
      toast.error('Failed to reset chat session. Please try reloading the page.');
    }
  }, [isLoading, stop, setMessages, clearMessages, reload]);

  // Expose handleReset through ref
  React.useImperativeHandle(ref, () => ({
    handleReset
  }), [handleReset]);

  // Save messages to local storage when they change (including during streaming)
  React.useEffect(() => {
    if (messages.length === 0) return;
    
    // Only save messages when not in the middle of streaming
    // This prevents potentially causing issues during fast streams
    if (!isLoading) {
      saveMessages(messages);
      
      // Add debug log to track message saves
      if (process.env.NODE_ENV === 'development') {
        console.debug(`Saving ${messages.length} messages after stream completed`);
      }
    }
  }, [messages, saveMessages, isLoading]);

  // Handle user message submission
  const handleUserSubmit = React.useCallback(async (event?: { preventDefault?: () => void }, options?: { experimental_attachments?: FileList }) => {
    try {
      if (event?.preventDefault) {
        event.preventDefault();
      }
      return await handleSubmit(event, options);
    } catch (error) {
      logError('ChatContainer', 'Failed to submit message', error);
      throw error;
    }
  }, [handleSubmit]);

  // Get suggestions from chatSettings
  const suggestions = React.useMemo(() => {
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