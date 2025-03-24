/**
 * @fileoverview Think Tool implementation for structured reasoning.
 * This tool helps agents think through complex problems using structured analysis.
 */

import { z } from 'zod';
import { Tool, ToolExecutionOptions } from '../../types';
import { ThinkComponent } from './components';
import { ToolResult } from '@/lib/utils/markdown-utils';
import { logger, LogCategory } from 'agentdock-core';

/**
 * Think tool schema
 */
export const thinkSchema = z.object({
  adTopic: z.string().min(1, "A topic is required for structured thinking"),
  reasoning: z.string().optional()
});

/**
 * Think tool parameters type
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
  adTopic: "",
  reasoning: ""
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
  
  logger.error(LogCategory.NODE, '[Think]', 'Execution error:', { error: errorMessage });
  
  // Return a properly formatted error message
  return ThinkComponent({
    topic: topic,
    reasoning: `Error: ${errorMessage}`
  });
}

/**
 * Generate dynamic structured reasoning for a topic using the LLM
 */
async function generateStructuredReasoning(topic: string, options: ToolExecutionOptions): Promise<string> {
  try {
    // Access LLM the same way as deep-research, this property was added in the agentdock-core context
    if (!options.llmContext?.llm) {
      logger.warn(LogCategory.NODE, '[Think]', 'No LLM available for generating dynamic reasoning');
      return `Analyzing ${topic}...`;
    }

    logger.debug(LogCategory.NODE, '[Think]', 'Generating dynamic structured reasoning with LLM');
    
    // Prepare LLM prompt - following deep-research implementation style 
    const messages = [
      {
        role: 'system',
        content: `You are an expert critical thinker who excels at structured reasoning. Generate a detailed, structured analysis for the topic provided.

Apply these critical thinking principles to your analysis:
- Begin by understanding and framing the topic clearly
- Identify relevant factors, variables, or components
- Consider different approaches or methodologies
- Provide step-by-step reasoning and analysis
- Verify your conclusions by checking for weaknesses
- Conclude with key insights and takeaways

Choose a structure that makes the most sense for this specific topic. Not all topics require the same structure - adapt your approach to what will produce the most insightful analysis for this particular topic.

Use rich Markdown formatting:
- Create appropriate section headings that reflect your chosen structure
- Bold (~15% of text) for key concepts and conclusions
- Italics (~10% of text) for insights and important points
- Create tables when comparing multiple elements
- Use blockquotes for profound insights
- Include numbered lists for sequential steps
- Use bullet points for related items

IMPORTANT: Do not include a title or heading at the beginning of your response.
Do not repeat the topic as a title. The application will add an appropriate title for your analysis.
Your analysis should be detailed, logically structured, and demonstrate expert reasoning.`
      },
      {
        role: 'user',
        content: `Generate a comprehensive structured reasoning analysis for this topic: "${topic}". 
        
Make your analysis thorough, well-formatted with Markdown, and demonstrate clear critical thinking.
Remember, do not include a title - start directly with your analysis.`
      }
    ];

    // Generate reasoning with LLM - this matches how deep-research does it
    const result = await options.llmContext.llm.generateText({ 
      messages
    });
    
    logger.debug(LogCategory.NODE, '[Think]', 'Successfully generated dynamic reasoning with LLM', {
      contentLength: result.text.length
    });
    
    return result.text;
  } catch (error) {
    logger.error(LogCategory.NODE, '[Think]', 'Error generating dynamic reasoning', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // If LLM generation fails, return a simple message
    return `Analyzing ${topic}...`;
  }
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
      const { adTopic, reasoning = '' } = params;
      
      logger.debug(LogCategory.NODE, '[Think]', `Processing reasoning for: "${adTopic}"`, { 
        toolCallId: options.toolCallId,
        hasReasoning: !!reasoning,
        reasoningLength: reasoning?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      // Add a minimal artificial delay to allow the loading animation to be visible
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Handle partial calls (when only adTopic is provided)
      if (!reasoning || reasoning.trim() === '') {
        logger.debug(LogCategory.NODE, '[Think]', 'Partial call detected - generating dynamic structured reasoning', {
          topic: adTopic,
          timestamp: new Date().toISOString()
        });
        
        // Generate dynamic structured reasoning for the topic using LLM
        const dynamicReasoning = await generateStructuredReasoning(adTopic, options);
        
        return ThinkComponent({
          topic: adTopic,
          reasoning: dynamicReasoning
        });
      }
      
      // Create the result with all parameters for complete calls
      const result = ThinkComponent({
        topic: adTopic,
        reasoning: reasoning
      });
      
      logger.debug(LogCategory.NODE, '[Think]', 'Returning complete reasoning', {
        topic: adTopic,
        reasoningLength: reasoning.length,
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
  think: thinkTool
}; 