'use client';

import { memo } from 'react';

import { Card } from '@/components/ui/card';

interface DebugPanelProps {
  settings: {
    apiKeys: {
      openai: string;
      anthropic: string;
      [key: string]: string;
    };
    [key: string]: any;
  };
}

function DebugPanelComponent({ settings }: DebugPanelProps) {
  return (
    <Card>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-medium">Current Settings</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Raw settings object for review.
        </p>

        <div className="space-y-4">
          <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
            {JSON.stringify(settings, null, 2)}
          </pre>
        </div>
      </div>
    </Card>
  );
}

export const DebugPanel = memo(DebugPanelComponent);
