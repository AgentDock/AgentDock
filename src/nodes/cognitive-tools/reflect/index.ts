/**
 * @fileoverview Reflect Tool implementation for retrospective analysis.
 * This tool helps agents reflect on experiences, decisions, or processes to extract insights.
 */

import { z } from 'zod';
import { Tool, ToolExecutionOptions } from '../../types';
import { ReflectComponent } from './components';
import { ToolResult } from '@/lib/utils/markdown-utils';
import { logger, LogCategory } from 'agentdock-core';

/**
 * Reflect tool schema
 */
export const reflectSchema = z.object({
  adTopic: z.string().min(1, "A topic is required for reflection"),
  reflection: z.string().optional()
});

/**
 * Reflect tool parameters type
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
 * Default Reflect parameters
 */
export const defaultReflectParams: ReflectParams = {
  adTopic: "",
  reflection: ""
};

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
 * Generate dynamic structured reflection for a topic using the LLM
 */
async function generateStructuredReflection(topic: string, options: ToolExecutionOptions): Promise<string> {
  try {
    // Access LLM the same way as deep-research, this property was added in the agentdock-core context
    if (!options.llmContext?.llm) {
      logger.warn(LogCategory.NODE, '[Reflect]', 'No LLM available for generating dynamic reflection');
      return `Reflecting on ${topic}...`;
    }

    logger.debug(LogCategory.NODE, '[Reflect]', 'Generating dynamic structured reflection with LLM');
    
    // Prepare LLM prompt - following deep-research implementation style
    const messages = [
      {
        role: 'system',
        content: `You are an expert at retrospective analysis and reflection. Generate a detailed, structured reflection for the topic provided.

Apply these reflection principles to your analysis:
- Begin by establishing relevant context and background
- Identify key patterns, observations, and notable elements
- Extract meaningful insights and lessons from the observations
- Consider opportunities for improvement and growth
- Make connections to broader principles or related domains
- Synthesize everything into a cohesive understanding

Choose a structure that makes the most sense for this specific topic. Not all topics require the same reflection structure - adapt your approach to what will produce the most meaningful insights for this particular topic.

Use rich Markdown formatting:
- Create appropriate section headings that reflect your chosen structure
- Bold (~15% of text) for key insights and conclusions
- Italics (~10% of text) for important lessons and perspectives
- Create tables when comparing multiple elements
- Use blockquotes for profound realizations
- Include numbered lists for sequential points
- Use bullet points for related patterns

IMPORTANT: Do not include a title or heading at the beginning of your response.
Do not repeat the topic as a title. The application will add an appropriate title for your reflection.

Your reflection should be insightful, well-structured, and demonstrate clear retrospective thinking.`
      },
      {
        role: 'user',
        content: `Generate a comprehensive structured reflection on this topic: "${topic}". 
        
Make your reflection thorough, well-formatted with Markdown, and extract meaningful insights.
Remember, do not include a title - start directly with your reflection.`
      }
    ];

    // Generate reflection with LLM - this matches how deep-research does it
    const result = await options.llmContext.llm.generateText({ 
      messages
    });
    
    logger.debug(LogCategory.NODE, '[Reflect]', 'Successfully generated dynamic reflection with LLM', {
      contentLength: result.text.length
    });
    
    return result.text;
  } catch (error) {
    logger.error(LogCategory.NODE, '[Reflect]', 'Error generating dynamic reflection', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // If LLM generation fails, return a simple message
    return `Reflecting on ${topic}...`;
  }
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
      const { adTopic, reflection = '' } = params;
      
      logger.debug(LogCategory.NODE, '[Reflect]', `Processing reflection for: "${adTopic}"`, { 
        toolCallId: options.toolCallId,
        hasReflection: !!reflection,
        reflectionLength: reflection?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      // Add a minimal artificial delay to allow the loading animation to be visible
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Handle partial calls (when only adTopic is provided)
      if (!reflection || reflection.trim() === '') {
        logger.debug(LogCategory.NODE, '[Reflect]', 'Partial call detected - generating dynamic structured reflection', {
          topic: adTopic,
          timestamp: new Date().toISOString()
        });
        
        // Generate dynamic structured reflection for the topic using LLM
        const dynamicReflection = await generateStructuredReflection(adTopic, options);
        
        return ReflectComponent({
          topic: adTopic,
          reflection: dynamicReflection
        });
      }
      
      // Create the result with all parameters for complete calls
      const result = ReflectComponent({
        topic: adTopic,
        reflection: reflection
      });
      
      logger.debug(LogCategory.NODE, '[Reflect]', 'Returning complete reflection', {
        topic: adTopic,
        reflectionLength: reflection.length,
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (error) {
      return safelyHandleError(error, params.adTopic || '');
    }
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  reflect: reflectTool
}; 