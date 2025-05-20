import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChatSkeletonProps {
  agentName?: string;
}

// Mermaid diagram skeleton for streaming state
export function MermaidSkeleton() {
  return (
    <div className="relative mb-4">
      <div className="border rounded-md p-4 overflow-hidden bg-white dark:bg-slate-900 dark:border-slate-700 shadow-sm">
        {/* Header with diagram type and title */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center">
            <div className="h-5 w-16 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded animate-pulse"></div>
            <div className="ml-2 h-5 w-24 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded animate-pulse delay-100"></div>
          </div>
          <div className="text-xs px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 animate-pulse">
            <span className="font-mono">mermaid</span>
          </div>
        </div>

        {/* Main diagram area with advanced node loading animation */}
        <div className="h-56 w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-md flex items-center justify-center relative overflow-hidden backdrop-blur-sm shadow-sm">
          {/* Graph grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(156,163,175,0.1)_1px,transparent_1px),linear-gradient(to_right,rgba(156,163,175,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

          {/* First node */}
          <div className="absolute left-1/4 top-1/3 w-24 h-16 rounded-md border-2 border-blue-200 dark:border-blue-800 bg-blue-50/90 dark:bg-blue-950/90 flex items-center justify-center shadow-sm z-10 animate-diagramPulse">
            <div className="h-4 w-14 bg-gradient-to-r from-blue-200 to-blue-300 dark:from-blue-700 dark:to-blue-600 rounded animate-pulse"></div>
          </div>

          {/* Connection arrow */}
          <div className="absolute left-[calc(25%+96px)] top-[calc(33%+8px)] w-[60px] h-0.5 bg-gradient-to-r from-slate-400 to-slate-300 dark:from-slate-500 dark:to-slate-600 origin-left animate-arrowPulse"></div>
          <div className="absolute left-[calc(25%+154px)] top-[calc(33%+6px)] w-3 h-3 border-t-2 border-r-2 border-slate-400 dark:border-slate-500 rotate-45 animate-arrowPulse"></div>

          {/* Second node */}
          <div className="absolute left-[calc(25%+170px)] top-1/3 w-24 h-16 rounded-md border-2 border-purple-200 dark:border-purple-800 bg-purple-50/90 dark:bg-purple-950/90 flex items-center justify-center shadow-sm opacity-0 animate-diagramFadeIn delay-500 fill-forward">
            <div className="h-4 w-14 bg-gradient-to-r from-purple-200 to-purple-300 dark:from-purple-700 dark:to-purple-600 rounded animate-pulse"></div>
          </div>

          {/* Third node appearing with delay */}
          <div className="absolute left-[calc(25%+100px)] top-[calc(33%+80px)] w-24 h-16 rounded-md border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-950/90 flex items-center justify-center shadow-sm opacity-0 animate-diagramFadeIn delay-1000 fill-forward">
            <div className="h-4 w-14 bg-gradient-to-r from-emerald-200 to-emerald-300 dark:from-emerald-700 dark:to-emerald-600 rounded animate-pulse"></div>
          </div>

          {/* Connection lines to third node */}
          <div className="absolute left-[calc(25%+12px)] top-[calc(33%+16px)] w-[1px] h-[64px] bg-slate-300 dark:bg-slate-600 opacity-0 animate-diagramFadeIn delay-1200 fill-forward"></div>
          <div className="absolute left-[calc(25%+12px)] top-[calc(33%+80px)] w-[88px] h-[1px] bg-slate-300 dark:bg-slate-600 opacity-0 animate-diagramFadeIn delay-1400 fill-forward"></div>
          <div className="absolute left-[calc(25%+182px)] top-[calc(33%+16px)] w-[1px] h-[64px] bg-slate-300 dark:bg-slate-600 opacity-0 animate-diagramFadeIn delay-1200 fill-forward"></div>
          <div className="absolute left-[calc(25%+100px)] top-[calc(33%+80px)] w-[82px] h-[1px] bg-slate-300 dark:bg-slate-600 opacity-0 animate-diagramFadeIn delay-1400 fill-forward"></div>

          {/* Advanced progress indicator */}
          <div className="absolute bottom-3 w-11/12 flex items-center px-1">
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden w-full relative">
              <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 rounded-full animate-progressBar absolute top-0 left-0"></div>
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%)] animate-shimmer"></div>
            </div>
          </div>
        </div>

        {/* Enhanced loading footer */}
        <div className="mt-3 flex justify-between items-center">
          <div className="flex items-center">
            <div className="h-4 w-6 rounded-sm bg-blue-100 dark:bg-blue-900 mr-1.5"></div>
            <div className="h-4 w-24 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded animate-pulse"></div>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            <span>preparing diagram</span>
            <span className="ml-1 inline-flex overflow-hidden">
              <span className="animate-loadingDot delay-0">.</span>
              <span className="animate-loadingDot delay-200">.</span>
              <span className="animate-loadingDot delay-400">.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatSkeleton({ agentName }: ChatSkeletonProps) {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] md:-mx-8 overflow-hidden">
      {/* Header skeleton */}
      <div className="flex-none bg-background">
        <div className="mx-auto w-full max-w-4xl px-4 py-3">
          <div className="flex items-center gap-3">
            {agentName ? (
              <h1 className="text-xl font-semibold">{agentName}</h1>
            ) : (
              <Skeleton className="h-7 w-48" />
            )}
            <Button variant="ghost" size="icon" disabled className="h-8 w-8 opacity-50">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Message area skeleton */}
      <div className="flex-1 overflow-y-auto h-full min-h-0 flex flex-col">
        <div className="mx-auto w-full max-w-4xl px-4 py-4 space-y-6">
          {/* First message bubble - appears first */}
          <div className="flex flex-col space-y-2 animate-pulse">
            <Skeleton className="h-5 w-24 mb-2" />
            <Skeleton className="h-24 w-full max-w-[75%]" />
          </div>

          {/* Second message bubble - appears with delay */}
          <div className="flex flex-col space-y-2 items-end animate-fadeIn opacity-0 delay-300">
            <Skeleton className="h-5 w-24 mb-2" />
            <Skeleton className="h-16 w-full max-w-[75%]" />
          </div>

          {/* Third message bubble - appears with longer delay */}
          <div className="flex flex-col space-y-2 animate-fadeIn opacity-0 delay-600">
            <Skeleton className="h-5 w-24 mb-2" />
            <Skeleton className="h-36 w-full max-w-[75%]" />
          </div>
        </div>
      </div>

      {/* Chat input skeleton */}
      <div className="flex-none bg-background sticky bottom-0 left-0 right-0 z-10">
        <div className="mx-auto w-full max-w-4xl px-4 py-2">
          <div className="relative">
            <Skeleton className="h-12 w-full rounded-lg" />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
