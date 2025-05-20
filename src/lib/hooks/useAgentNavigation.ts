import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { AGENT_TAGS } from '@/config/agent-tags';
import { logger, LogCategory } from 'agentdock-core';
import { templates, TemplateId } from '@/generated/templates';
import type { CategoryConfig } from '@/components/agents/AgentHeader';

interface UseAgentNavigationProps {
  category?: string | null;
}

export function useAgentNavigation({ category }: UseAgentNavigationProps = {}) {
  const router = useRouter();

  // Get category config if available
  const isAllAgents = !category || category === 'all';
  const predefinedCategory = category ? AGENT_TAGS.find((tag) => tag.id === category) : null;

  // Create category config - use predefined if available, otherwise create dynamic
  const categoryConfig: CategoryConfig | null =
    predefinedCategory ||
    (category
      ? {
          id: category,
          name: category.charAt(0).toUpperCase() + category.slice(1),
          description: `AI agents tagged with "${category}"`,
        }
      : null);

  const handleChat = useCallback(
    (agentId: string) => {
      logger.debug(LogCategory.SYSTEM, 'AgentsPage', 'Navigating to chat', {
        agentId,
        template: templates[agentId as TemplateId]?.name,
      });
      router.push(`/chat?agent=${agentId}`);
    },
    [router],
  );

  const handleCategorySelect = useCallback(
    (categoryId: string) => {
      router.push(`/agents/${categoryId}`);
    },
    [router],
  );

  const handleRemoveCategory = useCallback(() => {
    // Always navigate to /agents when removing a category
    router.replace('/agents');
  }, [router]);

  return {
    router,
    isAllAgents,
    categoryConfig,
    handleChat,
    handleCategorySelect,
    handleRemoveCategory,
  };
}
