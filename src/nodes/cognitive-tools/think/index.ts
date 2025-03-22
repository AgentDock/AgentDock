/**
 * @fileoverview Think tool implementation following Vercel AI SDK patterns.
 * Provides structured reasoning capabilities for complex problem solving.
 */

import { z } from 'zod';
import { Tool, ToolExecutionOptions } from '../../types';
import { ThinkComponent } from './components';
import { ToolResult, formatErrorMessage, createToolResult } from '@/lib/utils/markdown-utils';
import { logger, LogCategory } from 'agentdock-core';

/**
 * Detailed think tool description
 */
const thinkToolDescription = `
The 'think' tool provides a structured reasoning environment for complex problem-solving.

First, tell the user you'll use structured reasoning to analyze their question.
Then call the think tool with:
1. adTopic - A brief description of the topic
2. reasoning - Your detailed step-by-step analysis

For the reasoning, use Markdown formatting to create an engaging, well-structured analysis:
- **Bold key concepts** and *italicize important insights* (use these for ~20% of content)
- Use \`code blocks\` for technical elements, equations, or specific terms
- Create tables to organize comparative information using Markdown syntax
- Use > blockquotes for important conclusions or highlighted points
- Include numbered lists (1.) for sequential steps and bullet points (-) for related items
- Use Markdown headings (### and ####) for logical section breaks if needed

Begin with a clear problem definition, consider multiple approaches, work through the solution systematically, and provide a well-reasoned conclusion.

Your analysis should flow naturally while leveraging formatting to emphasize key points and improve readability.
`;

/**
 * Schema for think tool parameters
 */
const thinkSchema = z.object({
  adTopic: z.string().describe('A brief topic description for the structured reasoning heading'),
  reasoning: z.string().optional().describe('Detailed reasoning process with Markdown formatting for emphasis and structure'),
  confidence: z.number().min(0).max(1).optional().describe('Optional confidence score (0-1) in your reasoning')
});

/**
 * Type inference from schema
 */
type ThinkParams = z.infer<typeof thinkSchema>;

/**
 * Handle tool errors safely, ensuring they are always properly formatted strings
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
  
  logger.error(LogCategory.NODE, '[Think]', 'Execution error:', { error: errorMessage });
  
  // Return a properly formatted error message
  return ThinkComponent({
    topic: topic,
    reasoning: `Error: ${errorMessage}`
  });
}

/**
 * Think tool implementation
 */
export const thinkTool: Tool = {
  name: 'think',
  description: thinkToolDescription,
  parameters: thinkSchema,
  execute: async (params: ThinkParams, options: ToolExecutionOptions): Promise<ToolResult> => {
    try {
      const { adTopic, reasoning = '', confidence } = params;
      
      logger.debug(LogCategory.NODE, '[Think]', `Processing reasoning for: "${adTopic}"`, { 
        toolCallId: options.toolCallId,
        hasReasoning: !!reasoning,
        reasoningLength: reasoning?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      // Add an artificial delay to allow the loading animation to be visible
      // This is optional and can be adjusted or removed based on user preference
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Handle partial calls (when only adTopic is provided)
      if (!reasoning || reasoning.trim() === '') {
        logger.debug(LogCategory.NODE, '[Think]', 'Partial call detected, displaying topic only', {
          topic: adTopic,
          timestamp: new Date().toISOString()
        });
        
        return ThinkComponent({
          topic: adTopic,
          reasoning: 'Analyzing...'
        });
      }
      
      // Create the result with all parameters for complete calls
      const result = ThinkComponent({
        topic: adTopic,
        reasoning: reasoning,
        confidence
      });
      
      logger.debug(LogCategory.NODE, '[Think]', 'Returning complete reasoning', {
        topic: adTopic,
        reasoningLength: reasoning.length,
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (error) {
      // Use the safe error handler to ensure proper formatting
      return safelyHandleError(error, params?.adTopic || 'Unknown Topic');
    }
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  think: thinkTool
}; 