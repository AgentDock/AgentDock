import { type AgentTemplate } from '@/lib/store/types';
import { AgentCard } from './AgentCard';
import { memo } from 'react';

interface AgentGridProps {
  templates: AgentTemplate[];
  searchTerm: string;
  onChat: (agentId: string) => void;
  onSettings: (agentId: string) => void;
  onGithub?: (agentId: string) => void;
  currentCategory?: string;
  categoryName?: string;
  isLoading?: boolean;
}

/**
 * Grid layout for agent cards with skeleton loading support
 * Memoized to prevent unnecessary re-renders
 */
export const AgentGrid = memo(function AgentGrid({
  templates,
  searchTerm,
  onChat,
  onSettings,
  onGithub,
  currentCategory,
  categoryName,
  isLoading = false,
}: AgentGridProps) {
  if (templates.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-medium mb-2">No agents found</h3>
        <p className="text-muted-foreground">
          {searchTerm
            ? `No agents matching "${searchTerm}"${categoryName ? ` in ${categoryName}` : ''}`
            : `No agents${categoryName ? ` in ${categoryName}` : ''} yet.`}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {templates.map((template, index) => (
        <AgentCard
          key={template.agentId}
          template={template}
          index={index}
          onChat={onChat}
          onSettings={onSettings}
          onGithub={onGithub}
          currentCategory={currentCategory}
        />
      ))}
    </div>
  );
});
