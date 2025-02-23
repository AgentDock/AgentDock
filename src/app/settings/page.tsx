"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { SecureStorage } from 'agentdock-core'
import { ErrorBoundary } from "@/components/error-boundary"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorInfo } from "react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Save, AlertCircle, KeyRound, Bug, Shield } from "lucide-react"

interface GlobalSettings {
  apiKeys: {
    openai: string
    anthropic: string
    serpapi: string
  }
  core: {
    byokOnly: boolean
    debugMode?: boolean
  }
  models?: {
    anthropic?: {
      valid: boolean
      models: Array<{
        id: string
        name: string
        description: string
        context_window: number
      }>
    }
  }
}

const DEFAULT_SETTINGS: GlobalSettings = {
  apiKeys: {
    openai: "",
    anthropic: "",
    serpapi: ""
  },
  core: {
    byokOnly: false,
    debugMode: false
  }
}

// Memoize API key providers to prevent recreation on each render
const API_KEY_PROVIDERS = [
  { key: 'openai', label: 'OpenAI API Key', icon: KeyRound },
  { key: 'anthropic', label: 'Anthropic API Key', icon: KeyRound },
  { key: 'serpapi', label: 'SERP API Key', icon: KeyRound }
] as const;

// Create a single instance for settings
const storage = SecureStorage.getInstance('agentdock');

function SettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setInitialLoading(true)
        const storedSettings = await storage.get<GlobalSettings>("global_settings")
        if (storedSettings) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...storedSettings
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load settings"
        setError(message)
        toast.error(message)
      } finally {
        setInitialLoading(false)
      }
    }
    loadSettings()
  }, [])

  // Handle save with validation
  const handleSave = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      await storage.set("global_settings", settings)
      toast.success("Settings saved successfully")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save settings"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [settings])

  // Handle API key changes with validation
  const handleApiKeyChange = useCallback((provider: keyof GlobalSettings['apiKeys']) => async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setSettings(prev => ({
      ...prev,
      apiKeys: {
        ...prev.apiKeys,
        [provider]: value
      }
    }));
    setError(null);

    // If it's Anthropic, fetch available models
    if (provider === 'anthropic' && value.length > 0) {
      try {
        const response = await fetch('/api/anthropic/models', {
          headers: {
            'x-api-key': value
          }
        });

        const data = await response.json();
        
        if (data.valid) {
          setSettings(prev => ({
            ...prev,
            models: {
              ...prev.models,
              anthropic: data
            }
          }));
          toast.success('Successfully validated Anthropic API key and fetched models');
        } else {
          toast.error(data.error || 'Invalid Anthropic API key');
        }
      } catch (error) {
        console.error('Failed to validate Anthropic API key:', error);
        toast.error('Failed to validate Anthropic API key');
      }
    }
  }, []);

  // Handle BYOK only mode toggle
  const handleByokOnlyChange = useCallback((checked: boolean) => {
    // If trying to turn off BYOK mode, prevent it
    if (!checked) {
      toast.error("BYOK mode cannot be disabled once enabled")
      return
    }
    
    setSettings(prev => ({
      ...prev,
      core: {
        ...prev.core,
        byokOnly: checked
      }
    }))
    setError(null)
  }, [])

  // Handle debug mode toggle
  const handleDebugModeChange = useCallback((checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      core: {
        ...prev.core,
        debugMode: checked
      }
    }))
  }, [])

  // Memoize loading skeleton component
  const LoadingSkeleton = useMemo(() => (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="grid gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-56" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  ), []);

  if (initialLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-5 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        {LoadingSkeleton}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Manage your API keys and application preferences
            </p>
          </div>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Saving...</span>
              </div>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="flex items-start gap-4 pt-6">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div className="space-y-1">
                <p className="font-medium leading-none">Error Saving Settings</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6">
          {/* Core Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Core Settings
              </CardTitle>
              <CardDescription>
                Configure core application behavior
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>BYOK Only Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Only use provided API keys (no fallback to service keys)
                      </p>
                    </div>
                    <Switch
                      checked={settings.core.byokOnly}
                      onCheckedChange={handleByokOnlyChange}
                    />
                  </div>
                  {settings.core.byokOnly && (
                    <div className="rounded-md bg-yellow-500/15 p-4">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                        <p className="text-sm text-yellow-500">
                          Warning: With this enabled, agents will fail if you haven't provided your own API keys.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                <Separator />
                
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
                      checked={settings.core.debugMode}
                      onCheckedChange={handleDebugModeChange}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API Keys */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Configure your API keys for various services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                {API_KEY_PROVIDERS.map(({ key, label, icon: Icon }) => (
                  <div key={key} className="grid gap-2">
                    <Label htmlFor={key} className="flex items-center gap-2">
                      {label}
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </Label>
                    <div className="relative">
                      <Input
                        id={key}
                        type="password"
                        value={settings.apiKeys[key as keyof GlobalSettings['apiKeys']]}
                        onChange={handleApiKeyChange(key as keyof GlobalSettings['apiKeys'])}
                        placeholder={`Enter your ${label}`}
                        className="pr-20"
                      />
                      {settings.core.debugMode && (
                        <Badge 
                          variant={settings.apiKeys[key as keyof GlobalSettings['apiKeys']] ? "default" : "secondary"}
                          className="absolute right-2 top-1/2 -translate-y-1/2"
                        >
                          {settings.apiKeys[key as keyof GlobalSettings['apiKeys']] ? 'Set' : 'Not Set'}
                        </Badge>
                      )}
                    </div>
                    {key === 'anthropic' && settings.models?.anthropic && (
                      <div className="rounded-md bg-muted p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={settings.models.anthropic.valid ? "default" : "destructive"}>
                            {settings.models.anthropic.valid ? 'Valid' : 'Invalid'}
                          </Badge>
                        </div>
                        {settings.models.anthropic.valid && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Available Models:</p>
                            <div className="grid gap-1.5">
                              {settings.models.anthropic.models.map(model => (
                                <div key={model.id} className="text-sm">
                                  <span className="font-medium">{model.name}</span>
                                  <span className="text-muted-foreground"> - {model.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Debug Information */}
          {settings.core.debugMode && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bug className="h-5 w-5" />
                  Debug Information
                </CardTitle>
                <CardDescription>
                  Technical details for troubleshooting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
                  {JSON.stringify(settings, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

export default function SettingsPageWithErrorBoundary() {
  return (
    <ErrorBoundary
      onError={(error: Error, errorInfo: ErrorInfo) => {
        console.error("Error in Settings Page:", error, errorInfo);
      }}
      resetOnPropsChange
    >
      <SettingsPage />
    </ErrorBoundary>
  );
} 