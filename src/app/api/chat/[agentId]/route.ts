/**
 * @fileoverview Chat route handler with Vercel AI SDK tool integration.
 * Implements streaming responses, tool execution, and error handling.
 */

import { NextRequest } from 'next/server';
import { Message } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModelV1 } from '@ai-sdk/provider';
import { APIError, ErrorCode, logger, LogCategory, loadAgentConfig, NodeRegistry } from 'agentdock-core';
import { templates, TemplateId } from '@/generated/templates';
import { getToolsForAgent } from '@/nodes/registry';

// Log runtime configuration
logger.debug(
  LogCategory.API,
  'ChatRoute',
  'Route Handler Configuration:',
  {
    runtime: 'edge',
    path: '/api/chat/[agentId]',
    method: 'POST',
    timestamp: new Date().toISOString()
  }
);

// Debug: Check core tools
logger.debug(
  LogCategory.API,
  'ChatRoute',
  'Core tools from NodeRegistry:',
  NodeRegistry.getToolDefinitions()
);

// ============================================================================
// TEMPORARY IMPLEMENTATION FOR V1
// This is a simplified implementation using direct message handling.
// TODO: MIGRATION - This will be replaced with:
// 1. Full CoreMessage type support
// 2. Multi-part message handling
// 3. Provider abstraction
// Reference: plan_refactor.md Phase 1
// ============================================================================

export const runtime = 'edge';
export const preferredRegion = 'auto';
export const dynamic = 'force-dynamic';

// Add type for message formatting
interface FormattedMessage extends Message {
  content: string;
}

interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

// Enhanced error type checking
const isConnectionError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  
  const connectionErrors = [
    'ECONNRESET',
    'Failed to fetch',
    'Network error',
    'connection closed',
    'aborted',
    'timeout',
    'network request failed'
  ];
  
  return connectionErrors.some(errMsg => 
    error.message.toLowerCase().includes(errMsg.toLowerCase())
  );
};

// Error handler that logs errors and returns void
function handleError(error: unknown) {
  console.error('Error in chat route:', error);
  return;
}

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

/**
 * POST handler for chat requests
 * Implements Vercel AI SDK streaming with tool support
 */
export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    // Get agentId from params and validate
    const { agentId } = await params;
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
    const { messages, experimental_attachments, system } = await request.json();

    // Create Anthropic provider
    const anthropicProvider = createAnthropic({ apiKey });

    // Get enabled tools
    const enabledCustomTools = (template.modules || []).filter(
      module => !module.startsWith('llm.') && (module.startsWith('core.tool.') || !module.startsWith('core.'))
    );
    const tools = getToolsForAgent(enabledCustomTools);

    // Log available tools
    logger.debug(
      LogCategory.API,
      'ChatRoute',
      'Enabled tools for agent:',
      {
        agentId,
        enabledCustomTools,
        availableTools: Object.keys(tools),
        toolDetails: Object.entries(tools).map(([name, tool]) => ({
          name,
          description: tool.description,
          hasExecute: 'execute' in tool
        }))
      }
    );

    // Log request details
    logger.debug(
      LogCategory.API,
      'ChatRoute',
      'Processing chat request',
      {
        agentId,
        messageCount: messages.length,
        model: llmConfig.model,
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens
      }
    );

    // Use the validated personality from config
    // The type system guarantees this is a string due to the branded type
    const systemPrompt = system || config.personality;

    // Add explicit logging and type checking
    logger.debug(
      LogCategory.API,
      'ChatRoute',
      'System prompt details:',
      {
        type: typeof systemPrompt,
        value: systemPrompt
      }
    );
    
    // Ensure system prompt is a string
    const finalSystemPrompt = typeof systemPrompt === 'string' 
      ? systemPrompt 
      : Array.isArray(systemPrompt) 
        ? systemPrompt.join('\n') 
        : String(systemPrompt || '');
    
    logger.debug(
      LogCategory.API,
      'ChatRoute',
      'Final system prompt details:',
      {
        type: typeof finalSystemPrompt
      }
    );

    // Stream response using streamText
    const { streamText } = await import('ai');
    const stream = await streamText({
      model: anthropicProvider(llmConfig.model) as LanguageModelV1,
      messages,
      temperature: llmConfig.temperature,
      maxTokens: llmConfig.maxTokens,
      system: finalSystemPrompt,
      tools,
      ...(experimental_attachments ? { experimental_attachments } : {}),
      maxSteps: 5,
      toolCallStreaming: true,
      onError: handleError
    });

    // Return the stream using toDataStreamResponse
    return stream.toDataStreamResponse();
  } catch (error) {
    logger.error(
      LogCategory.API,
      'ChatAPI',
      'Failed to process chat',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );

    if (error instanceof APIError) {
      return new Response(
        JSON.stringify({ 
          error: error.message,
          code: error.code,
          retryable: false
        }), 
        { status: error.code === ErrorCode.CONFIG_NOT_FOUND ? 400 : 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: 'An error occurred while processing your request',
        code: 'INTERNAL_ERROR',
        retryable: false
      }), 
      { status: 500 }
    );
  }
} 