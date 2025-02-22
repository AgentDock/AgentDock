/**
 * @fileoverview AI Agents page with modern card layout and settings management
 */

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAgents } from "@/lib/store"
import { AgentTemplate } from "@/lib/store/types"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bot, MessageSquare, Settings, Plus } from "lucide-react"
import { toast } from "sonner"
import { SettingsSheet } from "@/components/agents/settings-sheet"
import { SecureStorage, logger, LogCategory } from 'agentdock-core'
import { templates } from '@/generated/templates'

// Initialize storage
const storage = SecureStorage.getInstance('agentdock');

export default function AgentsPage() {
  const { initialize, isInitialized } = useAgents()
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

  // Load templates from bundled templates
  useEffect(() => {
    try {
      setIsLoading(true)
      setError(null)

      logger.debug(
        LogCategory.SYSTEM,
        'AgentsPage',
        'Loading bundled templates'
      )

      // Convert templates object to array
      const templateArray = Object.values(templates)
      if (templateArray.length === 0) {
        throw new Error('No templates available')
      }

      logger.info(
        LogCategory.SYSTEM,
        'AgentsPage',
        'Templates loaded successfully',
        { count: templateArray.length }
      )

      setIsLoading(false)
    } catch (error) {
      logger.error(
        LogCategory.SYSTEM,
        'AgentsPage',
        'Failed to load templates',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      setError(error instanceof Error ? error.message : "Failed to load templates")
      toast.error("Failed to load agent templates")
    } finally {
      setIsLoading(false)
    }
  }, [])

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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-8">
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
            </div>
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
        {Object.values(templates).map((template) => (
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