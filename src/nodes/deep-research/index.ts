/**
 * @fileoverview Deep Research tool implementation following Vercel AI SDK patterns.
 * Provides in-depth research capabilities with search and content extraction.
 */

import { z } from 'zod';
import { Tool } from '../types';
import { DeepResearchReport, DeepResearchResult } from './components';
import { logger, LogCategory } from 'agentdock-core';
import { formatErrorMessage, createToolResult } from '@/lib/utils/markdown-utils';
// Import Firecrawl tools
import { firecrawlScrapeTool, firecrawlSearchTool } from '../firecrawl';
// Import tool LLM utilities
import { ToolExecutionOptions } from '../../../agentdock-core/src/types/tools';
import { CoreMessage } from 'ai';

/**
 * Schema for deep research tool parameters
 */
const deepResearchParamsSchema = z.object({
  query: z.string().describe('The research query to investigate'),
  depth: z.number().int().min(1).max(3).default(1).describe('Depth of research (1-3)'),
  breadth: z.number().int().min(3).max(15).default(5).describe('Number of sources to search (3-15)'),
});

// Define the parameter type for TypeScript
type _DeepResearchParams = z.infer<typeof deepResearchParamsSchema>;

/**
 * Deep Research tool implementation
 */
export const deepResearchTool: Tool = {
  name: 'deep_research',
  description: 'Perform in-depth research on a topic with search and content extraction',
  parameters: deepResearchParamsSchema,
  async execute({ query, depth = 2, breadth = 5 }, options) {
    logger.debug(LogCategory.NODE, '[DeepResearch]', `Executing research for query: ${query}`, { toolCallId: options.toolCallId });
    
    try {
      // Ensure parameters are within reasonable ranges
      depth = Math.max(1, Math.min(3, depth));
      breadth = Math.max(3, Math.min(15, breadth));
      
      // Validate input
      if (!query.trim()) {
        logger.warn(LogCategory.NODE, '[DeepResearch]', 'Empty research query provided');
        return createToolResult(
          'deep_research_error',
          formatErrorMessage('Error', 'Please provide a non-empty research query.')
        );
      }
      
      logger.info(LogCategory.NODE, '[DeepResearch]', `Starting research on "${query}" with depth=${depth}, breadth=${breadth}`);
      
      // Step 1: Initial search - use breadth parameter to determine number of results
      let searchResult = '';
      let searchError = false;
      
      try {
        // Use breadth parameter to determine number of search results (now supports up to 25)
        searchResult = await performSearch(query, breadth);
      } catch (error) {
        logger.warn(LogCategory.NODE, '[DeepResearch]', 'Error during initial search', { error });
        searchError = true;
        searchResult = `Error during search: ${error instanceof Error ? error.message : String(error)}`;
      }
      
      // Step 2: Extract sources from search results using regex
      const sources: Array<{ title: string, url: string }> = [];
      const urlRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match;
      
      while ((match = urlRegex.exec(searchResult)) !== null) {
        // Avoid duplicate sources
        const url = match[2];
        if (!sources.some(source => source.url === url)) {
          sources.push({
            title: match[1],
            url: url
          });
        }
      }
      
      logger.debug(LogCategory.NODE, '[DeepResearch]', `Found ${sources.length} initial sources`);
      
      // Step 3: Perform deeper content extraction if depth > 1
      let deepContent = '';
      let deepContentError = false;
      
      if (depth > 1 && sources.length > 0) {
        logger.info(LogCategory.NODE, '[DeepResearch]', `Performing deeper content extraction (depth=${depth})`);
        
        try {
          // Use Firecrawl for deeper content retrieval - use all available sources up to breadth
          const deeperSources = await getDeepContent(sources, Math.min(breadth, sources.length));
          
          // Add deeper sources to our sources list
          sources.push(...deeperSources.sources);
          
          // Add the deeper content to our research
          deepContent = deeperSources.content;
        } catch (error) {
          logger.warn(LogCategory.NODE, '[DeepResearch]', 'Error during deeper content extraction', { error });
          deepContentError = true;
          deepContent = `Error during content extraction: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
      
      // If both search and deep content failed, return an error
      if (searchError && deepContentError && sources.length === 0) {
        return createToolResult(
          'deep_research_error',
          formatErrorMessage('Research Error', 
            `Unable to complete research for "${query}": Both search and content extraction failed.`,
            'Please try again with a different query or check the tool configuration.')
        );
      }
      
      // Step 4: Extract key findings from the content
      const findings = extractKeyFindings(searchResult + deepContent);
      
      // Step 5: Format the research data - pass options to access LLM
      const summary = await formatResearchData(query, findings, searchResult, deepContent, depth, breadth, options, sources.length);
      
      // Step 6: Create the result object
      const result: DeepResearchResult = {
        query,
        summary,
        sources,
        depth,
        breadth,
        findings // Add findings to the result
      };
      
      logger.info(LogCategory.NODE, '[DeepResearch]', `Completed research on "${query}" with ${sources.length} sources`);
      
      // Return the formatted research report
      return DeepResearchReport(result);
    } catch (error: unknown) {
      logger.error(LogCategory.NODE, '[DeepResearch]', 'Research execution error:', { error });
      
      // Return a formatted error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorContent = formatErrorMessage(
        'Research Error',
        `Unable to complete research for "${query}": ${errorMessage}`,
        'Please try again with a different query or check the tool configuration.'
      );
      
      return createToolResult('deep_research_error', errorContent);
    }
  }
};

/**
 * Helper function to perform a search
 */
async function performSearch(query: string, limit: number): Promise<string> {
  try {
    logger.debug(LogCategory.NODE, '[DeepResearch]', `Searching for: ${query} with limit ${limit}`);
    
    // Firecrawl supports up to 25 results per search, but we're limiting to 15 for better agent interaction
    const maxResultsPerSearch = 15;
    
    // Ensure limit is within reasonable bounds
    const actualLimit = Math.min(maxResultsPerSearch, Math.max(1, limit));
    
    logger.info(LogCategory.NODE, '[DeepResearch]', `Requesting ${actualLimit} results from Firecrawl search`);
    
    // Perform the search with the requested limit
    const searchResult = await firecrawlSearchTool.execute({ 
      query, 
      limit: actualLimit 
    }, { toolCallId: `search-${Date.now()}` });
    
    return typeof searchResult === 'string' ? searchResult : JSON.stringify(searchResult);
  } catch (error) {
    logger.warn(LogCategory.NODE, '[DeepResearch]', 'Error using Firecrawl search', { error });
    throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Helper function to get deeper content using Firecrawl
 */
async function getDeepContent(sources: Array<{ title: string, url: string }>, limit: number): Promise<{ 
  content: string, 
  sources: Array<{ title: string, url: string }> 
}> {
  const deeperSources: Array<{ title: string, url: string }> = [];
  let content = '';
  let errorCount = 0;
  
  // Limit the number of sources to scrape based on the limit parameter
  const sourcesToScrape = sources.slice(0, limit);
  
  // Log the number of sources we're going to scrape
  logger.debug(LogCategory.NODE, '[DeepResearch]', `Scraping ${sourcesToScrape.length} sources for deeper content`);
  
  // Process sources in batches to avoid overwhelming the system
  const batchSize = 5;
  const batches = Math.ceil(sourcesToScrape.length / batchSize);
  
  for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
    const batchStart = batchIndex * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, sourcesToScrape.length);
    const currentBatch = sourcesToScrape.slice(batchStart, batchEnd);
    
    logger.debug(LogCategory.NODE, '[DeepResearch]', `Processing batch ${batchIndex + 1}/${batches} with ${currentBatch.length} sources`);
    
    // Process each source in the current batch
    const batchPromises = currentBatch.map(async (source) => {
      try {
        logger.debug(LogCategory.NODE, '[DeepResearch]', `Scraping deeper content from: ${source.url}`);
        
        // Use Firecrawl scrape to get deeper content
        const scrapeResult = await firecrawlScrapeTool.execute({ 
          url: source.url, 
          formats: ['markdown'] 
        }, { toolCallId: `scrape-${Date.now()}` });
        
        // Convert result to string if it's not already
        const scrapeContent = typeof scrapeResult === 'string' ? scrapeResult : JSON.stringify(scrapeResult);
        
        // Extract the actual content from the Firecrawl response
        let extractedContent = '';
        
        // Check if the content contains the "Content Preview" section
        const contentPreviewIndex = scrapeContent.indexOf('Content Preview');
        if (contentPreviewIndex !== -1) {
          // Find the content after the "Content Preview" header
          extractedContent = scrapeContent.substring(contentPreviewIndex + 'Content Preview'.length);
          
          // Remove any leading formatting characters
          extractedContent = extractedContent.replace(/^\s*\n+\s*/, '');
          
          // If there's another section after, only take the content up to that point
          const nextSectionIndex = extractedContent.indexOf('##');
          if (nextSectionIndex !== -1) {
            extractedContent = extractedContent.substring(0, nextSectionIndex);
          }
        } else {
          // If we can't find the Content Preview section, use the whole content
          extractedContent = scrapeContent;
        }
        
        // Check if the content contains an error
        if (scrapeContent.includes('firecrawl_error') || scrapeContent.includes('API Error')) {
          logger.warn(LogCategory.NODE, '[DeepResearch]', `Error in scraped content from ${source.url}`);
          return { success: false, source };
        } else {
          // Return the extracted content and source
          return { 
            success: true, 
            source, 
            content: `\n\n## Content from ${source.title}\n${extractedContent.trim()}`,
            contentLength: extractedContent.length
          };
        }
      } catch (error) {
        logger.warn(LogCategory.NODE, '[DeepResearch]', `Error scraping content from ${source.url}`, { error });
        return { success: false, source };
      }
    });
    
    // Wait for all promises in the batch to resolve
    const batchResults = await Promise.all(batchPromises);
    
    // Process the results
    for (const result of batchResults) {
      if (result.success) {
        content += result.content;
        deeperSources.push({
          title: `${result.source.title}`,
          url: result.source.url
        });
        
        logger.debug(
          LogCategory.NODE, 
          '[DeepResearch]', 
          `Successfully scraped content from ${result.source.url}`, 
          { contentLength: result.contentLength }
        );
      } else {
        errorCount++;
      }
    }
  }
  
  // If all sources failed, throw an error
  if (errorCount === sourcesToScrape.length && sourcesToScrape.length > 0) {
    throw new Error(`Failed to scrape content from all ${sourcesToScrape.length} sources`);
  }
  
  logger.info(LogCategory.NODE, '[DeepResearch]', `Successfully scraped content from ${deeperSources.length} out of ${sourcesToScrape.length} sources`);
  
  return { content, sources: deeperSources };
}

/**
 * Extract key findings from content
 */
function extractKeyFindings(content: string): string[] {
  // Clean the content first - remove any error messages or formatting
  content = content
    .replace(/\{"type":"firecrawl_error"[^}]*\}/g, '')
    .replace(/## API Error[^\n]*\n[^\n]*/g, '')
    .replace(/## Content from[^\n]*\n/g, '\n\n')
    .replace(/## Metadata[^\n]*\n[^\n]*/g, '')
    .replace(/## Content Preview[^\n]*\n/g, '\n\n');
  
  // Split content into paragraphs
  const paragraphs = content
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 30 && p.length < 500);
  
  // Filter out error messages and headers
  const cleanedParagraphs = paragraphs.filter(p => 
    !p.includes('firecrawl_error') && 
    !p.includes('API Error') && 
    !p.includes('error:') &&
    !p.includes('Firecrawl') &&
    !p.match(/^Content from/) &&
    !p.match(/^Metadata$/) &&
    !p.match(/^Content Preview$/)
  );
  
  // If we have enough paragraphs, return them
  if (cleanedParagraphs.length >= 8) {
    return cleanedParagraphs.slice(0, 15);
  }
  
  // Otherwise, extract sentences
  const sentences = content
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => 
      s.length > 30 && 
      s.length < 300 && 
      !s.includes('firecrawl_error') && 
      !s.includes('API Error') && 
      !s.includes('error:')
    );
  
  // Combine paragraphs and sentences
  const findings = [...cleanedParagraphs, ...sentences];
  
  // Return up to 15 findings
  return findings.slice(0, 15);
}

/**
 * Format research data into a structured report
 */
async function formatResearchData(
  query: string, 
  findings: string[], 
  searchResult: string, 
  deepContent: string, 
  depth: number, 
  breadth: number,
  options: ToolExecutionOptions,
  sourceCount: number
): Promise<string> {
  // Step 1: Create a structured report from the raw research data
  const title = `# Deep Research Report: "${query}"\n\n`;
  
  // Step 2: Use LLM to generate findings if we have access
  if (options.llmContext?.llm) {
    try {
      logger.info(LogCategory.NODE, '[DeepResearch]', 'Using LLM to generate findings');
      
      // Prepare content for LLM
      let cleanContent = searchResult + '\n\n' + deepContent;
      cleanContent = cleanContent
        .replace(/\{"type":"firecrawl_error"[^}]*\}/g, '')
        .replace(/## API Error[^\n]*\n[^\n]*/g, '')
        .replace(/## Content from[^\n]*\n/g, '\n\n')
        .replace(/## Metadata[^\n]*\n[^\n]*/g, '')
        .replace(/## Content Preview[^\n]*\n/g, '\n\n');
      
      const messages: CoreMessage[] = [
        {
          role: 'system',
          content: 'You are a research assistant that extracts key findings from content. Extract factual, informative points from the provided research content.'
        },
        {
          role: 'user',
          content: `Extract 8-10 key findings from this research content about "${query}". 
          Each finding should be a single sentence or short paragraph that contains factual information.
          Focus on dates, names, events, and statistics when available.
          
          RESEARCH CONTENT:
          ${cleanContent.substring(0, 10000)}`
        }
      ];
      
      // Add a context flag to indicate this is a tool-internal LLM call
      const result = await options.llmContext.llm.generateText({ 
        messages
      });
      
      // Parse the result to extract findings
      const llmFindings = result.text
        .split('\n')
        .filter(line => line.trim().length > 0)
        .filter(line => 
          line.trim().startsWith('-') || 
          line.trim().match(/^\d+\./) || 
          line.trim().startsWith('•')
        )
        .map(line => line.replace(/^[-•\d.]+\s*/, '').trim())
        .filter(line => line.length > 0);
      
      // If we got findings from the LLM, use those
      if (llmFindings.length > 0) {
        logger.debug(LogCategory.NODE, '[DeepResearch]', `Generated ${llmFindings.length} findings with LLM`);
        findings = llmFindings;
      }
    } catch (error) {
      logger.warn(LogCategory.NODE, '[DeepResearch]', 'Error generating findings with LLM', { error });
      // Continue with existing findings
    }
  }
  
  // Step 3: Add a clear "research incomplete" message if we don't have enough sources or findings
  let researchStatus = "";
  if (sourceCount < 12 || findings.length < 8) {
    researchStatus = `**Note: This research is incomplete.** Additional research is recommended to develop a more comprehensive understanding.\n\n`;
  }
  
  // Step 4: Format key findings section - always include this
  const keyFindings = `## Key Findings\n\n${findings.slice(0, 8).map(finding => `- ${finding}`).join('\n')}\n\n`;
  
  // Step 5: Format detailed findings section - only include if there are more than 8 findings
  let detailedFindings = "";
  if (findings.length > 8) {
    detailedFindings = `## Detailed Findings\n\n${findings.map(finding => `- ${finding}`).join('\n')}\n\n`;
  }
  
  // Step 6: Format research methodology section - simplified
  const methodology = `## Research Methodology\n\n- Conducted research with depth=${depth} and breadth=${breadth}
- Analyzed ${findings.length} key findings across ${sourceCount} sources
- Used Firecrawl for search and content extraction
- Analyzed approximately ${Math.round((searchResult.length + deepContent.length) / 1000)}KB of content\n\n`;
  
  // Step 7: Combine all sections without any follow-up questions
  return `${title}${researchStatus}${keyFindings}${detailedFindings}${methodology}`;
}

/**
 * Export tools for registry
 */
export const tools = {
  'deep_research': deepResearchTool
}; 