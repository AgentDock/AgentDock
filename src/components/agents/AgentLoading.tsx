import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function AgentLoading() {
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
        {Array(6)
          .fill(0)
          .map((_, i) => (
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
  );
}
