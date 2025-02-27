/**
 * @fileoverview SerpNode implementation for the AgentDock framework.
 * This node provides search engine results page functionality.
 */

import { BaseNode, NodePort } from '../base-node';
import { 
  SerpNodeConfig, 
  SerpResult, 
  SearchOptions, 
  SearchResponse,
  FormattedSearchResponse
} from './types';
import { createAdapter } from './adapters';
import { createError, ErrorCode } from '../../errors';
import { logger, LogCategory } from '../../logging';
import { serpNodeParametersSchema } from './schema';

/**
 * SerpNode provides search engine results page functionality
 */
export class SerpNode extends BaseNode<SerpNodeConfig> {
  readonly type = 'core.tool.serp';
  private adapter: ReturnType<typeof createAdapter> | null = null;
  
  // Static parameters schema for tool registration
  static parameters = serpNodeParametersSchema;
  
  /**
   * Initialize the node
   */
  async initialize(): Promise<void> {
    try {
      // Create the adapter based on the provider
      this.adapter = createAdapter(this.config.provider, this.config.config);
      
      // Validate the adapter configuration
      if (!this.adapter.validateConfig()) {
        throw createError(
          'node',
          `Invalid configuration for SERP provider: ${this.config.provider}`,
          ErrorCode.NODE_VALIDATION
        );
      }
      
      logger.debug(LogCategory.NODE, this.id, `Initialized SerpNode with provider: ${this.config.provider}`);
    } catch (error) {
      throw createError(
        'node',
        `Failed to initialize SerpNode: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.NODE_INITIALIZATION,
        { cause: error }
      );
    }
  }
  
  /**
   * Execute a search query
   * @param input Search query or options object
   * @returns Promise resolving to formatted search results
   */
  async execute(input: string | { query: string; options?: SearchOptions }): Promise<FormattedSearchResponse> {
    try {
      // Ensure the adapter is initialized
      if (!this.adapter) {
        await this.initialize();
      }
      
      // Extract query and options from input
      const { query, options } = this.parseInput(input);
      
      // Log the search request
      logger.debug(LogCategory.NODE, this.id, `Executing search: ${query}`, { options });
      
      // Start timing the search
      const startTime = Date.now();
      
      // Execute the search
      const results = await this.adapter!.search(query, options);
      
      // Calculate search time
      const searchTime = Date.now() - startTime;
      
      // Create the search response
      const response: SearchResponse = {
        results,
        metadata: {
          provider: this.adapter!.getProvider(),
          query,
          totalResults: results.length,
          searchTime
        }
      };
      
      // Format the response
      const formattedResponse = this.formatResponse(response);
      
      // Log the search results
      logger.debug(LogCategory.NODE, this.id, `Search completed: ${query}`, { 
        resultCount: results.length,
        searchTime
      });
      
      return formattedResponse;
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
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.adapter = null;
    return Promise.resolve();
  }
  
  /**
   * Get the node category
   */
  protected getCategory(): 'core' | 'custom' {
    return 'core';
  }
  
  /**
   * Get the node label
   */
  protected getLabel(): string {
    return 'Search Engine Results';
  }
  
  /**
   * Get the node description
   */
  protected getDescription(): string {
    return 'Provides search engine results page functionality';
  }
  
  /**
   * Get the node version
   */
  protected getVersion(): string {
    return '1.0.0';
  }
  
  /**
   * Get compatibility information
   */
  protected getCompatibility() {
    return {
      core: true,
      pro: true,
      custom: true
    };
  }
  
  /**
   * Get input ports
   */
  protected getInputs(): readonly NodePort[] {
    return [
      {
        id: 'query',
        type: 'string',
        label: 'Query',
        required: true
      }
    ];
  }
  
  /**
   * Get output ports
   */
  protected getOutputs(): readonly NodePort[] {
    return [
      {
        id: 'results',
        type: 'object',
        label: 'Results'
      }
    ];
  }
  
  /**
   * Parse the input to extract query and options
   * @param input Search query or options object
   * @returns Object containing query and options
   */
  private parseInput(input: string | { query: string; options?: SearchOptions }): {
    query: string;
    options?: SearchOptions;
  } {
    if (typeof input === 'string') {
      return { query: input };
    }
    
    if (!input.query || typeof input.query !== 'string') {
      throw createError(
        'node',
        'Search query is required and must be a string',
        ErrorCode.NODE_VALIDATION
      );
    }
    
    return {
      query: input.query,
      options: input.options
    };
  }
  
  /**
   * Format the search response
   * @param response Search response
   * @returns Formatted search response
   */
  private formatResponse(response: SearchResponse): FormattedSearchResponse {
    // Generate markdown representation of the results
    const markdown = this.generateMarkdown(response);
    
    return {
      markdown,
      raw: response
    };
  }
  
  /**
   * Generate markdown representation of search results
   * @param response Search response
   * @returns Markdown string
   */
  private generateMarkdown(response: SearchResponse): string {
    const { results, metadata } = response;
    
    if (results.length === 0) {
      return `No results found for query: "${metadata.query}"`;
    }
    
    // Generate header
    let markdown = `## Search Results for "${metadata.query}"\n\n`;
    
    // Add metadata
    markdown += `*Found ${results.length} results from ${metadata.provider} in ${metadata.searchTime}ms*\n\n`;
    
    // Add results
    results.forEach((result, index) => {
      markdown += `### ${index + 1}. [${result.title}](${result.url})\n\n`;
      markdown += `${result.snippet}\n\n`;
      markdown += `*Source: ${result.metadata?.domain || new URL(result.url).hostname}*\n\n`;
      
      // Add separator except for the last result
      if (index < results.length - 1) {
        markdown += `---\n\n`;
      }
    });
    
    return markdown;
  }
} 