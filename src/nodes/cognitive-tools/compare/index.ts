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
  adTopic: z.string().describe('Brief description of what is being compared'),
  comparison: z.string().optional().describe('Detailed structured comparison with Markdown formatting for tables and emphasis')
});

/**
 * Type inference from schema
 */
type CompareParams = z.infer<typeof compareSchema>;

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
  
  logger.error(LogCategory.NODE, '[Compare]', 'Execution error:', { error: errorMessage });
  
  // Return a properly formatted error message
  return CompareComponent({
    topic,
    comparison: `Error: ${errorMessage}`
  });
}

/**
 * Generate dynamic structured comparison for a topic using the LLM
 */
async function generateStructuredComparison(topic: string, options: ToolExecutionOptions): Promise<string> {
  try {
    // Access LLM the same way as in the think tool
    if (!options.llmContext?.llm) {
      logger.warn(LogCategory.NODE, '[Compare]', 'No LLM available for generating dynamic comparison');
      return `Comparing ${topic}...`;
    }

    logger.debug(LogCategory.NODE, '[Compare]', 'Generating dynamic structured comparison with LLM');
    
    // Prepare LLM prompt
    const messages = [
      {
        role: 'system',
        content: `You are an expert analyst who excels at creating comprehensive comparisons. Generate a detailed, structured comparison for the topic provided.
        
Your goal is to create an insightful, comprehensive analysis that effectively compares multiple options or perspectives. Choose a structure that makes the most sense for this specific topic - not all topics require the same comparison format.

Apply these comparison principles:
- Begin by clearly defining what's being compared and why
- Identify appropriate evaluation criteria relevant to the specific domain
- Provide balanced, objective analysis of each option
- Highlight key similarities and differences
- Recognize contextual factors that influence the evaluation
- Conclude with insights that help readers make informed decisions

You have flexibility in how you structure your comparison based on what works best for the specific topic. Some possible approaches:
- For product comparisons: Focus on features, performance, use cases, and value
- For methodology comparisons: Analyze approaches, underlying philosophies, and outcomes
- For theoretical comparisons: Examine foundational principles, implications, and applications
- For historical comparisons: Contrast contexts, impacts, and interpretations
- For decision analysis: Evaluate trade-offs, constraints, and potential outcomes

Use rich Markdown formatting to enhance readability:
- Create appropriate section headings that reflect your chosen structure
- Include comparison tables for side-by-side analysis when appropriate
- Bold (~15% of text) for key differences and important elements
- Italics (~10% of text) for nuanced observations or contextual details
- Use ✓ and ✗ symbols or emoji to indicate strengths/weaknesses
- Create numbered lists for sequential evaluation criteria
- Use bullet points for features or attributes

IMPORTANT: Do not include a title or heading at the beginning of your response.
Do not repeat the topic as a title. The application will add an appropriate title for your comparison.

Your comparison should be comprehensive, balanced, and demonstrate clear analytical thinking.`
      },
      {
        role: 'user',
        content: `Generate a comprehensive structured comparison for this topic: "${topic}".
        
Make your comparison thorough, well-formatted with Markdown tables when appropriate, and demonstrate clear analytical thinking.
Remember, do not include a title - start directly with your analysis.`
      }
    ];

    // Generate comparison with LLM
    const result = await options.llmContext.llm.generateText({ 
      messages
    });
    
    logger.debug(LogCategory.NODE, '[Compare]', 'Successfully generated dynamic comparison with LLM', {
      contentLength: result.text.length
    });
    
    return result.text;
  } catch (error) {
    logger.error(LogCategory.NODE, '[Compare]', 'Error generating dynamic comparison', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // If LLM generation fails, return a simple message
    return `Comparing ${topic}...`;
  }
}

/**
 * Compare tool implementation
 */
export const compareTool: Tool = {
  name: 'compare',
  description: compareToolDescription,
  parameters: compareSchema,
  execute: async (params: CompareParams, options: ToolExecutionOptions): Promise<ToolResult> => {
    try {
      const { adTopic, comparison = '' } = params;
      
      logger.debug(LogCategory.NODE, '[Compare]', `Processing comparison for: "${adTopic}"`, { 
        toolCallId: options.toolCallId,
        hasComparison: !!comparison,
        comparisonLength: comparison?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      // Add a minimal artificial delay to allow the loading animation to be visible
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Handle partial calls (when only adTopic is provided)
      if (!comparison || comparison.trim() === '') {
        logger.debug(LogCategory.NODE, '[Compare]', 'Partial call detected - generating dynamic structured comparison', {
          topic: adTopic,
          timestamp: new Date().toISOString()
        });
        
        // Generate dynamic structured comparison for the topic using LLM
        const dynamicComparison = await generateStructuredComparison(adTopic, options);
        
        return CompareComponent({
          topic: adTopic,
          comparison: dynamicComparison
        });
      }
      
      // Create the result with all parameters for complete calls
      const result = CompareComponent({
        topic: adTopic,
        comparison
      });
      
      logger.debug(LogCategory.NODE, '[Compare]', 'Returning complete comparison', {
        topic: adTopic,
        comparisonLength: comparison.length,
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
  compare: compareTool
}; 