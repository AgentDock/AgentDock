import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface AgentErrorProps {
  error: string
  onRetry?: () => void
}

export function AgentError({ error, onRetry }: AgentErrorProps) {
  return (
    <div className="container mx-auto py-8">
      <Card className="p-6 border-red-200 bg-red-50/10">
        <CardHeader>
          <CardTitle className="text-red-600">Error Loading Templates</CardTitle>
          <CardDescription className="text-red-500/80">{error}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={onRetry || (() => window.location.reload())} 
              variant="default" 
              className="bg-red-600 hover:bg-red-700"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 