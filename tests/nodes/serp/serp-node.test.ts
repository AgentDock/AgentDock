/**
 * @fileoverview Tests for the SerpNode implementation
 */

import { SerpNode } from '../../../agentdock-core/src/nodes/serp/serp-node';
import { SerpNodeConfig, SerpResult, SearchOptions } from '../../../agentdock-core/src/nodes/serp/types';
import { createError, ErrorCode } from '../../../agentdock-core/src/errors';
import { logger, LogCategory } from '../../../agentdock-core/src/logging';

// Mock the adapter factory
jest.mock('../../../agentdock-core/src/nodes/serp/adapters', () => ({
  createAdapter: jest.fn()
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

// Import the mocked createAdapter
import { createAdapter } from '../../../agentdock-core/src/nodes/serp/adapters';

describe('SerpNode', () => {
  let node: SerpNode;
  let mockConfig: SerpNodeConfig;
  let mockAdapter: any;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock adapter
    mockAdapter = {
      search: jest.fn(),
      getProvider: jest.fn().mockReturnValue('firecrawl'),
      validateConfig: jest.fn().mockReturnValue(true)
    };
    
    // Setup createAdapter mock
    (createAdapter as jest.Mock).mockReturnValue(mockAdapter);
    
    // Setup default config
    mockConfig = {
      provider: 'firecrawl',
      config: {
        apiKey: 'test-api-key'
      }
    };
    
    // Create node instance
    node = new SerpNode('test-serp-node', mockConfig);
  });
  
  describe('initialize', () => {
    it('should create and validate the adapter', async () => {
      await node.initialize();
      
      expect(createAdapter).toHaveBeenCalledWith(
        mockConfig.provider,
        mockConfig.config
      );
      expect(mockAdapter.validateConfig).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        LogCategory.NODE,
        'test-serp-node',
        expect.stringContaining('Initialized SerpNode')
      );
    });
    
    it('should throw an error if adapter validation fails', async () => {
      mockAdapter.validateConfig.mockReturnValue(false);
      
      await expect(node.initialize()).rejects.toThrow();
      expect(logger.debug).not.toHaveBeenCalledWith(
        LogCategory.NODE,
        'test-serp-node',
        expect.stringContaining('Initialized SerpNode')
      );
    });
  });
  
  describe('execute', () => {
    beforeEach(async () => {
      // Initialize the node before each test
      await node.initialize();
      
      // Setup mock search results
      mockAdapter.search.mockResolvedValue([
        {
          title: 'Test Result 1',
          snippet: 'This is a test result snippet',
          url: 'https://example.com/1',
          position: 1,
          metadata: {
            domain: 'example.com'
          }
        },
        {
          title: 'Test Result 2',
          snippet: 'Another test result snippet',
          url: 'https://example.com/2',
          position: 2,
          metadata: {
            domain: 'example.com'
          }
        }
      ]);
    });
    
    it('should execute a search with a string query', async () => {
      const result = await node.execute('test query');
      
      expect(mockAdapter.search).toHaveBeenCalledWith('test query', undefined);
      expect(result).toHaveProperty('markdown');
      expect(result).toHaveProperty('raw');
      expect(result.raw.results).toHaveLength(2);
      expect(result.raw.metadata).toHaveProperty('provider', 'firecrawl');
      expect(result.raw.metadata).toHaveProperty('query', 'test query');
    });
    
    it('should execute a search with an object query and options', async () => {
      const options: SearchOptions = {
        limit: 10,
        language: 'en'
      };
      
      const result = await node.execute({
        query: 'test query with options',
        options
      });
      
      expect(mockAdapter.search).toHaveBeenCalledWith('test query with options', options);
      expect(result.raw.metadata).toHaveProperty('query', 'test query with options');
    });
    
    it('should throw an error if query is invalid', async () => {
      await expect(node.execute({ query: '' })).rejects.toThrow();
      await expect(node.execute({ query: 123 as any })).rejects.toThrow();
    });
    
    it('should initialize the adapter if not already initialized', async () => {
      // Create a new node instance without initializing
      const uninitializedNode = new SerpNode('uninitialized-node', mockConfig);
      
      // Reset the createAdapter mock to verify it's called during execute
      (createAdapter as jest.Mock).mockClear();
      
      await uninitializedNode.execute('auto initialize query');
      
      expect(createAdapter).toHaveBeenCalled();
      expect(mockAdapter.search).toHaveBeenCalled();
    });
    
    it('should handle search errors gracefully', async () => {
      mockAdapter.search.mockRejectedValue(new Error('Search failed'));
      
      await expect(node.execute('error query')).rejects.toThrow();
    });
    
    it('should generate markdown correctly for search results', async () => {
      const result = await node.execute('markdown test');
      
      expect(result.markdown).toContain('## Search Results for "markdown test"');
      expect(result.markdown).toContain('Test Result 1');
      expect(result.markdown).toContain('Test Result 2');
      expect(result.markdown).toContain('https://example.com/1');
      expect(result.markdown).toContain('This is a test result snippet');
    });
    
    it('should handle empty search results', async () => {
      mockAdapter.search.mockResolvedValue([]);
      
      const result = await node.execute('empty query');
      
      expect(result.markdown).toContain('No results found for query: "empty query"');
      expect(result.raw.results).toHaveLength(0);
    });
  });
  
  describe('cleanup', () => {
    it('should clean up resources', async () => {
      await node.initialize();
      await node.cleanup();
      
      // After cleanup, the node should reinitialize the adapter on next execute
      (createAdapter as jest.Mock).mockClear();
      
      // Mock the adapter's search method to return a valid result
      mockAdapter.search.mockResolvedValue([
        {
          title: 'Test Result After Cleanup',
          snippet: 'This is a test result after cleanup',
          url: 'https://example.com/after-cleanup',
          position: 1,
          metadata: {
            domain: 'example.com'
          }
        }
      ]);
      
      await node.execute('after cleanup');
      
      expect(createAdapter).toHaveBeenCalled();
    });
  });
  
  describe('metadata', () => {
    it('should have the correct type', () => {
      expect(node.type).toBe('core.tool.serp');
    });
    
    it('should have the correct metadata', () => {
      const metadata = (SerpNode as any).getNodeMetadata();
      
      expect(metadata.category).toBe('core');
      expect(metadata.label).toBe('Search Engine Results');
      expect(metadata.description).toContain('search engine results');
      expect(metadata.inputs).toHaveLength(1);
      expect(metadata.outputs).toHaveLength(1);
      expect(metadata.inputs[0].id).toBe('query');
      expect(metadata.outputs[0].id).toBe('results');
    });
  });
}); 