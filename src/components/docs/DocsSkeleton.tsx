/**
 * @fileoverview Documentation skeleton component
 * Provides loading state for documentation pages that matches the actual UI
 */

import { Skeleton } from '@/components/ui/skeleton';

export function DocsSkeleton() {
  return (
    <div className="docs-page-container">
      <div className="px-4 py-6 md:px-8 md:py-6">
        {/* Title and subtitle */}
        <div className="mb-10 space-y-4">
          <Skeleton className="h-8 w-3/4 max-w-xl" />
          <Skeleton className="h-5 w-full max-w-2xl" />
        </div>

        {/* Content sections */}
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
          {/* Section 1 */}
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          {/* Code block */}
          <Skeleton className="h-40 w-full" />

          {/* Section 2 */}
          <div className="space-y-3">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>

          {/* List items */}
          <div className="space-y-3 pl-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-3 w-3 rounded-full flex-shrink-0" />
              <Skeleton className="h-4 w-11/12" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-3 w-3 rounded-full flex-shrink-0" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-3 w-3 rounded-full flex-shrink-0" />
              <Skeleton className="h-4 w-10/12" />
            </div>
          </div>

          {/* Section 3 */}
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>

        {/* Navigation links */}
        <div className="mt-10 pt-6 border-t border-border/40 flex items-center justify-between">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
    </div>
  );
}
