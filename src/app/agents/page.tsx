/**
 * @fileoverview AI Agents page with modern card layout and settings management
 */

"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAgents } from "@/lib/store"
import { AgentTemplate } from "@/lib/store/types"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Bot, MessageSquare, Settings, Plus } from "lucide-react"
import { toast } from "sonner"
import { SettingsSheet } from "@/components/agents/settings-sheet"
import { SecureStorage, logger, LogCategory } from 'agentdock-core';

// Initialize storage
const storage = SecureStorage.getInstance('agentdock');

export default function AgentsPage() {
  const { agents, initialize, isInitialized } = useAgents()
  const [templates, setTemplates] = useState<AgentTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!isInitialized) {
      initialize()
    }
  }, [initialize, isInitialized])

  const loadTemplates = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      await logger.debug(
        LogCategory.SYSTEM,
        'AgentsPage',
        'Starting template load process'
      )

      // Try to get from localStorage first
      try {
        const storedTemplates = await storage.get<AgentTemplate[]>('agent_templates')
        if (storedTemplates && Array.isArray(storedTemplates) && storedTemplates.length > 0) {
          await logger.info(
            LogCategory.SYSTEM,
            'AgentsPage',
            'Loading templates from localStorage',
            { count: storedTemplates.length }
          )
          setTemplates(storedTemplates)
          setIsLoading(false)
          return
        }
      } catch (storageError) {
        // If we get a tampering error, clear the storage and continue
        await logger.warn(
          LogCategory.SYSTEM,
          'AgentsPage',
          'Storage error detected, clearing corrupted data',
          { error: storageError instanceof Error ? storageError.message : 'Unknown error' }
        )
        await storage.remove('agent_templates')
      }

      // If not in localStorage or storage error, load from API/filesystem
      await logger.info(
        LogCategory.SYSTEM,
        'AgentsPage',
        'Loading templates from filesystem'
      )
      
      const response = await fetch("/api/agents/templates")
      if (!response.ok) {
        throw new Error(`Failed to load templates: ${response.statusText}`)
      }
      const data = await response.json()
      
      await logger.debug(
        LogCategory.SYSTEM,
        'AgentsPage',
        'Received template data from API',
        { data }
      )
      
      // Ensure data is an array
      if (!Array.isArray(data)) {
        throw new Error('Invalid template data received')
      }

      // Store in localStorage for future use
      if (data.length > 0) {
        await logger.info(
          LogCategory.SYSTEM,
          'AgentsPage',
          'Storing templates in localStorage',
          { count: data.length }
        )
        await storage.set('agent_templates', data)
      } else {
        await logger.warn(
          LogCategory.SYSTEM,
          'AgentsPage',
          'No templates received from API'
        )
      }

      setTemplates(data)
    } catch (error) {
      await logger.error(
        LogCategory.SYSTEM,
        'AgentsPage',
        'Failed to load templates',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      console.error("Failed to load templates:", error)
      setError(error instanceof Error ? error.message : "Failed to load templates")
      setTemplates([])
      toast.error("Failed to load agent templates")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load templates on mount and when settings change
  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // Function to reset templates from filesystem
  const resetTemplates = async () => {
    try {
      const response = await fetch("/api/agents/templates", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load_from_fs' })
      })

      if (!response.ok) {
        throw new Error('Failed to reset templates')
      }

      const { templates: freshTemplates } = await response.json()
      
      // Update localStorage
      await storage.set('agent_templates', freshTemplates)
      
      // Update state
      setTemplates(freshTemplates)
      toast.success('Templates reset to filesystem version')
    } catch (error) {
      console.error('Failed to reset templates:', error)
      toast.error('Failed to reset templates')
    }
  }

  // Function to save template to filesystem
  const saveTemplateToFS = async (template: AgentTemplate) => {
    try {
      const response = await fetch("/api/agents/templates", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'save_to_fs',
          template
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save template')
      }

      const { templates: updatedTemplates } = await response.json()
      
      // Update localStorage and state
      await storage.set('agent_templates', updatedTemplates)
      setTemplates(updatedTemplates)
      
      toast.success('Template saved to filesystem')
    } catch (error) {
      console.error('Failed to save template:', error)
      toast.error('Failed to save template')
    }
  }

  const handleChat = (agentId: string) => {
    router.push(`/chat?agent=${agentId}`)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
            <p className="text-muted-foreground mt-2">Loading templates...</p>
          </div>
        </div>
        <Separator className="my-6" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="h-6 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="h-6 w-20 bg-muted animate-pulse rounded" />
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-4">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Error Loading Templates</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
              <Button 
                variant="destructive" 
                onClick={async () => {
                  try {
                    await storage.remove('agent_templates');
                    toast.success('Storage cleared successfully');
                    window.location.reload();
                  } catch (error) {
                    console.error('Failed to clear storage:', error);
                    toast.error('Failed to clear storage');
                  }
                }}
              >
                Reset Storage
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              If you keep seeing errors, try using the "Reset Storage" button to clear cached data.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
          <p className="text-muted-foreground mt-2">Open Source AI Agents & Assistants</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Agent
        </Button>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-8">
        {templates.map((template) => (
          <Card key={template.agentId} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    {template.name}
                  </CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </div>
                <Badge variant="secondary">
                  Ready
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium">Model</div>
                  <div className="text-sm text-muted-foreground">
                    {template.nodeConfigurations?.['llm.anthropic']?.model || "Default"}
                  </div>
                </div>
                {template.modules && template.modules.length > 0 && (
                  <div>
                    <div className="text-sm font-medium">Modules</div>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {template.modules.map((module) => (
                        <Badge key={module} variant="outline">
                          {module}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 pt-6">
              <Button 
                className="flex-1" 
                variant="default"
                onClick={() => handleChat(template.agentId)}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Chat
              </Button>
              <SettingsSheet
                open={settingsOpen && selectedAgentId === template.agentId}
                onOpenChange={(open) => {
                  setSettingsOpen(open)
                  if (!open) setSelectedAgentId(null)
                }}
                agentId={template.agentId}
              >
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setSelectedAgentId(template.agentId)
                    setSettingsOpen(true)
                  }}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Configure
                </Button>
              </SettingsSheet>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
} 