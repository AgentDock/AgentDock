/**
 * @fileoverview Search tool implementation following Vercel AI SDK patterns.
 * Provides a dummy web search functionality for testing purposes.
 */

import { z } from 'zod';
import { Tool } from '../types';
import { SearchResult, SearchResults } from './components';
import { logger, LogCategory } from 'agentdock-core';

/**
 * Schema for search tool parameters
 */
const searchSchema = z.object({
  query: z.string().describe('Search query to look up'),
  limit: z.number().optional().default(5).describe('Maximum number of results to return')
});

/**
 * Type inference from schema
 */
type SearchParams = z.infer<typeof searchSchema>;

/**
 * Search tool implementation - dummy mock
 */
export const searchTool: Tool = {
  name: 'search',
  description: 'Search the web for information on any topic',
  parameters: searchSchema,
  async execute({ query, limit = 5 }) {
    logger.debug(LogCategory.NODE, '[Search]', `Executing search for query: ${query}`);
    
    // Generate mock data
    const results: SearchResult[] = [
      {
        title: 'AgentDock: Build AI Agents with Ease',
        url: 'https://agentdock.ai',
        snippet: 'AgentDock is a framework for building and deploying AI agents with custom tools and capabilities.'
      },
      {
        title: 'Getting Started with AgentDock',
        url: 'https://docs.agentdock.ai/getting-started',
        snippet: 'Learn how to create your first AI agent with AgentDock. This guide covers installation, configuration, and deployment.'
      },
      {
        title: 'Custom Tools in AgentDock',
        url: 'https://docs.agentdock.ai/tools',
        snippet: 'Extend your agents with custom tools. This guide shows how to create, register, and use custom tools in your agents.'
      },
      {
        title: 'AgentDock GitHub Repository',
        url: 'https://github.com/agentdock/agentdock',
        snippet: 'Open source framework for building AI agents. Star us on GitHub to support the project.'
      },
      {
        title: 'AgentDock vs. LangChain: A Comparison',
        url: 'https://blog.agentdock.ai/comparison',
        snippet: 'Compare AgentDock with other agent frameworks like LangChain. Learn about the pros and cons of each approach.'
      }
    ];
    
    // Limit results based on parameter
    const limitedResults = results.slice(0, Math.min(limit, results.length));
    
    // Use our SearchResults component to format the output
    return SearchResults({
      query,
      results: limitedResults
    });
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  'search': searchTool
}; 