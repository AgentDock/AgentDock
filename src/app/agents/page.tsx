/**
 * @fileoverview AI Agents page with modern card layout and settings management
 */

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAgents } from "@/lib/store"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bot, MessageSquare, Settings, Plus } from "lucide-react"
import { SettingsSheet } from "@/components/agents/settings-sheet"
import { getLLMInfo } from "@/lib/utils"
import { logger, LogCategory } from 'agentdock-core'
import { templates, TemplateId } from '@/generated/templates'
import { Skeleton } from "@/components/ui/skeleton"

export default function AgentsPage() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const router = useRouter()
  const { isInitialized, templatesValidated, templatesError } = useAgents();

  const handleChat = (agentId: string) => {
    logger.debug(
      LogCategory.SYSTEM,
      'AgentsPage',
      'Navigating to chat',
      { 
        agentId,
        template: templates[agentId as TemplateId]?.name 
      }
    );
    router.push(`/chat?agent=${agentId}`);
  }

  // Show loading state
  if (!isInitialized || !templatesValidated) {
    return (
      <div className="container mx-auto p-8">
        <div className="grid gap-6">
          {Array(3).fill(0).map((_, i) => (
            <Card key={i} className="relative">
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (templatesError) {
    return (
      <div className="container mx-auto py-8">
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Error Loading Templates</CardTitle>
            <CardDescription>{templatesError}</CardDescription>
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
                    {getLLMInfo(template).displayName}
                  </div>
                </div>
                {template.nodes && template.nodes.length > 0 && (
                  <div>
                    <div className="text-sm font-medium">Nodes</div>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {template.nodes.map((node) => (
                        <Badge key={node} variant="outline">
                          {node}
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