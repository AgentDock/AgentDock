/**
 * @fileoverview Brainstorm tool implementation following Vercel AI SDK patterns.
 * Provides creative ideation with structured categorization for various topics.
 */

import { z } from 'zod';
import { Tool, ToolExecutionOptions } from '../../types';
import { ToolResult, formatErrorMessage, createToolResult } from '@/lib/utils/markdown-utils';
import { logger, LogCategory } from 'agentdock-core';

/**
 * Schema for brainstorm tool parameters
 */
const brainstormSchema = z.object({
  challenge: z.string().min(1, "Challenge is required").describe("The problem or topic to brainstorm ideas for"),
  ideas: z.string().optional().describe("Structured collection of creative ideas with categories and explanations")
});

/**
 * Type inference from schema
 */
type BrainstormParams = z.infer<typeof brainstormSchema>;

/**
 * Formats brainstorm ideas with semantic markup
 */
function formatBrainstormIdeas(ideas: string): string {
  // Add semantic formatting to different sections
  return ideas
    // Format the section headers
    .replace(/PROBLEM FRAMING:/g, '**PROBLEM FRAMING:**')
    .replace(/CATEGORY \d+:/g, (match) => `\n\n### ${match}`)
    .replace(/IDEAS:/g, '**IDEAS:**')
    .replace(/POTENTIAL APPLICATIONS:/g, '**POTENTIAL APPLICATIONS:**')
    .replace(/KEY INSIGHTS:/g, '**KEY INSIGHTS:**')
    .replace(/NEXT STEPS:/g, '\n\n**NEXT STEPS:**');
}

/**
 * Brainstorm component function
 */
function BrainstormComponent({ 
  challenge = "", 
  ideas = ""
}: BrainstormParams): ToolResult {
  // Format title and content
  const title = `## 💡 Brainstorm: ${challenge}`;
  const formattedIdeas = formatBrainstormIdeas(ideas);
  
  // Return formatted markdown result
  return createToolResult(
    'brainstorm_result',
    `${title}\n\n${formattedIdeas}`
  );
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
 * Handle tool errors safely, ensuring they are always properly formatted strings
 */
function safelyHandleError(error: unknown, challenge: string): ToolResult {
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
  
  logger.error(LogCategory.NODE, '[Brainstorm]', 'Execution error:', { error: errorMessage });
  
  // Return a properly formatted error result
  return BrainstormComponent({
    challenge,
    ideas: `Error: ${errorMessage}`
  });
}

/**
 * Generate dynamic brainstorming ideas for a challenge using the LLM
 */
async function generateStructuredBrainstorming(challenge: string, options: ToolExecutionOptions): Promise<string> {
  try {
    // Access LLM from the context
    if (!options.llmContext?.llm) {
      logger.warn(LogCategory.NODE, '[Brainstorm]', 'No LLM available for generating dynamic brainstorming');
      return `Generating ideas for ${challenge}...`;
    }

    logger.debug(LogCategory.NODE, '[Brainstorm]', 'Generating dynamic structured brainstorming with LLM');
    
    // Prepare LLM prompt
    const messages = [
      {
        role: 'system',
        content: `You are an expert in creative thinking and innovation. Generate a detailed, structured brainstorming output for the challenge provided.
        
Your goal is to generate diverse, creative ideas that address the challenge from multiple angles. Choose a structure that makes the most sense for this specific challenge - not all challenges require the same brainstorming approach.

Apply these creative thinking principles:
- Begin by reframing the problem to unlock new perspectives
- Generate a diverse range of ideas across different domains and approaches
- Include unconventional or non-obvious solutions
- Consider both practical and ambitious ideas
- Organize ideas in a way that highlights patterns and themes
- Identify potential applications or implementations
- Extract key insights and suggest productive next steps

You have flexibility in how you structure your brainstorming based on what works best for the specific challenge. Some possible approaches:
- For product challenges: Explore features, user needs, technology applications, and business models
- For process improvements: Consider efficiency, automation, reorganization, and paradigm shifts
- For creative problems: Use analogies, constraint removal, reversal, and combination techniques
- For strategic questions: Analyze trends, stakeholder perspectives, and scenario planning
- For social challenges: Examine behavioral, systemic, and community-based approaches

Use rich Markdown formatting:
- Create appropriate section headings that reflect your chosen structure
- Bold (~15% of text) for key ideas and breakthrough concepts
- Italics (~10% of text) for contextual insights or qualifying statements
- Use emoji sparingly for visual categorization of different idea types
- Include numbered lists for prioritized ideas or sequential processes
- Use bullet points for idea variations or quick explorations

IMPORTANT: Do not include a title or heading at the beginning of your response.
Do not repeat the challenge as a title. The application will add an appropriate title for your brainstorming session.

Your brainstorming should be creative, diverse, and push beyond obvious solutions.`
      },
      {
        role: 'user',
        content: `Generate a comprehensive structured brainstorming session for this challenge: "${challenge}".
        
Be creative and diverse in your ideas, exploring multiple angles and approaches.
Remember, do not include a title - start directly with your brainstorming content.`
      }
    ];

    // Generate brainstorming with LLM
    const result = await options.llmContext.llm.generateText({ 
      messages
    });
    
    logger.debug(LogCategory.NODE, '[Brainstorm]', 'Successfully generated dynamic brainstorming with LLM', {
      contentLength: result.text.length
    });
    
    return result.text;
  } catch (error) {
    logger.error(LogCategory.NODE, '[Brainstorm]', 'Error generating dynamic brainstorming', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // If LLM generation fails, return a simple message
    return `Generating ideas for ${challenge}...`;
  }
}

/**
 * Brainstorm tool implementation
 */
export const brainstormTool: Tool = {
  name: 'brainstorm',
  description: brainstormToolDescription,
  parameters: brainstormSchema,
  execute: async (params: BrainstormParams, options: ToolExecutionOptions): Promise<ToolResult> => {
    try {
      const { challenge, ideas } = params;
      
      logger.debug(LogCategory.NODE, '[Brainstorm]', `Processing brainstorming for: "${challenge}"`, { 
        toolCallId: options.toolCallId,
        hasIdeas: !!ideas,
        ideasLength: ideas?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      // Add a minimal artificial delay to allow the loading animation to be visible
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Handle partial calls (when only challenge is provided)
      if (!ideas || ideas.trim() === '') {
        logger.debug(LogCategory.NODE, '[Brainstorm]', 'Partial call detected - generating dynamic structured brainstorming', {
          challenge,
          timestamp: new Date().toISOString()
        });
        
        // Generate dynamic structured brainstorming for the challenge using LLM
        const dynamicIdeas = await generateStructuredBrainstorming(challenge, options);
        
        return BrainstormComponent({
          challenge,
          ideas: dynamicIdeas
        });
      }
      
      // Create the result with all parameters for complete calls
      const result = BrainstormComponent({
        challenge,
        ideas
      });
      
      logger.debug(LogCategory.NODE, '[Brainstorm]', 'Returning complete brainstorming session', {
        challenge,
        ideasLength: ideas.length,
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (error) {
      // Use the safe error handler to ensure proper formatting
      return safelyHandleError(error, params.challenge || 'Unknown Challenge');
    }
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  brainstorm: brainstormTool
};
