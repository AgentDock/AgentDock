/**
 * @fileoverview Tests for the SERP types and interfaces
 */

import { 
  SerpResult, 
  SearchOptions, 
  SerpAdapter, 
  BaseSerpConfig,
  FirecrawlConfig,
  SerpNodeConfig,
  SerpError,
  SearchResponse,
  FormattedSearchResponse
} from '../../../agentdock-core/src/nodes/serp/types';

describe('SERP Types', () => {
  describe('SerpResult', () => {
    it('should validate a complete SerpResult object', () => {
      const result: SerpResult = {
        title: 'Test Result',
        snippet: 'This is a test result snippet',
        url: 'https://example.com',
        position: 1,
        metadata: {
          domain: 'example.com',
          lastUpdated: '2023-01-01',
          customField: 'custom value'
        }
      };
      
      // Type validation is done at compile time, so we just check that the object exists
      expect(result).toBeDefined();
      expect(result.title).toBe('Test Result');
      expect(result.snippet).toBe('This is a test result snippet');
      expect(result.url).toBe('https://example.com');
      expect(result.position).toBe(1);
      expect(result.metadata?.domain).toBe('example.com');
      expect(result.metadata?.lastUpdated).toBe('2023-01-01');
      expect(result.metadata?.customField).toBe('custom value');
    });
    
    it('should validate a minimal SerpResult object', () => {
      const result: SerpResult = {
        title: 'Minimal Result',
        snippet: 'Minimal snippet',
        url: 'https://example.org',
        position: 2
      };
      
      expect(result).toBeDefined();
      expect(result.metadata).toBeUndefined();
    });
  });
  
  describe('SearchOptions', () => {
    it('should validate a complete SearchOptions object', () => {
      const options: SearchOptions = {
        limit: 10,
        offset: 0,
        language: 'en',
        region: 'us',
        safeSearch: true,
        customOption: 'custom value'
      };
      
      expect(options).toBeDefined();
      expect(options.limit).toBe(10);
      expect(options.offset).toBe(0);
      expect(options.language).toBe('en');
      expect(options.region).toBe('us');
      expect(options.safeSearch).toBe(true);
      expect(options.customOption).toBe('custom value');
    });
    
    it('should validate an empty SearchOptions object', () => {
      const options: SearchOptions = {};
      
      expect(options).toBeDefined();
      expect(options.limit).toBeUndefined();
      expect(options.offset).toBeUndefined();
      expect(options.language).toBeUndefined();
      expect(options.region).toBeUndefined();
      expect(options.safeSearch).toBeUndefined();
    });
  });
  
  describe('SerpAdapter', () => {
    it('should validate a SerpAdapter implementation', () => {
      const adapter: SerpAdapter = {
        search: jest.fn(),
        getProvider: jest.fn().mockReturnValue('test-provider'),
        validateConfig: jest.fn().mockReturnValue(true)
      };
      
      expect(adapter).toBeDefined();
      expect(typeof adapter.search).toBe('function');
      expect(typeof adapter.getProvider).toBe('function');
      expect(typeof adapter.validateConfig).toBe('function');
      
      // Test the adapter methods
      adapter.search('test query');
      expect(adapter.search).toHaveBeenCalledWith('test query');
      
      const provider = adapter.getProvider();
      expect(provider).toBe('test-provider');
      
      const isValid = adapter.validateConfig();
      expect(isValid).toBe(true);
    });
  });
  
  describe('BaseSerpConfig', () => {
    it('should validate a complete BaseSerpConfig object', () => {
      const config: BaseSerpConfig = {
        apiKey: 'test-api-key',
        rateLimit: 60,
        timeout: 5000,
        cache: {
          enabled: true,
          ttl: 3600
        },
        retry: {
          maxAttempts: 3,
          backoffFactor: 2
        }
      };
      
      expect(config).toBeDefined();
      expect(config.apiKey).toBe('test-api-key');
      expect(config.rateLimit).toBe(60);
      expect(config.timeout).toBe(5000);
      expect(config.cache?.enabled).toBe(true);
      expect(config.cache?.ttl).toBe(3600);
      expect(config.retry?.maxAttempts).toBe(3);
      expect(config.retry?.backoffFactor).toBe(2);
    });
    
    it('should validate a minimal BaseSerpConfig object', () => {
      const config: BaseSerpConfig = {
        apiKey: 'minimal-api-key'
      };
      
      expect(config).toBeDefined();
      expect(config.apiKey).toBe('minimal-api-key');
      expect(config.rateLimit).toBeUndefined();
      expect(config.timeout).toBeUndefined();
      expect(config.cache).toBeUndefined();
      expect(config.retry).toBeUndefined();
    });
  });
  
  describe('FirecrawlConfig', () => {
    it('should validate a complete FirecrawlConfig object', () => {
      const config: FirecrawlConfig = {
        apiKey: 'firecrawl-api-key',
        baseUrl: 'https://api.firecrawl.dev',
        headers: {
          'X-Custom-Header': 'custom-value'
        },
        rateLimit: 60,
        timeout: 5000
      };
      
      expect(config).toBeDefined();
      expect(config.apiKey).toBe('firecrawl-api-key');
      expect(config.baseUrl).toBe('https://api.firecrawl.dev');
      expect(config.headers?.['X-Custom-Header']).toBe('custom-value');
      expect(config.rateLimit).toBe(60);
      expect(config.timeout).toBe(5000);
    });
    
    it('should validate a minimal FirecrawlConfig object', () => {
      const config: FirecrawlConfig = {
        apiKey: 'minimal-firecrawl-key'
      };
      
      expect(config).toBeDefined();
      expect(config.apiKey).toBe('minimal-firecrawl-key');
      expect(config.baseUrl).toBeUndefined();
      expect(config.headers).toBeUndefined();
    });
  });
  
  describe('SerpNodeConfig', () => {
    it('should validate a SerpNodeConfig object', () => {
      const config: SerpNodeConfig = {
        provider: 'firecrawl',
        config: {
          apiKey: 'node-config-api-key'
        }
      };
      
      expect(config).toBeDefined();
      expect(config.provider).toBe('firecrawl');
      expect(config.config.apiKey).toBe('node-config-api-key');
    });
  });
  
  describe('SerpError', () => {
    it('should create a SerpError with minimal parameters', () => {
      const error = new SerpError('Test error', 'TEST_ERROR');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SerpError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.status).toBeUndefined();
      expect(error.response).toBeUndefined();
      expect(error.name).toBe('SerpError');
    });
    
    it('should create a SerpError with all parameters', () => {
      const response = { error: 'Something went wrong' };
      const error = new SerpError('Full error', 'FULL_ERROR', 400, response);
      
      expect(error.message).toBe('Full error');
      expect(error.code).toBe('FULL_ERROR');
      expect(error.status).toBe(400);
      expect(error.response).toBe(response);
    });
  });
  
  describe('SearchResponse', () => {
    it('should validate a complete SearchResponse object', () => {
      const response: SearchResponse = {
        results: [
          {
            title: 'Response Result',
            snippet: 'Response snippet',
            url: 'https://example.com/response',
            position: 1
          }
        ],
        metadata: {
          provider: 'test-provider',
          query: 'test query',
          totalResults: 100,
          searchTime: 150,
          fromCache: false
        }
      };
      
      expect(response).toBeDefined();
      expect(response.results).toHaveLength(1);
      expect(response.results[0].title).toBe('Response Result');
      expect(response.metadata.provider).toBe('test-provider');
      expect(response.metadata.query).toBe('test query');
      expect(response.metadata.totalResults).toBe(100);
      expect(response.metadata.searchTime).toBe(150);
      expect(response.metadata.fromCache).toBe(false);
    });
    
    it('should validate a minimal SearchResponse object', () => {
      const response: SearchResponse = {
        results: [],
        metadata: {
          provider: 'minimal-provider',
          query: 'minimal query'
        }
      };
      
      expect(response).toBeDefined();
      expect(response.results).toHaveLength(0);
      expect(response.metadata.provider).toBe('minimal-provider');
      expect(response.metadata.query).toBe('minimal query');
      expect(response.metadata.totalResults).toBeUndefined();
      expect(response.metadata.searchTime).toBeUndefined();
      expect(response.metadata.fromCache).toBeUndefined();
    });
  });
  
  describe('FormattedSearchResponse', () => {
    it('should validate a FormattedSearchResponse object', () => {
      const formattedResponse: FormattedSearchResponse = {
        markdown: '## Search Results\n\n1. [Result](https://example.com)',
        raw: {
          results: [
            {
              title: 'Result',
              snippet: 'Snippet',
              url: 'https://example.com',
              position: 1
            }
          ],
          metadata: {
            provider: 'test-provider',
            query: 'test query'
          }
        }
      };
      
      expect(formattedResponse).toBeDefined();
      expect(formattedResponse.markdown).toBe('## Search Results\n\n1. [Result](https://example.com)');
      expect(formattedResponse.raw.results).toHaveLength(1);
      expect(formattedResponse.raw.metadata.provider).toBe('test-provider');
    });
  });
}); 