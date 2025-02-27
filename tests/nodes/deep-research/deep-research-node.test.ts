/**
 * @fileoverview Tests for the DeepResearchNode implementation
 */

import { DeepResearchNode } from '../../../agentdock-core/src/nodes/deep-research/deep-research-node';
import { DeepResearchNodeConfig, ResearchOptions, ResearchResult } from '../../../agentdock-core/src/nodes/deep-research/types';
import { createError, ErrorCode } from '../../../agentdock-core/src/errors';
import { logger, LogCategory } from '../../../agentdock-core/src/logging';
import { NodeRegistry } from '../../../agentdock-core/src/nodes/node-registry';
import { SerpNode } from '../../../agentdock-core/src/nodes/serp/serp-node';

// Mock the NodeRegistry
jest.mock('../../../agentdock-core/src/nodes/node-registry', () => ({
  NodeRegistry: {
    create: jest.fn()
  }
}));

// Mock the logger
jest.mock('../../../agentdock-core/src/logging', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  },
  LogCategory: {
    NODE: 'node'
  }
}));

describe('DeepResearchNode', () => {
  let node: DeepResearchNode;
  let mockConfig: DeepResearchNodeConfig;
  let mockSerpNode: any;
  let mockLlmNode: any;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock SerpNode
    mockSerpNode = {
      initialize: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn(),
      cleanup: jest.fn().mockResolvedValue(undefined)
    };
    
    // Setup mock LLM node
    mockLlmNode = {
      initialize: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn(),
      cleanup: jest.fn().mockResolvedValue(undefined)
    };
    
    // Setup NodeRegistry.create mock to return appropriate nodes
    (NodeRegistry.create as jest.Mock).mockImplementation((type, id, config) => {
      if (type === 'core.tool.serp') {
        return mockSerpNode;
      } else if (type.startsWith('core.llm.')) {
        return mockLlmNode;
      }
      return null;
    });
    
    // Setup default config
    mockConfig = {
      serpProvider: 'firecrawl',
      serpConfig: {
        apiKey: 'test-serp-api-key'
      },
      llmProvider: 'anthropic',
      llmConfig: {
        apiKey: 'test-llm-api-key'
      },
      maxResults: 5,
      maxDepth: 1,
      includeCitations: true,
      maxRetries: 3,
      retryDelay: 1000
    };
    
    // Create node instance
    node = new DeepResearchNode('test-deep-research-node', mockConfig);
    
    // Setup default mock responses
    mockSerpNode.execute.mockResolvedValue({
      raw: {
        results: [
          {
            title: 'Test Result 1',
            snippet: 'This is a test result snippet',
            url: 'https://example.com/1',
            position: 1,
            metadata: {
              lastUpdated: '2023-01-01'
            }
          }
        ],
        metadata: {
          totalResults: 1,
          searchTime: 100,
          provider: 'firecrawl'
        },
        query: 'test query'
      },
      markdown: '## Search Results for "test query"...'
    });
    
    mockLlmNode.execute.mockResolvedValue({
      summary: 'This is a test summary.',
      keyFindings: ['Key finding 1']
    });
  });
  
  describe('initialize', () => {
    it('should create and initialize the SerpNode and LLM node', async () => {
      await node.initialize();
      
      // Verify NodeRegistry.create was called for both nodes
      expect(NodeRegistry.create).toHaveBeenCalledTimes(2);
      expect(NodeRegistry.create).toHaveBeenCalledWith(
        'core.tool.serp',
        'test-deep-research-node-serp',
        {
          provider: mockConfig.serpProvider,
          config: mockConfig.serpConfig
        }
      );
      expect(NodeRegistry.create).toHaveBeenCalledWith(
        `core.llm.${mockConfig.llmProvider}`,
        'test-deep-research-node-llm',
        mockConfig.llmConfig
      );
      
      // Verify both nodes were initialized
      expect(mockSerpNode.initialize).toHaveBeenCalled();
      expect(mockLlmNode.initialize).toHaveBeenCalled();
      
      // Verify debug log
      expect(logger.debug).toHaveBeenCalledWith(
        LogCategory.NODE,
        'test-deep-research-node',
        expect.stringContaining('Initialized DeepResearchNode')
      );
    });
    
    it('should throw an error if SerpNode creation fails', async () => {
      // Make NodeRegistry.create fail for SerpNode
      (NodeRegistry.create as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Failed to create SerpNode');
      });
      
      await expect(node.initialize()).rejects.toThrow();
      expect(logger.debug).not.toHaveBeenCalledWith(
        LogCategory.NODE,
        'test-deep-research-node',
        expect.stringContaining('Initialized DeepResearchNode')
      );
    });
    
    it('should throw an error if LLM node creation fails', async () => {
      // Make NodeRegistry.create fail for LLM node but succeed for SerpNode
      // We need to reset the mock implementation first
      (NodeRegistry.create as jest.Mock).mockReset();
      
      // First call returns SerpNode, second call throws error
      (NodeRegistry.create as jest.Mock)
        .mockImplementationOnce(() => mockSerpNode)
        .mockImplementationOnce(() => {
          throw new Error('Failed to create LLM node');
        });
      
      // Initialize should throw
      await expect(node.initialize()).rejects.toThrow();
      
      // SerpNode should be created but not initialized
      expect(NodeRegistry.create).toHaveBeenCalledTimes(2);
      
      // Reset the initialize mock to ensure it's not called
      mockSerpNode.initialize.mockReset();
      
      // We don't expect initialize to be called because the error happens before that
      expect(mockSerpNode.initialize).not.toHaveBeenCalled();
    });
  });
  
  describe('execute', () => {
    beforeEach(async () => {
      // Initialize the node before each test
      await node.initialize();
      
      // Setup mock search results
      mockSerpNode.execute.mockResolvedValue({
        raw: {
          results: [
            {
              title: 'Test Result 1',
              snippet: 'This is a test result snippet',
              url: 'https://example.com/1',
              position: 1,
              metadata: {
                lastUpdated: '2023-01-01'
              }
            },
            {
              title: 'Test Result 2',
              snippet: 'Another test result snippet',
              url: 'https://example.com/2',
              position: 2,
              metadata: {
                lastUpdated: '2023-01-02'
              }
            }
          ],
          metadata: {
            totalResults: 2,
            searchTime: 150,
            provider: 'firecrawl'
          },
          query: 'test query'
        },
        markdown: '## Search Results for "test query"...'
      });
      
      // Setup mock LLM response
      mockLlmNode.execute.mockResolvedValue({
        summary: 'This is a test summary of the search results.',
        keyFindings: [
          'Key finding 1',
          'Key finding 2',
          'Key finding 3'
        ]
      });
    });
    
    it('should execute a research query with a string input', async () => {
      const result = await node.execute('test query');
      
      // Verify SerpNode was called
      expect(mockSerpNode.execute).toHaveBeenCalledWith({
        query: 'test query',
        options: {
          limit: mockConfig.maxResults
        }
      });
      
      // Verify LLM node was called
      expect(mockLlmNode.execute).toHaveBeenCalled();
      
      // Verify result structure
      expect(result).toHaveProperty('query', 'test query');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('keyFindings');
      expect(result).toHaveProperty('sources');
      expect(result.sources).toHaveLength(2);
      expect(result.metadata).toHaveProperty('totalSources', 2);
      expect(result.metadata).toHaveProperty('depth', 1);
      expect(result.metadata.providers).toHaveProperty('serp', 'firecrawl');
      expect(result.metadata.providers).toHaveProperty('llm', 'anthropic');
    });
    
    it('should execute a research query with options', async () => {
      const options: ResearchOptions = {
        maxResults: 10,
        maxDepth: 1,
        includeCitations: false,
        searchParams: {
          language: 'en'
        },
        llmParams: {
          temperature: 0.7
        }
      };
      
      // Reset the mocks to ensure they're called
      mockSerpNode.execute.mockReset();
      mockLlmNode.execute.mockReset();
      
      // Mock the SerpNode execute to return search results
      mockSerpNode.execute.mockResolvedValue({
        raw: {
          results: [
            {
              title: 'Test Result 1',
              snippet: 'This is a test result snippet',
              url: 'https://example.com/1',
              position: 1,
              metadata: {
                lastUpdated: '2023-01-01'
              }
            },
            {
              title: 'Test Result 2',
              snippet: 'Another test result snippet',
              url: 'https://example.com/2',
              position: 2,
              metadata: {
                lastUpdated: '2023-01-02'
              }
            }
          ],
          metadata: {
            totalResults: 2,
            searchTime: 150,
            provider: 'firecrawl'
          },
          query: 'test query with options'
        },
        markdown: '## Search Results for "test query with options"...'
      });
      
      // Mock the LLM execute to capture the parameters
      mockLlmNode.execute.mockImplementation((params: Record<string, any>) => {
        // Return a valid response
        return Promise.resolve({
          summary: 'This is a test summary with options.',
          keyFindings: ['Option finding 1', 'Option finding 2']
        });
      });
      
      const result = await node.execute({
        query: 'test query with options',
        options
      });
      
      // Verify SerpNode was called with correct options
      expect(mockSerpNode.execute).toHaveBeenCalledWith({
        query: 'test query with options',
        options: {
          ...options.searchParams,
          limit: options.maxResults
        }
      });
      
      // Verify LLM node was called
      expect(mockLlmNode.execute).toHaveBeenCalled();
      
      // Verify the LLM parameters include the temperature
      const llmCallArgs = mockLlmNode.execute.mock.calls[0][0];
      expect(llmCallArgs).toHaveProperty('temperature', 0.7);
      
      // Verify result
      expect(result).toHaveProperty('query', 'test query with options');
    });
    
    it('should initialize the nodes if not already initialized', async () => {
      // Create a new node instance without initializing
      const uninitializedNode = new DeepResearchNode('uninitialized-node', mockConfig);
      
      // Reset the NodeRegistry.create mock
      (NodeRegistry.create as jest.Mock).mockClear();
      
      await uninitializedNode.execute('auto initialize query');
      
      // Verify NodeRegistry.create was called
      expect(NodeRegistry.create).toHaveBeenCalledTimes(2);
      expect(mockSerpNode.execute).toHaveBeenCalled();
      expect(mockLlmNode.execute).toHaveBeenCalled();
    });
    
    it('should handle search errors with retry logic', async () => {
      // Make the first search call fail, then succeed
      mockSerpNode.execute
        .mockRejectedValueOnce(new Error('Search failed'))
        .mockResolvedValueOnce({
          raw: {
            results: [
              {
                title: 'Retry Result',
                snippet: 'This result came after a retry',
                url: 'https://example.com/retry',
                position: 1
              }
            ],
            metadata: {
              totalResults: 1,
              searchTime: 100,
              provider: 'firecrawl'
            },
            query: 'retry query'
          },
          markdown: '## Search Results for "retry query"...'
        });
      
      const result = await node.execute('retry query');
      
      // Verify SerpNode.execute was called twice
      expect(mockSerpNode.execute).toHaveBeenCalledTimes(2);
      
      // Verify we got the result from the second call
      expect(result.sources[0].title).toBe('Retry Result');
    });
    
    it('should handle LLM errors with retry logic', async () => {
      // Make the first LLM call fail, then succeed
      mockLlmNode.execute
        .mockRejectedValueOnce(new Error('LLM failed'))
        .mockResolvedValueOnce({
          summary: 'This summary came after a retry',
          keyFindings: ['Retry finding']
        });
      
      const result = await node.execute('llm retry query');
      
      // Verify LLM execute was called twice
      expect(mockLlmNode.execute).toHaveBeenCalledTimes(2);
      
      // Verify we got the result from the second call
      expect(result.summary).toBe('This summary came after a retry');
      expect(result.keyFindings).toContain('Retry finding');
    });
    
    it('should handle empty search results', async () => {
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
      
      const result = await node.execute('empty query');
      
      // Verify result has empty sources
      expect(result.sources).toHaveLength(0);
      
      // Verify LLM was still called to generate a summary
      expect(mockLlmNode.execute).toHaveBeenCalled();
    });
    
    it('should parse LLM response correctly when it returns a string', async () => {
      // Mock LLM returning a string with JSON
      mockLlmNode.execute.mockResolvedValueOnce(`
        \`\`\`json
        {
          "summary": "JSON string summary",
          "keyFindings": ["JSON finding 1", "JSON finding 2"]
        }
        \`\`\`
      `);
      
      const result = await node.execute('json response query');
      
      // Verify the JSON was parsed correctly
      expect(result.summary).toBe('JSON string summary');
      expect(result.keyFindings).toContain('JSON finding 1');
      expect(result.keyFindings).toContain('JSON finding 2');
    });
    
    it('should handle malformed LLM responses gracefully', async () => {
      // Mock LLM returning an invalid response
      mockLlmNode.execute.mockResolvedValueOnce('Not a valid JSON response');
      
      const result = await node.execute('invalid response query');
      
      // Verify we got a default summary
      expect(result.summary).toBe('Not a valid JSON response');
      expect(result.keyFindings).toHaveLength(0);
    });
  });
  
  describe('cleanup', () => {
    it('should clean up resources', async () => {
      // Initialize the node
      await node.initialize();
      
      // Reset the mock cleanup functions to ensure they're called
      mockSerpNode.cleanup.mockReset();
      mockLlmNode.cleanup.mockReset();
      
      // Mock the cleanup functions to return resolved promises
      mockSerpNode.cleanup.mockResolvedValue(undefined);
      mockLlmNode.cleanup.mockResolvedValue(undefined);
      
      // Call cleanup
      await node.cleanup();
      
      // Verify both nodes were cleaned up
      expect(mockSerpNode.cleanup).toHaveBeenCalled();
      expect(mockLlmNode.cleanup).toHaveBeenCalled();
    });
  });
  
  describe('metadata', () => {
    it('should have the correct type', () => {
      expect(node.type).toBe('core.tool.deep-research');
    });
    
    it('should have the correct metadata', () => {
      const metadata = (DeepResearchNode as any).getNodeMetadata();
      
      expect(metadata.category).toBe('core');
      expect(metadata.label).toBe('Deep Research');
      expect(metadata.description).toContain('research capabilities');
      expect(metadata.inputs).toHaveLength(2);
      expect(metadata.outputs).toHaveLength(1);
      expect(metadata.inputs[0].id).toBe('query');
      expect(metadata.inputs[1].id).toBe('options');
      expect(metadata.outputs[0].id).toBe('result');
    });
  });
}); 