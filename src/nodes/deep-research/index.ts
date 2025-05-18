/**
 * @fileoverview Deep Research tool implementation following Vercel AI SDK patterns.
 * Provides in-depth research capabilities with search and content extraction.
 */

import { z } from 'zod';
import { Tool } from '../types';
import { DeepResearchReport, DeepResearchResult } from './components';
import { logger, LogCategory, CoreMessage } from 'agentdock-core';
import { formatErrorMessage, createToolResult } from '@/lib/utils/markdown-utils';
// Import Firecrawl tools
import { firecrawlScrapeTool, firecrawlSearchTool } from '../firecrawl';
// Import tool LLM utilities
import { ToolExecutionOptions } from '../../../agentdock-core/src/types/tools';

/**
 * Schema for deep research tool parameters
 */
const deepResearchParamsSchema = z.object({
  query: z.string().describe('The research query to investigate'),
  depth: z.number().int().min(1).max(3).default(1).describe('Depth of research (1-3)'),
  breadth: z
    .number()
    .int()
    .min(3)
    .max(15)
    .default(5)
    .describe('Number of sources to search (3-15)'),
});

// Define the parameter type for TypeScript
type _DeepResearchParams = z.infer<typeof deepResearchParamsSchema>;

/**
 * Helper function to safely handle errors
 */
function safelyHandleError(error: unknown, context: string): void {
  logger.error(LogCategory.NODE, '[DeepResearch]', `Error in ${context}:`, { error });
  throw new Error(`Error in ${context}: ${error instanceof Error ? error.message : String(error)}`);
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
    .map((p) => p.trim())
    .filter((p) => p.length > 30 && p.length < 500);

  // Filter out error messages and headers
  const cleanedParagraphs = paragraphs.filter(
    (p) =>
      !p.includes('firecrawl_error') &&
      !p.includes('API Error') &&
      !p.includes('error:') &&
      !p.includes('Firecrawl') &&
      !p.match(/^Content from/) &&
      !p.match(/^Metadata$/) &&
      !p.match(/^Content Preview$/),
  );

  // If we have enough paragraphs, return them
  if (cleanedParagraphs.length >= 8) {
    return cleanedParagraphs.slice(0, 15);
  }

  // Otherwise, extract sentences
  const sentences = content
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 30 &&
        s.length < 300 &&
        !s.includes('firecrawl_error') &&
        !s.includes('API Error') &&
        !s.includes('error:'),
    );

  // Combine paragraphs and sentences
  const findings = [...cleanedParagraphs, ...sentences];

  // Return up to 15 findings
  return findings.slice(0, 15);
}

/**
 * Helper function to perform a search
 */
async function performSearch(
  query: string,
  limit: number,
  options: ToolExecutionOptions,
): Promise<string> {
  try {
    logger.debug(LogCategory.NODE, '[DeepResearch]', `Searching for: ${query} with limit ${limit}`);

    // Firecrawl supports up to 25 results per search, but we're limiting to 15 for better agent interaction
    const maxResultsPerSearch = 15;

    // Ensure limit is within reasonable bounds
    const actualLimit = Math.min(maxResultsPerSearch, Math.max(1, limit));

    logger.info(
      LogCategory.NODE,
      '[DeepResearch]',
      `Requesting ${actualLimit} results from Firecrawl search`,
    );

    // Perform the search with the requested limit
    const searchResult = await firecrawlSearchTool.execute(
      {
        query,
        limit: actualLimit,
      },
      {
        toolCallId: `search-${Date.now()}`,
        sessionId: options.sessionId,
      },
    );

    return typeof searchResult === 'string' ? searchResult : JSON.stringify(searchResult);
  } catch (error) {
    logger.warn(LogCategory.NODE, '[DeepResearch]', 'Error using Firecrawl search', { error });
    throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Helper function to get deeper content using Firecrawl
 */
async function getDeepContent(
  sources: Array<{ title: string; url: string }>,
  limit: number,
  options: ToolExecutionOptions,
): Promise<{
  content: string;
  sources: Array<{ title: string; url: string }>;
}> {
  const deeperSources: Array<{ title: string; url: string }> = [];
  let content = '';
  let errorCount = 0;

  // Limit the number of sources to scrape based on the limit parameter
  const sourcesToScrape = sources.slice(0, limit);

  // Log the number of sources we're going to scrape
  logger.debug(
    LogCategory.NODE,
    '[DeepResearch]',
    `Scraping ${sourcesToScrape.length} sources for deeper content`,
  );

  // Process sources in batches to avoid overwhelming the system
  const batchSize = 5;
  const batches = Math.ceil(sourcesToScrape.length / batchSize);

  for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
    const batchStart = batchIndex * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, sourcesToScrape.length);
    const currentBatch = sourcesToScrape.slice(batchStart, batchEnd);

    logger.debug(
      LogCategory.NODE,
      '[DeepResearch]',
      `Processing batch ${batchIndex + 1}/${batches} with ${currentBatch.length} sources`,
    );

    // Process each source in the current batch
    const batchPromises = currentBatch.map(async (source) => {
      try {
        logger.debug(
          LogCategory.NODE,
          '[DeepResearch]',
          `Scraping deeper content from: ${source.url}`,
        );

        // Use Firecrawl scrape to get deeper content
        const scrapeResult = await firecrawlScrapeTool.execute(
          {
            url: source.url,
            formats: ['markdown'],
          },
          {
            toolCallId: `scrape-${Date.now()}`,
            sessionId: options.sessionId,
          },
        );

        // Convert result to string if it's not already
        const scrapeContent =
          typeof scrapeResult === 'string' ? scrapeResult : JSON.stringify(scrapeResult);

        // Extract the actual content from the Firecrawl response
        let extractedContent = '';

        // Check if the content contains the "Content Preview" section
        const contentPreviewIndex = scrapeContent.indexOf('Content Preview');
        if (contentPreviewIndex !== -1) {
          // Find the content after the "Content Preview" header
          extractedContent = scrapeContent.substring(
            contentPreviewIndex + 'Content Preview'.length,
          );

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
          logger.warn(
            LogCategory.NODE,
            '[DeepResearch]',
            `Error in scraped content from ${source.url}`,
          );
          return { success: false, source };
        } else {
          // Return the extracted content and source
          return {
            success: true,
            source,
            content: `\n\n## Content from ${source.title}\n${extractedContent.trim()}`,
            contentLength: extractedContent.length,
          };
        }
      } catch (error) {
        logger.warn(
          LogCategory.NODE,
          '[DeepResearch]',
          `Error scraping content from ${source.url}`,
          { error },
        );
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
          url: result.source.url,
        });

        logger.debug(
          LogCategory.NODE,
          '[DeepResearch]',
          `Successfully scraped content from ${result.source.url}`,
          { contentLength: result.contentLength },
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

  logger.info(
    LogCategory.NODE,
    '[DeepResearch]',
    `Successfully scraped content from ${deeperSources.length} out of ${sourcesToScrape.length} sources`,
  );

  return { content, sources: deeperSources };
}

/**
 * Processes research content to generate findings using LLM.
 * Adds more explicit checks and logging for missing LLM context.
 * Returns the findings array and a status message.
 */
async function generateLLMAnalysis(
  query: string,
  initialFindings: string[],
  searchResult: string,
  deepContent: string,
  options: ToolExecutionOptions,
  scrapingRateLimited: boolean,
  scrapingFailed: boolean,
): Promise<{ findings: string[]; status: string }> {
  let finalFindings: string[] = [];
  let analysisFailed = false;
  let llmSkipped = false;
  let status = '';

  // --- Determine initial status based on scraping ---
  if (scrapingRateLimited) {
    status = `**Note: Deep content analysis may be incomplete due to Firecrawl rate limits.** Findings based on available data.\n`;
  } else if (scrapingFailed) {
    status = `**Note: Deep content analysis failed due to errors fetching sources.**\n`;
    analysisFailed = true; // Mark analysis as failed if scraping failed
  }

  // --- Attempt LLM Summarization ---
  // Explicitly check for llmContext and the llm instance itself
  if (!options.llmContext?.llm) {
    logger.error(
      LogCategory.NODE,
      '[DeepResearch]',
      'LLM analysis step skipped: llmContext or llm instance not provided in ToolExecutionOptions.',
    );
    status += `**Note: LLM analysis step skipped (LLM context unavailable).** Findings based on basic extraction.\n`;
    analysisFailed = true; // Mark as failed if LLM context is missing
    llmSkipped = true;
  } else if (analysisFailed) {
    // If scraping already failed, don't attempt LLM call
    logger.warn(
      LogCategory.NODE,
      '[DeepResearch]',
      'Skipping LLM analysis because content scraping failed.',
    );
    llmSkipped = true;
  } else {
    // LLM context exists and scraping didn't fail, proceed with try/catch
    try {
      logger.info(
        LogCategory.NODE,
        '[DeepResearch]',
        'Using LLM via generateText to generate final findings',
      );

      let cleanContent = searchResult + '\n\n' + deepContent;
      // Basic cleaning + link stripping
      cleanContent = cleanContent
        .replace(/\{"type":"firecrawl_error"[^}]*\}/g, '')
        .replace(/## API Error[^\n]*\n[^\n]*/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

      const userPrompt = `Analyze the following RESEARCH CONTENT regarding "${query}". 
          
Extract 10-15 key factual findings about this topic. Focus on the most significant information including:
- Important facts, statistics, and data points
- Key concepts, theories, or methodologies 
- Significant developments, trends, or innovations
- Expert opinions or consensus views
- Challenges, limitations, or controversies

IMPORTANT INSTRUCTIONS:
- Present each finding as a complete, standalone sentence with specific information
- Start each finding directly with the actual information (no titles or labels)
- DO NOT include headings like "Key Findings" or "Factual Findings" in your response
- DO NOT number your findings - I will add the numbers later
- DO NOT include introductory text like "Here are the findings" or "Based on the research"
- Each finding should be on its own line

RESEARCH CONTENT:
${cleanContent.substring(0, 18000)}`;

      const messages: CoreMessage[] = [
        {
          role: 'system',
          content:
            'You are an expert research analyst who extracts and presents key factual findings from provided content. Your job is to find the most important, specific information and present each finding as a clear, direct statement. Avoid introductions, conclusions, categorization, or headings. Just provide the actual findings as standalone statements.',
        },
        { role: 'user', content: userPrompt },
      ];

      const result = await options.llmContext.llm.generateText({ messages });

      // Even more aggressive cleaning of LLM output:
      const llmFindings = result.text
        // Remove any known header patterns
        .replace(/^(key findings|findings|research findings|summary|analysis):?\s*/i, '')
        .replace(/^(here are|the following are|based on the research)\s+.*?:\s*/i, '')
        // Split by lines
        .split('\n')
        // Clean each line
        .map((l) =>
          l
            .replace(/^[-•*#]+\s*/, '') // Remove bullet markers
            .replace(/^\d+[.):]-?\s*/, '') // Remove numbering
            .trim(),
        )
        // Filter invalid lines
        .filter(
          (l) =>
            l.length > 15 &&
            !l.toLowerCase().match(/^key\s+(factual\s+)?findings/) &&
            !l.toLowerCase().includes('following are') &&
            !l.toLowerCase().includes('research content') &&
            !l.toLowerCase().match(/^here are/i),
        );

      if (llmFindings.length > 0) {
        finalFindings = llmFindings;
        analysisFailed = false; // Explicitly mark success
        logger.info(
          LogCategory.NODE,
          '[DeepResearch]',
          `Successfully generated ${llmFindings.length} findings via LLM`,
        );
      } else {
        logger.warn(
          LogCategory.NODE,
          '[DeepResearch]',
          'LLM generateText returned empty/unusable findings',
          { rawText: result.text },
        );
        analysisFailed = true;
        status += '**Note: LLM analysis could not extract key findings.**\n';
      }
    } catch (error) {
      logger.error(
        LogCategory.NODE,
        '[DeepResearch]',
        'Error during LLM generateText call for findings',
        { error },
      );
      analysisFailed = true;
      status += `**Note: LLM analysis failed with error:** ${error instanceof Error ? error.message : 'Unknown error'}\n`;
    }
  }

  // --- Fallback Logic ---
  // Use initialFindings ONLY if LLM was skipped OR failed AND initialFindings exist
  if ((llmSkipped || analysisFailed) && finalFindings.length === 0 && initialFindings.length > 0) {
    logger.warn(
      LogCategory.NODE,
      '[DeepResearch]',
      'Using basic extracted findings as fallback because LLM step failed or was skipped.',
    );
    // Apply basic link stripping to fallback findings
    finalFindings = initialFindings
      .map((f) => f.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'))
      .filter((f) => f.trim().length > 0);

    // Add specific fallback note if not already covered by other status messages
    if (
      !status.includes('Findings based on basic extraction') &&
      !status.includes('LLM analysis failed')
    ) {
      status += '**Note: Findings based on basic extraction.**\n';
    }
  } else if ((llmSkipped || analysisFailed) && finalFindings.length === 0) {
    // If still no findings after attempting LLM/fallback
    if (!status.includes('Analysis could not be completed')) {
      status +=
        '**Note: Analysis could not be completed due to errors or lack of usable content.**\n';
    }
    analysisFailed = true; // Ensure failure state is set
  }

  return { findings: finalFindings, status: status.trim() }; // Trim final status
}

/**
 * Deep Research tool implementation
 * - Refactored to use component for final formatting
 */
export const deepResearchTool: Tool = {
  name: 'deep_research',
  description: 'Perform in-depth research on a topic with search and content extraction',
  parameters: deepResearchParamsSchema,
  async execute({ query, depth = 2, breadth = 5 }, options) {
    logger.debug(LogCategory.NODE, '[DeepResearch]', `Executing research for query: ${query}`, {
      toolCallId: options.toolCallId,
    });

    let searchResult = '';
    let deepContent = '';
    let sources: Array<{ title: string; url: string }> = [];
    let scrapingWasRateLimited = false;
    let scrapingFailedCompletely = false;

    try {
      depth = Math.max(1, Math.min(3, depth));
      breadth = Math.max(3, Math.min(15, breadth));

      if (!query.trim()) {
        safelyHandleError('Empty research query provided', 'input validation');
      }

      logger.info(
        LogCategory.NODE,
        '[DeepResearch]',
        `Starting research: "${query}" (Depth: ${depth}, Breadth: ${breadth})`,
      );

      // Step 1: Initial Search
      try {
        searchResult = await performSearch(query, breadth, options);
      } catch (error) {
        safelyHandleError(
          error instanceof Error ? error : new Error(String(error)),
          'initial search',
        );
      }

      // Step 2: Extract Sources from Search
      const urlRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match;
      while ((match = urlRegex.exec(searchResult)) !== null) {
        const url = match[2];
        if (!sources.some((source) => source.url === url)) {
          sources.push({ title: match[1], url: url });
        }
      }
      const initialSources = [...sources]; // Keep a copy before adding scraped ones
      logger.debug(
        LogCategory.NODE,
        '[DeepResearch]',
        `Found ${initialSources.length} initial sources from search`,
      );

      // Step 3: Scrape Content (if depth > 1)
      if (depth > 1 && initialSources.length > 0) {
        logger.info(
          LogCategory.NODE,
          '[DeepResearch]',
          `Performing content extraction (Depth: ${depth})`,
        );
        try {
          const deeperSourcesResult = await getDeepContent(
            initialSources,
            Math.min(breadth, initialSources.length),
            options,
          );
          sources.push(...deeperSourcesResult.sources); // Add successfully scraped sources
          deepContent = deeperSourcesResult.content;
        } catch (error: any) {
          logger.warn(
            LogCategory.NODE,
            '[DeepResearch]',
            `Content extraction issue: ${error.message}`,
          );
          if (error.message?.includes('rate limit')) {
            scrapingWasRateLimited = true;
          } else if (error.message?.includes('Failed to scrape')) {
            scrapingFailedCompletely = true;
          }
          // Store error message in deepContent only if scraping failed/rate limited
          if (scrapingWasRateLimited || scrapingFailedCompletely) {
            deepContent = `Error during content extraction: ${error.message}`;
          }
        }
      }

      // Step 4: Basic Findings Extraction (for fallback)
      const initialFindings = extractKeyFindings(searchResult + deepContent);

      // Step 5: Generate LLM Analysis
      const { findings: llmAnalyzedFindings, status: analysisStatus } = await generateLLMAnalysis(
        query,
        initialFindings,
        searchResult,
        deepContent,
        options,
        scrapingWasRateLimited,
        scrapingFailedCompletely,
      );

      // Step 6: Prepare result for the component
      const resultForComponent: DeepResearchResult = {
        query,
        sources,
        depth,
        breadth,
        findings: llmAnalyzedFindings, // Use the result from generateLLMAnalysis
        status: analysisStatus, // Pass the status note from generateLLMAnalysis
      };

      logger.info(LogCategory.NODE, '[DeepResearch]', `Completed research on "${query}"`);

      // Step 7: Return the report using the component for final formatting
      return DeepResearchReport(resultForComponent);
    } catch (error: unknown) {
      safelyHandleError(error, 'main execution');
    }
  },
};

/**
 * Export tools for registry
 */
export const tools = {
  deep_research: deepResearchTool,
};
