"use client"

import { useState } from "react"
import { useAgents } from "@/lib/store"
import { templates } from '@/generated/templates'
import type { AgentTemplate } from "@/lib/store/types"
import { AgentHeader } from "@/components/agents/AgentHeader"
import { AgentGrid } from "@/components/agents/AgentGrid"
import { AgentLoading } from "@/components/agents/AgentLoading"
import { AgentError } from "@/components/agents/AgentError"
import { ApiKeyDialog } from "@/components/api-key-dialog"
import { useAgentFiltering } from "@/lib/hooks/useAgentFiltering"
import { useAgentNavigation } from "@/lib/hooks/useAgentNavigation"

export function AgentsClientPage() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const { isInitialized, templatesValidated, templatesError } = useAgents()
  
  // Get all templates and their filtering/sorting
  const allTemplates = Object.values(templates) as unknown as AgentTemplate[]
  const { searchTerm, setSearchTerm, sortedTemplates } = useAgentFiltering({ 
    allTemplates,
    category: 'featured'  // Show only featured agents on main page
  })
  
  // Navigation helpers
  const { handleChat } = useAgentNavigation()
  
  // Handle opening API key dialog for an agent
  const handleConfigure = (agentId: string) => {
    setSelectedAgentId(agentId)
    setConfigDialogOpen(true)
  }

  // Handle GitHub button click - open repository in new tab
  const handleGithub = (agentId: string) => {
    // For now, just open a dummy URL - this will be replaced with the actual URL structure
    window.open(`https://github.com/agentdock/agentdock/tree/main/agents/${agentId}`, '_blank');
  }

  // Show loading state
  if (!isInitialized || !templatesValidated) {
    return <AgentLoading />
  }

  // Show error state
  if (templatesError) {
    return <AgentError error={templatesError} />
  }
  
  return (
    <div className="container py-6 space-y-6 md:py-10">
      <AgentHeader 
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        isAllAgents={true}
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
    </div>
  )
} 