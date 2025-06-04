import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { TemplateId, templates } from '@/generated/templates';

// Check if this is the very first load of the chat page
const isVeryFirstLoad = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    return sessionStorage.getItem('chat-first-load-complete') !== 'true';
  } catch (e) {
    return true;
  }
};

// Mark first load as complete
const markFirstLoadComplete = (): void => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem('chat-first-load-complete', 'true');
  } catch (e) {
    // Ignore errors with sessionStorage
  }
};

export function useChatProgressiveLoading(agentId: string | null) {
  // Loading stages
  const [agentExists, setAgentExists] = useState<boolean | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track whether this is the first load ever
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  const router = useRouter();

  // Check if this is the first load (run once on mount)
  useEffect(() => {
    const firstLoad = isVeryFirstLoad();
    setIsFirstLoad(firstLoad);

    // If we've already loaded the app once in this session, skip progressive loading
    if (!firstLoad) {
      setAgentExists(true);
      setLayoutReady(true);
      setApiKeysLoading(false);
      setSettingsLoading(false);
      setMessagesLoading(false);
    }
  }, []);

  // Verify agent ID and template existence immediately
  useEffect(() => {
    // Skip for non-first loads
    if (!isFirstLoad) return;

    // This operation is synchronous and fast
    if (!agentId) {
      setAgentExists(false);
      setError('No agent ID provided');
      return;
    }

    const templateExists = !!templates[agentId as TemplateId];
    setAgentExists(templateExists);

    if (!templateExists) {
      setError('Invalid agent ID');
      // Delay redirect slightly to avoid flashing
      setTimeout(() => {
        router.replace('/agents');
      }, 100);
      return;
    }

    // Layout is ready immediately after agent verification
    setLayoutReady(true);
  }, [agentId, router, isFirstLoad]);

  // Simulate API keys loading (in a real implementation, this would load actual keys)
  useEffect(() => {
    // Skip for non-first loads
    if (!isFirstLoad || !agentExists) return;

    const loadApiKeys = async () => {
      // Simulated API key loading - in reality, this would be an async operation
      setTimeout(() => {
        setApiKeysLoading(false);
      }, 200); // Simulate a 200ms API key loading time
    };

    loadApiKeys();
  }, [agentExists, isFirstLoad]);

  // Simulate settings loading after API keys are available
  useEffect(() => {
    // Skip for non-first loads
    if (!isFirstLoad || apiKeysLoading || !agentExists) return;

    const loadSettings = async () => {
      // Simulated settings loading
      setTimeout(() => {
        setSettingsLoading(false);
      }, 300); // Simulate a 300ms settings loading time
    };

    loadSettings();
  }, [apiKeysLoading, agentExists, isFirstLoad]);

  // Simulate message history loading after settings are available
  useEffect(() => {
    // Skip for non-first loads
    if (!isFirstLoad || settingsLoading || !agentExists) return;

    const loadMessages = async () => {
      // Simulated message loading
      setTimeout(() => {
        setMessagesLoading(false);
      }, 200); // Simulate a 200ms message loading time
    };

    loadMessages();
  }, [settingsLoading, agentExists, isFirstLoad]);

  // Mark first load as complete when all loading is complete
  useEffect(() => {
    if (
      isFirstLoad &&
      !apiKeysLoading &&
      !settingsLoading &&
      !messagesLoading &&
      agentExists
    ) {
      markFirstLoadComplete();
    }
  }, [
    isFirstLoad,
    apiKeysLoading,
    settingsLoading,
    messagesLoading,
    agentExists
  ]);

  // Calculate overall loading state
  const isLoading = apiKeysLoading || settingsLoading || messagesLoading;

  return {
    isLoading,
    agentExists,
    layoutReady,
    apiKeysLoading,
    settingsLoading,
    messagesLoading,
    error,
    isFirstLoad
  };
}
