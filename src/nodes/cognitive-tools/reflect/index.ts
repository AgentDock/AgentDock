/**
 * @fileoverview Reflect tool implementation following the same pattern as the Think tool.
 * Provides structured reflection capabilities for retrospective analysis.
 */

import { z } from 'zod';
import { Tool, ToolExecutionOptions } from '../../types';
import { ReflectComponent } from './components';
import { ToolResult, formatErrorMessage, createToolResult } from '@/lib/utils/markdown-utils';
import { logger, LogCategory } from 'agentdock-core';

/**
 * Detailed reflect tool description
 */
const reflectToolDescription = `
The 'reflect' tool provides structured retrospective analysis of past experiences or decisions.

First, tell the user you'll use structured reflection to analyze their topic.
Then call the reflect tool with:
1. adTopic - A brief description of the topic to reflect on
2. reflection - Your detailed structured reflection

For the reflection, use well-organized Markdown formatting:
- **Bold key insights** and *italicize important lessons* (use these for ~20% of content)
- Include numbered lists (1.) for sequential points and bullet points (-) for key patterns
- Create contextual sections for CONTEXT, OBSERVATIONS, INSIGHTS, GROWTH AREAS, etc.
- Use > blockquotes for important realizations or conclusions
- Use Markdown headings for logical section breaks if needed

Begin with contextual background, identify patterns, extract meaningful lessons, explore opportunities 
for improvement, connect to broader principles, and conclude with actionable takeaways.
`;

/**
 * Schema for reflect tool parameters
 */
const reflectSchema = z.object({
  adTopic: z.string().describe('A brief topic description for the reflection heading'),
  reflection: z.string().optional().describe('Detailed reflection with Markdown formatting for emphasis and structure'),
  confidence: z.number().min(0).max(1).optional().describe('Optional confidence score (0-1) in your reflection')
});

/**
 * Type inference from schema
 */
type ReflectParams = z.infer<typeof reflectSchema>;

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
  
  logger.error(LogCategory.NODE, '[Reflect]', 'Execution error:', { error: errorMessage });
  
  // Return a properly formatted error message
  return ReflectComponent({
    topic: topic,
    reflection: `Error: ${errorMessage}`
  });
}

/**
 * Reflect tool implementation
 */
export const reflectTool: Tool = {
  name: 'reflect',
  description: reflectToolDescription,
  parameters: reflectSchema,
  execute: async (params: ReflectParams, options: ToolExecutionOptions): Promise<ToolResult> => {
    try {
      const { adTopic, reflection = '', confidence } = params;
      
      logger.debug(LogCategory.NODE, '[Reflect]', `Processing reflection for: "${adTopic}"`, { 
        toolCallId: options.toolCallId,
        hasReflection: !!reflection,
        reflectionLength: reflection?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      // Add an artificial delay to allow the loading animation to be visible
      // This is optional and can be adjusted or removed based on user preference
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Handle partial calls (when only adTopic is provided)
      if (!reflection || reflection.trim() === '') {
        logger.debug(LogCategory.NODE, '[Reflect]', 'Partial call detected, displaying topic only', {
          topic: adTopic,
          timestamp: new Date().toISOString()
        });
        
        return ReflectComponent({
          topic: adTopic,
          reflection: 'Reflecting...'
        });
      }
      
      // Create the result with all parameters for complete calls
      const result = ReflectComponent({
        topic: adTopic,
        reflection: reflection,
        confidence
      });
      
      logger.debug(LogCategory.NODE, '[Reflect]', 'Returning complete reflection', {
        topic: adTopic,
        reflectionLength: reflection.length,
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
  reflect: reflectTool
}; 