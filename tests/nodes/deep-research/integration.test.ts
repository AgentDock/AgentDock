/**
 * @fileoverview Integration tests for the DeepResearchNode with SerpNode and LLM
 */

import { DeepResearchNode } from '../../../agentdock-core/src/nodes/deep-research/deep-research-node';
import { DeepResearchNodeConfig, ResearchOptions, ResearchResult } from '../../../agentdock-core/src/nodes/deep-research/types';
import { NodeRegistry } from '../../../agentdock-core/src/nodes/node-registry';
import { SerpNode } from '../../../agentdock-core/src/nodes/serp/serp-node';

// Mock the NodeRegistry to return real instances but with mocked dependencies
jest.mock('../../../agentdock-core/src/nodes/node-registry', () => ({
  NodeRegistry: {
    create: jest.fn()
  }
}));

// Mock fetch for API calls
global.fetch = jest.fn();

describe('DeepResearchNode Integration Tests', () => {
  let node: DeepResearchNode;
  let mockConfig: DeepResearchNodeConfig;
  let mockSerpNode: any;
  let mockLlmNode: any;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock SerpNode with real-like behavior
    mockSerpNode = {
      initialize: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn(),
      cleanup: jest.fn().mockResolvedValue(undefined),
      type: 'core.tool.serp'
    };
    
    // Setup mock LLM node with real-like behavior
    mockLlmNode = {
      initialize: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn(),
      cleanup: jest.fn().mockResolvedValue(undefined),
      type: 'core.llm.anthropic'
    };
    
    // Setup NodeRegistry.create mock to return our mock nodes
    (NodeRegistry.create as jest.Mock).mockImplementation((type, id, config) => {
      if (type === 'core.tool.serp') {
        return mockSerpNode;
      } else if (type === 'core.llm.anthropic') {
        return mockLlmNode;
      }
      return null;
    });
    
    // Setup default config
    mockConfig = {
      serpProvider: 'firecrawl',
      serpConfig: {
        apiKey: 'test-serp-api-key',
        cache: {
          enabled: true,
          ttl: 3600
        }
      },
      llmProvider: 'anthropic',
      llmConfig: {
        apiKey: 'test-llm-api-key',
        model: 'claude-3-sonnet-20240229'
      },
      maxResults: 5,
      maxDepth: 1,
      includeCitations: true,
      maxRetries: 3,
      retryDelay: 1000
    };
    
    // Create node instance
    node = new DeepResearchNode('test-deep-research-node', mockConfig);
    
    // Setup mock SerpNode execute response
    mockSerpNode.execute.mockResolvedValue({
      raw: {
        results: [
          {
            title: 'Integration Test Result 1',
            snippet: 'This is an integration test result snippet',
            url: 'https://example.com/integration/1',
            position: 1,
            metadata: {
              lastUpdated: '2023-01-01',
              domain: 'example.com'
            }
          },
          {
            title: 'Integration Test Result 2',
            snippet: 'Another integration test result snippet',
            url: 'https://example.com/integration/2',
            position: 2,
            metadata: {
              lastUpdated: '2023-01-02',
              domain: 'example.com'
            }
          }
        ],
        metadata: {
          totalResults: 2,
          searchTime: 150,
          provider: 'firecrawl'
        },
        query: 'integration test query'
      },
      markdown: '## Search Results for "integration test query"...'
    });
    
    // Setup mock LLM node execute response
    mockLlmNode.execute.mockResolvedValue({
      summary: 'This is a summary of the integration test results.',
      keyFindings: [
        'Integration test finding 1',
        'Integration test finding 2',
        'Integration test finding 3'
      ]
    });
  });
  
  describe('End-to-end research flow', () => {
    it('should perform a complete research operation from query to summary', async () => {
      // Initialize the node
      await node.initialize();
      
      // Execute a research query
      const result = await node.execute('integration test query');
      
      // Verify SerpNode was called
      expect(mockSerpNode.execute).toHaveBeenCalledTimes(1);
      expect(mockSerpNode.execute).toHaveBeenCalledWith({
        query: 'integration test query',
        options: {
          limit: mockConfig.maxResults
        }
      });
      
      // Verify LLM node was called with appropriate prompt
      expect(mockLlmNode.execute).toHaveBeenCalledTimes(1);
      const llmPrompt = mockLlmNode.execute.mock.calls[0][0].prompt;
      expect(llmPrompt).toContain('integration test query');
      expect(llmPrompt).toContain('Integration Test Result 1');
      expect(llmPrompt).toContain('Integration Test Result 2');
      
      // Verify result structure
      expect(result).toHaveProperty('query', 'integration test query');
      expect(result).toHaveProperty('summary', 'This is a summary of the integration test results.');
      expect(result).toHaveProperty('keyFindings');
      expect(result.keyFindings).toContain('Integration test finding 1');
      expect(result).toHaveProperty('sources');
      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].title).toBe('Integration Test Result 1');
      expect(result.sources[1].url).toBe('https://example.com/integration/2');
      expect(result.metadata).toHaveProperty('totalSources', 2);
      expect(result.metadata).toHaveProperty('depth', 1);
      expect(result.metadata).toHaveProperty('researchTime');
      expect(result.metadata.providers).toHaveProperty('serp', 'firecrawl');
      expect(result.metadata.providers).toHaveProperty('llm', 'anthropic');
    });
    
    it('should handle research with options correctly', async () => {
      // Define research options
      const options: ResearchOptions = {
        maxResults: 3,
        maxDepth: 1, // Ensure maxDepth is 1 to trigger LLM call
        includeCitations: true,
        searchParams: {
          language: 'en',
          region: 'us'
        },
        llmParams: {
          temperature: 0.7,
          maxTokens: 2000
        }
      };
      
      // Reset mocks to ensure they're called
      mockSerpNode.execute.mockReset();
      mockLlmNode.execute.mockReset();
      
      // Setup mock responses
      mockSerpNode.execute.mockResolvedValue({
        raw: {
          results: [
            {
              title: 'Options Test Result 1',
              snippet: 'This is a test result with options',
              url: 'https://example.com/options/1',
              position: 1,
              metadata: {
                lastUpdated: '2023-01-01',
                domain: 'example.com'
              }
            },
            {
              title: 'Options Test Result 2',
              snippet: 'Another test result with options',
              url: 'https://example.com/options/2',
              position: 2,
              metadata: {
                lastUpdated: '2023-01-02',
                domain: 'example.com'
              }
            }
          ],
          metadata: {
            totalResults: 2,
            searchTime: 120,
            provider: 'firecrawl'
          },
          query: 'options test'
        },
        markdown: '## Search Results for "options test"...'
      });
      
      mockLlmNode.execute.mockResolvedValue({
        summary: 'This is a summary with options.',
        keyFindings: [
          'Option finding 1',
          'Option finding 2',
          'Option finding 3'
        ]
      });
      
      // Initialize the node
      await node.initialize();
      
      // Execute research with options
      const result = await node.execute({
        query: 'options test',
        options
      });
      
      // Verify options were passed to SerpNode
      expect(mockSerpNode.execute).toHaveBeenCalledWith({
        query: 'options test',
        options: {
          ...options.searchParams,
          limit: options.maxResults
        }
      });
      
      // Verify LLM node was called
      expect(mockLlmNode.execute).toHaveBeenCalled();
      
      // Verify the LLM parameters include the temperature and maxTokens
      const llmCallArgs = mockLlmNode.execute.mock.calls[0][0];
      expect(llmCallArgs).toHaveProperty('temperature', 0.7);
      expect(llmCallArgs).toHaveProperty('maxTokens', 2000);
      
      // Verify the result structure
      expect(result).toHaveProperty('query', 'options test');
      expect(result).toHaveProperty('summary', 'This is a summary with options.');
      expect(result.keyFindings).toContain('Option finding 1');
    });
  });
  
  describe('Error handling and recovery', () => {
    it('should retry failed search requests', async () => {
      // Make the first search call fail, then succeed
      mockSerpNode.execute
        .mockRejectedValueOnce(new Error('Search failed'))
        .mockResolvedValueOnce({
          raw: {
            results: [
              {
                title: 'Retry Success',
                snippet: 'This result came after a retry',
                url: 'https://example.com/retry',
                position: 1,
                metadata: {
                  domain: 'example.com'
                }
              }
            ],
            metadata: {
              totalResults: 1,
              searchTime: 100,
              provider: 'firecrawl'
            },
            query: 'retry test'
          },
          markdown: '## Search Results for "retry test"...'
        });
      
      await node.initialize();
      
      // Execute should succeed after retry
      const result = await node.execute('retry test');
      
      // Verify SerpNode.execute was called twice
      expect(mockSerpNode.execute).toHaveBeenCalledTimes(2);
      
      // Verify we got the results from the second call
      expect(result.sources[0].title).toBe('Retry Success');
    });
    
    it('should retry failed LLM requests', async () => {
      // Make the first LLM call fail, then succeed
      mockLlmNode.execute
        .mockRejectedValueOnce(new Error('LLM failed'))
        .mockResolvedValueOnce({
          summary: 'This summary came after a retry',
          keyFindings: ['Retry finding 1', 'Retry finding 2']
        });
      
      await node.initialize();
      
      // Execute should succeed after retry
      const result = await node.execute('llm retry test');
      
      // Verify LLM execute was called twice
      expect(mockLlmNode.execute).toHaveBeenCalledTimes(2);
      
      // Verify we got the results from the second call
      expect(result.summary).toBe('This summary came after a retry');
      expect(result.keyFindings).toContain('Retry finding 1');
    });
    
    it('should handle empty search results gracefully', async () => {
      // Mock empty search results
      mockSerpNode.execute.mockResolvedValueOnce({
        raw: {
          results: [],
          metadata: {
            totalResults: 0,
            searchTime: 50,
            provider: 'firecrawl'
          },
          query: 'empty query'
        },
        markdown: 'No results found for query: "empty query"'
      });
      
      await node.initialize();
      
      const result = await node.execute('empty query');
      
      // Verify result has empty sources
      expect(result.sources).toHaveLength(0);
      
      // Verify LLM was still called to generate a summary
      expect(mockLlmNode.execute).toHaveBeenCalled();
      
      // Verify the prompt mentions no results
      const llmPrompt = mockLlmNode.execute.mock.calls[0][0].prompt;
      expect(llmPrompt).toContain('empty query');
    });
    
    it('should handle malformed LLM responses gracefully', async () => {
      // Mock LLM returning an invalid response
      mockLlmNode.execute.mockResolvedValueOnce('Not a valid JSON response');
      
      await node.initialize();
      
      const result = await node.execute('invalid response query');
      
      // Verify we got a default summary
      expect(result.summary).toBe('Not a valid JSON response');
      expect(result.keyFindings).toHaveLength(0);
    });
  });
  
  describe('Performance considerations', () => {
    it('should respect maxResults parameter', async () => {
      // Create a node with a different maxResults
      const customConfig = {
        ...mockConfig,
        maxResults: 3
      };
      
      const customNode = new DeepResearchNode('custom-node', customConfig);
      await customNode.initialize();
      
      await customNode.execute('max results test');
      
      // Verify SerpNode was called with the correct limit
      expect(mockSerpNode.execute).toHaveBeenCalledWith({
        query: 'max results test',
        options: {
          limit: 3
        }
      });
    });
    
    it('should override config maxResults with options maxResults', async () => {
      await node.initialize();
      
      await node.execute({
        query: 'override test',
        options: {
          maxResults: 10
        }
      });
      
      // Verify SerpNode was called with the overridden limit
      expect(mockSerpNode.execute).toHaveBeenCalledWith({
        query: 'override test',
        options: {
          limit: 10
        }
      });
    });
  });
}); 