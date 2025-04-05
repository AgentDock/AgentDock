"use client"

import { useState, useEffect, useCallback, useMemo, ErrorInfo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { SecureStorage } from 'agentdock-core/storage/secure-storage'
import { LLMProvider, logger, LogCategory } from 'agentdock-core'
import { ErrorBoundary } from "@/components/error-boundary"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Save, AlertCircle, KeyRound } from "lucide-react"
import { ModelService } from '@/lib/services/model-service'
import { FontFamily } from '@/lib/fonts'

// Import components
import { ModelDisplay } from './model-display'
import { CoreSettings } from './core-settings'
import { DebugPanel } from './debug-panel'
import { FontSettings } from './font-settings'

// Import types
import { GlobalSettings, DEFAULT_SETTINGS, ApiKeyProvider } from './types'

// Create a single instance for settings
const storage = SecureStorage.getInstance('agentdock');

// Memoize API key providers to prevent recreation on each render
const API_KEY_PROVIDERS: ApiKeyProvider[] = [
  { key: 'openai', label: 'OpenAI API Key', icon: KeyRound, description: 'Used for OpenAI models like GPT-4 and GPT-3.5' },
  { key: 'anthropic', label: 'Anthropic API Key', icon: KeyRound, description: 'Used for Anthropic Claude models' },
  { key: 'gemini', label: 'Google Gemini API Key', icon: KeyRound, description: 'Used for Google Gemini models' },
  { key: 'deepseek', label: 'DeepSeek API Key', icon: KeyRound, description: 'Used for DeepSeek models including DeepSeek-V3 and DeepSeek-R1' },
  { key: 'groq', label: 'Groq API Key', icon: KeyRound, description: 'Used for Groq models like Llama 3 and Mixtral' }
];

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
            // Trigger a refresh of the models immediately
              setModelsRefreshTrigger(prev => prev + 1);
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

  // Centralized function to handle API key validation, saving, and model refresh
  const handleApiKeyValidationAndSave = useCallback(async (
    provider: keyof GlobalSettings['apiKeys'], 
    value: string,
    shouldSave: boolean = true
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      // Skip validation if empty
      if (!value) {
        if (shouldSave) {
          // Update settings with empty value
          const updatedSettings = {
            ...settings,
            apiKeys: {
              ...settings.apiKeys,
              [provider]: ''
            }
          };
          
          // Save settings
          await storage.set("global_settings", updatedSettings);
          setSettings(updatedSettings);
          toast.success("Settings saved successfully");
        }
        return;
      }
      
      // Validate the API key
      const isValid = await ModelService.validateApiKey(provider as LLMProvider, value);
      
      if (isValid) {
        // Update settings with valid key
        const updatedSettings = {
          ...settings,
          apiKeys: {
            ...settings.apiKeys,
            [provider]: value
          }
        };
        
        // Save settings if requested
        if (shouldSave) {
          await storage.set("global_settings", updatedSettings);
          toast.success(`Valid ${provider} API key - Settings saved automatically`);
        }
        
        // Update state
        setSettings(updatedSettings);
        
        // Trigger model refresh AFTER settings are updated and saved
        setModelsRefreshTrigger(prev => prev + 1);
      } else {
        toast.error(`Invalid ${provider} API key`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `Error processing ${provider} API key`;
      logger.error(LogCategory.LLM, '[Settings]', message, { error });
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [settings]);

  // Handle API key changes
  const handleApiKeyChange = useCallback((provider: keyof GlobalSettings['apiKeys'], value: string) => {
    // Just update the state immediately for responsive UI
    setSettings(prev => ({
      ...prev,
      apiKeys: {
        ...prev.apiKeys,
        [provider]: value
      }
    }));
  }, []);

  // Handle API key validation and save when blur or Enter key
  const handleApiKeyValidate = useCallback((provider: keyof GlobalSettings['apiKeys'], value: string) => {
    handleApiKeyValidationAndSave(provider, value, true);
  }, [handleApiKeyValidationAndSave]);

  // Handle save with validation for all settings
  const handleSave = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate any API keys that have values before saving
      const apiKeyPromises = Object.entries(settings.apiKeys)
        .filter(([_, value]) => value) // Only validate non-empty keys
        .map(async ([key, value]) => {
          const provider = key as keyof GlobalSettings['apiKeys'];
          const isValid = await ModelService.validateApiKey(provider as LLMProvider, value);
          return { provider, value, isValid };
        });

      const results = await Promise.all(apiKeyPromises);
      const invalidKeys = results.filter(result => !result.isValid);

      if (invalidKeys.length > 0) {
        const invalidProviders = invalidKeys.map(k => k.provider).join(', ');
        toast.error(`Invalid API keys: ${invalidProviders}`);
        return;
      }

      // All keys are valid or empty, save settings
      await storage.set("global_settings", settings);
      toast.success("Settings saved successfully");
      
      // Refresh models after save
      setModelsRefreshTrigger(prev => prev + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save settings";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [settings]);

  // Handle BYOK only mode toggle
  const handleByokOnlyChange = useCallback((checked: boolean) => {
    // Update the state
    setSettings(prev => ({
      ...prev,
      core: {
        ...prev.core,
        byokOnly: checked
      }
    }))
    setError(null)
    
    // Store BYOK setting in localStorage ONLY
    try {
      localStorage.setItem('byokOnly', checked ? 'true' : 'false')
    } catch (error) {
      console.warn("Failed to save BYOK setting to localStorage", error)
    }
    
    // Show appropriate toast message
    if (checked) {
      toast.info("BYOK Mode enabled - Only user-provided API keys will be used")
    } else {
      toast.info("BYOK Mode disabled - System will fall back to environment variables if needed")
    }
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

  // Trigger model refresh
  const handleRefreshTrigger = useCallback(() => {
    setModelsRefreshTrigger(prev => prev + 1);
  }, []);

  // Handle font settings changes
  const handlePrimaryFontChange = useCallback(async (value: FontFamily) => {
    try {
      setLoading(true);
      setError(null);
      
      const updatedSettings = {
        ...settings,
        fonts: {
          ...settings.fonts,
          primary: value
        }
      };
      
      await storage.set("global_settings", updatedSettings);
      setSettings(updatedSettings);
      toast.success("Font settings saved. Reload the page to see changes.");
    } catch (error) {
      logger.error(LogCategory.SYSTEM, '[Settings]', 'Error saving font settings:', { error });
      setError("Failed to save font settings");
    } finally {
      setLoading(false);
    }
  }, [settings]);

  const handleMonoFontChange = useCallback(async (value: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const updatedSettings = {
        ...settings,
        fonts: {
          ...settings.fonts,
          mono: value
        }
      };
      
      await storage.set("global_settings", updatedSettings);
      setSettings(updatedSettings);
      toast.success("Font settings saved. Reload the page to see changes.");
    } catch (error) {
      logger.error(LogCategory.SYSTEM, '[Settings]', 'Error saving font settings:', { error });
      setError("Failed to save font settings");
    } finally {
      setLoading(false);
    }
  }, [settings]);

  // Memoize loading skeleton component
  const LoadingSkeleton = useMemo(() => (
    <div className="grid gap-6">
      <Skeleton className="h-[200px] w-full" />
      <Skeleton className="h-[400px] w-full" />
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
      <div className="container py-6 space-y-6 md:py-10">
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
        
        {/* Core Settings and Font Settings */}
        <div className="grid gap-6 md:grid-cols-2">
          <CoreSettings 
            settings={settings}
            onByokChange={handleByokOnlyChange}
            onDebugModeChange={handleDebugModeChange}
          />
          
          <FontSettings 
            settings={settings}
            onPrimaryFontChange={handlePrimaryFontChange}
            onMonoFontChange={handleMonoFontChange}
          />
        </div>
        
        {/* API Keys */}
        <div className="space-y-4">
          <Card className="shadow-none">
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                <h3 className="text-lg font-medium">API Keys</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Configure API keys for language models and other services
              </p>
              
              <div className="grid gap-6">
                {API_KEY_PROVIDERS.map(({ key, label, icon: Icon, description }) => (
                  <div key={key.toString()} className="grid gap-2">
                    <Label htmlFor={key.toString()} className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {label}
                    </Label>
                    <div className="relative">
                      <Input
                        id={key.toString()}
                        type="password"
                        placeholder={`Enter your ${key} API key`}
                        value={settings.apiKeys[key]}
                        onChange={(e) => handleApiKeyChange(key, e.target.value)}
                        onBlur={(e) => handleApiKeyValidate(key, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleApiKeyValidate(key, (e.target as HTMLInputElement).value);
                          }
                        }}
                        className="pr-20"
                      />
                      {settings.apiKeys[key] && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="absolute right-1 top-1 h-7"
                          onClick={() => handleApiKeyValidate(key, '')}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    {description && (
                      <p className="text-xs text-muted-foreground">{description}</p>
                    )}
                    {key === 'anthropic' && (
                      <div className="pt-2">
                        <ModelDisplay 
                          provider="anthropic" 
                          refreshTrigger={modelsRefreshTrigger} 
                          onRefreshComplete={handleRefreshTrigger} 
                        />
                      </div>
                    )}
                    {key === 'openai' && (
                      <div className="pt-2">
                        <ModelDisplay 
                          provider="openai" 
                          refreshTrigger={modelsRefreshTrigger} 
                          onRefreshComplete={handleRefreshTrigger} 
                        />
                      </div>
                    )}
                    {key === 'gemini' && (
                      <div className="pt-2">
                        <ModelDisplay 
                          provider="gemini" 
                          refreshTrigger={modelsRefreshTrigger} 
                          onRefreshComplete={handleRefreshTrigger} 
                        />
                      </div>
                    )}
                    {key === 'deepseek' && (
                      <div className="pt-2">
                        <ModelDisplay 
                          provider="deepseek" 
                          refreshTrigger={modelsRefreshTrigger} 
                          onRefreshComplete={handleRefreshTrigger} 
                        />
                      </div>
                    )}
                    {key === 'groq' && (
                      <div className="pt-2">
                        <ModelDisplay 
                          provider="groq" 
                          refreshTrigger={modelsRefreshTrigger} 
                          onRefreshComplete={handleRefreshTrigger} 
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Debug Information */}
          {settings.core.debugMode && (
            <DebugPanel 
              settings={settings} 
              onRefreshTrigger={handleRefreshTrigger} 
            />
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