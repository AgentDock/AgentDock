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
import { motion } from "framer-motion"

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
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-5 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array(6).fill(0).map((_, i) => (
            <Card key={i} className="relative overflow-hidden border border-border/40">
              <div className="absolute inset-0 bg-gradient-to-br from-background/5 to-background/20 opacity-10"></div>
              <CardHeader>
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-4 w-full max-w-[280px]" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-32 mb-4" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
              <CardFooter className="flex gap-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (templatesError) {
    return (
      <div className="container mx-auto py-8">
        <Card className="p-6 border-red-200 bg-red-50/10">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Templates</CardTitle>
            <CardDescription className="text-red-500/80">{templatesError}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button onClick={() => window.location.reload()} variant="default" className="bg-red-600 hover:bg-red-700">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container py-6 space-y-6 md:py-10">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
          <p className="text-muted-foreground">
            Open Source AI Agents & Assistants
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Agent
        </Button>
      </div>
      
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 mt-4">
        {Object.values(templates).map((template, index) => (
          <motion.div
            key={template.agentId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Card className="flex flex-col h-full overflow-hidden group border border-border/50 hover:border-primary/20 transition-all duration-300 hover:shadow-md">
              <CardHeader className="relative pb-4">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="flex items-start justify-between relative">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      {template.name}
                    </CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="px-2 py-1 h-auto bg-secondary/80">
                    Ready
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 pt-0">
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium">Model</div>
                    <div className="text-sm text-muted-foreground">
                      {getLLMInfo(template).displayName}
                    </div>
                  </div>
                  
                  {template.nodes && template.nodes.length > 0 && (
                    <div className="pt-1">
                      <div className="text-sm font-medium mb-1.5">Tools</div>
                      <div className="flex flex-wrap gap-1.5">
                        {template.nodes.map((node) => (
                          <Badge key={node} variant="outline" className="bg-background/50 text-xs px-2 py-0.5">
                            {node.replace('llm.', '')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex gap-2 pt-4 border-t border-border/30 mt-2">
                <Button 
                  className="flex-1 gap-2 bg-primary/90 hover:bg-primary shadow-sm transition-all" 
                  variant="default"
                  onClick={() => handleChat(template.agentId)}
                >
                  <MessageSquare className="h-4 w-4" />
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
                    className="flex-1 gap-2 border-border/60 hover:bg-background transition-all"
                    onClick={() => {
                      setSelectedAgentId(template.agentId)
                      setSettingsOpen(true)
                    }}
                  >
                    <Settings className="h-4 w-4" />
                    Configure
                  </Button>
                </SettingsSheet>
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
} 