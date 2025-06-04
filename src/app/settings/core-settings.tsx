'use client';

import { memo } from 'react';
import { AlertCircle, Bug, Shield } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

interface CoreSettingsProps {
  settings: {
    core: {
      byokOnly: boolean;
      debugMode?: boolean;
    };
  };
  onByokChange: (checked: boolean) => void;
  onDebugModeChange: (checked: boolean) => void;
}

function CoreSettingsComponent({
  settings,
  onByokChange,
  onDebugModeChange
}: CoreSettingsProps) {
  return (
    <Card>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5" />
          <h3 className="text-lg font-medium">Core Settings</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Configure core application behavior
        </p>

        <div className="grid gap-6">
          {/* BYOK Only Mode */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Bring Your Own Keys Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Use only user-provided API keys (no fallback to environment
                  variables)
                </p>
              </div>
              <Switch
                checked={settings.core.byokOnly}
                onCheckedChange={(checked) => {
                  // Update localStorage directly in addition to calling the regular handler
                  try {
                    localStorage.setItem(
                      'byokOnly',
                      checked ? 'true' : 'false'
                    );

                    // Add info log to show BYOK mode status
                    console.info(
                      `BYOK mode ${checked ? 'enabled' : 'disabled'} via settings interface`
                    );
                  } catch (e) {
                    console.warn(
                      'Failed to update localStorage BYOK setting:',
                      e
                    );
                  }

                  // Call the regular handler
                  onByokChange(checked);
                }}
              />
            </div>

            {settings.core.byokOnly && (
              <div className="rounded-md bg-yellow-500/15 p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <p className="text-sm text-yellow-500">
                    Warning: With BYOK mode enabled, agents will fail if you
                    haven&apos;t provided your own API keys in settings.
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Debug Mode */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  Debug Mode
                  <Bug className="h-4 w-4 text-muted-foreground" />
                </Label>
                <p className="text-sm text-muted-foreground">
                  Show additional debugging information
                </p>
              </div>
              <Switch
                checked={settings.core.debugMode || false}
                onCheckedChange={onDebugModeChange}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const CoreSettings = memo(CoreSettingsComponent);
