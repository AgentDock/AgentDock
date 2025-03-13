/**
 * @fileoverview Deep Research tool implementation following Vercel AI SDK patterns.
 * Provides a multi-step research workflow using the search node.
 */

import { z } from 'zod';
import { Tool, ToolExecutionOptions } from '../types';
import { DeepResearchResult, DeepResearchReport } from './components';
import { logger, LogCategory } from 'agentdock-core';
import { searchTool } from '../search';
import { formatErrorMessage, createToolResult } from '@/lib/utils/markdown-utils';

/**
 * Schema for deep research tool parameters
 */
const deepResearchSchema = z.object({
  query: z.string().describe('The research question or topic to investigate'),
  depth: z.number().optional().default(1).describe('How many levels of follow-up searches to perform (1-3)'),
  breadth: z.number().optional().default(3).describe('How many search results to consider per level (1-5)')
});

/**
 * Type inference from schema
 */
type DeepResearchParams = z.infer<typeof deepResearchSchema>;

/**
 * Extract key phrases from a text for follow-up searches
 * @param text The text to analyze
 * @param count Number of phrases to extract
 * @returns Array of key phrases
 */
function extractKeyPhrases(text: string, count: number): string[] {
  // In a real implementation, this would use NLP or an LLM to extract key phrases
  // For now, we'll just split by sentences and take the first few
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  return sentences.slice(0, count).map(s => s.trim());
}

/**
 * Deep Research tool implementation
 */
export const deepResearchTool: Tool = {
  name: 'deep_research',
  description: 'Perform in-depth research on a topic with multiple search iterations and summarization',
  parameters: deepResearchSchema,
  async execute({ query, depth = 1, breadth = 3 }, options: ToolExecutionOptions) {
    logger.debug(LogCategory.NODE, '[DeepResearch]', `Executing deep research for query: ${query}`, { toolCallId: options.toolCallId });
    
    // Limit parameters to reasonable ranges
    depth = Math.min(Math.max(depth, 1), 3);
    breadth = Math.min(Math.max(breadth, 1), 5);
    
    try {
      // Validate input
      if (!query.trim()) {
        logger.warn(LogCategory.NODE, '[DeepResearch]', 'Empty research query provided');
        return createToolResult(
          'deep_research_error',
          formatErrorMessage('Error', 'Please provide a non-empty research query.')
        );
      }
      
      // Step 1: Perform initial search using the search tool
      const initialSearchResult = await searchTool.execute(
        { query, limit: breadth },
        { toolCallId: options.toolCallId }
      );
      
      // Extract text content from the search result
      let searchContent = '';
      if (typeof initialSearchResult === 'string') {
        searchContent = initialSearchResult;
      } else if (initialSearchResult && typeof initialSearchResult === 'object') {
        // Handle the case where the search tool returns an object with content property
        searchContent = initialSearchResult.content || JSON.stringify(initialSearchResult);
      }
      
      // Step 2: Extract sources from the search result
      const sources: Array<{ title: string; url: string }> = [];
      const sourceRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match;
      while ((match = sourceRegex.exec(searchContent)) !== null && sources.length < breadth) {
        sources.push({
          title: match[1],
          url: match[2]
        });
      }
      
      // Step 3: If depth > 1, perform follow-up searches
      let summary = searchContent;
      if (depth > 1) {
        // Extract key phrases for follow-up searches
        const followUpQueries = extractKeyPhrases(searchContent, breadth);
        
        // Perform follow-up searches
        for (let i = 0; i < Math.min(followUpQueries.length, breadth); i++) {
          const followUpQuery = `${query} ${followUpQueries[i]}`;
          logger.debug(LogCategory.NODE, '[DeepResearch]', `Follow-up search: ${followUpQuery}`);
          
          try {
            const followUpResult = await searchTool.execute(
              { query: followUpQuery, limit: 2 },
              { toolCallId: options.toolCallId }
            );
            
            // Extract text content from the follow-up search result
            let followUpContent = '';
            if (typeof followUpResult === 'string') {
              followUpContent = followUpResult;
            } else if (followUpResult && typeof followUpResult === 'object') {
              followUpContent = followUpResult.content || JSON.stringify(followUpResult);
            }
            
            // Add to the summary
            summary += `\n\n## Follow-up Research: ${followUpQueries[i]}\n${followUpContent}`;
            
            // Extract additional sources
            while ((match = sourceRegex.exec(followUpContent)) !== null && sources.length < breadth * 2) {
              sources.push({
                title: match[1],
                url: match[2]
              });
            }
          } catch (error) {
            logger.error(LogCategory.NODE, '[DeepResearch]', `Follow-up search error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
      
      // Step 4: Create the result
      const result: DeepResearchResult = {
        query,
        summary,
        sources,
        depth,
        breadth
      };
      
      // Use our DeepResearchReport component to format the output
      return DeepResearchReport(result);
    } catch (error) {
      logger.error(LogCategory.NODE, '[DeepResearch]', `Research error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Return a formatted error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createToolResult(
        'deep_research_error',
        formatErrorMessage(
          'Error',
          `Unable to complete research on "${query}": ${errorMessage}`,
          'Please try again with a different query or check if the search service is available.'
        )
      );
    }
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  'deep_research': deepResearchTool
}; 