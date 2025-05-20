'use client';

import { useState } from 'react';
import { AgentHeader } from '@/components/agents/AgentHeader';
import { AgentGrid } from '@/components/agents/AgentGrid';
import { ApiKeyDialog } from '@/components/api-key-dialog';
import type { AgentTemplate } from '@/lib/store/types';
import { useAgentFiltering } from '@/lib/hooks/useAgentFiltering';

/**
 * Client wrapper that handles interactive elements while data is fetched on the server
 * This optimizes performance by keeping heavy data fetching on the server
 * while allowing client-side interactivity
 */
export default function ClientWrapper({
  templates,
  initialCategory,
}: {
  templates: AgentTemplate[];
  initialCategory?: string;
}) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  // Use the hook for filtering and sorting
  const { searchTerm, setSearchTerm, sortedTemplates } = useAgentFiltering({
    allTemplates: templates,
    category: initialCategory,
  });

  // Handle chat button click - navigate to chat page using the correct URL format
  const handleChat = (agentId: string) => {
    window.location.href = `/chat?agent=${agentId}`;
  };

  // Handle settings button click - open API key dialog
  const handleConfigure = (agentId: string) => {
    setSelectedAgentId(agentId);
    setConfigDialogOpen(true);
  };

  // Handle GitHub button click - open repository in new tab
  const handleGithub = (agentId: string) => {
    window.open(`https://github.com/agentdock/agentdock/tree/main/agents/${agentId}`, '_blank');
  };

  return (
    <>
      <AgentHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        isAllAgents={initialCategory === 'featured'}
      />

      <AgentGrid
        templates={sortedTemplates}
        searchTerm={searchTerm}
        onChat={handleChat}
        onSettings={handleConfigure}
        onGithub={handleGithub}
      />

      {/* API Key dialog */}
      {selectedAgentId && (
        <ApiKeyDialog
          agentId={selectedAgentId}
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
        />
      )}
    </>
  );
}
