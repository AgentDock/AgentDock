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
  topic: z.string().min(1, "Topic is required").describe("The controversial or complex topic to debate"),
  perspectives: z.string().optional().describe("Multi-perspective analysis with arguments from different viewpoints")
});

/**
 * Type inference from schema
 */
type DebateParams = z.infer<typeof debateSchema>;

/**
 * Formats debate perspectives with semantic markup
 */
function formatDebatePerspectives(perspectives: string): string {
  // Add semantic formatting to different sections
  return perspectives
    // Format the section headers
    .replace(/INTRODUCTION:/g, '**INTRODUCTION:**')
    .replace(/PERSPECTIVE \d+:/g, (match) => `\n\n### ${match}`)
    .replace(/ARGUMENTS:/g, '**ARGUMENTS:**')
    .replace(/COUNTER-ARGUMENTS:/g, '**COUNTER-ARGUMENTS:**')
    .replace(/EVIDENCE:/g, '**EVIDENCE:**')
    .replace(/SYNTHESIS:/g, '\n\n### **SYNTHESIS:**')
    .replace(/CONCLUSION:/g, '**CONCLUSION:**');
}

/**
 * Debate component function
 */
function DebateComponent({ 
  topic = "", 
  perspectives = ""
}: DebateParams): ToolResult {
  // Format title and content
  const title = `## ⚖️ Debate on: ${topic}`;
  const formattedPerspectives = formatDebatePerspectives(perspectives);
  
  // Return formatted markdown result
  return createToolResult(
    'debate_result',
    `${title}\n\n${formattedPerspectives}`
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
  
  logger.error(LogCategory.NODE, '[Debate]', 'Execution error:', { error: errorMessage });
  
  // Return a properly formatted error result
  return DebateComponent({
    topic,
    perspectives: `Error: ${errorMessage}`
  });
}

/**
 * Generate dynamic multi-perspective analysis for a topic using the LLM
 */
async function generateStructuredDebate(topic: string, options: ToolExecutionOptions): Promise<string> {
  try {
    // Access LLM from the context
    if (!options.llmContext?.llm) {
      logger.warn(LogCategory.NODE, '[Debate]', 'No LLM available for generating dynamic debate');
      return `Analyzing perspectives on ${topic}...`;
    }
    
    logger.debug(LogCategory.NODE, '[Debate]', 'Generating dynamic structured debate with LLM');
    
    // Prepare LLM prompt
    const messages = [
      {
        role: 'system',
        content: `You are an expert at multi-perspective analysis with deep knowledge across multiple domains. Generate a balanced, nuanced debate for the topic provided.

Your goal is to explore multiple viewpoints on the given topic in a fair and comprehensive way. Choose a structure that makes the most sense for this specific topic - not all topics require the same debate structure.

Apply these debate principles:
- Represent diverse viewpoints fairly and comprehensively
- Identify key arguments, counter-arguments, and supporting evidence
- Acknowledge areas of agreement, disagreement, and uncertainty
- Avoid personal bias while presenting positions in their strongest form
- Highlight potential synthesis or middle-ground positions where appropriate

You have flexibility in how you structure your analysis based on what's most appropriate for the specific topic. Some possible approaches:
- For policy debates: Compare stakeholder perspectives with their concerns and interests
- For ethical dilemmas: Explore different ethical frameworks and their conclusions
- For scientific controversies: Present competing theories with their supporting evidence
- For historical interpretations: Contrast different schools of thought on events
- For practical decisions: Analyze tradeoffs between different approaches

Use rich Markdown formatting:
- Create appropriate section headings that reflect your chosen structure
- Bold (~15% of text) for key positions and important conclusions
- Italics (~10% of text) for notable nuances and contextual factors
- Create tables when comparing multiple elements side-by-side
- Use blockquotes for significant principles or memorable quotes
- Include numbered lists for sequential arguments
- Use bullet points for evidence and examples

IMPORTANT: Do not include a title or heading at the beginning of your response.
Do not repeat the topic as a title. The application will add an appropriate title for your debate.

Your analysis should be balanced, nuanced, and present multiple viewpoints fairly.`
      },
      {
        role: 'user',
        content: `Generate a comprehensive multi-perspective debate on this topic: "${topic}".
        
Present a balanced analysis that fairly represents different viewpoints and their supporting evidence.
Remember, do not include a title - start directly with your analysis.`
      }
    ];

    // Generate debate with LLM
    const result = await options.llmContext.llm.generateText({ 
      messages
    });
    
    logger.debug(LogCategory.NODE, '[Debate]', 'Successfully generated dynamic debate with LLM', {
      contentLength: result.text.length
    });
    
    return result.text;
  } catch (error) {
    logger.error(LogCategory.NODE, '[Debate]', 'Error generating dynamic debate', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // If LLM generation fails, return a simple message
    return `Analyzing perspectives on ${topic}...`;
  }
}

/**
 * Debate tool implementation
 */
export const debateTool: Tool = {
  name: 'debate',
  description: debateToolDescription,
  parameters: debateSchema,
  execute: async (params: DebateParams, options: ToolExecutionOptions): Promise<ToolResult> => {
    try {
      const { topic, perspectives } = params;
      
      logger.debug(LogCategory.NODE, '[Debate]', `Processing debate for: "${topic}"`, { 
        toolCallId: options.toolCallId,
        hasPerspectives: !!perspectives,
        perspectivesLength: perspectives?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      // Add a minimal artificial delay to allow the loading animation to be visible
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Handle partial calls (when only topic is provided)
      if (!perspectives || perspectives.trim() === '') {
        logger.debug(LogCategory.NODE, '[Debate]', 'Partial call detected - generating dynamic structured debate', {
          topic,
          timestamp: new Date().toISOString()
        });
        
        // Generate dynamic structured multi-perspective analysis for the topic using LLM
        const dynamicPerspectives = await generateStructuredDebate(topic, options);
        
        return DebateComponent({
          topic,
          perspectives: dynamicPerspectives
        });
      }
      
      // Create the result with all parameters for complete calls
      const result = DebateComponent({
        topic,
        perspectives
      });
      
      logger.debug(LogCategory.NODE, '[Debate]', 'Returning complete debate', {
        topic,
        perspectivesLength: perspectives.length,
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (error) {
      // Use the safe error handler to ensure proper formatting
      return safelyHandleError(error, params.topic || 'Unknown Topic');
    }
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  debate: debateTool
};
