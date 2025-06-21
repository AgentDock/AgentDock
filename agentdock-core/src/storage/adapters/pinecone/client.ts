/**
 * @fileoverview Pinecone client wrapper for API interactions
 */

import { LogCategory, logger } from '../../../logging';
import {
  PineconeIndexConfig,
  PineconeIndexStats,
  PineconeQueryOptions,
  PineconeQueryResponse,
  PineconeUpdateRequest,
  PineconeVector
} from './types';

/**
 * Pinecone API endpoints
 */
const PINECONE_API = {
  CONTROL: 'https://api.pinecone.io',
  INDEX_URL: (environment: string, indexName: string) =>
    `https://${indexName}-${environment}.svc.pinecone.io`
};

/**
 * Pinecone client for API operations
 */
export class PineconeClient {
  private apiKey: string;
  private environment?: string;
  private timeout: number;
  private maxRetries: number;

  constructor(options: {
    apiKey: string;
    environment?: string;
    timeout?: number;
    maxRetries?: number;
  }) {
    this.apiKey = options.apiKey;
    this.environment = options.environment;
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Make an authenticated request to Pinecone
   */
  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers = {
      'Api-Key': this.apiKey,
      'Content-Type': 'application/json',
      ...options.headers
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Pinecone API error: ${response.status} - ${error}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          logger.debug(
            LogCategory.STORAGE,
            'PineconeClient',
            `Request failed, retrying in ${delay}ms`,
            { attempt, error: lastError.message }
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed');
  }

  /**
   * Create a new index
   */
  async createIndex(config: PineconeIndexConfig): Promise<void> {
    const body = {
      name: config.name,
      dimension: config.dimension,
      metric: config.metric || 'cosine',
      spec: {
        serverless: {
          cloud: config.cloud || 'aws',
          region: config.region || 'us-east-1'
        }
      }
    };

    await this.request(`${PINECONE_API.CONTROL}/indexes`, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    // Wait for index to be ready
    await this.waitForIndexReady(config.name);

    logger.info(LogCategory.STORAGE, 'PineconeClient', 'Index created', {
      name: config.name,
      dimension: config.dimension
    });
  }

  /**
   * Wait for index to be ready
   */
  private async waitForIndexReady(
    name: string,
    maxWait = 60000
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      try {
        const index = await this.describeIndex(name);
        if (index.status?.ready) {
          return;
        }
      } catch (error) {
        // Index might not exist yet
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error(`Index ${name} not ready after ${maxWait}ms`);
  }

  /**
   * Describe an index
   */
  async describeIndex(name: string): Promise<any> {
    return this.request(`${PINECONE_API.CONTROL}/indexes/${name}`);
  }

  /**
   * Delete an index
   */
  async deleteIndex(name: string): Promise<void> {
    await this.request(`${PINECONE_API.CONTROL}/indexes/${name}`, {
      method: 'DELETE'
    });

    logger.info(LogCategory.STORAGE, 'PineconeClient', 'Index deleted', {
      name
    });
  }

  /**
   * List all indexes
   */
  async listIndexes(): Promise<string[]> {
    const response = await this.request<{ indexes: Array<{ name: string }> }>(
      `${PINECONE_API.CONTROL}/indexes`
    );

    return response.indexes.map((index) => index.name);
  }

  /**
   * Get index URL
   */
  private getIndexUrl(indexName: string): string {
    if (!this.environment) {
      throw new Error('Environment not set - required for data operations');
    }
    return PINECONE_API.INDEX_URL(this.environment, indexName);
  }

  /**
   * Get index statistics
   */
  async getIndexStats(indexName: string): Promise<PineconeIndexStats> {
    const url = `${this.getIndexUrl(indexName)}/describe_index_stats`;

    return this.request(url, { method: 'POST', body: '{}' });
  }

  /**
   * Upsert vectors
   */
  async upsertVectors(
    indexName: string,
    vectors: PineconeVector[],
    namespace?: string
  ): Promise<void> {
    const url = `${this.getIndexUrl(indexName)}/vectors/upsert`;

    const body = {
      vectors,
      namespace
    };

    await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    logger.debug(LogCategory.STORAGE, 'PineconeClient', 'Vectors upserted', {
      indexName,
      count: vectors.length,
      namespace
    });
  }

  /**
   * Query vectors
   */
  async queryVectors(
    indexName: string,
    vector: number[],
    options: PineconeQueryOptions = {}
  ): Promise<PineconeQueryResponse> {
    const url = `${this.getIndexUrl(indexName)}/query`;

    const body = {
      vector,
      topK: options.topK || 10,
      includeValues: options.includeValues || false,
      includeMetadata: options.includeMetadata !== false,
      filter: options.filter,
      namespace: options.namespace
    };

    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * Fetch vectors by ID
   */
  async fetchVectors(
    indexName: string,
    ids: string[],
    namespace?: string
  ): Promise<Record<string, PineconeVector>> {
    const url = `${this.getIndexUrl(indexName)}/vectors/fetch`;

    const params = new URLSearchParams();
    ids.forEach((id) => params.append('ids', id));
    if (namespace) params.append('namespace', namespace);

    const response = await this.request<{
      vectors: Record<string, PineconeVector>;
    }>(`${url}?${params.toString()}`);

    return response.vectors || {};
  }

  /**
   * Update vectors
   */
  async updateVectors(
    indexName: string,
    updates: PineconeUpdateRequest[]
  ): Promise<void> {
    const url = `${this.getIndexUrl(indexName)}/vectors/update`;

    // Process updates one by one (Pinecone doesn't support batch updates)
    for (const update of updates) {
      await this.request(url, {
        method: 'POST',
        body: JSON.stringify(update)
      });
    }

    logger.debug(LogCategory.STORAGE, 'PineconeClient', 'Vectors updated', {
      indexName,
      count: updates.length
    });
  }

  /**
   * Delete vectors
   */
  async deleteVectors(
    indexName: string,
    ids: string[],
    namespace?: string
  ): Promise<void> {
    const url = `${this.getIndexUrl(indexName)}/vectors/delete`;

    const body = {
      ids,
      namespace
    };

    await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    logger.debug(LogCategory.STORAGE, 'PineconeClient', 'Vectors deleted', {
      indexName,
      count: ids.length,
      namespace
    });
  }

  /**
   * Delete all vectors in a namespace
   */
  async deleteAllVectors(indexName: string, namespace?: string): Promise<void> {
    const url = `${this.getIndexUrl(indexName)}/vectors/delete`;

    const body = {
      deleteAll: true,
      namespace
    };

    await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    logger.info(LogCategory.STORAGE, 'PineconeClient', 'All vectors deleted', {
      indexName,
      namespace
    });
  }
}
