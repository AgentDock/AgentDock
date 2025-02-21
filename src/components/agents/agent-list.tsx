'use client';

/**
 * @fileoverview Agent list component for displaying and managing agents.
 */

import { useCallback } from 'react';
import { useAgents, useAgentActions } from '@/lib/store/hooks';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Square, AlertCircle, MessageSquare, Plus } from 'lucide-react';
import Link from 'next/link';
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorInfo } from "react";
import { Agent, AgentState } from "@/lib/store/types";

/**
 * Agent state badge colors
 */
const stateBadgeVariants: Record<AgentState, { variant: "default" | "destructive" | "outline" | "secondary", animate?: boolean }> = {
  'CREATED': { variant: "secondary" },
  'INITIALIZING': { variant: "secondary", animate: true },
  'READY': { variant: "default" },
  'RUNNING': { variant: "default", animate: true },
  'PAUSED': { variant: "outline" },
  'ERROR': { variant: "destructive" },
  'STOPPED': { variant: "secondary" }
};

/**
 * Agent list component
 */
function BaseAgentList() {
  const agents = useAgents();
  const { removeAgent, setActiveAgent } = useAgentActions();

  /**
   * Handle agent selection
   */
  const handleSelect = useCallback((id: string) => {
    setActiveAgent(id);
  }, [setActiveAgent]);

  /**
   * Handle agent deletion
   */
  const handleDelete = useCallback((id: string) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      removeAgent(id);
    }
  }, [removeAgent]);

  if (agents.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>No Agents</CardTitle>
          <CardDescription>Get started by creating your first AI agent</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Button size="lg">
            <Plus className="mr-2 h-5 w-5" />
            Create New Agent
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>AI Agents</CardTitle>
          <CardDescription>Manage and monitor your active agents</CardDescription>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Agent
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Agent</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[200px]">Last Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent: Agent) => {
                const badgeConfig = stateBadgeVariants[agent.state];
                const chatUrl = agent.metadata.chatWindow?.url || `/chat?agent=${agent.id}`;
                return (
                  <TableRow
                    key={agent.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setActiveAgent(agent.id)}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="font-medium">{agent.name}</div>
                        {agent.description && (
                          <div className="text-sm text-muted-foreground">
                            {agent.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={badgeConfig.variant}
                        className={badgeConfig.animate ? "animate-pulse" : ""}
                      >
                        {agent.state}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(agent.metadata.lastStateChange).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={{
                            pathname: chatUrl.startsWith('/') ? chatUrl : '/chat',
                            query: chatUrl.startsWith('/') ? undefined : { url: chatUrl }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button size="sm" variant="outline">
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Chat
                          </Button>
                        </Link>
                        {agent.state === 'READY' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              agent.start?.();
                            }}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {agent.state === 'RUNNING' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              agent.pause?.();
                            }}
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        {agent.state === 'PAUSED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              agent.resume?.();
                            }}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {agent.state !== 'STOPPED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              agent.stop?.();
                            }}
                          >
                            <Square className="h-4 w-4" />
                          </Button>
                        )}
                        {agent.state === 'ERROR' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              alert(agent.metadata.error?.message);
                            }}
                          >
                            <AlertCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(agent.id);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentList() {
  return (
    <ErrorBoundary
      onError={(error: Error, errorInfo: ErrorInfo) => {
        console.error("Error in AgentList:", error, errorInfo);
      }}
      resetOnPropsChange
    >
      <BaseAgentList />
    </ErrorBoundary>
  );
} 