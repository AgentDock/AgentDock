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

import { LogLevel } from '../../logging';

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
    logger.debug(LogCategory.NODE, this.id, "Initializing SerpNode...", {});
    logger.debug(LogCategory.NODE, this.id, "Configuration:", { config: this.config });
    
    try {
      logger.debug(LogCategory.NODE, this.id, "Creating adapter for provider", { provider: this.config.provider });
      // Create the adapter based on the provider
      this.adapter = createAdapter(this.config.provider, this.config.config);
      logger.debug(LogCategory.NODE, this.id, "Adapter created successfully", {});
      
      // Validate the adapter configuration
      logger.debug(LogCategory.NODE, this.id, "Validating adapter configuration...", {});
      if (!this.adapter.validateConfig()) {
        logger.error(LogCategory.NODE, this.id, "Invalid configuration for SERP provider", { provider: this.config.provider });
        throw createError(
          'node',
          `Invalid configuration for SERP provider: ${this.config.provider}`,
          ErrorCode.NODE_VALIDATION
        );
      }
      logger.debug(LogCategory.NODE, this.id, "Adapter configuration validated successfully", {});
      
    } catch (error) {
      logger.error(LogCategory.NODE, this.id, "Error initializing SerpNode", { error });
      throw createError(
        'node',
        `Failed to initialize SerpNode: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.NODE_INITIALIZATION
      );
    }
    
    logger.debug(LogCategory.NODE, this.id, "SerpNode initialized successfully", {});
  }
  
  /**
   * Execute the node with the given inputs
   * @param inputs The node inputs
   * @returns The node outputs
   */
  async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    logger.debug(LogCategory.NODE, this.id, "Executing SerpNode...", {});
    
    // Ensure the node is initialized
    if (!this.adapter) {
      logger.error(LogCategory.NODE, this.id, "SerpNode not initialized", {});
      throw createError(
        'node',
        'SerpNode not initialized',
        ErrorCode.NODE_INITIALIZATION
      );
    }
    
    // Get the query from the inputs
    const query = inputs.query as string;
    logger.debug(LogCategory.NODE, this.id, "Search query", { query });
    
    if (!query || typeof query !== 'string') {
      logger.error(LogCategory.NODE, this.id, "Invalid query input", { query });
      throw createError(
        'node',
        'Query input must be a non-empty string',
        ErrorCode.VALIDATION_ERROR
      );
    }
    
    // Get the options from the inputs
    const options: SearchOptions = {};
    
    // Add limit if provided
    if (inputs.limit !== undefined) {
      options.limit = Number(inputs.limit);
      logger.debug(LogCategory.NODE, this.id, "Search limit", { limit: options.limit });
    }
    
    try {
      // Execute the search
      logger.debug(LogCategory.NODE, this.id, "Executing search...", {});
      const results = await this.adapter.search(query, options);
      logger.debug(LogCategory.NODE, this.id, "Search completed", { resultCount: results.length });
      
      // Format the results
      const formatted = this.formatResults(results);
      logger.debug(LogCategory.NODE, this.id, "Results formatted", {});
      
      return {
        results: formatted
      };
    } catch (error) {
      logger.error(LogCategory.NODE, this.id, "Error executing search", { error });
      throw createError(
        'node',
        `Failed to execute search: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.NODE_EXECUTION
      );
    }
  }
  
  /**
   * Get the node category
   * @returns The node category
   */
  protected getCategory(): 'core' | 'custom' {
    logger.debug(LogCategory.NODE, this.id, "Getting node category", {});
    return 'core';
  }
  
  /**
   * Get the node label
   * @returns The node label
   */
  protected getLabel(): string {
    logger.debug(LogCategory.NODE, this.id, "Getting node label", {});
    return 'Search Engine';
  }
  
  /**
   * Get the node description
   * @returns The node description
   */
  protected getDescription(): string {
    logger.debug(LogCategory.NODE, this.id, "Getting node description", {});
    return 'Provides search engine results for a given query';
  }
  
  /**
   * Get the node version
   * @returns The node version
   */
  protected getVersion(): string {
    logger.debug(LogCategory.NODE, this.id, "Getting node version", {});
    return '1.0.0';
  }
  
  /**
   * Get the node compatibility
   * @returns The node compatibility
   */
  protected getCompatibility(): { core: boolean; pro: boolean; custom: boolean } {
    logger.debug(LogCategory.NODE, this.id, "Getting node compatibility", {});
    return {
      core: true,
      pro: true,
      custom: true
    };
  }
  
  /**
   * Get the node inputs
   * @returns The node inputs
   */
  protected getInputs(): readonly NodePort[] {
    logger.debug(LogCategory.NODE, this.id, "Getting node inputs", {});
    return [
      {
        id: 'query',
        type: 'string',
        required: true,
        label: 'Query'
      },
      {
        id: 'limit',
        type: 'number',
        required: false,
        label: 'Result Limit'
      }
    ];
  }
  
  /**
   * Get the node outputs
   * @returns The node outputs
   */
  protected getOutputs(): readonly NodePort[] {
    logger.debug(LogCategory.NODE, this.id, "Getting node outputs", {});
    return [
      {
        id: 'results',
        type: 'object',
        label: 'Search Results'
      }
    ];
  }
  
  /**
   * Format the search results
   * @param results The search results
   * @returns The formatted search results
   */
  private formatResults(results: SerpResult[]): FormattedSearchResponse {
    // Create a formatted response with markdown and raw results
    const markdown = this.generateMarkdown(results);
    
    return {
      markdown,
      raw: {
        results,
        metadata: {
          provider: this.adapter?.getProvider() || 'unknown',
          query: '',
          totalResults: results.length,
          searchTime: 0
        }
      }
    };
  }
  
  /**
   * Generate markdown representation of search results
   * @param results Search results
   * @returns Markdown string
   */
  private generateMarkdown(results: SerpResult[]): string {
    if (results.length === 0) {
      return 'No results found';
    }
    
    // Generate header
    let markdown = `## Search Results\n\n`;
    
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