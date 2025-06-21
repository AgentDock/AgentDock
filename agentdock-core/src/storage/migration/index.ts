/**
 * Storage migration tool for moving data between different storage providers
 */

import { LogCategory, logger } from '../../logging';
import { StorageProvider } from '../types';

export interface MigrationOptions {
  /** Batch size for transferring data */
  batchSize?: number;
  /** Whether to clear destination before migration */
  clearDestination?: boolean;
  /** Namespaces to migrate (undefined = all) */
  namespaces?: string[];
  /** Progress callback */
  onProgress?: (progress: MigrationProgress) => void;
  /** Whether to verify data after migration */
  verify?: boolean;
  /** Prefix filter for keys to migrate */
  prefixFilter?: string;
}

export interface MigrationProgress {
  /** Total keys to migrate */
  total: number;
  /** Keys migrated so far */
  migrated: number;
  /** Keys failed to migrate */
  failed: number;
  /** Current phase */
  phase: 'scanning' | 'migrating' | 'verifying' | 'complete';
  /** Percentage complete */
  percentage: number;
  /** Current namespace being processed */
  currentNamespace?: string;
}

export interface MigrationResult {
  /** Total keys migrated */
  totalMigrated: number;
  /** Total keys failed */
  totalFailed: number;
  /** Failed keys with errors */
  failedKeys: Array<{ key: string; error: string }>;
  /** Time taken in milliseconds */
  duration: number;
  /** Whether verification passed (if enabled) */
  verificationPassed?: boolean;
}

/**
 * Migrate data between storage providers
 */
export class StorageMigrator {
  constructor(
    private source: StorageProvider,
    private destination: StorageProvider
  ) {}

  /**
   * Migrate all data from source to destination
   */
  async migrate(options: MigrationOptions = {}): Promise<MigrationResult> {
    const {
      batchSize = 100,
      clearDestination = false,
      namespaces,
      onProgress,
      verify = false,
      prefixFilter = ''
    } = options;

    const startTime = Date.now();
    const result: MigrationResult = {
      totalMigrated: 0,
      totalFailed: 0,
      failedKeys: [],
      duration: 0
    };

    try {
      // Clear destination if requested
      if (clearDestination) {
        logger.info(
          LogCategory.STORAGE,
          'StorageMigrator',
          'Clearing destination storage'
        );
        await this.destination.clear();
      }

      // Get namespaces to migrate
      const namespacesToMigrate = namespaces || [undefined]; // undefined = default namespace

      let totalKeys = 0;
      const allKeys: Array<{ key: string; namespace?: string }> = [];

      // Phase 1: Scan all keys
      this.reportProgress(onProgress, {
        total: 0,
        migrated: 0,
        failed: 0,
        phase: 'scanning',
        percentage: 0
      });

      for (const namespace of namespacesToMigrate) {
        const keys = await this.source.list(prefixFilter, { namespace });
        totalKeys += keys.length;

        for (const key of keys) {
          allKeys.push({ key, namespace });
        }

        logger.debug(
          LogCategory.STORAGE,
          'StorageMigrator',
          'Scanned namespace',
          {
            namespace: namespace || 'default',
            keys: keys.length
          }
        );
      }

      // Phase 2: Migrate data
      for (let i = 0; i < allKeys.length; i += batchSize) {
        const batch = allKeys.slice(i, i + batchSize);

        for (const { key, namespace } of batch) {
          try {
            // Get value from source
            const value = await this.source.get(key, { namespace });

            if (value !== null) {
              // Set value in destination
              await this.destination.set(key, value, { namespace });
              result.totalMigrated++;
            }
          } catch (error) {
            result.totalFailed++;
            result.failedKeys.push({
              key: namespace ? `${namespace}:${key}` : key,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }

        // Report progress
        this.reportProgress(onProgress, {
          total: totalKeys,
          migrated: result.totalMigrated,
          failed: result.totalFailed,
          phase: 'migrating',
          percentage: Math.round(((i + batch.length) / totalKeys) * 100),
          currentNamespace: batch[0]?.namespace
        });
      }

      // Phase 3: Migrate lists
      for (const namespace of namespacesToMigrate) {
        // Get all list keys (this is adapter-specific, so we try common patterns)
        const listKeys = await this.findListKeys(namespace);

        for (const listKey of listKeys) {
          try {
            const list = await this.source.getList(
              listKey,
              undefined,
              undefined,
              { namespace }
            );
            if (list) {
              await this.destination.saveList(listKey, list, { namespace });
              result.totalMigrated++;
            }
          } catch (error) {
            result.totalFailed++;
            result.failedKeys.push({
              key: namespace
                ? `${namespace}:list:${listKey}`
                : `list:${listKey}`,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      // Phase 4: Verify if requested
      if (verify) {
        this.reportProgress(onProgress, {
          total: totalKeys,
          migrated: result.totalMigrated,
          failed: result.totalFailed,
          phase: 'verifying',
          percentage: 100
        });

        result.verificationPassed = await this.verifyMigration(allKeys);
      }

      result.duration = Date.now() - startTime;

      // Final progress report
      this.reportProgress(onProgress, {
        total: totalKeys,
        migrated: result.totalMigrated,
        failed: result.totalFailed,
        phase: 'complete',
        percentage: 100
      });

      logger.info(
        LogCategory.STORAGE,
        'StorageMigrator',
        'Migration complete',
        {
          totalMigrated: result.totalMigrated,
          totalFailed: result.totalFailed,
          duration: `${result.duration}ms`,
          verificationPassed: result.verificationPassed
        }
      );

      return result;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'StorageMigrator', 'Migration failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Verify that migration was successful
   */
  private async verifyMigration(
    keys: Array<{ key: string; namespace?: string }>
  ): Promise<boolean> {
    let verified = true;

    for (const { key, namespace } of keys) {
      const sourceValue = await this.source.get(key, { namespace });
      const destValue = await this.destination.get(key, { namespace });

      if (JSON.stringify(sourceValue) !== JSON.stringify(destValue)) {
        logger.warn(
          LogCategory.STORAGE,
          'StorageMigrator',
          'Verification failed',
          {
            key,
            namespace
          }
        );
        verified = false;
      }
    }

    return verified;
  }

  /**
   * Find list keys (adapter-specific patterns)
   */
  private async findListKeys(namespace?: string): Promise<string[]> {
    // Try common patterns for list keys
    const patterns = ['list:', 'lists:', '_list_'];
    const listKeys: Set<string> = new Set();

    for (const pattern of patterns) {
      try {
        const keys = await this.source.list(pattern, { namespace });
        keys.forEach((key: string) => listKeys.add(key));
      } catch {
        // Ignore errors for unsupported patterns
      }
    }

    return Array.from(listKeys);
  }

  /**
   * Report progress
   */
  private reportProgress(
    onProgress: ((progress: MigrationProgress) => void) | undefined,
    progress: MigrationProgress
  ): void {
    if (onProgress) {
      onProgress(progress);
    }
  }
}

/**
 * Create a storage migrator
 */
export function createMigrator(
  source: StorageProvider,
  destination: StorageProvider
): StorageMigrator {
  return new StorageMigrator(source, destination);
}
