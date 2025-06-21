/**
 * @fileoverview Qdrant client wrapper for API interactions
 */

import { LogCategory, logger } from '../../../logging';
import {
  Payload,
  QdrantBatchResult,
  QdrantCollectionConfig,
  QdrantCollectionInfo,
  QdrantFilter,
  QdrantPoint,
  QdrantScrollParams,
  QdrantScrollResponse,
  QdrantSearchParams,
  QdrantSearchResult
} from './types';

/**
 * Qdrant API client
 */
export class QdrantClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeout: number;
  private maxRetries: number;

  constructor(options: {
    host: string;
    port?: number;
    https?: boolean;
    apiKey?: string;
    timeout?: number;
    maxRetries?: number;
  }) {
    const protocol = options.https ? 'https' : 'http';
    const port = options.port || 6333;
    this.baseUrl = `${protocol}://${options.host}:${port}`;

    this.headers = {
      'Content-Type': 'application/json'
    };

    if (options.apiKey) {
      this.headers['api-key'] = options.apiKey;
    }

    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Make an authenticated request to Qdrant
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers: this.headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response
            .json()
            .catch(() => ({ error: response.statusText }));
          throw new Error(
            `Qdrant API error: ${response.status} - ${JSON.stringify(error)}`
          );
        }

        const result = await response.json();

        // Qdrant wraps responses in a result object
        if (result.status === 'error') {
          throw new Error(
            `Qdrant error: ${result.description || 'Unknown error'}`
          );
        }

        return result.result !== undefined ? result.result : result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          logger.debug(
            LogCategory.STORAGE,
            'QdrantClient',
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
   * Create a new collection
   */
  async createCollection(config: QdrantCollectionConfig): Promise<void> {
    const body = {
      vectors: config.vectors,
      shard_number: config.shard_number,
      replication_factor: config.replication_factor,
      write_consistency_factor: config.write_consistency_factor,
      on_disk_payload: config.on_disk_payload,
      hnsw_config: config.hnsw_config,
      optimizers_config: config.optimizers_config
    };

    await this.request('PUT', `/collections/${config.name}`, body);

    logger.info(LogCategory.STORAGE, 'QdrantClient', 'Collection created', {
      name: config.name,
      vectors: config.vectors
    });
  }

  /**
   * Delete a collection
   */
  async deleteCollection(name: string): Promise<void> {
    await this.request('DELETE', `/collections/${name}`);

    logger.info(LogCategory.STORAGE, 'QdrantClient', 'Collection deleted', {
      name
    });
  }

  /**
   * List all collections
   */
  async listCollections(): Promise<string[]> {
    const response = await this.request<{
      collections: Array<{ name: string }>;
    }>('GET', '/collections');

    return response.collections.map((col) => col.name);
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(name: string): Promise<QdrantCollectionInfo> {
    const response = await this.request<QdrantCollectionInfo>(
      'GET',
      `/collections/${name}`
    );

    return response;
  }

  /**
   * Check if collection exists
   */
  async collectionExists(name: string): Promise<boolean> {
    try {
      await this.getCollectionInfo(name);
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Upsert points (vectors with metadata)
   */
  async upsertPoints(
    collection: string,
    points: QdrantPoint[]
  ): Promise<QdrantBatchResult> {
    const body = {
      points: points.map((point) => ({
        id: point.id,
        vector: point.vector,
        payload: point.payload
      }))
    };

    const response = await this.request<{
      operation_id: number;
      status: string;
    }>('PUT', `/collections/${collection}/points`, body);

    logger.debug(LogCategory.STORAGE, 'QdrantClient', 'Points upserted', {
      collection,
      count: points.length
    });

    return {
      status: 'completed',
      ids: points.map((p) => p.id)
    };
  }

  /**
   * Search for similar vectors
   */
  async searchPoints(
    collection: string,
    vector: number[],
    params: QdrantSearchParams = {}
  ): Promise<QdrantSearchResult[]> {
    const body = {
      vector,
      limit: params.limit || 10,
      score_threshold: params.score_threshold,
      offset: params.offset,
      with_payload: params.with_payload !== false,
      with_vector: params.with_vector || false,
      filter: params.filter,
      params: params.params
    };

    const response = await this.request<QdrantSearchResult[]>(
      'POST',
      `/collections/${collection}/points/search`,
      body
    );

    return response;
  }

  /**
   * Retrieve points by ID
   */
  async retrievePoints(
    collection: string,
    ids: Array<string | number>,
    withPayload: boolean | string[] = true,
    withVector: boolean | string[] = false
  ): Promise<QdrantPoint[]> {
    const body = {
      ids,
      with_payload: withPayload,
      with_vector: withVector
    };

    const response = await this.request<QdrantPoint[]>(
      'POST',
      `/collections/${collection}/points`,
      body
    );

    return response;
  }

  /**
   * Update point payloads
   */
  async updatePayload(
    collection: string,
    points: Array<{
      id: string | number;
      payload: Payload;
    }>
  ): Promise<QdrantBatchResult> {
    // Process updates in sequence (Qdrant doesn't have batch payload update)
    for (const point of points) {
      const body = {
        payload: point.payload,
        points: [point.id]
      };

      await this.request(
        'POST',
        `/collections/${collection}/points/payload`,
        body
      );
    }

    logger.debug(LogCategory.STORAGE, 'QdrantClient', 'Payloads updated', {
      collection,
      count: points.length
    });

    return {
      status: 'completed',
      ids: points.map((p) => p.id)
    };
  }

  /**
   * Delete points
   */
  async deletePoints(
    collection: string,
    ids: Array<string | number>
  ): Promise<QdrantBatchResult> {
    const body = {
      points: ids
    };

    await this.request(
      'POST',
      `/collections/${collection}/points/delete`,
      body
    );

    logger.debug(LogCategory.STORAGE, 'QdrantClient', 'Points deleted', {
      collection,
      count: ids.length
    });

    return {
      status: 'completed',
      ids
    };
  }

  /**
   * Delete points by filter
   */
  async deletePointsByFilter(
    collection: string,
    filter: QdrantFilter
  ): Promise<void> {
    const body = {
      filter
    };

    await this.request(
      'POST',
      `/collections/${collection}/points/delete`,
      body
    );

    logger.debug(
      LogCategory.STORAGE,
      'QdrantClient',
      'Points deleted by filter',
      {
        collection,
        filter
      }
    );
  }

  /**
   * Scroll through all points in collection
   */
  async scrollPoints(
    collection: string,
    params: QdrantScrollParams = {}
  ): Promise<QdrantScrollResponse> {
    const body = {
      offset: params.offset,
      limit: params.limit || 100,
      with_payload: params.with_payload !== false,
      with_vector: params.with_vector || false,
      filter: params.filter
    };

    const response = await this.request<QdrantScrollResponse>(
      'POST',
      `/collections/${collection}/points/scroll`,
      body
    );

    return response;
  }

  /**
   * Count points in collection
   */
  async countPoints(
    collection: string,
    filter?: QdrantFilter
  ): Promise<number> {
    const body = filter ? { filter } : {};

    const response = await this.request<{ count: number }>(
      'POST',
      `/collections/${collection}/points/count`,
      body
    );

    return response.count;
  }

  /**
   * Create field index for faster filtering
   */
  async createFieldIndex(
    collection: string,
    field: string,
    schema: 'keyword' | 'integer' | 'float' | 'geo'
  ): Promise<void> {
    const body = {
      field_name: field,
      field_schema: schema
    };

    await this.request('PUT', `/collections/${collection}/index`, body);

    logger.info(LogCategory.STORAGE, 'QdrantClient', 'Field index created', {
      collection,
      field,
      schema
    });
  }
}
