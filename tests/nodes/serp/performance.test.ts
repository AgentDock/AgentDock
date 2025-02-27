/**
 * @fileoverview Performance tests for the SERP node and FirecrawlAdapter
 */

import { SerpNode } from '../../../agentdock-core/src/nodes/serp/serp-node';
import { FirecrawlAdapter } from '../../../agentdock-core/src/nodes/serp/adapters/firecrawl';
import { SerpNodeConfig, FirecrawlConfig, SearchOptions } from '../../../agentdock-core/src/nodes/serp/types';
import { createAdapter } from '../../../agentdock-core/src/nodes/serp/adapters';

// Mock the adapter factory
jest.mock('../../../agentdock-core/src/nodes/serp/adapters', () => ({
  createAdapter: jest.fn()
}));

// Mock fetch for API calls
global.fetch = jest.fn();

describe('SERP Performance Tests', () => {
  let node: SerpNode;
  let adapter: FirecrawlAdapter;
  let mockConfig: SerpNodeConfig;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default config
    const firecrawlConfig: FirecrawlConfig = {
      apiKey: 'test-api-key',
      baseUrl: 'https://api.firecrawl.dev',
      timeout: 5000,
      rateLimit: 60,
      cache: {
        enabled: true,
        ttl: 3600
      },
      retry: {
        maxAttempts: 3,
        backoffFactor: 2
      }
    };
    
    mockConfig = {
      provider: 'firecrawl',
      config: firecrawlConfig
    };
    
    // Create adapter instance
    adapter = new FirecrawlAdapter(firecrawlConfig);
    
    // Mock the adapter factory to return our adapter
    (createAdapter as jest.Mock).mockReturnValue(adapter);
    
    // Create node instance
    node = new SerpNode('perf-test-node', mockConfig);
    
    // Mock successful API response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: Array(10).fill(0).map((_, i) => ({
          title: `Result ${i + 1}`,
          snippet: `This is result snippet ${i + 1}`,
          url: `https://example.com/${i + 1}`,
          position: i + 1,
          domain: 'example.com'
        })),
        metadata: {
          totalResults: 10,
          searchTime: 150
        }
      })
    });
  });
  
  describe('Caching Performance', () => {
    it('should be significantly faster for cached queries', async () => {
      await node.initialize();
      
      // First search to populate cache
      const startFirstSearch = performance.now();
      await node.execute('performance test query');
      const endFirstSearch = performance.now();
      const firstSearchTime = endFirstSearch - startFirstSearch;
      
      // Second search with same query (should use cache)
      const startSecondSearch = performance.now();
      await node.execute('performance test query');
      const endSecondSearch = performance.now();
      const secondSearchTime = endSecondSearch - startSecondSearch;
      
      // The second search should be significantly faster
      expect(secondSearchTime).toBeLessThan(firstSearchTime * 0.5);
      
      // Verify the API was only called once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    
    it('should handle cache expiration correctly', async () => {
      // Create adapter with short TTL
      const shortTtlConfig: FirecrawlConfig = {
        apiKey: 'test-api-key',
        cache: {
          enabled: true,
          ttl: 1 // 1 second TTL
        }
      };
      
      const shortTtlAdapter = new FirecrawlAdapter(shortTtlConfig);
      (createAdapter as jest.Mock).mockReturnValue(shortTtlAdapter);
      
      const shortTtlNode = new SerpNode('short-ttl-node', {
        provider: 'firecrawl',
        config: shortTtlConfig
      });
      
      await shortTtlNode.initialize();
      
      // First search to populate cache
      await shortTtlNode.execute('ttl test query');
      
      // Reset the fetch mock
      (global.fetch as jest.Mock).mockClear();
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Second search with same query (should not use cache)
      await shortTtlNode.execute('ttl test query');
      
      // Verify the API was called again
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Rate Limiting Performance', () => {
    it.skip('should properly queue and process requests under rate limits', async () => {
      // Create adapter with strict rate limit
      const rateLimitConfig: FirecrawlConfig = {
        apiKey: 'test-api-key',
        rateLimit: 30, // 30 requests per minute = 1 every 2 seconds
        cache: {
          enabled: false,
          ttl: 0
        }
      };
      
      const rateLimitAdapter = new FirecrawlAdapter(rateLimitConfig);
      (createAdapter as jest.Mock).mockReturnValue(rateLimitAdapter);
      
      const rateLimitNode = new SerpNode('rate-limit-node', {
        provider: 'firecrawl',
        config: rateLimitConfig
      });
      
      await rateLimitNode.initialize();
      
      // Mock Date.now for precise timing control
      const originalDateNow = Date.now;
      const mockDateNow = jest.fn();
      global.Date.now = mockDateNow;
      
      // Start time at 0
      mockDateNow.mockReturnValue(0);
      
      // Submit 5 queries in rapid succession
      const queries = ['query1', 'query2', 'query3', 'query4', 'query5'];
      const promises = queries.map(q => rateLimitNode.execute(q));
      
      // First request should execute immediately
      mockDateNow.mockReturnValue(100);
      
      // Second request should wait until t=2000
      mockDateNow.mockReturnValue(2000);
      
      // Third request should wait until t=4000
      mockDateNow.mockReturnValue(4000);
      
      // Fourth request should wait until t=6000
      mockDateNow.mockReturnValue(6000);
      
      // Fifth request should wait until t=8000
      mockDateNow.mockReturnValue(8000);
      
      // Wait for all promises to resolve
      await Promise.all(promises);
      
      // Verify all requests were processed
      expect(global.fetch).toHaveBeenCalledTimes(5);
      
      // Verify we got the results from the third call
      // ... existing code ...
      
      // Restore original Date.now
      global.Date.now = originalDateNow;
    });
  });
  
  describe('Retry Performance', () => {
    it.skip('should handle retries with exponential backoff', async () => {
      // Create adapter with retry configuration
      const retryConfig: FirecrawlConfig = {
        apiKey: 'test-api-key',
        retry: {
          maxAttempts: 3,
          backoffFactor: 2
        }
      };
      
      const retryAdapter = new FirecrawlAdapter(retryConfig);
      (createAdapter as jest.Mock).mockReturnValue(retryAdapter);
      
      const retryNode = new SerpNode('retry-node', {
        provider: 'firecrawl',
        config: retryConfig
      });
      
      await retryNode.initialize();
      
      // Mock Date.now for precise timing control
      const originalDateNow = Date.now;
      const mockDateNow = jest.fn();
      global.Date.now = mockDateNow;
      
      // Start time at 0
      mockDateNow.mockReturnValue(0);
      
      // Mock fetch to fail twice then succeed
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error 1'))
        .mockRejectedValueOnce(new Error('Network error 2'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            results: [{ title: 'Success after retry', snippet: 'Finally worked', url: 'https://example.com/retry', position: 1 }],
            metadata: { totalResults: 1, searchTime: 100 }
          })
        });
      
      // Execute the search (should retry twice)
      const promise = retryNode.execute('retry performance test');
      
      // First retry should happen after backoff
      mockDateNow.mockReturnValue(1000);
      
      // Second retry should happen after exponential backoff
      mockDateNow.mockReturnValue(3000);
      
      // Wait for the promise to resolve
      const result = await promise;
      
      // Verify fetch was called 3 times
      expect(global.fetch).toHaveBeenCalledTimes(4);
      
      // Verify we got the results from the third call
      expect(result.raw.results[0].title).toBe('Success after retry');
      
      // Restore original Date.now
      global.Date.now = originalDateNow;
    });
  });
  
  describe('Large Result Sets', () => {
    it('should handle large result sets efficiently', async () => {
      // Mock a large result set
      const largeResults = Array(100).fill(0).map((_, i) => ({
        title: `Large Result ${i + 1}`,
        snippet: `This is large result snippet ${i + 1}`,
        url: `https://example.com/large/${i + 1}`,
        position: i + 1,
        domain: 'example.com'
      }));
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: largeResults,
          metadata: {
            totalResults: 100,
            searchTime: 500
          }
        })
      });
      
      await node.initialize();
      
      // Measure time to process large result set
      const startTime = performance.now();
      const result = await node.execute('large result set test');
      const endTime = performance.now();
      
      // Verify we got all results
      expect(result.raw.results).toHaveLength(100);
      
      // Verify markdown generation was reasonably fast
      // This is a soft assertion as performance will vary by environment
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(1000); // Should process in under 1 second
    });
  });
}); 