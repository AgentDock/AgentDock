'use client';

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LLMProvider, logger, LogCategory } from 'agentdock-core';
import { SecureStorage } from 'agentdock-core/storage/secure-storage';
import { useAgents } from '@/lib/store/index';
import { toast } from 'sonner';
import { getLLMInfo } from '@/lib/utils';
import { ModelService } from '@/lib/services/model-service';
import type { GlobalSettings } from '@/lib/types/settings';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// Create a single instance for storage
const storage = SecureStorage.getInstance('agentdock');

export interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId?: string; // Optional - if provided, enables per-agent API key option
  providerOverride?: LLMProvider; // Optional - if provided, uses this provider instead of detecting from agent
  onSuccess?: () => void; // Callback when API key is successfully saved
}

export function ApiKeyDialog({
  open,
  onOpenChange,
  agentId,
  providerOverride,
  onSuccess,
}: ApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState('');
  const [saveType, setSaveType] = useState<'agent' | 'global'>(agentId ? 'agent' : 'global');
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { agents, updateAgentRuntime } = useAgents.getState();

  // Get provider info - either from override or from agent
  const providerInfo = React.useMemo(() => {
    if (providerOverride) {
      return {
        provider: providerOverride,
        displayName: providerOverride.charAt(0).toUpperCase() + providerOverride.slice(1),
      };
    }

    if (!agentId) return { provider: 'anthropic', displayName: 'Anthropic' };

    const agent = agents.find((a) => a.agentId === agentId);
    if (!agent) return { provider: 'anthropic', displayName: 'Anthropic' };

    try {
      const info = getLLMInfo(agent);
      // Extract the base provider name without 'llm.' prefix if it exists
      const providerName = info.provider.replace('llm.', '') as LLMProvider;
      return {
        provider: providerName,
        displayName: info.provider.includes('.')
          ? info.provider.split('.')[1].charAt(0).toUpperCase() +
            info.provider.split('.')[1].slice(1)
          : providerName.charAt(0).toUpperCase() + providerName.slice(1),
      };
    } catch (error) {
      console.error('Failed to get LLM info:', error);
      return { provider: 'anthropic', displayName: 'Anthropic' };
    }
  }, [agentId, agents, providerOverride]);

  // Clear form on open
  useEffect(() => {
    if (open) {
      setApiKey('');
    }
  }, [open]);

  // Save API key to appropriate storage
  const handleSave = useCallback(async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setIsValidating(true);
    try {
      // Validate the API key
      const isValid = await ModelService.validateApiKey(
        providerInfo.provider as LLMProvider,
        apiKey.trim(),
      );

      if (!isValid) {
        toast.error(`Invalid ${providerInfo.displayName} API key`);
        setIsValidating(false);
        return;
      }

      // API key is valid, now save it
      setIsSaving(true);

      if (saveType === 'agent' && agentId) {
        // Save to agent-specific settings
        await updateAgentRuntime(agentId, {
          apiKey: apiKey.trim(),
        });

        logger.info(LogCategory.SYSTEM, 'ApiKeyDialog', 'Saved agent-specific API key', {
          provider: providerInfo.provider,
          agentId,
        });
      } else {
        // Save to global settings
        const globalSettings = (await storage.get<GlobalSettings>('global_settings')) || {
          apiKeys: {
            openai: '',
            anthropic: '',
          },
          core: {
            byokOnly: false,
          },
        };

        const updatedSettings = {
          ...globalSettings,
          apiKeys: {
            ...globalSettings.apiKeys,
            [providerInfo.provider]: apiKey.trim(),
          },
        };

        await storage.set('global_settings', updatedSettings);

        logger.info(LogCategory.SYSTEM, 'ApiKeyDialog', 'Saved global API key', {
          provider: providerInfo.provider,
        });
      }

      // Add a small delay to ensure storage updates are propagated
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Validate the saved key again to ensure it's properly stored and accessible
      const finalValidation = await ModelService.validateApiKey(
        providerInfo.provider as LLMProvider,
        apiKey.trim(),
      );

      if (!finalValidation) {
        throw new Error('API key validation failed after saving');
      }

      toast.success(`${providerInfo.displayName} API key saved successfully`);

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Close dialog
      onOpenChange(false);
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'ApiKeyDialog', 'Failed to save API key', {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error('Failed to save API key. Please try again.');
    } finally {
      setIsValidating(false);
      setIsSaving(false);
    }
  }, [apiKey, saveType, agentId, updateAgentRuntime, providerInfo, onOpenChange, onSuccess]);

  // Handle Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isValidating && !isSaving) {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave, isValidating, isSaving],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{providerInfo.displayName} API Key</DialogTitle>
          <DialogDescription>
            Enter your {providerInfo.displayName} API key to use this agent.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="apiKey">{providerInfo.displayName} API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder={`Enter your ${providerInfo.displayName} API key`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            <p className="text-sm text-muted-foreground">
              Your API key will be encrypted and stored securely.
            </p>
          </div>

          {agentId && (
            <div className="grid gap-2">
              <Label>Save API Key As</Label>
              <RadioGroup
                value={saveType}
                onValueChange={(value) => setSaveType(value as 'agent' | 'global')}
                className="grid gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="agent" id="agent" />
                  <Label htmlFor="agent" className="font-normal">
                    Agent-specific key (only this agent)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="global" id="global" />
                  <Label htmlFor="global" className="font-normal">
                    Global key (all {providerInfo.displayName} agents)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isValidating || isSaving}>
            {isValidating ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Validating...</span>
              </div>
            ) : isSaving ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Saving...</span>
              </div>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
