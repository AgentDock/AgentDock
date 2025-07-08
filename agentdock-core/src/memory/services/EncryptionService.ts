import { Pool } from 'pg';

import { LogCategory, logger } from '../../logging';

export interface EncryptionConfig {
  keyManagement: 'env' | 'aws-kms' | 'vault';
  defaultKeyId?: string;
  rotationIntervalDays?: number;
}

export interface EncryptedData {
  data: string;
  keyId: string;
  algorithm: 'pgp_sym_encrypt';
  version: number;
}

export interface EncryptionKey {
  keyId: string;
  key: string;
  createdAt: Date;
  expiresAt?: Date;
  active: boolean;
}

/**
 * Production-grade encryption service using PostgreSQL's pgcrypto extension.
 * Provides column-level encryption for sensitive memory data.
 *
 * Note: PostgreSQL community edition does NOT have native TDE.
 * This service uses pgcrypto extension for field-level encryption.
 */
export class EncryptionService {
  private keys: Map<string, EncryptionKey> = new Map();
  private defaultKeyId: string;

  constructor(
    private pool: Pool,
    private config: EncryptionConfig
  ) {
    this.defaultKeyId = config.defaultKeyId || 'default';
    this.initializeEncryption();
  }

  /**
   * Initialize pgcrypto extension and setup encryption keys
   */
  async initializeEncryption(): Promise<void> {
    try {
      // Ensure pgcrypto extension is available
      await this.pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

      // Load encryption keys
      await this.loadEncryptionKeys();

      logger.info(
        LogCategory.STORAGE,
        'EncryptionService',
        'Initialized with pgcrypto extension'
      );
    } catch (error) {
      console.error('Failed to initialize encryption service:', error);
      throw new Error(
        `Encryption initialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Encrypt sensitive content using pgcrypto
   */
  async encrypt(
    plaintext: string,
    keyId: string = this.defaultKeyId
  ): Promise<EncryptedData> {
    const key = this.getKey(keyId);

    try {
      // Use pgp_sym_encrypt for AES encryption
      const result = await this.pool.query(
        'SELECT pgp_sym_encrypt($1, $2) as encrypted_data',
        [plaintext, key.key]
      );

      return {
        data: result.rows[0].encrypted_data,
        keyId,
        algorithm: 'pgp_sym_encrypt',
        version: 1
      };
    } catch (error) {
      console.error(`Encryption failed for keyId ${keyId}:`, error);
      throw new Error(
        `Failed to encrypt data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Decrypt encrypted content using pgcrypto
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    const key = this.getKey(encryptedData.keyId);

    try {
      // Use pgp_sym_decrypt for AES decryption
      const result = await this.pool.query(
        'SELECT pgp_sym_decrypt($1, $2) as decrypted_data',
        [encryptedData.data, key.key]
      );

      return result.rows[0].decrypted_data;
    } catch (error) {
      console.error(
        `Decryption failed for keyId ${encryptedData.keyId}:`,
        error
      );
      throw new Error(
        `Failed to decrypt data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Batch encrypt multiple values for performance
   */
  async batchEncrypt(
    plaintexts: string[],
    keyId: string = this.defaultKeyId
  ): Promise<EncryptedData[]> {
    const key = this.getKey(keyId);

    try {
      // Build parameterized query for batch encryption
      const values = plaintexts.map((_, idx) => `($${idx + 2}, $1)`).join(', ');
      const sql = `
        SELECT pgp_sym_encrypt(plaintext, $1) as encrypted_data, 
               row_number() OVER () as idx
        FROM (VALUES ${values}) as t(plaintext)
        ORDER BY idx
      `;

      const result = await this.pool.query(sql, [key.key, ...plaintexts]);

      return result.rows.map((row) => ({
        data: row.encrypted_data,
        keyId,
        algorithm: 'pgp_sym_encrypt' as const,
        version: 1
      }));
    } catch (error) {
      console.error(`Batch encryption failed for keyId ${keyId}:`, error);
      throw new Error(
        `Failed to batch encrypt data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Batch decrypt multiple values for performance
   */
  async batchDecrypt(encryptedData: EncryptedData[]): Promise<string[]> {
    // Group by keyId for efficient processing
    const keyGroups = new Map<string, EncryptedData[]>();

    encryptedData.forEach((data) => {
      if (!keyGroups.has(data.keyId)) {
        keyGroups.set(data.keyId, []);
      }
      keyGroups.get(data.keyId)!.push(data);
    });

    const results: string[] = new Array(encryptedData.length);

    // Process each key group
    for (const [keyId, dataGroup] of Array.from(keyGroups.entries())) {
      const key = this.getKey(keyId);

      try {
        const values = dataGroup
          .map((_, idx) => `($${idx + 2}, $1)`)
          .join(', ');
        const sql = `
          SELECT pgp_sym_decrypt(encrypted_data, $1) as decrypted_data,
                 row_number() OVER () as idx
          FROM (VALUES ${values}) as t(encrypted_data)
          ORDER BY idx
        `;

        const result = await this.pool.query(sql, [
          key.key,
          ...dataGroup.map((d) => d.data)
        ]);

        // Map results back to original positions
        result.rows.forEach((row, idx) => {
          const originalIndex = encryptedData.indexOf(dataGroup[idx]);
          results[originalIndex] = row.decrypted_data;
        });
      } catch (error) {
        console.error(`Batch decryption failed for keyId ${keyId}:`, error);
        throw new Error(
          `Failed to batch decrypt data: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return results;
  }

  /**
   * Create encrypted memory table columns
   */
  async createEncryptedColumn(
    tableName: string,
    columnName: string
  ): Promise<void> {
    try {
      // SECURITY FIX: Validate and sanitize SQL identifiers to prevent injection
      const validatedTableName = this.validateSQLIdentifier(tableName);
      const validatedColumnName = this.validateSQLIdentifier(columnName);

      // Use parameterized queries where possible, or properly escaped identifiers
      await this.pool.query(`
        ALTER TABLE ${this.escapeIdentifier(validatedTableName)}
        ADD COLUMN IF NOT EXISTS ${this.escapeIdentifier(validatedColumnName)}_encrypted BYTEA,
        ADD COLUMN IF NOT EXISTS ${this.escapeIdentifier(validatedColumnName)}_key_id TEXT,
        ADD COLUMN IF NOT EXISTS ${this.escapeIdentifier(validatedColumnName)}_algorithm TEXT DEFAULT 'pgp_sym_encrypt',
        ADD COLUMN IF NOT EXISTS ${this.escapeIdentifier(validatedColumnName)}_version INTEGER DEFAULT 1
      `);

      // Create index for key lookups - using escaped identifiers
      const indexName = `idx_${validatedTableName}_${validatedColumnName}_key_id`;
      const validatedIndexName = this.validateSQLIdentifier(indexName);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS ${this.escapeIdentifier(validatedIndexName)}
        ON ${this.escapeIdentifier(validatedTableName)}(${this.escapeIdentifier(validatedColumnName)}_key_id)
      `);

      logger.info(
        LogCategory.STORAGE,
        'EncryptionService',
        'Encrypted column added',
        {
          table: validatedTableName,
          column: validatedColumnName
        }
      );
    } catch (error) {
      console.error(`Failed to create encrypted column:`, error);
      throw new Error(
        `Failed to create encrypted column: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validate SQL identifier to prevent injection attacks.
   * Only allows alphanumeric characters and underscores.
   *
   * @private
   */
  private validateSQLIdentifier(identifier: string): string {
    if (!identifier || typeof identifier !== 'string') {
      throw new Error('SQL identifier must be a non-empty string');
    }

    // Remove any whitespace
    const trimmed = identifier.trim();

    // Check for valid identifier pattern (letters, numbers, underscores only)
    const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!validPattern.test(trimmed)) {
      throw new Error(
        `Invalid SQL identifier: "${identifier}". Only alphanumeric characters and underscores are allowed.`
      );
    }

    // Check length constraints
    if (trimmed.length > 63) {
      throw new Error(
        `SQL identifier too long: "${identifier}". Maximum 63 characters allowed.`
      );
    }

    // Check against reserved words (basic PostgreSQL reserved words)
    const reservedWords = [
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'DROP',
      'CREATE',
      'ALTER',
      'TABLE',
      'INDEX',
      'VIEW',
      'TRIGGER',
      'FUNCTION',
      'PROCEDURE',
      'DATABASE',
      'SCHEMA',
      'USER',
      'ROLE',
      'GRANT',
      'REVOKE',
      'AND',
      'OR',
      'NOT',
      'NULL',
      'TRUE',
      'FALSE'
    ];

    if (reservedWords.includes(trimmed.toUpperCase())) {
      throw new Error(
        `Cannot use reserved word as identifier: "${identifier}"`
      );
    }

    return trimmed;
  }

  /**
   * Escape SQL identifier by wrapping in double quotes.
   * This prevents injection while allowing the identifier to be used safely.
   *
   * @private
   */
  private escapeIdentifier(identifier: string): string {
    // Double any existing double quotes to escape them
    const escaped = identifier.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  /**
   * Rotate encryption keys for enhanced security
   */
  async rotateKey(keyId: string): Promise<string> {
    try {
      const newKeyId = `${keyId}_${Date.now()}`;
      const newKey = await this.generateKey();

      // Store new key
      this.keys.set(newKeyId, {
        keyId: newKeyId,
        key: newKey,
        createdAt: new Date(),
        active: true
      });

      // Mark old key as inactive
      const oldKey = this.keys.get(keyId);
      if (oldKey) {
        oldKey.active = false;
        oldKey.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      }

      // Update default key if rotating default
      if (keyId === this.defaultKeyId) {
        this.defaultKeyId = newKeyId;
      }

      logger.info(LogCategory.STORAGE, 'EncryptionService', 'Key rotated', {
        oldKeyId: keyId,
        newKeyId: newKeyId
      });
      return newKeyId;
    } catch (error) {
      console.error(`Key rotation failed for ${keyId}:`, error);
      throw new Error(
        `Failed to rotate key: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get memory encryption stats for monitoring
   */
  async getEncryptionStats(): Promise<{
    totalKeys: number;
    activeKeys: number;
    expiredKeys: number;
    defaultKeyId: string;
  }> {
    const now = new Date();

    return {
      totalKeys: this.keys.size,
      activeKeys: Array.from(this.keys.values()).filter((k) => k.active).length,
      expiredKeys: Array.from(this.keys.values()).filter(
        (k) => k.expiresAt && k.expiresAt < now
      ).length,
      defaultKeyId: this.defaultKeyId
    };
  }

  /**
   * Load encryption keys from configured source
   */
  private async loadEncryptionKeys(): Promise<void> {
    switch (this.config.keyManagement) {
      case 'env':
        await this.loadFromEnvironment();
        break;
      case 'aws-kms':
        await this.loadFromAWSKMS();
        break;
      case 'vault':
        await this.loadFromVault();
        break;
      default:
        throw new Error(
          `Unsupported key management: ${this.config.keyManagement}`
        );
    }
  }

  /**
   * Load keys from environment variables
   */
  private async loadFromEnvironment(): Promise<void> {
    const defaultKey = process.env.MEMORY_ENCRYPTION_KEY;
    if (!defaultKey) {
      throw new Error('MEMORY_ENCRYPTION_KEY environment variable required');
    }

    this.keys.set(this.defaultKeyId, {
      keyId: this.defaultKeyId,
      key: defaultKey,
      createdAt: new Date(),
      active: true
    });
  }

  /**
   * Load keys from AWS KMS (placeholder for future implementation)
   */
  private async loadFromAWSKMS(): Promise<void> {
    // TODO: Implement AWS KMS integration
    throw new Error('AWS KMS integration not yet implemented');
  }

  /**
   * Load keys from HashiCorp Vault (placeholder for future implementation)
   */
  private async loadFromVault(): Promise<void> {
    // TODO: Implement Vault integration
    throw new Error('Vault integration not yet implemented');
  }

  /**
   * Generate a new encryption key
   */
  private async generateKey(): Promise<string> {
    // Use PostgreSQL's gen_random_bytes for cryptographically strong key
    const result = await this.pool.query(
      "SELECT encode(gen_random_bytes(32), 'base64') as key"
    );
    return result.rows[0].key;
  }

  /**
   * Get encryption key by ID
   */
  private getKey(keyId: string): EncryptionKey {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Encryption key not found: ${keyId}`);
    }
    if (!key.active) {
      throw new Error(`Encryption key is inactive: ${keyId}`);
    }
    return key;
  }
}
