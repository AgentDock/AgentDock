/**
 * @fileoverview Brainstorm tool implementation following Vercel AI SDK patterns.
 * Provides creative ideation with structured categorization for various topics.
 */

import { LogCategory, logger } from 'agentdock-core';

import { createToolResult, ToolResult } from '@/lib/utils/markdown-utils';
import { Tool, ToolExecutionOptions } from '../../types';
import { BrainstormParameters, BrainstormSchema } from './schema';

/**
 * Handle tool errors by throwing a standard Error.
 */
function safelyHandleError(error: unknown, challenge: string): never {
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

  logger.error(
    LogCategory.NODE,
    '[Brainstorm]',
    'Execution error (throwing):',
    { error: errorMessage }
  );

  // Throw a standard Error instead of returning a ToolResult
  throw new Error(`Error during brainstorm on "${challenge}": ${errorMessage}`);
}

/**
 * Detailed brainstorm tool description
 */
const brainstormToolDescription = `
The 'brainstorm' tool provides a structured approach to creative ideation for problems, challenges, or opportunities.

First, tell the user you'll use a structured brainstorming process to generate ideas for their challenge.
Then call the brainstorm tool with:
1. challenge - A brief description of the problem or opportunity to explore
2. ideas - Your structured collection of creative ideas

For the ideas, use this structure:
- Begin with "PROBLEM FRAMING:" to reframe the challenge in a way that enables creative solutions
- Include multiple idea categories using "CATEGORY 1:", "CATEGORY 2:", etc.
- For each category include:
  * "IDEAS:" - A list of specific, actionable ideas in this category
  * "POTENTIAL APPLICATIONS:" - How these ideas might be implemented or used
- End with "KEY INSIGHTS:" highlighting patterns or particularly promising directions
- Conclude with "NEXT STEPS:" suggesting how to develop these ideas further

Format your ideas with Markdown for readability:
- **Bold key concepts** and *italicize important insights* 
- Use numbered lists (1., 2., etc.) for sequential steps or prioritized ideas
- Use bullet points for related concepts or variations on an idea
- Create tables if comparing multiple approaches or ideas
- Use emoji sparingly to add visual distinction to different idea types

Your brainstorming should be creative, diverse, and push beyond obvious solutions.
`;

/**
 * Brainstorm tool implementation - Formats SUCCESS results directly.
 */
export const brainstormTool: Tool = {
  name: 'brainstorm',
  description: brainstormToolDescription,
  parameters: BrainstormSchema,
  execute: async (
    params: BrainstormParameters,
    options: ToolExecutionOptions
  ): Promise<ToolResult> => {
    try {
      const validation = BrainstormSchema.safeParse(params);
      if (!validation.success) {
        const errorMsg = validation.error.errors
          .map((e) => `${e.path.join('.')} - ${e.message}`)
          .join(', ');
        logger.warn(
          LogCategory.NODE,
          '[Brainstorm]',
          'Invalid parameters received (throwing)',
          { errors: errorMsg }
        );
        // Throw the validation error using the helper
        safelyHandleError(
          `Invalid parameters: ${errorMsg}`,
          params.challenge || 'Unknown Challenge'
        );
      }

      const { challenge, ideas } = validation.data;

      logger.debug(
        LogCategory.NODE,
        '[Brainstorm]',
        `Formatting brainstorming for: "${challenge}"`,
        {
          toolCallId: options.toolCallId,
          ideasLength: ideas.length,
          timestamp: new Date().toISOString()
        }
      );

      // Format success result directly using createToolResult
      const trimmedIdeas = ideas.trim();
      const title = `## 💡 Brainstorm: ${challenge}`;
      const markdownContent = `${title}\n\n${trimmedIdeas}`;
      const result = createToolResult('brainstorm_result', markdownContent);

      logger.debug(
        LogCategory.NODE,
        '[Brainstorm]',
        'Returning formatted brainstorming session',
        {
          challenge,
          ideasLength: ideas.length, // Log original length
          timestamp: new Date().toISOString()
        }
      );

      return result;
    } catch (error) {
      const challenge =
        typeof params?.challenge === 'string'
          ? params.challenge
          : 'Unknown Challenge';
      // Use the helper to throw the error consistently
      safelyHandleError(error, challenge);
    }
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  brainstorm: brainstormTool
};
