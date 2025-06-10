import { Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import type { SessionInfoData } from '@/hooks/use-session-info'; // Import type

interface SessionInfoDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  messagesCount: number;
  sessionData: SessionInfoData | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function SessionInfoDialog({
  isOpen,
  onOpenChange,
  sessionId,
  messagesCount,
  sessionData,
  isLoading,
  error,
  onRefresh
}: SessionInfoDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Session Information</DialogTitle>
          <DialogDescription>
            Details about the current chat session, including ID, message count,
            and cumulative token usage.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-3">
          {/* Session ID */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Session ID
            </label>
            <div className="break-all font-mono text-sm bg-muted p-2 rounded">
              {sessionId || 'N/A'}
            </div>
          </div>

          {/* Messages Count */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Messages in Session
            </label>
            <div className="font-mono text-sm bg-muted p-2 rounded">
              {messagesCount}
            </div>
          </div>

          <Separator />

          {/* Cumulative Usage Section */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-muted-foreground">
                Cumulative Session Usage
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh} // Use passed refresh function
                disabled={isLoading || !sessionId}
                className="h-7 px-2"
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                <span className="ml-1">Refresh</span>
              </Button>
            </div>
            {isLoading && (
              <div className="text-sm text-muted-foreground italic">
                Loading usage...
              </div>
            )}
            {error && (
              <div className="text-sm text-destructive">Error: {error}</div>
            )}
            {/* Use sessionData from props */}
            {!isLoading && !error && sessionData?.cumulativeTokenUsage && (
              <div className="font-mono text-sm bg-muted p-2 rounded space-y-1">
                <div>
                  Prompt Tokens: {sessionData.cumulativeTokenUsage.promptTokens}
                </div>
                <div>
                  Completion Tokens:{' '}
                  {sessionData.cumulativeTokenUsage.completionTokens}
                </div>
                <div className="font-semibold">
                  Total Tokens: {sessionData.cumulativeTokenUsage.totalTokens}
                </div>
              </div>
            )}
            {!isLoading && !error && !sessionData?.cumulativeTokenUsage && (
              <div className="text-sm text-muted-foreground italic">
                No usage data available.
              </div>
            )}
          </div>
        </div>
        {/* No Footer needed, dialog closes on overlay click or escape */}
      </DialogContent>
    </Dialog>
  );
}
