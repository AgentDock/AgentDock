/**
 * @fileoverview ChromaDB client wrapper for API interactions
 */

import { LogCategory, logger } from '../../../logging';
import {
  ChromaCollectionInfo,
  ChromaCollectionMetadata,
  ChromaDocument,
  ChromaEmbeddingFunction,
  ChromaGetResult,
  ChromaInclude,
  ChromaQueryParams,
  ChromaQueryResult,
  ChromaWhereDocumentFilter,
  ChromaWhereFilter
} from './types';

/**
 * ChromaDB API client
 */
export class ChromaDBClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeout: number;
  private maxRetries: number;

  constructor(options: {
    host?: string;
    authToken?: string;
    timeout?: number;
    maxRetries?: number;
  }) {
    this.baseUrl = options.host || 'http://localhost:8000';

    this.headers = {
      'Content-Type': 'application/json'
    };

    if (options.authToken) {
      this.headers['Authorization'] = `Bearer ${options.authToken}`;
    }

    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Make an authenticated request to ChromaDB
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
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
            `ChromaDB API error: ${response.status} - ${JSON.stringify(error)}`
          );
        }

        // Handle 204 No Content
        if (response.status === 204) {
          return {} as T;
        }

        const result = await response.json();
        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          logger.debug(
            LogCategory.STORAGE,
            'ChromaDBClient',
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
  async createCollection(
    name: string,
    metadata?: ChromaCollectionMetadata
  ): Promise<ChromaCollectionInfo> {
    const body = {
      name,
      metadata
    };

    const response = await this.request<ChromaCollectionInfo>(
      'POST',
      '/collections',
      body
    );

    logger.info(LogCategory.STORAGE, 'ChromaDBClient', 'Collection created', {
      name,
      metadata
    });

    return response;
  }

  /**
   * Delete a collection
   */
  async deleteCollection(name: string): Promise<void> {
    await this.request('DELETE', `/collections/${name}`);

    logger.info(LogCategory.STORAGE, 'ChromaDBClient', 'Collection deleted', {
      name
    });
  }

  /**
   * List all collections
   */
  async listCollections(): Promise<ChromaCollectionInfo[]> {
    const response = await this.request<ChromaCollectionInfo[]>(
      'GET',
      '/collections'
    );
    return response;
  }

  /**
   * Get collection info
   */
  async getCollection(name: string): Promise<ChromaCollectionInfo> {
    const response = await this.request<ChromaCollectionInfo>(
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
      await this.getCollection(name);
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Add documents to collection
   */
  async addDocuments(
    collection: string,
    documents: ChromaDocument[]
  ): Promise<void> {
    const ids = documents.map((d) => d.id);
    const docs = documents
      .map((d) => d.document)
      .filter((d) => d !== undefined);
    const embeddings = documents
      .map((d) => d.embedding)
      .filter((e) => e !== undefined);
    const metadatas = documents.map((d) => d.metadata || {});

    const body: Record<string, unknown> = {
      ids
    };

    if (docs.length > 0) body.documents = docs;
    if (embeddings.length > 0) body.embeddings = embeddings;
    if (metadatas.length > 0) body.metadatas = metadatas;

    await this.request('POST', `/collections/${collection}/add`, body);

    logger.debug(LogCategory.STORAGE, 'ChromaDBClient', 'Documents added', {
      collection,
      count: documents.length
    });
  }

  /**
   * Query collection by embeddings
   */
  async queryDocuments(
    collection: string,
    queryEmbeddings: number[][],
    params: ChromaQueryParams = {}
  ): Promise<ChromaQueryResult> {
    const body = {
      query_embeddings: queryEmbeddings,
      n_results: params.nResults || 10,
      where: params.where,
      where_document: params.whereDocument,
      include: params.include || [
        ChromaInclude.METADATAS,
        ChromaInclude.DOCUMENTS,
        ChromaInclude.DISTANCES
      ]
    };

    const response = await this.request<ChromaQueryResult>(
      'POST',
      `/collections/${collection}/query`,
      body
    );

    return response;
  }

  /**
   * Get documents by ID
   */
  async getDocuments(
    collection: string,
    ids: string[],
    include?: ChromaInclude[]
  ): Promise<ChromaGetResult> {
    const body = {
      ids,
      include: include || [ChromaInclude.METADATAS, ChromaInclude.DOCUMENTS]
    };

    const response = await this.request<ChromaGetResult>(
      'POST',
      `/collections/${collection}/get`,
      body
    );

    return response;
  }

  /**
   * Update documents
   */
  async updateDocuments(
    collection: string,
    ids: string[],
    metadatas?: Record<string, string | number | boolean>[],
    documents?: string[],
    embeddings?: number[][]
  ): Promise<void> {
    const body: Record<string, unknown> = { ids };

    if (metadatas) body.metadatas = metadatas;
    if (documents) body.documents = documents;
    if (embeddings) body.embeddings = embeddings;

    await this.request('POST', `/collections/${collection}/update`, body);

    logger.debug(LogCategory.STORAGE, 'ChromaDBClient', 'Documents updated', {
      collection,
      count: ids.length
    });
  }

  /**
   * Upsert documents (add or update)
   */
  async upsertDocuments(
    collection: string,
    documents: ChromaDocument[]
  ): Promise<void> {
    const ids = documents.map((d) => d.id);
    const docs = documents
      .map((d) => d.document)
      .filter((d) => d !== undefined);
    const embeddings = documents
      .map((d) => d.embedding)
      .filter((e) => e !== undefined);
    const metadatas = documents.map((d) => d.metadata || {});

    const body: Record<string, unknown> = {
      ids
    };

    if (docs.length > 0) body.documents = docs;
    if (embeddings.length > 0) body.embeddings = embeddings;
    if (metadatas.length > 0) body.metadatas = metadatas;

    await this.request('POST', `/collections/${collection}/upsert`, body);

    logger.debug(LogCategory.STORAGE, 'ChromaDBClient', 'Documents upserted', {
      collection,
      count: documents.length
    });
  }

  /**
   * Delete documents
   */
  async deleteDocuments(
    collection: string,
    ids?: string[],
    where?: ChromaWhereFilter,
    whereDocument?: ChromaWhereDocumentFilter
  ): Promise<string[]> {
    const body: Record<string, unknown> = {};

    if (ids) body.ids = ids;
    if (where) body.where = where;
    if (whereDocument) body.where_document = whereDocument;

    const response = await this.request<string[]>(
      'POST',
      `/collections/${collection}/delete`,
      body
    );

    logger.debug(LogCategory.STORAGE, 'ChromaDBClient', 'Documents deleted', {
      collection,
      count: response.length
    });

    return response;
  }

  /**
   * Count documents in collection
   */
  async countDocuments(collection: string): Promise<number> {
    const response = await this.request<{ count: number }>(
      'GET',
      `/collections/${collection}/count`
    );

    return response.count;
  }

  /**
   * Peek at first n documents
   */
  async peekDocuments(
    collection: string,
    limit: number = 10
  ): Promise<ChromaGetResult> {
    const body = { limit };

    const response = await this.request<ChromaGetResult>(
      'POST',
      `/collections/${collection}/peek`,
      body
    );

    return response;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request('GET', '/heartbeat');
      return true;
    } catch {
      return false;
    }
  }
}
