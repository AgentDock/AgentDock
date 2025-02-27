/**
 * @fileoverview DeepResearchNode implementation for the AgentDock framework.
 * This node provides advanced research capabilities by combining search and LLM summarization.
 */

import { BaseNode, NodePort, NodeMetadata } from '../base-node';
import { 
  DeepResearchNodeConfig, 
  ResearchQuery, 
  ResearchResult, 
  ResearchOptions,
  IntermediateResearchData,
  SourceCitation
} from './types';
import { deepResearchNodeParametersSchema } from './schema';
import { createError, ErrorCode, ErrorCategory } from '../../errors';
import { logger, LogCategory } from '../../logging';
import { SerpNode } from '../serp/serp-node';
import { SerpResult, SearchOptions, FormattedSearchResponse } from '../serp/types';
import { NodeRegistry } from '../node-registry';
import { SecureStorage } from '../../storage';
import { LLMNode } from '../llm/llm-node';

/**
 * DeepResearchNode provides advanced research capabilities
 */
export class DeepResearchNode extends BaseNode<DeepResearchNodeConfig> {
  readonly type = 'core.tool.deep-research';
  private serpNode: SerpNode | null = null;
  private llmNode: BaseNode | null = null;
  private isInitialized = false;
  
  // Static parameters schema for tool registration
  static parameters = deepResearchNodeParametersSchema;
  
  /**
   * Initialize the node
   */
  async initialize(): Promise<void> {
    try {
      // Get global settings for API keys
      const storage = SecureStorage.getInstance('agentdock');
      const globalSettings = await storage.get<any>('global_settings');
      const serpApiKey = globalSettings?.apiKeys?.serpapi;

      // Create and initialize SERP node
      this.serpNode = NodeRegistry.create(
        'core.tool.serp',
        `${this.id}-serp`,
        {
          provider: this.config.serpProvider,
          config: {
            ...this.config.serpConfig,
            apiKey: serpApiKey || this.config.serpConfig.apiKey, // Use settings key with fallback to config
          },
        }
      ) as SerpNode;
      await this.serpNode.initialize();

      // Create and initialize LLM node
      this.llmNode = NodeRegistry.create(
        `core.llm.${this.config.llmProvider}`,
        `${this.id}-llm`,
        this.config.llmConfig
      );
      await this.llmNode.initialize();

      this.isInitialized = true;
      logger.debug(LogCategory.NODE, this.id, `Initialized DeepResearchNode with SERP provider: ${this.config.serpProvider} and LLM provider: ${this.config.llmProvider}`);
    } catch (error) {
      throw createError(
        'node',
        `Failed to initialize DeepResearchNode: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.NODE_INITIALIZATION,
        { cause: error }
      );
    }
  }
  
  /**
   * Execute a research query
   * @param input Research query or options object
   * @returns Promise resolving to research results
   */
  async execute(input: ResearchQuery): Promise<ResearchResult> {
    try {
      // Ensure the node is initialized
      if (!this.serpNode || !this.llmNode) {
        await this.initialize();
      }
      
      // Extract query and options from input
      const { query, options } = this.parseInput(input);
      
      // Log the research request
      logger.debug(LogCategory.NODE, this.id, `Executing research: ${query}`, { options });
      
      // Start timing the research
      const startTime = Date.now();
      
      // Execute the initial search
      const initialData: IntermediateResearchData = {
        searchResults: [],
        sources: [],
        depth: 0,
        timeTaken: 0
      };
      
      // Perform the research
      const researchData = await this.performResearch(query, options, initialData);
      
      // Calculate research time
      const researchTime = Date.now() - startTime;
      
      // Create the research result
      const result: ResearchResult = {
        query,
        summary: researchData.summarizedContent || 'No summary available',
        keyFindings: researchData.keyFindings || [],
        sources: researchData.sources,
        metadata: {
          totalSources: researchData.sources.length,
          depth: researchData.depth,
          researchTime,
          providers: {
            serp: this.config.serpProvider,
            llm: this.config.llmProvider
          }
        }
      };
      
      // Log the research results
      logger.debug(LogCategory.NODE, this.id, `Research completed: ${query}`, { 
        sourceCount: result.sources.length,
        depth: result.metadata.depth,
        researchTime
      });
      
      return result;
    } catch (error) {
      throw createError(
        'node',
        `Research failed: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.NODE_EXECUTION,
        { cause: error }
      );
    }
  }
  
  /**
   * Parse the input to extract query and options
   * @param input Research query or options object
   * @returns Object containing query and options
   */
  private parseInput(input: ResearchQuery): { query: string; options: ResearchOptions } {
    if (typeof input === 'string') {
      return { query: input, options: {} };
    }
    
    return { 
      query: input.query, 
      options: input.options || {} 
    };
  }
  
  /**
   * Perform the research
   * @param query Research query
   * @param options Research options
   * @param data Intermediate research data
   * @returns Promise resolving to updated research data
   */
  private async performResearch(
    query: string, 
    options: ResearchOptions, 
    data: IntermediateResearchData
  ): Promise<IntermediateResearchData> {
    // Check if we've reached the maximum depth
    const maxDepth = options.maxDepth || this.config.maxDepth || 1;
    if (data.depth >= maxDepth) {
      return data;
    }
    
    // Increment the depth
    data.depth += 1;
    
    // Execute the search
    const searchResults = await this.executeSearch(query, options);
    
    // Update the search results
    data.searchResults = searchResults;
    
    // Extract sources from search results
    const sources = this.extractSources(searchResults);
    
    // Update the sources
    data.sources = [...data.sources, ...sources];
    
    // Generate a summary if this is the final depth
    if (data.depth === maxDepth) {
      const { summary, keyFindings } = await this.generateSummary(query, searchResults, options);
      data.summarizedContent = summary;
      data.keyFindings = keyFindings;
    }
    
    // Update the time taken
    data.timeTaken = Date.now() - data.timeTaken;
    
    return data;
  }
  
  /**
   * Execute a search query
   * @param query Search query
   * @param options Research options
   * @returns Promise resolving to search results
   */
  private async executeSearch(query: string, options: ResearchOptions): Promise<SerpResult[]> {
    try {
      // Create search options
      const searchOptions: SearchOptions = {
        ...options.searchParams,
        limit: options.maxResults || this.config.maxResults || 10
      };
      
      // Execute the search
      const response = await this.executeWithRetry(() => 
        this.serpNode!.execute({ query, options: searchOptions })
      );
      
      return response.raw.results;
    } catch (error) {
      throw createError(
        'node',
        `Search failed: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.NODE_EXECUTION,
        { cause: error }
      );
    }
  }
  
  /**
   * Extract sources from search results
   * @param results Search results
   * @returns Array of source citations
   */
  private extractSources(results: SerpResult[]): SourceCitation[] {
    return results.map(result => ({
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      date: result.metadata?.lastUpdated
    }));
  }
  
  /**
   * Generate a summary from search results
   * @param query Research query
   * @param results Search results
   * @param options Research options
   * @returns Promise resolving to summary and key findings
   */
  private async generateSummary(
    query: string, 
    results: SerpResult[], 
    options: ResearchOptions
  ): Promise<{ summary: string; keyFindings: string[] }> {
    try {
      // Create the prompt
      const prompt = this.createSummaryPrompt(query, results);
      
      // Execute the LLM
      const response = await this.executeWithRetry(() => 
        this.llmNode!.execute({
          prompt,
          ...options.llmParams
        })
      );
      
      // Parse the response
      return this.parseSummaryResponse(response);
    } catch (error) {
      throw createError(
        'node',
        `Summary generation failed: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.NODE_EXECUTION,
        { cause: error }
      );
    }
  }
  
  /**
   * Create a prompt for summary generation
   * @param query Research query
   * @param results Search results
   * @returns Summary prompt
   */
  private createSummaryPrompt(query: string, results: SerpResult[]): string {
    const resultsText = results.map(result => 
      `Title: ${result.title}\nURL: ${result.url}\nSnippet: ${result.snippet || 'No snippet available'}\n`
    ).join('\n');
    
    return `
You are a research assistant. Your task is to analyze the following search results and provide a comprehensive summary and key findings related to the query: "${query}".

Search Results:
${resultsText}

Please provide:
1. A comprehensive summary of the information (2-3 paragraphs)
2. A list of 5-7 key findings or insights
3. Format your response as JSON with the following structure:
{
  "summary": "Your comprehensive summary here...",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3", ...]
}
`;
  }
  
  /**
   * Parse the summary response
   * @param response LLM response
   * @returns Object containing summary and key findings
   */
  private parseSummaryResponse(response: any): { summary: string; keyFindings: string[] } {
    try {
      // If the response is already an object with summary and keyFindings, return it
      if (
        typeof response === 'object' && 
        response !== null && 
        typeof response.summary === 'string' && 
        Array.isArray(response.keyFindings)
      ) {
        return {
          summary: response.summary,
          keyFindings: response.keyFindings
        };
      }
      
      // If the response is a string, try to parse it as JSON
      if (typeof response === 'string') {
        // Extract JSON from the response if it's wrapped in markdown code blocks
        const jsonMatch = response.match(/```(?:json)?\s*({[\s\S]*?})\s*```/) || 
                          response.match(/({[\s\S]*})/);
        
        if (jsonMatch && jsonMatch[1]) {
          const parsedResponse = JSON.parse(jsonMatch[1]);
          
          if (
            typeof parsedResponse === 'object' && 
            parsedResponse !== null && 
            typeof parsedResponse.summary === 'string' && 
            Array.isArray(parsedResponse.keyFindings)
          ) {
            return {
              summary: parsedResponse.summary,
              keyFindings: parsedResponse.keyFindings
            };
          }
        }
      }
      
      // If we couldn't parse the response, return a default
      return {
        summary: typeof response === 'string' ? response : 'No summary available',
        keyFindings: []
      };
    } catch (error) {
      logger.warn(LogCategory.NODE, this.id, `Failed to parse summary response: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        summary: typeof response === 'string' ? response : 'No summary available',
        keyFindings: []
      };
    }
  }
  
  /**
   * Execute a function with retry logic
   * @param fn Function to execute
   * @returns Promise resolving to the function result
   */
  private async executeWithRetry<T>(fn: () => Promise<T>, attempt: number = 1): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (attempt < (this.config.maxRetries || 3)) {
        await new Promise(resolve => 
          setTimeout(resolve, (this.config.retryDelay || 1000) * attempt)
        );
        return this.executeWithRetry(fn, attempt + 1);
      }
      throw error;
    }
  }
  
  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      // Clean up the SerpNode
      if (this.serpNode) {
        await this.serpNode.cleanup();
      }
      
      // Clean up the LLM node
      if (this.llmNode) {
        await this.llmNode.cleanup();
      }
      
      // Reset the nodes
      this.serpNode = null;
      this.llmNode = null;
      
      logger.debug(LogCategory.NODE, this.id, 'DeepResearchNode resources cleaned up');
    } catch (error) {
      logger.error(LogCategory.NODE, this.id, `Error during cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get node metadata
   */
  protected getMetadata(): NodeMetadata {
    return {
      category: 'core',
      label: 'Deep Research',
      description: 'Advanced research capabilities combining search and LLM summarization',
      inputs: [
        {
          id: 'query',
          label: 'Query',
          type: 'string',
          required: true
        },
        {
          id: 'options',
          label: 'Options',
          type: 'object',
          required: false
        }
      ],
      outputs: [
        {
          id: 'result',
          label: 'Result',
          type: 'object'
        }
      ],
      version: '1.0.0',
      compatibility: {
        core: true,
        pro: true,
        custom: true
      }
    };
  }
  
  /**
   * Get node metadata (static method)
   */
  static getNodeMetadata(): NodeMetadata {
    return {
      category: 'core',
      label: 'Deep Research',
      description: 'Advanced research capabilities combining search and LLM summarization',
      inputs: [
        {
          id: 'query',
          label: 'Query',
          type: 'string',
          required: true
        },
        {
          id: 'options',
          label: 'Options',
          type: 'object',
          required: false
        }
      ],
      outputs: [
        {
          id: 'result',
          label: 'Result',
          type: 'object'
        }
      ],
      version: '1.0.0',
      compatibility: {
        core: true,
        pro: true,
        custom: true
      }
    };
  }
  
  /**
   * Get the node category
   * @returns Node category
   */
  protected getCategory(): 'core' | 'custom' {
    return 'core';
  }
  
  /**
   * Get the display name of the node
   * @returns Node label
   */
  protected getLabel(): string {
    return 'Deep Research';
  }
  
  /**
   * Get the node description
   * @returns Node description
   */
  protected getDescription(): string {
    return 'Provides advanced research capabilities by combining search and LLM summarization';
  }
  
  /**
   * Get the node version
   * @returns Node version
   */
  protected getVersion(): string {
    return '1.0.0';
  }
  
  /**
   * Get compatibility information
   * @returns Node compatibility
   */
  protected getCompatibility(): { core: boolean; pro: boolean; custom: boolean } {
    return { core: true, pro: true, custom: true };
  }
  
  /**
   * Define the node's input ports
   * @returns Node input ports
   */
  protected getInputs(): readonly NodePort[] {
    return [
      {
        id: 'query',
        type: 'string',
        label: 'Research Query',
        required: true
      },
      {
        id: 'options',
        type: 'object',
        label: 'Research Options',
        required: false
      }
    ];
  }
  
  /**
   * Define the node's output ports
   * @returns Node output ports
   */
  protected getOutputs(): readonly NodePort[] {
    return [
      {
        id: 'result',
        type: 'object',
        label: 'Research Result'
      }
    ];
  }
} 