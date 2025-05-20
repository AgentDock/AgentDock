/**
 * @fileoverview Critique tool implementation following Vercel AI SDK patterns.
 * Provides structured critical analysis for code, writing, arguments, and designs.
 */

import { z } from 'zod';
import { Tool, ToolExecutionOptions } from '../../types';
import { ToolResult, createToolResult } from '@/lib/utils/markdown-utils';
import { logger, LogCategory } from 'agentdock-core';
import { CritiqueSchema, CritiqueParameters } from './schema';

/**
 * Schema for critique tool parameters
 */
const critiqueSchema = z.object({
  subject: z.string().min(1, 'Subject is required').describe('What is being critiqued'),
  analysis: z
    .string()
    .min(1, 'Analysis content must be provided.')
    .describe(
      'Detailed critique analysis with understanding, strengths, issues, suggestions, and assessment',
    ),
});

/**
 * Type inference from schema
 */
type CritiqueParams = z.infer<typeof critiqueSchema>;

/**
 * Formats critique analysis with semantic markup
 */
function formatCritiqueAnalysis(analysis: string): string {
  if (!analysis || typeof analysis !== 'string') return '';
  return analysis.trim();
}

/**
 * Critique component function
 */
function CritiqueComponent({ subject = '', analysis = '' }: CritiqueParams): ToolResult {
  const formattedAnalysis = formatCritiqueAnalysis(analysis);
  const title = `## 🔍 Critique of: ${subject}`;
  const markdownContent = `${title}\n\n${formattedAnalysis}`;
  return createToolResult('critique_result', markdownContent);
}

/**
 * Detailed critique tool description
 */
const critiqueToolDescription = `
The 'critique' tool provides a structured framework for critically evaluating code, writing, arguments, and designs.

First, tell the user you'll perform a structured critique to analyze their content.
Then call the critique tool with:
1. subject - A brief description of what you're critiquing
2. analysis - Your detailed step-by-step critique

For the analysis, use this structure to create a balanced and actionable critique:
- Begin with "UNDERSTANDING:" to show comprehension of the subject
- Include "STRENGTHS:" section with numbered lists of positive aspects
- Add "ISSUES:" section with clear identification of problems
- Provide "SUGGESTIONS:" with specific, actionable recommendations
- End with "OVERALL ASSESSMENT:" that summarizes your evaluation

Format your analysis with Markdown for readability:
- **Bold key concepts** and *italicize important insights* 
- Use numbered lists (1., 2., etc.) for each point in a section
- Use paragraphs to clearly separate distinct thoughts
- Maintain a balanced tone that recognizes both strengths and weaknesses

Your critique should be constructive, specific, and provide clear guidance for improvement.
`;

/**
 * Handle tool errors by throwing a standard Error.
 */
function safelyHandleError(error: unknown, subject: string): never {
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
        type: typeof error,
        message:
          error && typeof error === 'object' && 'message' in error
            ? String(error.message)
            : 'Unknown error format',
      };
      errorMessage = JSON.stringify(safeError);
    } catch {
      errorMessage = 'Error: Could not format error details';
    }
  }

  logger.error(LogCategory.NODE, '[Critique]', 'Execution error (throwing):', {
    error: errorMessage,
  });

  throw new Error(`Error during critique of "${subject}": ${errorMessage}`);
}

/**
 * Critique tool implementation - Uses local CritiqueComponent for SUCCESS results only.
 */
export const critiqueTool: Tool = {
  name: 'critique',
  description: critiqueToolDescription,
  parameters: CritiqueSchema,
  execute: async (
    params: CritiqueParameters,
    options: ToolExecutionOptions,
  ): Promise<ToolResult> => {
    try {
      const validation = CritiqueSchema.safeParse(params);
      if (!validation.success) {
        const errorMsg = validation.error.errors
          .map((e) => `${e.path.join('.')} - ${e.message}`)
          .join(', ');
        logger.warn(LogCategory.NODE, '[Critique]', 'Invalid parameters received (throwing)', {
          errors: errorMsg,
        });
        safelyHandleError(`Invalid parameters: ${errorMsg}`, params.subject || 'Unknown Subject');
      }

      const { subject, analysis } = validation.data;

      logger.debug(LogCategory.NODE, '[Critique]', `Formatting critique for: "${subject}"`, {
        toolCallId: options.toolCallId,
        analysisLength: analysis.length,
        timestamp: new Date().toISOString(),
      });

      const result = CritiqueComponent({ subject, analysis });

      logger.debug(
        LogCategory.NODE,
        '[Critique]',
        'Returning formatted critique via local Component',
        {
          subject,
          analysisLength: analysis.length,
          timestamp: new Date().toISOString(),
        },
      );

      return result;
    } catch (error) {
      const subject = typeof params?.subject === 'string' ? params.subject : 'Unknown Subject';
      safelyHandleError(error, subject);
    }
  },
};

/**
 * Export tools for registry
 */
export const tools = {
  critique: critiqueTool,
};
