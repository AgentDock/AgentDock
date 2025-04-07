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
  adTopic: z.string().min(1, "Topic must not be empty"),
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
    // --- Added Direct Options Logging ---
    logger.debug(LogCategory.NODE, '[Reflect]', 'generateStructuredReflection received options:', {
      keys: Object.keys(options),
      hasLLMContext: !!options.llmContext,
      hasLLM: !!options.llmContext?.llm
    });
    // --- End Direct Options Logging ---
    
    // Check for LLM context - use proper property path based on how it's passed from agent-node.ts
    if (!options.llmContext?.llm) {
      logger.warn(LogCategory.NODE, '[Reflect]', 'No LLM available for generating dynamic reflection');
      return `Reflecting on ${topic}...`;
    }

    logger.debug(LogCategory.NODE, '[Reflect]', 'Generating dynamic structured reflection with LLM');
    
    // Add explicit debugging to verify LLM context
    logger.debug(LogCategory.NODE, '[Reflect]', 'LLM context check', {
      hasLLM: !!options.llmContext?.llm,
      provider: options.llmContext?.provider,
      model: options.llmContext?.model
    });
    
    // Prepare LLM prompt
    const messages = [
      {
        role: 'system',
        content: `You are an expert in reflective analysis. Generate a thoughtful, comprehensive reflection on the topic provided.

Your reflection should include these elements, structured appropriately for the specific topic:
- Context and background understanding
- Identification of key patterns and insights
- Analysis of what worked well and what didn't
- Valuable lessons and principles extracted
- Considerations for applying these insights going forward

Use rich Markdown formatting:
- Create appropriate section headings that reflect your chosen structure
- Bold (~15% of text) for key insights and conclusions
- Italics (~10% of text) for important observations
- Use blockquotes for profound realizations
- Include numbered lists for sequential processes
- Use bullet points for related items

IMPORTANT: Do not include a title or heading at the beginning of your response.
Do not repeat the topic as a title. The application will add an appropriate title for your reflection.
Your reflection should be comprehensive, insightful, and demonstrate deep analysis.`
      },
      {
        role: 'user',
        content: `Generate a comprehensive structured reflection on this topic: "${topic}". 
        
Make your reflection thorough, well-formatted with Markdown, and demonstrate deep introspective analysis.
Remember, do not include a title - start directly with your reflection.`
      }
    ];
    
    // Generate reflection with LLM
    const result = await options.llmContext.llm.generateText({
      messages
    });
    
    // --- Add Usage Tracking --- 
    if (result.usage && options.updateUsageHandler) {
      logger.debug(LogCategory.NODE, '[Reflect]', 'Calling usage handler after generateText', { 
        usage: result.usage,
        handlerExists: !!options.updateUsageHandler 
      });
      await options.updateUsageHandler(result.usage); // Call the handler passed from AgentNode
    } else {
      // Log if handler or usage is missing for debugging
      logger.warn(LogCategory.NODE, '[Reflect]', 'Usage handler or usage data missing, skipping update', { 
        hasUsage: !!result.usage,
        handlerExists: !!options.updateUsageHandler 
      });
    }
    // --- End Usage Tracking ---
    
    logger.debug(LogCategory.NODE, '[Reflect]', 'Successfully generated dynamic reflection with LLM', {
      contentLength: result.text.length
    });
    
    return result.text;
  } catch (error) {
    logger.error(LogCategory.NODE, '[Reflect]', 'Error generating dynamic reflection', {
      error: error instanceof Error ? error.message : String(error),
      options: JSON.stringify({
        hasLLMContext: !!options.llmContext,
        optionsKeys: Object.keys(options)
      })
    });
    
    // If LLM generation fails, return a simple message
    return `Reflecting on ${topic}...`;
  }
}

/**
 * Reflect tool implementation - using direct approach without enhancer
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
        reflection
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