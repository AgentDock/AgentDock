/**
 * @fileoverview Reflect Tool implementation for retrospective analysis.
 * This tool helps agents reflect on experiences, decisions, or processes to extract insights.
 */

import { z } from 'zod';
import { Tool, ToolExecutionOptions } from '../../types';
import { ReflectComponent } from './components';
import { ToolResult, createToolResult } from '@/lib/utils/markdown-utils';
import { logger, LogCategory } from 'agentdock-core';

/**
 * Reflect tool schema - Defined locally
 */
export const reflectSchema = z.object({
  adTopic: z
    .string()
    .min(1, 'Topic must not be empty')
    .describe('The main topic being reflected upon.'),
  reflection: z
    .string()
    .min(1, 'Reflection content must be provided.')
    .describe('The pre-generated structured reflection content in Markdown format.'),
});

/**
 * Reflect tool parameters type - Defined locally
 */
export type ReflectParams = z.infer<typeof reflectSchema>;

/**
 * Reflect tool description
 */
export const reflectToolDescription = `
The Reflect tool provides structured retrospective analysis to extract insights and lessons.

Use it to analyze experiences, decisions, or processes with thoughtful reflection.

Examples:
1. "Reflect on the impact of our recent product launch"
2. "Analyze what we learned from the marketing campaign"
3. "Extract insights from our customer feedback patterns"
4. "Identify lessons from our team's remote work experience"
5. "Examine the effectiveness of our decision-making process"

The tool will generate comprehensive, structured reflection on any topic provided.
`;

/**
 * Handle tool errors by throwing a standard Error.
 */
function safelyHandleError(error: unknown, topic: string): never {
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
      errorMessage = JSON.stringify(error);
    } catch {
      errorMessage = 'Error: Could not format error details';
    }
  }

  logger.error(LogCategory.NODE, '[Reflect]', 'Execution error (throwing):', {
    error: errorMessage,
  });

  // Throw a standard Error instead of returning a ToolResult
  // The API route's main catch block should handle this.
  throw new Error(`Error during reflection on "${topic}": ${errorMessage}`);
}

/**
 * Reflect tool implementation - Uses ReflectComponent for SUCCESS results only.
 */
export const reflectTool: Tool = {
  name: 'reflect',
  description: reflectToolDescription,
  parameters: reflectSchema,
  execute: async (params: ReflectParams, options: ToolExecutionOptions): Promise<ToolResult> => {
    try {
      const validation = reflectSchema.safeParse(params);
      if (!validation.success) {
        const errorMsg = validation.error.errors
          .map((e) => `${e.path.join('.')} - ${e.message}`)
          .join(', ');
        logger.warn(LogCategory.NODE, '[Reflect]', 'Invalid parameters received (throwing)', {
          errors: errorMsg,
        });
        // Throw the validation error using the helper
        safelyHandleError(`Invalid parameters: ${errorMsg}`, params.adTopic || 'Unknown Topic');
      }

      const { adTopic, reflection } = validation.data;

      logger.debug(LogCategory.NODE, '[Reflect]', `Formatting reflection for: "${adTopic}"`, {
        toolCallId: options.toolCallId,
        reflectionLength: reflection.length,
        timestamp: new Date().toISOString(),
      });

      const result = ReflectComponent({ topic: adTopic, reflection });

      logger.debug(
        LogCategory.NODE,
        '[Reflect]',
        'Returning formatted reflection via ReflectComponent',
        {
          topic: adTopic,
          reflectionLength: reflection.length,
          timestamp: new Date().toISOString(),
        },
      );

      return result;
    } catch (error) {
      const topic = typeof params?.adTopic === 'string' ? params.adTopic : 'Unknown Topic';
      // Use the helper to throw the error consistently
      safelyHandleError(error, topic);
    }
  },
};

/**
 * Export tools for registry
 */
export const tools = {
  reflect: reflectTool,
};
