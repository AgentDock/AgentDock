import { useCallback, useRef, useEffect } from 'react';
import { Message } from 'agentdock-core/client';
import { logger, LogCategory } from 'agentdock-core';

/**
 * Hook to handle chat message persistence using localStorage
 * @param agentId The agent ID to use for storage key
 * @returns Storage functions and data
 */
export function useChatStorage(agentId: string | undefined) {
  // Track the previous message state to avoid unnecessary saves
  const prevMessagesRef = useRef<string>('');
  
  // Track if initial messages have been loaded
  const initialMessagesLoadedRef = useRef<boolean>(false);
  
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
        'ChatStorage',
        'Failed to load saved messages',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ).catch(console.error);
    }
    return [];
  }, [agentId]);

  // Function to save messages to localStorage
  const saveMessages = useCallback((messages: Message[]) => {
    if (typeof window === 'undefined' || !agentId || messages.length === 0) return;
    
    // Use a stringified comparison to detect any changes, not just count
    const messagesString = JSON.stringify(messages);
    
    // Only save if there are actual changes in the messages
    if (messagesString !== prevMessagesRef.current) {
      try {
        localStorage.setItem(`chat-${agentId}`, messagesString);
        prevMessagesRef.current = messagesString;
        
        logger.debug(
          LogCategory.SYSTEM,
          'ChatStorage',
          'Saved messages to localStorage',
          { agentId, messageCount: messages.length }
        ).catch(console.error);
      } catch (error) {
        logger.error(
          LogCategory.SYSTEM,
          'ChatStorage',
          'Failed to save messages to local storage',
          { error: error instanceof Error ? error.message : 'Unknown error' }
        ).catch(console.error);
      }
    }
  }, [agentId]);
  
  // Function to clear messages from localStorage
  const clearMessages = useCallback(() => {
    if (typeof window === 'undefined' || !agentId) return;
    
    try {
      localStorage.removeItem(`chat-${agentId}`);
      prevMessagesRef.current = '';
    } catch (error) {
      logger.error(
        LogCategory.SYSTEM,
        'ChatStorage',
        'Failed to clear messages from local storage',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ).catch(console.error);
    }
  }, [agentId]);

  // Return the initial messages on first load
  const getInitialMessages = useCallback(() => {
    // Only load messages once
    if (!initialMessagesLoadedRef.current) {
      const messages = loadSavedMessages();
      initialMessagesLoadedRef.current = true;
      if (messages.length > 0) {
        prevMessagesRef.current = JSON.stringify(messages);
      }
      return messages;
    }
    return [];
  }, [loadSavedMessages]);

  return {
    getInitialMessages,
    saveMessages,
    clearMessages
  };
} 