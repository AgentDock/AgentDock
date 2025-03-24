/**
 * @fileoverview Critique tool implementation following Vercel AI SDK patterns.
 * Provides structured critical analysis for code, writing, arguments, and designs.
 */

import { z } from 'zod';
import { Tool, ToolExecutionOptions } from '../../types';
import { ToolResult, formatErrorMessage, createToolResult } from '@/lib/utils/markdown-utils';
import { logger, LogCategory } from 'agentdock-core';

/**
 * Schema for critique tool parameters
 */
const critiqueSchema = z.object({
  subject: z.string().min(1, "Subject is required").describe("What is being critiqued"),
  analysis: z.string().optional().describe("Detailed critique analysis with understanding, strengths, issues, suggestions, and assessment")
});

/**
 * Type inference from schema
 */
type CritiqueParams = z.infer<typeof critiqueSchema>;

/**
 * Formats critique analysis with semantic markup
 */
function formatCritiqueAnalysis(analysis: string): string {
  // Add semantic formatting to different sections
  return analysis
    // Format the section headers
    .replace(/UNDERSTANDING:/g, '**UNDERSTANDING:**')
    .replace(/STRENGTHS:/g, '**STRENGTHS:**')
    .replace(/ISSUES:/g, '**ISSUES:**')
    .replace(/SUGGESTIONS:/g, '**SUGGESTIONS:**')
    .replace(/OVERALL ASSESSMENT:/g, '**OVERALL ASSESSMENT:**');
}

/**
 * Critique component function
 */
function CritiqueComponent({ 
  subject = "", 
  analysis = ""
}: CritiqueParams): ToolResult {
  // Format title and content
  const title = `## 🔍 Critique of: ${subject}`;
  const formattedAnalysis = formatCritiqueAnalysis(analysis);
  
  // Return formatted markdown result
  return createToolResult(
    'critique_result',
    `${title}\n\n${formattedAnalysis}`
  );
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
 * Handle tool errors safely, ensuring they are always properly formatted strings
 */
function safelyHandleError(error: unknown, subject: string): ToolResult {
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
  
  logger.error(LogCategory.NODE, '[Critique]', 'Execution error:', { error: errorMessage });
  
  // Return a properly formatted error result
  return CritiqueComponent({
    subject,
    analysis: `Error: ${errorMessage}`
  });
}

/**
 * Generate dynamic critique analysis for a subject using the LLM
 */
async function generateStructuredCritique(subject: string, options: ToolExecutionOptions): Promise<string> {
  try {
    // Access LLM from the context
    if (!options.llmContext?.llm) {
      logger.warn(LogCategory.NODE, '[Critique]', 'No LLM available for generating dynamic critique');
      return `Analyzing ${subject}...`;
    }

    logger.debug(LogCategory.NODE, '[Critique]', 'Generating dynamic structured critique with LLM');
    
    // Prepare LLM prompt
    const messages = [
      {
        role: 'system',
        content: `You are an expert critic with deep analytical abilities across multiple domains. Generate a detailed, structured critique for the subject provided.
        
Your goal is to provide a comprehensive, balanced analysis that identifies both strengths and areas for improvement. Choose a structure that makes the most sense for this specific subject - not all subjects require the same critique format.

Apply these critical analysis principles:
- Begin by demonstrating your understanding of the subject
- Identify notable strengths and positive aspects
- Pinpoint issues, weaknesses, or limitations
- Provide constructive, actionable suggestions for improvement
- Conclude with a balanced overall assessment

Select a critique approach that fits the specific subject type:
- For code: Focus on functionality, efficiency, readability, and best practices
- For writing: Analyze clarity, structure, argumentation, and stylistic elements
- For arguments: Evaluate logical consistency, evidence quality, and persuasiveness
- For designs: Consider usability, aesthetics, functionality, and target audience
- For concepts: Assess feasibility, originality, coherence, and potential impact

Use rich Markdown formatting:
- Create appropriate section headings that reflect your chosen structure
- Bold (~15% of text) for key insights and important elements
- Italics (~10% of text) for nuanced observations or contextual details
- Create tables when comparing multiple elements or versions
- Use blockquotes for highlighting exceptional points or concerns
- Include numbered lists for prioritized recommendations
- Use bullet points for related observations

IMPORTANT: Do not include a title or heading at the beginning of your response.
Do not repeat the subject as a title. The application will add an appropriate title for your critique.

Your critique should be thorough, balanced, and provide clear guidance for improvement.`
      },
      {
        role: 'user',
        content: `Generate a comprehensive structured critique for: "${subject}".
        
Make your analysis balanced, specific, and actionable with clear strengths and areas for improvement.
Remember, do not include a title - start directly with your analysis.`
      }
    ];

    // Generate critique with LLM
    const result = await options.llmContext.llm.generateText({ 
      messages
    });
    
    logger.debug(LogCategory.NODE, '[Critique]', 'Successfully generated dynamic critique with LLM', {
      contentLength: result.text.length
    });
    
    return result.text;
  } catch (error) {
    logger.error(LogCategory.NODE, '[Critique]', 'Error generating dynamic critique', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // If LLM generation fails, return a simple message
    return `Analyzing ${subject}...`;
  }
}

/**
 * Critique tool implementation
 */
export const critiqueTool: Tool = {
  name: 'critique',
  description: critiqueToolDescription,
  parameters: critiqueSchema,
  execute: async (params: CritiqueParams, options: ToolExecutionOptions): Promise<ToolResult> => {
    try {
      const { subject, analysis } = params;
      
      logger.debug(LogCategory.NODE, '[Critique]', `Processing critique for: "${subject}"`, { 
        toolCallId: options.toolCallId,
        hasAnalysis: !!analysis,
        analysisLength: analysis?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      // Add a minimal artificial delay to allow the loading animation to be visible
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Handle partial calls (when only subject is provided)
      if (!analysis || analysis.trim() === '') {
        logger.debug(LogCategory.NODE, '[Critique]', 'Partial call detected - generating dynamic structured critique', {
          subject,
          timestamp: new Date().toISOString()
        });
        
        // Generate dynamic structured critique for the subject using LLM
        const dynamicAnalysis = await generateStructuredCritique(subject, options);
        
        return CritiqueComponent({
          subject,
          analysis: dynamicAnalysis
        });
      }
      
      // Create the result with all parameters for complete calls
      const result = CritiqueComponent({
        subject,
        analysis
      });
      
      logger.debug(LogCategory.NODE, '[Critique]', 'Returning complete critique', {
        subject,
        analysisLength: analysis.length,
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (error) {
      // Use the safe error handler to ensure proper formatting
      return safelyHandleError(error, params?.subject || 'Unknown Subject');
    }
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  critique: critiqueTool
};
