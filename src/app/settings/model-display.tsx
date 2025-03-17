"use client"

import { useState, useEffect, useCallback, memo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { logger, LogCategory, ModelMetadata, SecureStorage } from 'agentdock-core'
import { ModelService } from '@/lib/services/model-service'
import { RefreshCw, Database } from "lucide-react"

// Create a single instance for settings
const storage = SecureStorage.getInstance('agentdock');

// Helper Components
const LoadingIndicator = memo(({ message }: { message: string }) => (
  <div className="flex items-center justify-center py-4">
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
    <span className="text-sm text-muted-foreground">{message}</span>
  </div>
));

// Memoized table component to prevent re-renders
const ModelsTable = memo(({ models, onRefresh, isLoading }: { 
  models: ModelMetadata[],
  onRefresh: () => void,
  isLoading: boolean
}) => (
  <>
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" />
        <Badge variant="outline" className="bg-primary/10 hover:bg-primary/20 transition-colors px-2.5 py-0.5 text-xs font-medium">
          {models.length} models available
        </Badge>
      </div>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onRefresh}
        disabled={isLoading}
        className="h-8 gap-1.5"
      >
        {isLoading ? (
          <>
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
            <span>Refreshing</span>
          </>
        ) : (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </>
        )}
      </Button>
    </div>
    <div className="rounded-md border overflow-hidden">
      <table className="w-full bg-background">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Model</th>
            <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Description</th>
            <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground">Context</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {models.map(model => (
            <tr key={model.id} className="hover:bg-muted/30 transition-colors">
              <td className="py-2.5 px-3 text-sm font-medium">{model.displayName}</td>
              <td className="py-2.5 px-3 text-xs text-muted-foreground">{model.description}</td>
              <td className="py-2.5 px-3 text-xs text-right font-mono">
                {model.contextWindow ? `${(model.contextWindow / 1000).toFixed(0)}K` : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
));

interface ModelDisplayProps {
  provider: 'anthropic' | 'openai' | 'gemini' | 'deepseek'
  refreshTrigger: number
  onRefreshComplete?: () => void
}

function ModelDisplayComponent({ provider, refreshTrigger, onRefreshComplete }: ModelDisplayProps) {
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'loading' | 'no-key' | 'has-models' | 'no-models'>('loading');
  
  // Fetch models based on the current state
  const fetchModels = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    
    try {
      // First, get the current API key
      const settings = await storage.get<{ apiKeys: Record<string, string> }>("global_settings");
      const apiKey = settings?.apiKeys?.[provider] || '';
      
      // If no API key, show no-key state
      if (!apiKey) {
        setStatus('no-key');
        setLoading(false);
        return;
      }
      
      // Try to get models from registry first (unless forcing refresh)
      if (!forceRefresh) {
        const registryResponse = await fetch(`/api/providers/models?provider=${provider}`, {
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (registryResponse.ok) {
          const data = await registryResponse.json();
          if (data.models?.length > 0) {
            setModels(data.models);
            setStatus('has-models');
            setLoading(false);
            return;
          }
        }
      }
      
      // If no models in registry or forcing refresh, fetch from provider API
      await ModelService.fetchAndRegisterModels(provider, apiKey);
      
      // Get updated models from registry
      const updatedResponse = await fetch(`/api/providers/models?provider=${provider}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (updatedResponse.ok) {
        const data = await updatedResponse.json();
        setModels(data.models || []);
        setStatus(data.models?.length > 0 ? 'has-models' : 'no-models');
        
        if (forceRefresh && data.models?.length > 0) {
          toast.success(`Successfully loaded ${provider} models`);
        }
      }
      
      // Notify parent component that refresh is complete
      if (onRefreshComplete) {
        onRefreshComplete();
      }
    } catch (error) {
      logger.error(LogCategory.LLM, '[ModelDisplay]', `Error loading models for ${provider}:`, { error });
      if (forceRefresh) {
        toast.error(`Failed to load ${provider} models`);
      }
      setStatus('no-models');
    } finally {
      setLoading(false);
    }
  }, [provider, onRefreshComplete]);
  
  // Initial load and refresh trigger handling
  useEffect(() => {
    fetchModels(false);
  }, [fetchModels, refreshTrigger]);
  
  // Handle user-initiated refresh
  const handleRefresh = useCallback(() => {
    fetchModels(true);
  }, [fetchModels]);
  
  // Render based on status
  if (status === 'loading') {
    return <LoadingIndicator message="Loading..." />;
  }
  
  if (status === 'no-key') {
    return (
      <div className="rounded-md bg-muted p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Enter a valid API key above to fetch available models.
        </p>
      </div>
    );
  }
  
  return (
    <div className="rounded-md bg-muted p-4">
      {loading && models.length === 0 ? (
        <LoadingIndicator message={`Fetching ${provider} models...`} />
      ) : models.length > 0 ? (
        <ModelsTable models={models} onRefresh={handleRefresh} isLoading={loading} />
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-3">
            No models found. Click refresh to fetch available models.
          </p>
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleRefresh}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
                <span>Refreshing...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh Models</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const ModelDisplay = memo(ModelDisplayComponent); 