"use client"

import { useState, useEffect, useCallback, useMemo, ErrorInfo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { SecureStorage, LLMProvider, logger, LogCategory } from 'agentdock-core'
import { ErrorBoundary } from "@/components/error-boundary"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Save, AlertCircle, KeyRound, Bug, Shield } from "lucide-react"
import { ModelRegistry } from '@/lib/models/registry'
import { ModelService } from '@/lib/services/model-service'

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

// Create a unified model display component
const ModelDisplay = ({ provider, refreshTrigger, setRefreshTrigger: _setRefreshTrigger }: { 
  provider: 'anthropic' | 'openai', 
  refreshTrigger: number,
  setRefreshTrigger: (fn: (prev: number) => number) => void
}) => {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [initialLoad, setInitialLoad] = useState(true);
  
  // Get the API key from settings
  useEffect(() => {
    const getApiKey = async () => {
      try {
        const storedSettings = await storage.get<GlobalSettings>("global_settings");
        if (storedSettings?.apiKeys?.[provider]) {
          setApiKey(storedSettings.apiKeys[provider]);
        }
        setInitialLoad(false);
      } catch (error) {
        logger.error(LogCategory.LLM, '[Settings]', `Error getting API key for ${provider}:`, { error });
        setInitialLoad(false);
      }
    };
    
    getApiKey();
  }, [provider]);
  
  // Function to get models directly from registry via API
  const getModelsFromRegistry = useCallback(async () => {
    if (!apiKey) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/models?provider=${provider}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      
      const data = await response.json();
      logger.debug(LogCategory.LLM, '[ModelDisplay]', `Provider: ${provider}, Models from registry: ${data.count}`);
      
      if (data.models && Array.isArray(data.models)) {
        setModels(data.models);
      } else {
        setModels([]);
      }
    } catch (error) {
      logger.error(LogCategory.LLM, '[Settings]', 'Error fetching models from registry:', { provider, error });
      toast.error(`Failed to fetch ${provider} models from registry`);
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [provider, apiKey]);
  
  // Function to refresh models from the provider API
  const refreshModels = useCallback(async () => {
    if (!apiKey) {
      toast.error(`No API key available for ${provider}`);
      return;
    }
    
    setLoading(true);
    try {
      // Use ModelService to fetch and register models
      await ModelService.fetchAndRegisterModels(provider, apiKey);
      
      // After successful fetch, get models from registry
      await getModelsFromRegistry();
      toast.success(`Successfully refreshed ${provider} models`);
    } catch (error) {
      logger.error(LogCategory.LLM, '[Settings]', `Error fetching models for ${provider}:`, { error });
      toast.error(`Failed to refresh ${provider} models`);
      setLoading(false);
    }
  }, [provider, apiKey, getModelsFromRegistry]);
  
  // Function to reset models for this provider
  const resetModels = useCallback(async () => {
    if (!apiKey) return;
    
    setLoading(true);
    try {
      // Use ModelService to reset models
      ModelService.resetModels(provider);
      
      // Clear the models in the UI
      setModels([]);
      
      toast.success(`Reset ${provider} models`);
    } catch (error) {
      logger.error(LogCategory.LLM, '[Settings]', `Error resetting ${provider} models:`, { error });
      toast.error(`Failed to reset ${provider} models`);
    } finally {
      setLoading(false);
    }
  }, [provider, apiKey]);
  
  // Fetch models on mount and when refreshTrigger changes
  useEffect(() => {
    logger.debug(LogCategory.LLM, '[ModelDisplay]', `Refresh trigger changed for ${provider}: ${refreshTrigger}`);
    
    // Only fetch models from registry when the trigger changes and we have an API key
    if (refreshTrigger > 0 && apiKey) {
      getModelsFromRegistry();
    }
  }, [refreshTrigger, provider, getModelsFromRegistry, apiKey]);
  
  return (
    <div className="rounded-md bg-muted p-4 space-y-4">
      {initialLoad ? (
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : apiKey ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Models</span>
              {models.length > 0 && (
                <Badge variant="outline" className="px-2 py-0 text-xs">
                  {models.length} available
                </Badge>
              )}
            </div>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={resetModels}
                disabled={loading || models.length === 0}
                className="h-8 px-3"
              >
                Reset
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={refreshModels}
                disabled={loading}
                className="h-8 px-3"
              >
                {loading ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
                    <span>Refreshing</span>
                  </>
                ) : (
                  <span>Refresh</span>
                )}
              </Button>
            </div>
          </div>
          
          {loading && models.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
              <div className="text-sm text-muted-foreground">
                Fetching available models...
              </div>
            </div>
          ) : models.length > 0 ? (
            <div className="bg-background rounded-md border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Model</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Description</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {models.map(model => (
                    <tr key={model.id} className="hover:bg-muted/30">
                      <td className="py-2 px-3 text-sm font-medium">{model.displayName}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{model.description}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground text-right">{(model.contextWindow / 1000).toFixed(0)}K</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="text-sm text-muted-foreground mb-3">
                No models registered. Click the Refresh button to fetch available models.
              </div>
              <Button 
                variant="default" 
                size="sm" 
                onClick={refreshModels}
                disabled={loading}
                className="h-8 px-3"
              >
                {loading ? "Refreshing..." : "Refresh Models"}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="text-sm text-muted-foreground">
            Enter a valid API key above to fetch available models.
          </div>
        </div>
      )}
    </div>
  );
};

function SettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modelsRefreshTrigger, setModelsRefreshTrigger] = useState(0);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setInitialLoading(true);
        const storedSettings = await storage.get<GlobalSettings>("global_settings");
        if (storedSettings) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...storedSettings
          });
          
          // If we have API keys, trigger a refresh of the models
          if (storedSettings.apiKeys?.anthropic || storedSettings.apiKeys?.openai) {
            // Trigger a refresh of the models
            setTimeout(() => {
              setModelsRefreshTrigger(prev => prev + 1);
            }, 100);
          }
        }
      } catch (error) {
        logger.error(LogCategory.LLM, '[Settings]', 'Error loading settings:', { error });
        setError("Failed to load settings");
      } finally {
        setInitialLoading(false);
      }
    };
    
    loadSettings();
  }, []);

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

  // Handle API key changes
  const handleApiKeyChange = async (provider: keyof GlobalSettings['apiKeys'], value: string) => {
    // Update the settings state
    setSettings(prev => ({
      ...prev,
      apiKeys: {
        ...prev.apiKeys,
        [provider]: value
      }
    }));

    // If the value is empty, don't validate
    if (!value) return;

    // Validate the API key using ModelService
    try {
      setLoading(true);
      const isValid = await ModelService.validateApiKey(provider as LLMProvider, value);

      if (isValid) {
        toast.success(`Valid ${provider} API key`);
        
        // Trigger a refresh of the models immediately
        setTimeout(() => {
          setModelsRefreshTrigger(prev => prev + 1);
        }, 100); // Small delay to ensure models are registered
      } else {
        toast.error(`Invalid ${provider} API key`);
      }
    } catch (error) {
      logger.error(LogCategory.LLM, '[Settings]', `Error validating ${provider} API key:`, { error });
      toast.error(`Failed to validate ${provider} API key`);
    } finally {
      setLoading(false);
    }
  };

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
                          Warning: With this enabled, agents will fail if you haven&apos;t provided your own API keys.
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
                Configure API keys for language models and other services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                {API_KEY_PROVIDERS.map(({ key, label, icon: Icon }) => (
                  <div key={key} className="grid gap-2">
                    <Label htmlFor={key} className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {label}
                    </Label>
                    <div className="relative">
                      <Input
                        id={key}
                        type="password"
                        placeholder={`Enter your ${key} API key`}
                        value={settings.apiKeys[key as keyof GlobalSettings['apiKeys']]}
                        onChange={(e) => handleApiKeyChange(key as keyof GlobalSettings['apiKeys'], e.target.value)}
                        className="pr-20"
                      />
                      {settings.apiKeys[key as keyof GlobalSettings['apiKeys']] && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="absolute right-1 top-1 h-7"
                          onClick={() => handleApiKeyChange(key as keyof GlobalSettings['apiKeys'], '')}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {key === 'openai' && 'Used for OpenAI models like GPT-4 and GPT-3.5'}
                      {key === 'anthropic' && 'Used for Anthropic Claude models'}
                      {key === 'serpapi' && 'Used for web search capabilities'}
                    </p>
                    {key === 'anthropic' && (
                      <div className="pt-2">
                        <ModelDisplay provider="anthropic" refreshTrigger={modelsRefreshTrigger} setRefreshTrigger={setModelsRefreshTrigger} />
                      </div>
                    )}
                    {key === 'openai' && (
                      <div className="pt-2">
                        <ModelDisplay provider="openai" refreshTrigger={modelsRefreshTrigger} setRefreshTrigger={setModelsRefreshTrigger} />
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
                <div className="space-y-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2"
                    onClick={async () => {
                      try {
                        // Get API keys from settings
                        const anthropicKey = settings?.apiKeys?.anthropic;
                        const openaiKey = settings?.apiKeys?.openai;
                        
                        // Fetch models from the registry API for both providers
                        const anthropicResponse = await fetch('/api/models?provider=anthropic', {
                          headers: {
                            'x-api-key': anthropicKey || ''
                          }
                        });
                        const openaiResponse = await fetch('/api/models?provider=openai', {
                          headers: {
                            'x-api-key': openaiKey || ''
                          }
                        });
                        
                        const anthropicData = await anthropicResponse.json();
                        const openaiData = await openaiResponse.json();
                        
                        logger.debug(LogCategory.LLM, '[Settings]', 'Model Registry State from API:', {
                          anthropicModels: anthropicData.count,
                          openaiModels: openaiData.count
                        });
                        
                        // Log model IDs for debugging
                        const anthropicIds = anthropicData.models?.map((model: any) => model.id) || [];
                        const openaiIds = openaiData.models?.map((model: any) => model.id) || [];
                        logger.debug(LogCategory.LLM, '[Settings]', 'Model IDs:', {
                          anthropic: anthropicIds,
                          openai: openaiIds
                        });
                        
                        toast.success(`Found ${anthropicData.count} Anthropic models and ${openaiData.count} OpenAI models`);
                        
                        // Trigger refresh
                        setModelsRefreshTrigger(prev => prev + 1);
                      } catch (error) {
                        logger.error(LogCategory.LLM, '[Settings]', 'Error debugging model registry:', { error });
                        toast.error('Failed to debug model registry');
                      }
                    }}
                  >
                    Debug Model Registry
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={async () => {
                        // Reset models for both providers
                        ModelRegistry.resetModels(['anthropic', 'openai']);
                        
                        toast.success('Cleared all models from registry');
                        setModelsRefreshTrigger(prev => prev + 1);
                      }}
                    >
                      Clear Registry
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      onClick={async () => {
                        // Force refresh of both providers
                        let anthropicSuccess = false;
                        let openaiSuccess = false;
                        
                        if (settings.apiKeys.anthropic) {
                          try {
                            const response = await fetch('/api/anthropic/models', {
                              headers: {
                                'x-api-key': settings.apiKeys.anthropic
                              }
                            });
                            
                            const data = await response.json();
                            if (data.valid) {
                              anthropicSuccess = true;
                            }
                          } catch (error) {
                            logger.error(LogCategory.LLM, '[Settings]', 'Failed to refresh Anthropic models:', { error });
                          }
                        }
                        
                        if (settings.apiKeys.openai) {
                          try {
                            const response = await fetch('/api/openai/models', {
                              headers: {
                                'x-api-key': settings.apiKeys.openai
                              }
                            });
                            
                            const data = await response.json();
                            if (data.valid) {
                              openaiSuccess = true;
                            }
                          } catch (error) {
                            logger.error(LogCategory.LLM, '[Settings]', 'Failed to refresh OpenAI models:', { error });
                          }
                        }
                        
                        // Wait a bit for the registry to update
                        setTimeout(() => {
                          const anthropicModels = ModelRegistry.getModelsForProvider('anthropic');
                          const openaiModels = ModelRegistry.getModelsForProvider('openai');
                          
                          let message = 'Refreshed models: ';
                          if (anthropicSuccess) {
                            message += `Anthropic (${anthropicModels.length}) `;
                          }
                          if (openaiSuccess) {
                            message += `OpenAI (${openaiModels.length})`;
                          }
                          if (!anthropicSuccess && !openaiSuccess) {
                            message = 'Failed to refresh models. Check API keys.';
                          }
                          
                          toast.success(message);
                          setModelsRefreshTrigger(prev => prev + 1);
                        }, 500);
                      }}
                    >
                      Refresh All
                    </Button>
                  </div>
                  
                  <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
                    {JSON.stringify(settings, null, 2)}
                  </pre>
                </div>
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
        logger.error(LogCategory.LLM, '[Settings]', 'Error in Settings Page:', { error, errorInfo });
      }}
      resetOnPropsChange
    >
      <SettingsPage />
    </ErrorBoundary>
  );
} 