import { useCallback, useRef, useEffect } from 'react';
import { Message, applyHistoryPolicy, logger, LogCategory } from 'agentdock-core';
import { templates, TemplateId } from '@/generated/templates';

/**
 * Hook to handle chat message persistence using localStorage
 * @param agentId The agent ID to use for storage key
 * @returns Storage functions and data
 */
export function useChatStorage(agentId: string | undefined) {
  // Track the previous message state to avoid unnecessary saves
  const prevMessagesRef = useRef<string>('');
  // Track the previous session ID to avoid unnecessary saves
  const prevSessionIdRef = useRef<string>('');

  // Track if initial messages have been loaded
  const initialMessagesLoadedRef = useRef<boolean>(false);

  // Track history settings from agent template
  const historySettingsRef = useRef({
    historyPolicy: 'lastN' as 'none' | 'lastN' | 'all',
    historyLength: 20,
    preserveSystemMessages: true,
  });

  // Load history settings from agent template and environment variables
  useEffect(() => {
    if (!agentId) return;

    try {
      // First: Get settings from the template
      const template = templates[agentId as TemplateId];
      if (template?.chatSettings) {
        // Get historyPolicy with a fallback
        const policy = template.chatSettings.historyPolicy || 'lastN';

        // Use type assertion for historyLength since it's optional
        // and might not exist on some template types
        let length = 20;
        if ('historyLength' in template.chatSettings) {
          const templateLength = (template.chatSettings as any).historyLength;
          if (typeof templateLength === 'number') {
            length = templateLength;
          }
        }

        historySettingsRef.current = {
          historyPolicy: policy,
          historyLength: length,
          preserveSystemMessages: true,
        };
      }

      // Second: Load environment settings with highest precedence
      // These come from EnvOverrideProvider which already handles precedence rules
      if (typeof window !== 'undefined') {
        // Check for ENV_HISTORY_POLICY from window (set by EnvOverrideProvider)
        if ((window as any).ENV_HISTORY_POLICY) {
          const envPolicy = (window as any).ENV_HISTORY_POLICY;
          if (['none', 'lastN', 'all'].includes(envPolicy)) {
            historySettingsRef.current.historyPolicy = envPolicy as 'none' | 'lastN' | 'all';
            console.debug(`[ChatStorage] Using history policy: ${envPolicy}`);
          }
        }

        // Check for ENV_HISTORY_LENGTH from window (set by EnvOverrideProvider)
        if ((window as any).ENV_HISTORY_LENGTH !== undefined) {
          const envLength = parseInt(String((window as any).ENV_HISTORY_LENGTH), 10);
          if (!isNaN(envLength) && envLength >= 0) {
            historySettingsRef.current.historyLength = envLength;
            console.debug(`[ChatStorage] Using history length: ${envLength}`);
          }
        }
      }

      // Log final settings
      logger
        .debug(LogCategory.SYSTEM, 'ChatStorage', 'Using history settings', {
          agentId,
          historyPolicy: historySettingsRef.current.historyPolicy,
          historyLength: historySettingsRef.current.historyLength,
        })
        .catch(console.error);
    } catch (error) {
      console.error('Failed to load message history settings:', error);
    }
  }, [agentId]);

  // Function to save messages AND session ID to localStorage
  const saveData = useCallback(
    (data: { messages: Message[]; sessionId: string }) => {
      if (typeof window === 'undefined' || !agentId) return;

      const { messages, sessionId } = data;

      // Save Messages (only if changed)
      if (messages.length > 0) {
        const messagesJson = JSON.stringify(messages);
        if (messagesJson !== prevMessagesRef.current) {
          try {
            const messagesStorageKey = `chat-${agentId}`;
            localStorage.setItem(messagesStorageKey, messagesJson);
            prevMessagesRef.current = messagesJson;
          } catch (error) {
            console.error('Failed to save messages:', error);
          }
        }
      }

      // Save Session ID (only if changed and not empty)
      if (sessionId && sessionId !== prevSessionIdRef.current) {
        try {
          const sessionStorageKey = `session-${agentId}`;
          localStorage.setItem(sessionStorageKey, sessionId);
          prevSessionIdRef.current = sessionId;
        } catch (error) {
          console.error('Failed to save session ID:', error);
        }
      }
    },
    [agentId],
  );

  // Load saved messages and session ID for this agent
  const loadSavedData = useCallback(() => {
    if (typeof window === 'undefined' || !agentId) return { messages: [], sessionId: '' };

    let messages: Message[] = [];
    let sessionId: string = '';

    try {
      const messagesStorageKey = `chat-${agentId}`;
      const sessionStorageKey = `session-${agentId}`;

      // Load Messages
      const savedMessagesData = localStorage.getItem(messagesStorageKey);
      if (savedMessagesData) {
        const loadedMessages = JSON.parse(savedMessagesData) as Message[];
        messages = applyHistoryPolicy(loadedMessages, historySettingsRef.current);
      }

      // Load Session ID
      const savedSessionId = localStorage.getItem(sessionStorageKey);
      if (savedSessionId) {
        sessionId = savedSessionId;
      }
    } catch (error) {
      console.error('Failed to load saved chat data:', error);
    }
    return { messages, sessionId };
  }, [agentId]);

  // Function to clear saved messages and session ID
  const clearSavedData = useCallback(() => {
    if (typeof window === 'undefined' || !agentId) return;

    try {
      const messagesStorageKey = `chat-${agentId}`;
      const sessionStorageKey = `session-${agentId}`;
      localStorage.removeItem(messagesStorageKey);
      localStorage.removeItem(sessionStorageKey);
      prevMessagesRef.current = '';
      prevSessionIdRef.current = '';
    } catch (error) {
      console.error('Failed to clear saved chat data:', error);
    }
  }, [agentId]);

  // Function to trim messages to a specified number of user messages
  const trimMessages = useCallback((messages: Message[]) => {
    if (!messages || messages.length === 0) return [];

    // Apply history policy directly with unified Message type
    return applyHistoryPolicy(messages, historySettingsRef.current);
  }, []);

  // Get the history settings
  const getHistorySettings = useCallback(() => {
    return {
      ...historySettingsRef.current,
    };
  }, []);

  // Return the functions
  return {
    loadSavedData,
    saveData,
    clearSavedData,
    trimMessages,
    getHistorySettings,
    initialMessagesLoadedRef,
  };
}
