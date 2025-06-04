/**
 * @fileoverview Think Tool implementation for structured reasoning.
 * This tool helps agents think through complex problems using structured analysis.
 */

import { LogCategory, logger } from 'agentdock-core';
import { z } from 'zod';

import { createToolResult, ToolResult } from '@/lib/utils/markdown-utils';
import { Tool, ToolExecutionOptions } from '../../types';
import { ThinkComponent } from './components';

/**
 * Think tool schema - Defined locally
 */
export const thinkSchema = z.object({
  adTopic: z
    .string()
    .min(1, 'Topic must not be empty')
    .describe('The main topic being analyzed.'),
  reasoning: z
    .string()
    .min(1, 'Reasoning content must be provided.')
    .describe(
      'The pre-generated structured reasoning content in Markdown format.'
    )
});

/**
 * Think tool parameters type - Defined locally
 */
export type ThinkParams = z.infer<typeof thinkSchema>;

/**
 * Think tool description
 */
export const thinkToolDescription = `
The Think tool provides structured reasoning to help solve complex problems.

Use it to analyze topics with clear, step-by-step thinking.

Examples:
1. "Analyze the impact of AI on job markets"
2. "Reason through the pros and cons of remote work"
3. "Evaluate different approaches to learning programming"
4. "Think through the implications of a new technology"
5. "Analyze factors affecting climate change solutions"

The tool will generate comprehensive, structured reasoning on any topic provided.
`;

/**
 * Default Think parameters
 */
export const defaultThinkParams: ThinkParams = {
  adTopic: '',
  reasoning: ''
};

/**
 * Handle tool errors safely, returning a simple Markdown error string.
 */
function safelyHandleError(error: unknown, topic: string): ToolResult {
  // Ensure error is properly converted to string in all cases
  let errorMessage: string;

  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error === null || error === undefined) {
    errorMessage = 'Unknown error occurred (null or undefined)';
  } else {
    try {
      // Try to stringify the error if it's an object
      errorMessage = JSON.stringify(error);
    } catch {
      // If JSON stringify fails, provide a fallback
      errorMessage = 'Error: Could not format error details';
    }
  }

  logger.error(LogCategory.NODE, '[Think]', 'Execution error:', {
    error: errorMessage
  });

  // Return a simple, plain Markdown error string using createToolResult
  const title = `## 🧠 Thinking about: ${topic}`;
  const errorContent = `Error: ${errorMessage}`;
  return createToolResult('think_error', `${title}\n\n${errorContent}`); // Use a distinct type like 'think_error'?
}

/**
 * Think tool implementation - Uses ThinkComponent for SUCCESS results only.
 */
export const thinkTool: Tool = {
  name: 'think',
  description: thinkToolDescription,
  parameters: thinkSchema,
  execute: async (
    params: ThinkParams,
    options: ToolExecutionOptions
  ): Promise<ToolResult> => {
    try {
      // Validate parameters using the schema
      const validation = thinkSchema.safeParse(params);
      if (!validation.success) {
        const errorMessage = validation.error.errors
          .map((e) => `${e.path.join('.')} - ${e.message}`)
          .join(', ');
        logger.warn(
          LogCategory.NODE,
          '[Think]',
          'Invalid parameters received',
          { errors: errorMessage }
        );
        // Use the simplified safelyHandleError
        return safelyHandleError(
          `Invalid parameters: ${errorMessage}`,
          params.adTopic || 'Unknown Topic'
        );
      }

      const { adTopic, reasoning } = validation.data; // Use validated data

      logger.debug(
        LogCategory.NODE,
        '[Think]',
        `Formatting reasoning for: "${adTopic}"`,
        {
          toolCallId: options.toolCallId,
          reasoningLength: reasoning.length,
          timestamp: new Date().toISOString()
        }
      );

      // Call the component function ONLY for successful formatting
      const result = ThinkComponent({ topic: adTopic, reasoning });

      logger.debug(
        LogCategory.NODE,
        '[Think]',
        'Returning formatted reasoning via ThinkComponent',
        {
          topic: adTopic,
          reasoningLength: reasoning.length,
          timestamp: new Date().toISOString()
        }
      );

      return result;
    } catch (error) {
      // Ensure adTopic is passed even if params might be malformed before validation
      const topic =
        typeof params?.adTopic === 'string' ? params.adTopic : 'Unknown Topic';
      // Use the simplified safelyHandleError
      return safelyHandleError(error, topic);
    }
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  think: thinkTool
};
