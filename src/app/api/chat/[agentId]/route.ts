/**
 * @fileoverview Chat route handler using the latest Vercel AI SDK patterns.
 */

import { NextRequest } from 'next/server';
import { 
  APIError, 
  ErrorCode, 
  logger, 
  LogCategory, 
  loadAgentConfig,
  AgentNode
} from 'agentdock-core';
import { templates, TemplateId } from '@/generated/templates';

// Import the agent adapter to ensure the tool registry is set
import '@/lib/agent-adapter';

// Import the initialization module to ensure nodes are registered
import '@/nodes/init';

// Log runtime configuration
console.log('Route Handler Initialized:', {
  runtime: 'edge',
  path: '/api/chat/[agentId]',
  timestamp: new Date().toISOString()
});

export const runtime = 'edge';

/**
 * POST handler for chat requests
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    // Get agentId from params
    const { agentId } = await params;
    console.log(`Processing request for agent: ${agentId}`);
    
    // Validate template
    const template = templates[agentId as TemplateId];
    if (!template) {
      throw new APIError(
        'Template not found',
        ErrorCode.CONFIG_NOT_FOUND,
        request.url,
        'POST',
        { agentId }
      );
    }

    // Validate API key
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      throw new APIError(
        'API key is required',
        ErrorCode.CONFIG_NOT_FOUND,
        request.url,
        'POST'
      );
    }

    // Load and validate config
    const config = await loadAgentConfig(template, apiKey);
    const llmConfig = config.nodeConfigurations?.['llm.anthropic'];
    if (!llmConfig) {
      throw new APIError(
        'LLM configuration not found',
        ErrorCode.CONFIG_NOT_FOUND,
        request.url,
        'POST',
        { agentId }
      );
    }

    // Parse request body
    const { messages, system } = await request.json();
    console.log(`Received ${messages.length} messages`);
    
    // Log request details
    await logger.debug(
      LogCategory.API,
      'ChatRoute',
      'Processing chat request',
      {
        agentId,
        messageCount: messages.length,
        model: llmConfig.model
      }
    );

    // Create the AgentNode instance
    const agent = new AgentNode(`agent-${agentId}`, {
      agentConfig: template,
      apiKey
    });

    // Handle the message
    const result = await agent.handleMessage({
      messages,
      system
    });
    
    // Return the response
    return result.toDataStreamResponse();

  } catch (error) {
    console.error('Error in chat route:', error);
    
    await logger.error(
      LogCategory.API,
      'ChatAPI',
      'Failed to process chat',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );

    // Return error response
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        code: error instanceof APIError ? error.code : 'INTERNAL_ERROR'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
} 