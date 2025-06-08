'use client';

/**
 * IMPORTANT: This page uses client-side components and hooks that require
 * the "use client" directive. To avoid hydration issues and Next.js warnings:
 *
 * 1. We separate the main content into its own component (AllAgentsPageContent)
 * 2. We wrap it in a Suspense boundary in the default exported component
 * 3. This pattern ensures hooks like useAgentNavigation work properly
 *    without causing "Warning: serverless functions/edge don't support
 *    useState, useEffect, or similar..." errors
 *
 * This approach should be followed for all pages using client-side hooks.
 */
import { Suspense, useState } from 'react';

import { AgentError } from '@/components/agents/AgentError';
import { AgentGrid } from '@/components/agents/AgentGrid';
import { AgentHeader } from '@/components/agents/AgentHeader';
import { AgentLoading } from '@/components/agents/AgentLoading';
import { ApiKeyDialog } from '@/components/api-key-dialog';
import { templates } from '@/generated/templates';
import { useAgentFiltering } from '@/lib/hooks/useAgentFiltering';
import { useAgentNavigation } from '@/lib/hooks/useAgentNavigation';
import { useAgents } from '@/lib/store';
import type { AgentTemplate } from '@/lib/store/types';

// Separate the actual implementation into its own component
function AllAgentsPageContent() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { isInitialized, templatesValidated, templatesError } = useAgents();

  // Get all templates without category filtering
  const allTemplates = Object.values(templates) as unknown as AgentTemplate[];
  const { searchTerm, setSearchTerm, sortedTemplates } = useAgentFiltering({
    allTemplates,
    category: 'all' // Explicitly set category to 'all' to show all agents
  });

  // Navigation helpers
  const { handleChat } = useAgentNavigation();

  // Handle opening API key dialog for an agent
  const handleConfigure = (agentId: string) => {
    setSelectedAgentId(agentId);
    setConfigDialogOpen(true);
  };

  // Handle GitHub button click - open repository in new tab
  const handleGithub = (agentId: string) => {
    window.open(
      `https://github.com/agentdock/agentdock/tree/main/agents/${agentId}`,
      '_blank'
    );
  };

  // Show loading state
  if (!isInitialized || !templatesValidated) {
    return <AgentLoading />;
  }

  // Show error state
  if (templatesError) {
    return <AgentError error={templatesError} />;
  }

  return (
    <div className="container py-6 space-y-6 md:py-10">
      <AgentHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        categoryConfig={{ id: 'all', name: 'All Agents' }}
        isAllAgents={true}
      />

      <AgentGrid
        templates={sortedTemplates}
        searchTerm={searchTerm}
        onChat={handleChat}
        onSettings={handleConfigure}
        onGithub={handleGithub}
        categoryName="All Agents"
      />

      {/* API Key dialog */}
      {selectedAgentId && (
        <ApiKeyDialog
          agentId={selectedAgentId}
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
        />
      )}
    </div>
  );
}

// Main page component
export default function AllAgentsPage() {
  return (
    <Suspense fallback={<AgentLoading />}>
      <AllAgentsPageContent />
    </Suspense>
  );
}
