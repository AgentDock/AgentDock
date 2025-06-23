/**
 * @fileoverview Qdrant configuration validation
 */

/**
 * Qdrant configuration interface
 */
export interface QdrantConfig {
  /**
   * Qdrant host
   */
  host: string;

  /**
   * Qdrant port (default: 6333)
   */
  port: number;

  /**
   * API key for authentication (optional)
   */
  apiKey?: string;

  /**
   * Use HTTPS connection (optional)
   */
  https?: boolean;
}

/**
 * Validate and normalize Qdrant configuration
 */
export function validateQdrantConfig(config: unknown): QdrantConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('Qdrant config must be an object');
  }

  const cfg = config as Record<string, unknown>;

  const host = cfg.host || 'localhost';
  const port = cfg.port || 6333;

  if (typeof host !== 'string') {
    throw new Error('Qdrant host must be a string');
  }

  if (
    typeof port !== 'number' ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error('Qdrant port must be an integer between 1 and 65535');
  }

  let apiKey: string | undefined;
  if (cfg.apiKey !== undefined) {
    if (typeof cfg.apiKey !== 'string') {
      throw new Error('Qdrant apiKey must be a string');
    }
    apiKey = cfg.apiKey;
  }

  let https: boolean | undefined;
  if (cfg.https !== undefined) {
    if (typeof cfg.https !== 'boolean') {
      throw new Error('Qdrant https must be a boolean');
    }
    https = cfg.https;
  }

  return {
    host,
    port,
    ...(apiKey && { apiKey }),
    ...(https !== undefined && { https })
  };
}
