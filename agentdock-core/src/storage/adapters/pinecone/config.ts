/**
 * @fileoverview Pinecone configuration validation
 */

/**
 * Pinecone configuration interface
 */
export interface PineconeConfig {
  /**
   * Pinecone API key
   */
  apiKey: string;

  /**
   * Index name
   */
  indexName: string;

  /**
   * Namespace (optional)
   */
  namespace?: string;
}

/**
 * Validate and normalize Pinecone configuration
 */
export function validatePineconeConfig(config: unknown): PineconeConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('Pinecone config must be an object');
  }

  const cfg = config as Record<string, unknown>;

  if (!cfg.apiKey || typeof cfg.apiKey !== 'string') {
    throw new Error('Pinecone apiKey is required and must be a string');
  }

  if (!cfg.indexName || typeof cfg.indexName !== 'string') {
    throw new Error('Pinecone indexName is required and must be a string');
  }

  let namespace: string | undefined;
  if (cfg.namespace !== undefined) {
    if (typeof cfg.namespace !== 'string') {
      throw new Error('Pinecone namespace must be a string');
    }
    namespace = cfg.namespace;
  }

  return {
    apiKey: cfg.apiKey,
    indexName: cfg.indexName,
    ...(namespace && { namespace })
  };
}
