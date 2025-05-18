/**
 * @fileoverview Compare tool implementation following Vercel AI SDK patterns.
 * Provides structured comparison capabilities for evaluating multiple options.
 */

import { z } from 'zod';
import { Tool, ToolExecutionOptions } from '../../types';
import { CompareComponent } from './components';
import { ToolResult, formatErrorMessage, createToolResult } from '@/lib/utils/markdown-utils';
import { logger, LogCategory } from 'agentdock-core';

/**
 * Detailed compare tool description
 */
const compareToolDescription = `
The 'compare' tool provides a structured framework for comparing multiple options, concepts, or approaches.

First, tell the user you'll create a systematic comparison to evaluate the options.
Then call the compare tool with:
1. adTopic - Brief description of what's being compared
2. comparison - Your detailed structured comparison analysis

For the comparison, use Markdown formatting to create a clear, comprehensive analysis:
- **Bold key differences** and *italicize important insights* (use these for ~20% of content)
- Create comparison tables using Markdown syntax (highly recommended for visual comparisons)
- Use ✓ and ✗ symbols to indicate strengths and weaknesses
- Use \`code blocks\` for technical elements or specific terms
- Use > blockquotes for important conclusions or highlighted points
- Include numbered lists (1.) for criteria and bullet points (-) for features

Begin with a DEFINE section that establishes what's being compared, followed by CRITERIA to evaluate, 
then ANALYSIS that systematically compares each option. Include a TRADE-OFFS section to discuss 
situational factors, and end with a CONCLUDE section offering recommendations.

Your comparison should be balanced, objective, and utilize formatting to enhance readability.
`;

/**
 * Schema for compare tool parameters
 */
const compareSchema = z.object({
  adTopic: z
    .string()
    .min(1, 'Topic must not be empty')
    .describe('Brief description of what is being compared'),
  comparison: z
    .string()
    .min(1, 'Comparison content must be provided.')
    .describe('Detailed structured comparison with Markdown formatting for tables and emphasis'),
});

/**
 * Type inference from schema
 */
type CompareParams = z.infer<typeof compareSchema>;

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
      const safeError = {
        message: error instanceof Error ? error.message : 'Unknown error object',
        type: error?.constructor?.name || typeof error,
      };
      errorMessage = JSON.stringify(safeError);
    } catch {
      errorMessage = 'Error: Could not format error details';
    }
  }

  logger.error(LogCategory.NODE, '[Compare]', 'Execution error (throwing):', {
    error: errorMessage,
  });

  // Throw a standard Error instead of returning a ToolResult
  throw new Error(`Error during comparison on "${topic}": ${errorMessage}`);
}

/**
 * Compare tool implementation - Uses CompareComponent for SUCCESS results only.
 */
export const compareTool: Tool = {
  name: 'compare',
  description: compareToolDescription,
  parameters: compareSchema,
  execute: async (params: CompareParams, options: ToolExecutionOptions): Promise<ToolResult> => {
    try {
      const validation = compareSchema.safeParse(params);
      if (!validation.success) {
        const errorMsg = validation.error.errors
          .map((e) => `${e.path.join('.')} - ${e.message}`)
          .join(', ');
        logger.warn(LogCategory.NODE, '[Compare]', 'Invalid parameters received (throwing)', {
          errors: errorMsg,
        });
        // Throw the validation error using the helper
        safelyHandleError(`Invalid parameters: ${errorMsg}`, params.adTopic || 'Unknown Topic');
      }

      const { adTopic, comparison } = validation.data;

      logger.debug(LogCategory.NODE, '[Compare]', `Formatting comparison for: "${adTopic}"`, {
        toolCallId: options.toolCallId,
        comparisonLength: comparison.length,
        timestamp: new Date().toISOString(),
      });

      // Call the component function ONLY for successful formatting
      const result = CompareComponent({ topic: adTopic, comparison });

      logger.debug(
        LogCategory.NODE,
        '[Compare]',
        'Returning formatted comparison via CompareComponent',
        {
          topic: adTopic,
          comparisonLength: comparison.length,
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
  compare: compareTool,
};
