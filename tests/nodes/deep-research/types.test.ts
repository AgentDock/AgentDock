/**
 * @fileoverview Type validation tests for the DeepResearchNode
 */

import { z } from 'zod';
import { 
  DeepResearchNodeConfig, 
  ResearchOptions, 
  ResearchQuery, 
  ResearchResult, 
  SourceCitation,
  IntermediateResearchData
} from '../../../agentdock-core/src/nodes/deep-research/types';
import { 
  researchOptionsSchema,
  deepResearchNodeParametersSchema,
  deepResearchNodeConfigSchema
} from '../../../agentdock-core/src/nodes/deep-research/schema';
import { SerpResult } from '../../../agentdock-core/src/nodes/serp/types';

describe('DeepResearchNode Types', () => {
  describe('DeepResearchNodeConfig', () => {
    it('should validate a valid config', () => {
      const validConfig: DeepResearchNodeConfig = {
        serpProvider: 'firecrawl',
        serpConfig: {
          apiKey: 'test-api-key'
        },
        llmProvider: 'anthropic',
        llmConfig: {
          apiKey: 'test-llm-api-key'
        },
        maxResults: 10,
        maxDepth: 2,
        includeCitations: true,
        maxRetries: 3,
        retryDelay: 1000
      };
      
      const result = deepResearchNodeConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });
    
    it('should validate a minimal config', () => {
      const minimalConfig = {
        serpProvider: 'firecrawl',
        serpConfig: {
          apiKey: 'test-api-key'
        },
        llmProvider: 'anthropic',
        llmConfig: {
          apiKey: 'test-llm-api-key'
        }
      };
      
      const result = deepResearchNodeConfigSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);
      
      if (result.success) {
        // Check default values
        expect(result.data.maxResults).toBe(10);
        expect(result.data.maxDepth).toBe(1);
        expect(result.data.includeCitations).toBe(true);
        expect(result.data.maxRetries).toBe(3);
        expect(result.data.retryDelay).toBe(1000);
      }
    });
    
    it('should reject an invalid config', () => {
      const invalidConfig = {
        serpProvider: 'firecrawl',
        // Missing serpConfig
        llmProvider: 'anthropic',
        llmConfig: {
          apiKey: 'test-llm-api-key'
        }
      };
      
      const result = deepResearchNodeConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
    
    it('should reject invalid maxDepth values', () => {
      const invalidDepthConfig = {
        serpProvider: 'firecrawl',
        serpConfig: {
          apiKey: 'test-api-key'
        },
        llmProvider: 'anthropic',
        llmConfig: {
          apiKey: 'test-llm-api-key'
        },
        maxDepth: 10 // Too high
      };
      
      const result = deepResearchNodeConfigSchema.safeParse(invalidDepthConfig);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('maxDepth');
      }
    });
    
    it('should reject negative maxRetries', () => {
      const invalidRetriesConfig = {
        serpProvider: 'firecrawl',
        serpConfig: {
          apiKey: 'test-api-key'
        },
        llmProvider: 'anthropic',
        llmConfig: {
          apiKey: 'test-llm-api-key'
        },
        maxRetries: -1 // Negative
      };
      
      const result = deepResearchNodeConfigSchema.safeParse(invalidRetriesConfig);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('maxRetries');
      }
    });
  });
  
  describe('ResearchOptions', () => {
    it('should validate valid options', () => {
      const validOptions: ResearchOptions = {
        maxResults: 5,
        maxDepth: 2,
        includeCitations: true,
        searchParams: {
          language: 'en',
          region: 'us'
        },
        llmParams: {
          temperature: 0.7
        }
      };
      
      const result = researchOptionsSchema.safeParse(validOptions);
      expect(result.success).toBe(true);
    });
    
    it('should validate empty options', () => {
      const emptyOptions = {};
      
      const result = researchOptionsSchema.safeParse(emptyOptions);
      expect(result.success).toBe(true);
    });
    
    it('should reject invalid maxDepth values', () => {
      const invalidOptions = {
        maxDepth: 10 // Too high
      };
      
      const result = researchOptionsSchema.safeParse(invalidOptions);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('maxDepth');
      }
    });
  });
  
  describe('ResearchQuery', () => {
    it('should accept a string query', () => {
      const stringQuery: ResearchQuery = 'test query';
      
      // TypeScript should compile this
      expect(typeof stringQuery).toBe('string');
    });
    
    it('should accept an object query with options', () => {
      const objectQuery: ResearchQuery = {
        query: 'test query',
        options: {
          maxResults: 5,
          maxDepth: 2
        }
      };
      
      // TypeScript should compile this
      expect(objectQuery.query).toBe('test query');
      expect(objectQuery.options?.maxResults).toBe(5);
    });
  });
  
  describe('ResearchResult', () => {
    it('should have the correct structure', () => {
      const result: ResearchResult = {
        query: 'test query',
        summary: 'This is a test summary',
        keyFindings: ['Finding 1', 'Finding 2'],
        sources: [
          {
            title: 'Test Source',
            url: 'https://example.com',
            snippet: 'Test snippet',
            date: '2023-01-01'
          }
        ],
        metadata: {
          totalSources: 1,
          depth: 1,
          researchTime: 1000,
          providers: {
            serp: 'firecrawl',
            llm: 'anthropic'
          }
        }
      };
      
      // TypeScript should compile this
      expect(result.query).toBe('test query');
      expect(result.summary).toBe('This is a test summary');
      expect(result.keyFindings).toHaveLength(2);
      expect(result.sources).toHaveLength(1);
      expect(result.metadata.totalSources).toBe(1);
    });
  });
  
  describe('SourceCitation', () => {
    it('should have the correct structure', () => {
      const source: SourceCitation = {
        title: 'Test Source',
        url: 'https://example.com',
        snippet: 'Test snippet',
        date: '2023-01-01'
      };
      
      // TypeScript should compile this
      expect(source.title).toBe('Test Source');
      expect(source.url).toBe('https://example.com');
      expect(source.snippet).toBe('Test snippet');
      expect(source.date).toBe('2023-01-01');
    });
    
    it('should allow optional fields to be omitted', () => {
      const minimalSource: SourceCitation = {
        title: 'Minimal Source',
        url: 'https://example.com'
      };
      
      // TypeScript should compile this
      expect(minimalSource.title).toBe('Minimal Source');
      expect(minimalSource.url).toBe('https://example.com');
      expect(minimalSource.snippet).toBeUndefined();
      expect(minimalSource.date).toBeUndefined();
    });
  });
  
  describe('IntermediateResearchData', () => {
    it('should have the correct structure', () => {
      const serpResult: SerpResult = {
        title: 'Test Result',
        snippet: 'Test snippet',
        url: 'https://example.com',
        position: 1
      };
      
      const data: IntermediateResearchData = {
        searchResults: [serpResult],
        summarizedContent: 'Test summary',
        keyFindings: ['Finding 1', 'Finding 2'],
        sources: [
          {
            title: 'Test Source',
            url: 'https://example.com',
            snippet: 'Test snippet',
            date: '2023-01-01'
          }
        ],
        depth: 1,
        timeTaken: 1000
      };
      
      // TypeScript should compile this
      expect(data.searchResults).toHaveLength(1);
      expect(data.summarizedContent).toBe('Test summary');
      expect(data.keyFindings).toHaveLength(2);
      expect(data.sources).toHaveLength(1);
      expect(data.depth).toBe(1);
      expect(data.timeTaken).toBe(1000);
    });
    
    it('should allow optional fields to be omitted', () => {
      const minimalData: IntermediateResearchData = {
        searchResults: [],
        sources: [],
        depth: 0,
        timeTaken: 0
      };
      
      // TypeScript should compile this
      expect(minimalData.searchResults).toHaveLength(0);
      expect(minimalData.summarizedContent).toBeUndefined();
      expect(minimalData.keyFindings).toBeUndefined();
      expect(minimalData.sources).toHaveLength(0);
      expect(minimalData.depth).toBe(0);
      expect(minimalData.timeTaken).toBe(0);
    });
  });
  
  describe('Schema Type Inference', () => {
    it('should correctly infer types from schemas', () => {
      // Create a type from the schema
      type InferredConfig = z.infer<typeof deepResearchNodeConfigSchema>;
      
      // Create an object of that type - with all required properties
      const config: InferredConfig = {
        serpProvider: 'firecrawl',
        serpConfig: {
          apiKey: 'test-api-key'
        },
        llmProvider: 'anthropic',
        llmConfig: {
          apiKey: 'test-llm-api-key'
        },
        maxResults: 10,
        maxDepth: 1,
        includeCitations: true,
        maxRetries: 3,
        retryDelay: 1000
      };
      
      // Validate it with the schema
      const result = deepResearchNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });
}); 