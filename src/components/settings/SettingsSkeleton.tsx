/**
 * @fileoverview Settings page skeleton component
 * Provides loading state for settings that matches the actual settings UI
 */

import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function SettingsSkeleton() {
  return (
    <div className="container py-6">
      {/* Page header */}
      <div className="flex flex-col mb-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Settings cards */}
      <div className="grid gap-6">
        {/* API Keys section */}
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Key inputs */}
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-10 flex-1" />
                    <Skeleton className="h-10 w-20" />
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        {/* Core settings */}
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Toggle settings */}
            {Array(2)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>
              ))}
          </CardContent>
        </Card>

        {/* Font settings */}
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Font selection */}
            {Array(2)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
