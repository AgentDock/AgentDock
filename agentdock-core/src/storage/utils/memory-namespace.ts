/**
 * @fileoverview Memory namespace patterns and management
 * 
 * Provides hierarchical namespace structure for memory isolation,
 * multi-tenant support, and efficient organization.
 */

import { LogCategory, logger } from '../../logging';
import { StorageProvider } from '../types';
import { getStorageFactory } from '../factory';
import { MemoryType } from '../adapters/postgresql/schema-memory';

/**
 * Namespace patterns for memory system
 */
export const NAMESPACE_PATTERNS = {
  // Base pattern: memories:{tenant}:{agent}:{type}
  agentMemories: (tenantId: string, agentId: string) => 
    `memories:${tenantId}:${agentId}`,
  
  // Memory type specific
  workingMemory: (tenantId: string, agentId: string) => 
    `memories:${tenantId}:${agentId}:working`,
  
  episodicMemory: (tenantId: string, agentId: string) => 
    `memories:${tenantId}:${agentId}:episodic`,
  
  semanticMemory: (tenantId: string, agentId: string) => 
    `memories:${tenantId}:${agentId}:semantic`,
  
  proceduralMemory: (tenantId: string, agentId: string) => 
    `memories:${tenantId}:${agentId}:procedural`,
  
  // Shared memories across agents
  sharedMemories: (tenantId: string) => 
    `memories:${tenantId}:shared`,
  
  // System-wide memories
  systemMemories: () => 'memories:system',
  
  // Vector collections
  vectorNamespace: (tenantId: string) => 
    `vectors:${tenantId}:memories`,
  
  // Audit logs
  auditNamespace: () => 'audit:access',
  
  // Temporary processing
  tempNamespace: (tenantId: string, jobId: string) =>
    `temp:${tenantId}:${jobId}`
};

/**
 * Storage type configuration for different memory types
 */
export interface MemoryTypeConfig {
  storageType: string;
  ttl?: number;
  maxKeys?: number;
  additionalConfig?: Record<string, any>;
}

/**
 * Tenant configuration
 */
export interface TenantConfig {
  tenantId: string;
  storageType?: string;
  storageConfig?: Record<string, any>;
  maxConnections?: number;
  quotas?: {
    maxMemories: number;
    maxStorageBytes: number;
    maxVectors: number;
  };
}

/**
 * Namespace permissions
 */
export interface NamespacePermissions {
  read: boolean;
  write: boolean;
  delete: boolean;
  admin: boolean;
}

/**
 * Resource usage tracking
 */
export interface ResourceUsage {
  memoryCount: number;
  storageBytes: number;
  vectorCount: number;
}

/**
 * Namespace configuration
 */
export interface NamespaceConfig {
  type: string;
  ttl?: number;
  maxSize?: number;
  permissions?: NamespacePermissions;
}

/**
 * Namespaced memory storage manager
 */
export class NamespacedMemoryStorage {
  private storageProviders = new Map<string, StorageProvider>();
  private namespaceConfigs = new Map<string, NamespaceConfig>();

  /**
   * Get storage provider for a namespace
   */
  getStorage(namespace: string): StorageProvider {
    if (!this.storageProviders.has(namespace)) {
      const config = this.getNamespaceConfig(namespace);
      const provider = getStorageFactory().getProvider({
        type: this.getStorageType(namespace),
        namespace,
        config: config
      });
      
      this.storageProviders.set(namespace, provider);
      
      logger.debug(
        LogCategory.STORAGE,
        'NamespacedMemoryStorage',
        'Created storage provider',
        { namespace, type: this.getStorageType(namespace) }
      );
    }
    
    return this.storageProviders.get(namespace)!;
  }

  /**
   * Determine storage type based on namespace
   */
  private getStorageType(namespace: string): string {
    // Different storage types for different memory types
    if (namespace.includes(':working')) {
      return 'redis'; // Fast, ephemeral
    } else if (namespace.includes(':procedural')) {
      return 'postgresql'; // Reliable, queryable
    } else if (namespace.includes('vectors:')) {
      return 'postgresql-vector'; // Vector search
    } else if (namespace.includes('audit:')) {
      return 'postgresql'; // Audit trail
    } else if (namespace.includes('temp:')) {
      return 'memory'; // Temporary processing
    }
    
    return 'postgresql'; // Default
  }

  /**
   * Get configuration for a namespace
   */
  private getNamespaceConfig(namespace: string): Record<string, any> {
    // Namespace-specific configurations
    if (namespace.includes(':working')) {
      return {
        ttl: 3600, // 1 hour TTL for working memory
        maxKeys: 1000 // Limit working memory size
      };
    } else if (namespace.includes(':episodic')) {
      return {
        // Keep recent episodes longer
        ttl: 7 * 24 * 3600 // 7 days
      };
    } else if (namespace.includes('temp:')) {
      return {
        ttl: 300, // 5 minutes for temp data
        maxKeys: 10000
      };
    }
    
    return {};
  }

  /**
   * Register a namespace configuration
   */
  registerNamespace(namespace: string, config: NamespaceConfig): void {
    this.namespaceConfigs.set(namespace, config);
    
    logger.debug(
      LogCategory.STORAGE,
      'NamespacedMemoryStorage',
      'Registered namespace',
      { namespace, config }
    );
  }

  /**
   * Close all storage providers
   */
  async closeAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const [namespace, provider] of Array.from(this.storageProviders.entries())) {
      if ('destroy' in provider && typeof provider.destroy === 'function') {
        promises.push(
          provider.destroy().catch(error => {
            logger.warn(
              LogCategory.STORAGE,
              'NamespacedMemoryStorage',
              'Failed to close provider',
              { namespace, error: error.message }
            );
          })
        );
      }
    }
    
    await Promise.all(promises);
    this.storageProviders.clear();
  }
}

/**
 * Memory-specific operations across namespaces
 */
export class IsolatedMemoryOperations {
  constructor(
    private tenantId: string,
    private agentId: string,
    private storage: NamespacedMemoryStorage
  ) {}

  /**
   * Update working memory (ephemeral, fast access)
   */
  async updateWorkingMemory(content: string): Promise<void> {
    const namespace = NAMESPACE_PATTERNS.workingMemory(
      this.tenantId, 
      this.agentId
    );
    const storage = this.storage.getStorage(namespace);
    
    await storage.set('current_context', {
      content,
      timestamp: Date.now(),
      tokens: this.countTokens(content)
    }, {
      ttlSeconds: 3600 // Auto-expire after 1 hour
    });
  }

  /**
   * Add episodic memory (time-ordered events)
   */
  async addEpisodicMemory(memory: {
    id: string;
    sessionId: string;
    content: string;
    timestamp: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const namespace = NAMESPACE_PATTERNS.episodicMemory(
      this.tenantId,
      this.agentId
    );
    const storage = this.storage.getStorage(namespace);
    
    // Time-based key for natural ordering
    const key = `${memory.sessionId}:${memory.timestamp}:${memory.id}`;
    
    await storage.set(key, memory);
  }

  /**
   * Store semantic memory (facts and knowledge)
   */
  async storeSemanticMemory(memory: {
    id: string;
    category: string;
    content: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const namespace = NAMESPACE_PATTERNS.semanticMemory(
      this.tenantId,
      this.agentId
    );
    const storage = this.storage.getStorage(namespace);
    
    // Content-based key for deduplication
    const key = `${memory.category}:${this.hashContent(memory.content)}`;
    
    await storage.set(key, memory);
  }

  /**
   * Record procedural pattern (learned behaviors)
   */
  async recordProceduralPattern(pattern: {
    trigger: string;
    action: string;
    success: boolean;
    context?: Record<string, any>;
  }): Promise<void> {
    const namespace = NAMESPACE_PATTERNS.proceduralMemory(
      this.tenantId,
      this.agentId
    );
    const storage = this.storage.getStorage(namespace);
    
    // Pattern-based key
    const key = `${pattern.trigger}:${pattern.action}`;
    
    // Get existing pattern or create new
    const existing = await storage.get<any>(key);
    
    const updated = existing ? {
      ...existing,
      successCount: existing.successCount + (pattern.success ? 1 : 0),
      failureCount: existing.failureCount + (pattern.success ? 0 : 1),
      lastUsed: Date.now()
    } : {
      trigger: pattern.trigger,
      action: pattern.action,
      successCount: pattern.success ? 1 : 0,
      failureCount: pattern.success ? 0 : 1,
      firstUsed: Date.now(),
      lastUsed: Date.now(),
      context: pattern.context
    };
    
    await storage.set(key, updated);
  }

  /**
   * Simple content hashing
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Count tokens (simplified)
   */
  private countTokens(content: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(content.length / 4);
  }
}

/**
 * Cross-namespace memory query
 */
export class CrossNamespaceMemoryQuery {
  constructor(private storage: NamespacedMemoryStorage) {}

  /**
   * Find memories across multiple namespaces
   */
  async findRelatedMemories(
    tenantId: string,
    agentId: string,
    query: string,
    options: {
      includeShared?: boolean;
      memoryTypes?: string[];
      limit?: number;
    } = {}
  ): Promise<any[]> {
    const {
      includeShared = true,
      memoryTypes = ['episodic', 'semantic'],
      limit = 100
    } = options;

    // Build namespace list
    const namespaces: string[] = [];
    
    if (memoryTypes.includes('episodic')) {
      namespaces.push(NAMESPACE_PATTERNS.episodicMemory(tenantId, agentId));
    }
    if (memoryTypes.includes('semantic')) {
      namespaces.push(NAMESPACE_PATTERNS.semanticMemory(tenantId, agentId));
    }
    if (memoryTypes.includes('procedural')) {
      namespaces.push(NAMESPACE_PATTERNS.proceduralMemory(tenantId, agentId));
    }
    if (includeShared) {
      namespaces.push(NAMESPACE_PATTERNS.sharedMemories(tenantId));
    }
    
    // Parallel search across namespaces
    const searchPromises = namespaces.map(namespace => 
      this.searchNamespace(namespace, query, Math.ceil(limit / namespaces.length))
    );
    
    const results = await Promise.all(searchPromises);
    
    // Merge and rank results
    return this.mergeAndRankResults(results.flat(), limit);
  }

  /**
   * Search within a specific namespace
   */
  private async searchNamespace(
    namespace: string,
    query: string,
    limit: number
  ): Promise<any[]> {
    const storage = this.storage.getStorage(namespace);
    
    // List all keys (simplified search)
    const keys = await storage.list('', { limit: limit * 2 });
    const results: any[] = [];
    
    // Batch get and filter
    const values = await storage.getMany(keys);
    
    for (const [key, value] of Object.entries(values)) {
      if (value && this.matchesQuery(value, query)) {
        results.push({
          namespace,
          key,
          value,
          score: this.calculateScore(value, query)
        });
      }
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Check if value matches query
   */
  private matchesQuery(value: any, query: string): boolean {
    const queryLower = query.toLowerCase();
    const content = JSON.stringify(value).toLowerCase();
    return content.includes(queryLower);
  }

  /**
   * Calculate relevance score
   */
  private calculateScore(value: any, query: string): number {
    const queryLower = query.toLowerCase();
    const content = (value.content || JSON.stringify(value)).toLowerCase();
    
    // Simple scoring based on match count
    const matches = (content.match(new RegExp(queryLower, 'g')) || []).length;
    const importance = value.importance || 0.5;
    const recency = value.timestamp 
      ? 1 / (1 + (Date.now() - value.timestamp) / (24 * 60 * 60 * 1000))
      : 0.5;
    
    return matches * importance * recency;
  }

  /**
   * Merge and rank results from multiple namespaces
   */
  private mergeAndRankResults(results: any[], limit: number): any[] {
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

/**
 * Multi-tenant memory system
 */
export class MultiTenantMemorySystem {
  private tenantConfigs = new Map<string, TenantConfig>();
  private storage = new NamespacedMemoryStorage();

  /**
   * Initialize a new tenant
   */
  async initializeTenant(config: TenantConfig): Promise<void> {
    this.tenantConfigs.set(config.tenantId, config);
    
    // Create tenant-specific namespaces
    const namespaces = [
      `memories:${config.tenantId}`,
      `vectors:${config.tenantId}:memories`,
      `memories:${config.tenantId}:shared`
    ];
    
    // Register namespaces with appropriate configurations
    for (const namespace of namespaces) {
      this.storage.registerNamespace(namespace, {
        type: config.storageType || 'postgresql',
        permissions: {
          read: true,
          write: true,
          delete: true,
          admin: false
        }
      });
    }
    
    logger.info(
      LogCategory.STORAGE,
      'MultiTenantMemorySystem',
      'Tenant initialized',
      { tenantId: config.tenantId, namespaces }
    );
  }

  /**
   * Get tenant usage statistics
   */
  async getTenantUsage(tenantId: string): Promise<ResourceUsage> {
    const namespaces = [
      `memories:${tenantId}`,
      `vectors:${tenantId}:memories`
    ];
    
    let totalCount = 0;
    let totalBytes = 0;
    let vectorCount = 0;
    
    for (const namespace of namespaces) {
      const storage = this.storage.getStorage(namespace);
      const keys = await storage.list('');
      
      totalCount += keys.length;
      
      // Estimate size (simplified)
      if (namespace.includes('vectors')) {
        vectorCount = keys.length;
      }
      
      // In production, implement proper size calculation
      totalBytes += keys.length * 1000; // Rough estimate
    }
    
    return { 
      memoryCount: totalCount, 
      storageBytes: totalBytes, 
      vectorCount 
    };
  }

  /**
   * Enforce tenant quotas
   */
  async enforceQuotas(tenantId: string): Promise<void> {
    const config = this.tenantConfigs.get(tenantId);
    if (!config?.quotas) return;
    
    const usage = await this.getTenantUsage(tenantId);
    
    // Check quotas
    if (usage.memoryCount >= config.quotas.maxMemories) {
      logger.warn(
        LogCategory.STORAGE,
        'MultiTenantMemorySystem',
        'Memory quota exceeded',
        { tenantId, usage, quotas: config.quotas }
      );
      
      // Trigger consolidation or cleanup
      // Implementation depends on business logic
    }
  }
}

/**
 * Namespace sharding for scale
 */
export class NamespaceSharding {
  /**
   * Get sharded namespace
   */
  getShardedNamespace(
    baseNamespace: string,
    shardKey: string,
    shardCount: number = 16
  ): string {
    const shard = this.hashToShard(shardKey, shardCount);
    return `${baseNamespace}:shard${shard}`;
  }

  /**
   * Hash key to shard number
   */
  private hashToShard(key: string, shardCount: number): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % shardCount;
  }

  /**
   * Query across all shards
   */
  async queryAcrossShards<T>(
    baseNamespace: string,
    shardCount: number,
    storage: NamespacedMemoryStorage,
    query: (storage: StorageProvider) => Promise<T[]>
  ): Promise<T[]> {
    const shardQueries: Promise<T[]>[] = [];
    
    for (let i = 0; i < shardCount; i++) {
      const namespace = `${baseNamespace}:shard${i}`;
      const shardStorage = storage.getStorage(namespace);
      shardQueries.push(query(shardStorage));
    }
    
    const results = await Promise.all(shardQueries);
    return results.flat();
  }
}