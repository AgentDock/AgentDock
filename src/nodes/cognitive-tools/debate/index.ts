/**
 * @fileoverview Debate tool implementation following Vercel AI SDK patterns.
 * Provides multi-perspective analysis for complex or controversial topics.
 */

import { z } from 'zod';
import { Tool, ToolExecutionOptions } from '../../types';
import { ToolResult, formatErrorMessage, createToolResult } from '@/lib/utils/markdown-utils';
import { logger, LogCategory } from 'agentdock-core';

/**
 * Schema for debate tool parameters
 */
const debateSchema = z.object({
  topic: z
    .string()
    .min(1, 'Topic is required')
    .describe('The controversial or complex topic to debate'),
  perspectives: z
    .string()
    .min(1, 'Perspectives content must be provided.')
    .describe('Multi-perspective analysis with arguments from different viewpoints'),
});

/**
 * Type inference from schema
 */
type DebateParams = z.infer<typeof debateSchema>;

/**
 * Minimal formatting function - primarily ensures the text is trimmed.
 */
function formatDebatePerspectives(perspectives: string): string {
  if (!perspectives || typeof perspectives !== 'string') return '';
  // Trim whitespace, but avoid other modifications.
  return perspectives.trim();
}

/**
 * Debate component function - simplified to just combine title and trimmed content
 */
function DebateComponent({ topic = '', perspectives = '' }: DebateParams): ToolResult {
  // Format title and content
  const title = `## ⚖️ Debate on: ${topic}`;
  const formattedPerspectives = formatDebatePerspectives(perspectives);

  // Return formatted markdown result
  return createToolResult(
    'debate_result',
    `${title}\n\n${formattedPerspectives}`, // Pass trimmed perspectives directly
  );
}

/**
 * Detailed debate tool description
 */
const debateToolDescription = `
The 'debate' tool provides a multi-perspective analysis for complex or controversial topics.

First, tell the user you'll perform a balanced debate to explore different perspectives on their topic.
Then call the debate tool with:
1. topic - A brief description of the complex or controversial topic to debate
2. perspectives - Your detailed multi-perspective analysis

For the perspectives, use this structure:
- Begin with "INTRODUCTION:" to frame the topic and explain its complexity
- Include multiple perspectives with "PERSPECTIVE 1:", "PERSPECTIVE 2:", etc.
- For each perspective include:
  * "ARGUMENTS:" - Key points supporting this viewpoint
  * "COUNTER-ARGUMENTS:" - Potential objections to this perspective
  * "EVIDENCE:" - Facts, research, or examples supporting this view
- End with "SYNTHESIS:" that highlights areas of agreement or compromise
- Conclude with "CONCLUSION:" that summarizes the most balanced perspective

Format your analysis with Markdown for readability:
- **Bold key concepts** and *italicize important insights* 
- Use numbered lists (1., 2., etc.) for arguments and counter-arguments
- Use bullet points for evidence points
- Use blockquotes for memorable quotes or key principles
- Create tables if comparing multiple perspectives side-by-side

Your debate should be balanced, nuanced, and present multiple viewpoints fairly.
`;

/**
 * Handle tool errors by throwing a standard Error.
 */
function safelyHandleError(error: unknown, topic: string): never {
  // Return type 'never' signifies it always throws
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

  logger.error(LogCategory.NODE, '[Debate]', 'Execution error (throwing):', {
    error: errorMessage,
  });

  // Throw a standard Error instead of returning a ToolResult
  throw new Error(`Error during debate on "${topic}": ${errorMessage}`);
}

/**
 * Debate tool implementation - Uses DebateComponent for SUCCESS results only.
 */
export const debateTool: Tool = {
  name: 'debate',
  description: debateToolDescription,
  parameters: debateSchema,
  execute: async (params: DebateParams, options: ToolExecutionOptions): Promise<ToolResult> => {
    try {
      const validation = debateSchema.safeParse(params);
      if (!validation.success) {
        const errorMsg = validation.error.errors
          .map((e) => `${e.path.join('.')} - ${e.message}`)
          .join(', ');
        logger.warn(LogCategory.NODE, '[Debate]', 'Invalid parameters received (throwing)', {
          errors: errorMsg,
        });
        // Throw the validation error using the helper
        safelyHandleError(`Invalid parameters: ${errorMsg}`, params.topic || 'Unknown Topic');
      }

      const { topic, perspectives } = validation.data;

      logger.debug(LogCategory.NODE, '[Debate]', `Formatting debate for: "${topic}"`, {
        toolCallId: options.toolCallId,
        perspectivesLength: perspectives.length,
        timestamp: new Date().toISOString(),
      });

      // Call the component function ONLY for successful formatting
      const result = DebateComponent({ topic, perspectives });

      logger.debug(LogCategory.NODE, '[Debate]', 'Returning formatted debate via DebateComponent', {
        topic,
        perspectivesLength: perspectives.length,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      const topic = typeof params?.topic === 'string' ? params.topic : 'Unknown Topic';
      // Use the helper to throw the error consistently
      safelyHandleError(error, topic);
    }
  },
};

/**
 * Export tools for registry
 */
export const tools = {
  debate: debateTool,
};
