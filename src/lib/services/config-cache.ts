import { logger, LogCategory } from 'agentdock-core';

// Using any for data as the cache can store various types of configurations
interface CacheEntry {
  data: any;
  timestamp: number;
  templateVersion: string;
}

export class ConfigCache {
  private static instance: ConfigCache;
  private cache: Map<string, CacheEntry>;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.cache = new Map();
  }

  static getInstance(): ConfigCache {
    if (!ConfigCache.instance) {
      ConfigCache.instance = new ConfigCache();
    }
    return ConfigCache.instance;
  }

  // Returns any as the cache can store various types of configurations
  async get(agentId: string, templateVersion: string): Promise<any | null> {
    const cached = this.cache.get(agentId);
    
    if (!cached) {
      await logger.debug(
        LogCategory.CONFIG,
        'ConfigCache',
        'Cache miss',
        { agentId }
      );
      return null;
    }

    // Invalidate if template version changed
    if (cached.templateVersion !== templateVersion) {
      await logger.debug(
        LogCategory.CONFIG,
        'ConfigCache',
        'Template version mismatch - invalidating',
        { 
          agentId,
          cached: cached.templateVersion,
          current: templateVersion
        }
      );
      this.cache.delete(agentId);
      return null;
    }

    // Check TTL
    if (Date.now() - cached.timestamp > this.DEFAULT_TTL) {
      await logger.debug(
        LogCategory.CONFIG,
        'ConfigCache',
        'Cache expired',
        { 
          agentId,
          age: Math.round((Date.now() - cached.timestamp) / 1000) + 's'
        }
      );
      this.cache.delete(agentId);
      return null;
    }

    await logger.debug(
      LogCategory.CONFIG,
      'ConfigCache',
      'Cache hit',
      { 
        agentId,
        version: cached.templateVersion,
        age: Math.round((Date.now() - cached.timestamp) / 1000) + 's'
      }
    );

    return cached.data;
  }

  // Accepts any as data parameter since the cache can store various types of configurations
  async set(agentId: string, data: any, templateVersion: string): Promise<void> {
    this.cache.set(agentId, {
      data,
      timestamp: Date.now(),
      templateVersion
    });

    await logger.debug(
      LogCategory.CONFIG,
      'ConfigCache',
      'Cache updated',
      { 
        agentId,
        version: templateVersion
      }
    );
  }

  async clear(): Promise<void> {
    this.cache.clear();
    await logger.debug(
      LogCategory.CONFIG,
      'ConfigCache',
      'Cache cleared'
    );
  }
} 