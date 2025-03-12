"use client"

import { useState, memo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { logger, LogCategory } from 'agentdock-core'
import { Bug } from "lucide-react"
import { ModelRegistry } from '@/lib/models/registry'

interface DebugPanelProps {
  settings: {
    apiKeys: {
      openai: string
      anthropic: string
      [key: string]: string
    }
  }
  onRefreshTrigger: () => void
}

function DebugPanelComponent({ settings, onRefreshTrigger }: DebugPanelProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Debug registry state
  const handleDebugRegistry = async () => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      const { anthropic: anthropicKey, openai: openaiKey } = settings?.apiKeys || {};
      
      // Fetch models from the registry API for both providers
      const [anthropicResponse, openaiResponse] = await Promise.all([
        fetch('/api/models?provider=anthropic', {
          headers: {
            'x-api-key': anthropicKey || '',
            'Cache-Control': 'no-cache'
          }
        }),
        fetch('/api/models?provider=openai', {
          headers: {
            'x-api-key': openaiKey || '',
            'Cache-Control': 'no-cache'
          }
        })
      ]);
      
      const [anthropicData, openaiData] = await Promise.all([
        anthropicResponse.json(),
        openaiResponse.json()
      ]);
      
      // Log model counts and IDs
      logger.debug(LogCategory.LLM, '[Settings]', 'Model Registry State:', {
        anthropicModels: anthropicData.count,
        openaiModels: openaiData.count,
        anthropicIds: anthropicData.models?.map((m: any) => m.id) || [],
        openaiIds: openaiData.models?.map((m: any) => m.id) || []
      });
      
      toast.success(`Found ${anthropicData.count} Anthropic models and ${openaiData.count} OpenAI models`);
      onRefreshTrigger();
    } catch (error) {
      logger.error(LogCategory.LLM, '[Settings]', 'Error debugging model registry:', { error });
      toast.error('Failed to debug model registry');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear registry
  const handleClearRegistry = () => {
    if (isLoading) return;
    
    ModelRegistry.resetModels(['anthropic', 'openai']);
    toast.success('Cleared all models from registry');
    onRefreshTrigger();
  };

  // Refresh all models
  const handleRefreshAll = async () => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      const { anthropic: anthropicKey, openai: openaiKey } = settings?.apiKeys || {};
      const results = { anthropic: false, openai: false };
      
      // Refresh Anthropic models
      if (anthropicKey) {
        try {
          const response = await fetch('/api/anthropic/models', {
            headers: {
              'x-api-key': anthropicKey,
              'Cache-Control': 'no-cache'
            }
          });
          const data = await response.json();
          results.anthropic = data.valid;
        } catch (error) {
          logger.error(LogCategory.LLM, '[Settings]', 'Failed to refresh Anthropic models:', { error });
        }
      }
      
      // Refresh OpenAI models
      if (openaiKey) {
        try {
          const response = await fetch('/api/openai/models', {
            headers: {
              'x-api-key': openaiKey,
              'Cache-Control': 'no-cache'
            }
          });
          const data = await response.json();
          results.openai = data.valid;
        } catch (error) {
          logger.error(LogCategory.LLM, '[Settings]', 'Failed to refresh OpenAI models:', { error });
        }
      }
      
      // Get model counts
      const anthropicModels = ModelRegistry.getModelsForProvider('anthropic');
      const openaiModels = ModelRegistry.getModelsForProvider('openai');
      
      // Show results
      if (results.anthropic || results.openai) {
        let message = 'Refreshed models: ';
        if (results.anthropic) message += `Anthropic (${anthropicModels.length}) `;
        if (results.openai) message += `OpenAI (${openaiModels.length})`;
        toast.success(message);
      } else {
        toast.error('Failed to refresh models. Check API keys.');
      }
      
      onRefreshTrigger();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Bug className="h-5 w-5" />
          <h3 className="text-lg font-medium">Debug Information</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Technical details for troubleshooting
        </p>
        
        <div className="space-y-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDebugRegistry}
            disabled={isLoading}
          >
            Debug Model Registry
          </Button>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleClearRegistry}
              disabled={isLoading}
            >
              Clear Registry
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleRefreshAll}
              disabled={isLoading}
            >
              Refresh All
            </Button>
          </div>
          
          <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
            {JSON.stringify(settings, null, 2)}
          </pre>
        </div>
      </div>
    </Card>
  );
}

export const DebugPanel = memo(DebugPanelComponent); 