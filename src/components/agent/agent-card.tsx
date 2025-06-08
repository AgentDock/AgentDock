'use client';

import * as React from 'react';
import { ErrorInfo } from 'react';
import { Bot } from 'lucide-react';

import { ErrorBoundary } from '@/components/error-boundary';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AgentControls } from './agent-controls';

interface AgentCardProps {
  className?: string;
  name: string;
  description: string;
  model: string;
  tools: number;
  lastUpdated: string;
  onChat?: () => void;
  onSettings?: () => void;
}

export function AgentCardSkeleton() {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-6 w-48" />
            </div>
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <Skeleton className="h-4 w-16 mb-1" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div>
            <Skeleton className="h-4 w-16 mb-1" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="col-span-2">
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

function BaseAgentCard({
  className,
  name,
  description,
  model,
  tools,
  lastUpdated,
  onChat,
  onSettings
}: AgentCardProps) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <CardTitle>{name}</CardTitle>
            </div>
            <CardDescription>{description}</CardDescription>
          </div>
          <AgentControls
            onChat={onChat}
            onSettings={onSettings}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div>
            <div className="font-medium">Model</div>
            <div>{model}</div>
          </div>
          <div>
            <div className="font-medium">Tools</div>
            <div>{tools} available</div>
          </div>
          <div className="col-span-2">
            <div className="font-medium">Last Updated</div>
            <div>{lastUpdated}</div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

export function AgentCard(props: AgentCardProps) {
  return (
    <ErrorBoundary
      onError={(error: Error, errorInfo: ErrorInfo) => {
        console.error(
          `Error in AgentCard for agent ${props.name}:`,
          error,
          errorInfo
        );
      }}
      resetOnPropsChange
    >
      <BaseAgentCard {...props} />
    </ErrorBoundary>
  );
}
