import { NextRequest } from 'next/server';
import { APIError, ErrorCode, logger, LogCategory, loadAgentConfig } from 'agentdock-core';
import { templates } from '@/generated/templates';
import { ConfigCache } from '@/lib/services/config-cache';

export const runtime = 'edge';

export async function GET(req: NextRequest, { params }: { params: { agentId: string } }) {
  try {
    const agentId = params.agentId.split('?')[0];
    const apiKey = req.headers.get('x-api-key');

    if (!agentId) {
      throw new APIError(
        'Missing agent ID',
        ErrorCode.API_VALIDATION,
        req.url,
        'GET',
        {},
        400
      );
    }

    logger.debug(
      LogCategory.API,
      'Fetching agent configuration',
      JSON.stringify({ agentId })
    );

    if (!apiKey) {
      throw new APIError(
        'Please add your Anthropic API key in settings to use the chat',
        ErrorCode.CONFIG_NOT_FOUND,
        req.url,
        'GET',
        { agentId },
        400
      );
    }

    // Get template first - we need this for version checking
    const template = templates[agentId as keyof typeof templates];
    if (!template) {
      throw new APIError(
        'Template not found',
        ErrorCode.CONFIG_NOT_FOUND,
        req.url,
        'GET',
        { agentId },
        404
      );
    }

    // Try to get from cache first
    const configCache = ConfigCache.getInstance();
    const cachedConfig = await configCache.get(agentId, template.version);
    
    if (cachedConfig) {
      return new Response(JSON.stringify(cachedConfig), {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Load and validate configuration
    const agentConfig = await loadAgentConfig(template, apiKey);
    const llmConfig = agentConfig.nodeConfigurations?.['llm.anthropic'];

    // Prepare safe configuration (excluding API key)
    const config = {
      name: agentConfig.name,
      description: agentConfig.description,
      model: llmConfig?.model || 'claude-3-opus-20240229',
      temperature: llmConfig?.temperature ?? 0.7,
      maxTokens: llmConfig?.maxTokens ?? 1000,
      modules: agentConfig.modules,
      personality: agentConfig.personality,
      chatSettings: agentConfig.chatSettings
    };

    // Cache the configuration with template version
    await configCache.set(agentId, config, template.version);

    return new Response(JSON.stringify(config), {
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    logger.error(
      LogCategory.API,
      'Error fetching agent configuration',
      error instanceof Error ? error.message : 'Unknown error'
    );
    
    if (error instanceof APIError) {
      return new Response(
        JSON.stringify({ 
          error: error.message,
          code: error.code
        }), 
        { status: error.code === ErrorCode.CONFIG_NOT_FOUND ? 400 : 500 }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { status: 500 }
    );
  }
} 