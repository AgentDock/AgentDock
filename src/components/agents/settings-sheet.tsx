"use client";

import { useState, useEffect, useCallback, useMemo, memo, ErrorInfo } from "react";
import { useAgents } from "@/lib/store";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { SecureStorage, logger, LogCategory } from 'agentdock-core';
import { ErrorBoundary } from "@/components/error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { templates, TemplateId } from '@/generated/templates';
import type { AgentSettings, GlobalSettings } from '@/lib/types/settings';

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  children: React.ReactNode;
}

const storage = SecureStorage.getInstance('agentdock');

// Memoize the sheet contents component to prevent unnecessary re-renders
const SheetContents = memo(({ 
  settings, 
  handleApiKeyChange,
  handleTemperatureChange,
  handleMaxTokensChange,
  handleUseCustomApiKeyChange,
}: {
  settings: AgentSettings;
  handleApiKeyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTemperatureChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleMaxTokensChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUseCustomApiKeyChange: (checked: boolean) => void;
}) => (
  <div className="grid gap-6 py-6">
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="useCustomApiKey">Use Custom API Key</Label>
        <Switch
          id="useCustomApiKey"
          checked={settings.useCustomApiKey}
          onCheckedChange={handleUseCustomApiKeyChange}
        />
      </div>
      {settings.useCustomApiKey && (
        <div className="grid gap-2">
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            id="apiKey"
            type="password"
            placeholder="Enter your API key"
            value={settings.apiKey}
            onChange={handleApiKeyChange}
          />
          <p className="text-sm text-muted-foreground">
            Your API key will be encrypted and stored securely.
          </p>
        </div>
      )}
    </div>

    <Separator />

    <div className="grid gap-4">
      <Label>Advanced Settings</Label>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="temperature">Temperature</Label>
          <Input
            id="temperature"
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={settings.temperature}
            onChange={handleTemperatureChange}
          />
          <p className="text-xs text-muted-foreground">
            Controls randomness (0-2)
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="maxTokens">Max Tokens</Label>
          <Input
            id="maxTokens"
            type="number"
            min="1"
            max="32000"
            value={settings.maxTokens}
            onChange={handleMaxTokensChange}
          />
          <p className="text-xs text-muted-foreground">
            Maximum response length
          </p>
        </div>
      </div>
    </div>
  </div>
));

SheetContents.displayName = 'SheetContents';

// Memoize the loading skeleton component
const SheetLoadingSkeleton = memo(() => (
  <div className="grid gap-6 py-6">
    <div className="grid gap-2">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-4 w-64" />
    </div>

    <Skeleton className="h-px w-full" />

    <div className="grid gap-4">
      <Skeleton className="h-5 w-40" />
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    </div>
  </div>
));

SheetLoadingSkeleton.displayName = 'SheetLoadingSkeleton';

function BaseSettingsSheet({
  open,
  onOpenChange,
  agentId,
  children,
}: SettingsSheetProps) {
  const { agents, updateAgentRuntime } = useAgents.getState();
  const agent = useMemo(() => agents.find(a => a.agentId === agentId), [agents, agentId]);
  const [settings, setSettings] = useState<AgentSettings>({
    apiKey: agent?.runtimeSettings?.apiKey || "",
    useCustomApiKey: !!agent?.runtimeSettings?.apiKey,
    temperature: agent?.runtimeSettings?.temperature?.toString() || "0.7",
    maxTokens: agent?.runtimeSettings?.maxTokens?.toString() || "4096"
  });

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Load settings when sheet opens
  useEffect(() => {
    if (open) {
      try {
        setInitialLoading(true);
        setSettings({
          apiKey: agent?.runtimeSettings?.apiKey || "",
          useCustomApiKey: !!agent?.runtimeSettings?.apiKey,
          temperature: agent?.runtimeSettings?.temperature?.toString() || "0.7",
          maxTokens: agent?.runtimeSettings?.maxTokens?.toString() || "4096"
        });
      } catch (error) {
        console.error("Failed to load settings:", error);
        toast.error(error instanceof Error ? error.message : "Failed to load settings");
      } finally {
        setInitialLoading(false);
      }
    }
  }, [open, agent]);

  // Memoize save handler
  const handleSave = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      // Validate settings
      const temperature = parseFloat(settings.temperature);
      if (isNaN(temperature) || temperature < 0 || temperature > 2) {
        throw new Error("Temperature must be between 0 and 2");
      }
      const maxTokens = parseInt(settings.maxTokens);
      if (isNaN(maxTokens) || maxTokens < 1 || maxTokens > 32000) {
        throw new Error("Max tokens must be between 1 and 32000");
      }
      if (settings.useCustomApiKey && !settings.apiKey.trim()) {
        throw new Error("API key is required when using custom key");
      }

      // Update runtime settings
      await updateAgentRuntime(agentId, {
        apiKey: settings.useCustomApiKey ? settings.apiKey.trim() : undefined,
        temperature,
        maxTokens
      });
      
      toast.success("Settings saved");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setLoading(false);
    }
  }, [settings, agentId, onOpenChange, updateAgentRuntime]);

  const handleApiKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSettings(prev => ({ ...prev, apiKey: value }));
  }, []);

  // Validate API key when it changes
  useEffect(() => {
    const validateApiKey = async () => {
      if (!settings.useCustomApiKey || !settings.apiKey.trim()) return;

      try {
        const response = await fetch('/api/anthropic/models', {
          headers: {
            'x-api-key': settings.apiKey
          }
        });

        const data = await response.json();
        
        if (data.valid) {
          toast.success('API key validated successfully');
        } else {
          toast.error(data.error || 'Invalid API key');
        }
      } catch (error) {
        console.error('Failed to validate API key:', error);
        toast.error('Failed to validate API key');
      }
    };

    // Debounce the validation to avoid too many requests
    const timeoutId = setTimeout(validateApiKey, 500);
    return () => clearTimeout(timeoutId);
  }, [settings.useCustomApiKey, settings.apiKey]);

  const handleTemperatureChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({ ...prev, temperature: e.target.value }));
  }, []);

  const handleMaxTokensChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({ ...prev, maxTokens: e.target.value }));
  }, []);

  const handleUseCustomApiKeyChange = useCallback((checked: boolean) => {
    setSettings(prev => ({ ...prev, useCustomApiKey: checked }));
  }, []);

  // Memoize close handler
  const handleClose = useCallback(() => {
    if (loading) return;
    onOpenChange(false);
  }, [loading, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-hidden flex flex-col h-full">
        <SheetHeader>
          <SheetTitle>
            Agent Runtime Settings - {agent?.name}
          </SheetTitle>
          <SheetDescription>
            Configure this agent's runtime settings and parameters.
          </SheetDescription>
        </SheetHeader>
          
        <ErrorBoundary>
          <ScrollArea className="flex-1">
            <div className="px-6">
              {initialLoading ? (
                <SheetLoadingSkeleton />
              ) : (
                <SheetContents
                  settings={settings}
                  handleApiKeyChange={handleApiKeyChange}
                  handleTemperatureChange={handleTemperatureChange}
                  handleMaxTokensChange={handleMaxTokensChange}
                  handleUseCustomApiKeyChange={handleUseCustomApiKeyChange}
                />
              )}
            </div>
          </ScrollArea>
        </ErrorBoundary>

        <div className="px-6 py-4 border-t border-border">
          <div className="flex items-center justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>Saving...</span>
                </div>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function SettingsSheet(props: SettingsSheetProps) {
  return (
    <ErrorBoundary
      onError={(error: Error, errorInfo: ErrorInfo) => {
        console.error(`Error in Settings Sheet for agent ${props.agentId}:`, error, errorInfo);
      }}
      resetOnPropsChange
    >
      <BaseSettingsSheet {...props} />
    </ErrorBoundary>
  );
} 