'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Settings, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentControlsProps {
  className?: string;
  onChat?: () => void;
  onSettings?: () => void;
}

export function AgentControls({ className, onChat, onSettings }: AgentControlsProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button variant="outline" size="sm" onClick={onChat} className="gap-2">
        <MessageSquare className="h-4 w-4" />
        Chat
      </Button>

      <Button variant="outline" size="sm" onClick={onSettings} className="gap-2">
        <Settings className="h-4 w-4" />
        Configure
      </Button>
    </div>
  );
}
