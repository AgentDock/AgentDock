/**
 * @fileoverview Chat route handler with Vercel AI SDK tool integration.
 * Implements streaming responses, tool execution, and error handling.
 */

import { NextRequest } from 'next/server';
import { Message } from 'ai';
import { APIError, ErrorCode, logger, LogCategory, loadAgentConfig } from 'agentdock-core';
import { templates, TemplateId } from '@/generated/templates';
import { getToolsForAgent } from '@/nodes/registry';
import { AnthropicProvider } from 'agentdock-core/providers/anthropic/anthropic-provider';

// Log runtime configuration
console.log('Route Handler Configuration:', {
  runtime: 'edge',
  path: '/api/chat/[agentId]',
  method: 'POST',
  timestamp: new Date().toISOString()
});

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

    // Get enabled tools
    const enabledCustomTools = (template.nodes || []).filter(
      module => !module.startsWith('llm.')
    );
    const tools = getToolsForAgent(enabledCustomTools);

    // Log available tools
    console.log('Enabled tools for agent:', {
      agentId,
      enabledCustomTools,
      availableTools: Object.keys(tools),
      toolDetails: Object.entries(tools).map(([name, tool]) => ({
        name,
        description: tool.description,
        hasExecute: 'execute' in tool
      }))
    });

    // Log request details
    await logger.debug(
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
    console.log('System prompt type:', typeof systemPrompt);
    console.log('System prompt value:', systemPrompt);
    
    // Ensure system prompt is a string
    const finalSystemPrompt = typeof systemPrompt === 'string' 
      ? systemPrompt 
      : Array.isArray(systemPrompt) 
        ? systemPrompt.join('\n') 
        : String(systemPrompt || '');
    
    console.log('Final system prompt type:', typeof finalSystemPrompt);

    const { ThinVercelAIAdapter } = await import('agentdock-core/llm/thin-vercel-ai-adapter');
    
    const anthropicProvider = new AnthropicProvider(apiKey);

    const adapter = new ThinVercelAIAdapter(anthropicProvider, llmConfig);

    // Add system message to the beginning of the messages array
    const messagesWithSystem = [
      { role: 'system', content: finalSystemPrompt },
      ...messages
    ];

    console.log('Sending messages with system prompt:', {
      messageCount: messagesWithSystem.length,
      hasSystemPrompt: !!finalSystemPrompt,
      firstMessageRole: messagesWithSystem[0].role
    });

    const stream = await adapter.generateStream(messagesWithSystem);
    
    // Convert the stream to proper Response format with correct encoding
    return new Response(
      stream, 
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      }
    );
  } catch (error) {
    await logger.error(
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