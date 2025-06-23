/**
 * @fileoverview ChromaDB configuration validation
 */

/**
 * ChromaDB authentication options
 */
export interface ChromaAuthOptions {
  /**
   * Authentication provider (token, basic)
   */
  provider: 'token' | 'basic';

  /**
   * Credentials based on provider
   */
  credentials?: string;

  /**
   * Token for token auth
   */
  token?: string;

  /**
   * Username for basic auth
   */
  username?: string;

  /**
   * Password for basic auth
   */
  password?: string;
}

/**
 * ChromaDB configuration interface
 */
export interface ChromaDBConfig {
  /**
   * ChromaDB server URL
   */
  path?: string;

  /**
   * Authentication options
   */
  auth?: ChromaAuthOptions;

  /**
   * Tenant name
   */
  tenant?: string;

  /**
   * Database name
   */
  database?: string;
}

/**
 * Validate and normalize ChromaDB configuration
 */
export function validateChromaDBConfig(config: unknown): ChromaDBConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('ChromaDB config must be an object');
  }

  const cfg = config as Record<string, unknown>;
  const result: ChromaDBConfig = {};

  // Validate path
  if (cfg.path !== undefined) {
    if (typeof cfg.path !== 'string') {
      throw new Error('ChromaDB path must be a string');
    }
    result.path = cfg.path;
  }

  // Validate auth
  if (cfg.auth !== undefined) {
    if (!cfg.auth || typeof cfg.auth !== 'object') {
      throw new Error('ChromaDB auth must be an object');
    }

    const auth = cfg.auth as Record<string, unknown>;

    if (
      !auth.provider ||
      (auth.provider !== 'token' && auth.provider !== 'basic')
    ) {
      throw new Error('ChromaDB auth.provider must be "token" or "basic"');
    }

    result.auth = {
      provider: auth.provider as 'token' | 'basic'
    };

    if (auth.provider === 'token') {
      if (!auth.token || typeof auth.token !== 'string') {
        throw new Error(
          'ChromaDB auth.token is required for token authentication'
        );
      }
      result.auth.token = auth.token;
    } else if (auth.provider === 'basic') {
      if (!auth.username || typeof auth.username !== 'string') {
        throw new Error(
          'ChromaDB auth.username is required for basic authentication'
        );
      }
      if (!auth.password || typeof auth.password !== 'string') {
        throw new Error(
          'ChromaDB auth.password is required for basic authentication'
        );
      }
      result.auth.username = auth.username;
      result.auth.password = auth.password;
    }

    if (auth.credentials !== undefined) {
      if (typeof auth.credentials !== 'string') {
        throw new Error('ChromaDB auth.credentials must be a string');
      }
      result.auth.credentials = auth.credentials;
    }
  }

  // Validate tenant
  if (cfg.tenant !== undefined) {
    if (typeof cfg.tenant !== 'string') {
      throw new Error('ChromaDB tenant must be a string');
    }
    result.tenant = cfg.tenant;
  }

  // Validate database
  if (cfg.database !== undefined) {
    if (typeof cfg.database !== 'string') {
      throw new Error('ChromaDB database must be a string');
    }
    result.database = cfg.database;
  }

  return result;
}
