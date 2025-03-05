/**
 * @fileoverview Enhanced SecureStorage implementation with Web Crypto API, HMAC, and retry handling.
 * Provides secure client-side storage for sensitive data like API keys.
 */

import { createError, ErrorCode } from '../errors/index';

interface StorageData {
  data: string;      // Encrypted data
  hmac: string;      // HMAC for tampering detection
  version: string;   // Storage format version
  timestamp: number; // Creation timestamp
}

interface StorageKey {
  key: CryptoKey;
  hmacKey: CryptoKey;
}

/**
 * Enhanced SecureStorage class for client-side encryption
 */
export class SecureStorage {
  private static readonly STORAGE_VERSION = '1.0';
  private static readonly MAX_RETRIES = 3;
  private static readonly KEY_ALGORITHM = { name: 'AES-GCM', length: 256 };
  private static readonly HMAC_ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };
  private static instance: SecureStorage;

  private retryCount: Map<string, number> = new Map();
  private keys: Map<string, StorageKey> = new Map();

  private constructor(private readonly namespace: string = 'agentdock') {}

  /**
   * Get the singleton instance of SecureStorage
   */
  static getInstance(namespace: string = 'agentdock'): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage(namespace);
    }
    return SecureStorage.instance;
  }

  /**
   * Reset all storage and keys
   * Use this when storage becomes corrupted
   */
  async reset(key?: string): Promise<void> {
    try {
      if (key) {
        // Clear specific key
        this.keys.delete(key);
        this.retryCount.delete(key);
        localStorage.removeItem(this.getStorageKey(key));
        localStorage.removeItem(`${this.namespace}:keys:${key}`);
      } else {
        // Clear all keys and data for this namespace
        const prefix = `${this.namespace}:`;
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key?.startsWith(prefix)) {
            localStorage.removeItem(key);
          }
        }

        // Clear in-memory state
        this.keys.clear();
        this.retryCount.clear();

        // Reset the instance to force new key generation
        SecureStorage.instance = new SecureStorage(this.namespace);
      }
    } catch (error) {
      throw createError('storage', 'Failed to reset storage', ErrorCode.STORAGE_DELETE, {
        operation: 'reset',
        cause: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Store data securely with encryption and HMAC
   */
  async set(key: string, value: unknown): Promise<void> {
    try {
      // Generate or retrieve encryption keys
      const storageKey = await this.getOrCreateKeys(key);
      
      // Prepare data for storage
      const data = JSON.stringify(value);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt data
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        storageKey.key,
        new TextEncoder().encode(data)
      );

      // Calculate HMAC
      const hmac = await this.calculateHMAC(
        new Uint8Array(encryptedData).buffer,
        storageKey.hmacKey
      );

      // Prepare storage object
      const storageData: StorageData = {
        data: this.arrayBufferToBase64(encryptedData),
        hmac: this.arrayBufferToBase64(hmac),
        version: SecureStorage.STORAGE_VERSION,
        timestamp: Date.now()
      };

      // Store with namespace and IV
      localStorage.setItem(
        this.getStorageKey(key),
        JSON.stringify({
          ...storageData,
          iv: this.arrayBufferToBase64(iv.buffer)
        })
      );

      // Reset retry count on successful operation
      this.retryCount.delete(key);

    } catch (error) {
      throw createError('storage', 'Failed to store data securely', ErrorCode.STORAGE_WRITE, {
        operation: 'write',
        key,
        cause: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Retrieve and decrypt data with HMAC verification
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Get stored data
      const stored = localStorage.getItem(this.getStorageKey(key));
      if (!stored) return null;

      // Parse stored data
      const { data, hmac, iv, version } = JSON.parse(stored);
      
      // Version check
      if (version !== SecureStorage.STORAGE_VERSION) {
        throw createError('storage', 'Incompatible storage version', ErrorCode.STORAGE_READ, {
          key,
          version
        });
      }

      // Retry check
      const retries = this.retryCount.get(key) || 0;
      if (retries >= SecureStorage.MAX_RETRIES) {
        throw createError('storage', 'Maximum retry attempts exceeded', ErrorCode.MAX_RETRIES_EXCEEDED, {
          key,
          maxRetries: SecureStorage.MAX_RETRIES
        });
      }

      // Get keys
      const storageKey = await this.getOrCreateKeys(key);

      // Verify HMAC
      const storedData = this.base64ToArrayBuffer(data);
      const calculatedHmac = await this.calculateHMAC(
        storedData,
        storageKey.hmacKey
      );

      if (!this.compareHMAC(
        calculatedHmac,
        this.base64ToArrayBuffer(hmac)
      )) {
        // Force complete key regeneration
        await this.reset(key);
        throw createError('storage', 'Data tampering detected', ErrorCode.TAMPERING_DETECTED, {
          key
        });
      }

      try {
        // Decrypt data
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: this.base64ToArrayBuffer(iv) },
          storageKey.key,
          storedData
        );

        // Parse and return
        const result = JSON.parse(new TextDecoder().decode(decrypted));
        
        // Reset retry count on success
        this.retryCount.delete(key);
        
        return result as T;
      } catch (error) {
        // Increment retry count for decryption errors
        const retries = (this.retryCount.get(key) || 0) + 1;
        this.retryCount.set(key, retries);

        if (error instanceof Error && error.name === 'SecurityError') {
          this.clearKeys(key);
        }

        throw error; // Re-throw to be caught by outer try-catch
      }

    } catch (error) {
      if (error instanceof Error) {
        // If it's already one of our errors, re-throw it
        if ('code' in error && typeof error.code === 'string') {
          throw error;
        }
        
        // Otherwise, wrap it in a storage error
        throw createError('storage', 'Failed to retrieve data', ErrorCode.STORAGE_READ, {
          operation: 'read',
          key,
          retries: this.retryCount.get(key) || 0,
          cause: error.message
        });
      }
      throw error;
    }
  }

  /**
   * Remove data and associated keys
   */
  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.getStorageKey(key));
      this.clearKeys(key);
      this.retryCount.delete(key);
    } catch (error) {
      throw createError('storage', 'Failed to remove data', ErrorCode.STORAGE_DELETE, {
        operation: 'delete',
        key,
        cause: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clear all stored data and keys
   */
  async clear(): Promise<void> {
    try {
      // Clear only items in our namespace
      const prefix = `${this.namespace}:`;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      }
      this.keys.clear();
      this.retryCount.clear();
    } catch (error) {
      throw createError('storage', 'Failed to clear storage', ErrorCode.STORAGE_DELETE, {
        operation: 'clear',
        cause: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get or create encryption and HMAC keys for a storage key
   */
  private async getOrCreateKeys(key: string): Promise<StorageKey> {
    // First check if keys exist in memory
    if (!this.keys.has(key)) {
      // Try to load persisted keys from localStorage
      try {
        const persistedKeysKey = `${this.namespace}:keys:${key}`;
        const persistedKeys = localStorage.getItem(persistedKeysKey);
        
        if (persistedKeys) {
          const { encKey, hmacKey } = JSON.parse(persistedKeys);
          
          // Import the persisted keys
          const importedEncKey = await crypto.subtle.importKey(
            'jwk',
            JSON.parse(encKey),
            SecureStorage.KEY_ALGORITHM,
            true,
            ['encrypt', 'decrypt']
          );
          
          const importedHmacKey = await crypto.subtle.importKey(
            'jwk',
            JSON.parse(hmacKey),
            SecureStorage.HMAC_ALGORITHM,
            true,
            ['sign', 'verify']
          );
          
          // Store the imported keys in memory
          const storageKey: StorageKey = { 
            key: importedEncKey, 
            hmacKey: importedHmacKey 
          };
          this.keys.set(key, storageKey);
          
          console.log(`Successfully loaded persisted keys for ${key}`);
          return storageKey;
        }
      } catch (error) {
        console.warn('Failed to load persisted keys, generating new ones:', error);
      }
      
      // If no persisted keys or loading failed, generate new keys
      const encryptionKey = await crypto.subtle.generateKey(
        SecureStorage.KEY_ALGORITHM,
        true,
        ['encrypt', 'decrypt']
      ) as CryptoKey;

      const hmacKey = await crypto.subtle.generateKey(
        SecureStorage.HMAC_ALGORITHM,
        true,
        ['sign', 'verify']
      ) as CryptoKey;

      const storageKey: StorageKey = { key: encryptionKey, hmacKey };
      this.keys.set(key, storageKey);
      
      // Export and persist the new keys
      try {
        const exportedEncKey = await crypto.subtle.exportKey('jwk', encryptionKey);
        const exportedHmacKey = await crypto.subtle.exportKey('jwk', hmacKey);
        
        localStorage.setItem(`${this.namespace}:keys:${key}`, JSON.stringify({
          encKey: JSON.stringify(exportedEncKey),
          hmacKey: JSON.stringify(exportedHmacKey)
        }));
      } catch (error) {
        console.warn('Failed to persist encryption keys:', error);
      }

      return storageKey;
    }

    return this.keys.get(key)!;
  }

  /**
   * Calculate HMAC for data
   */
  private async calculateHMAC(data: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
    return crypto.subtle.sign(
      SecureStorage.HMAC_ALGORITHM,
      key,
      data
    );
  }

  /**
   * Compare HMACs in constant time
   */
  private compareHMAC(a: ArrayBuffer, b: ArrayBuffer): boolean {
    if (a.byteLength !== b.byteLength) return false;
    const aView = new Uint8Array(a);
    const bView = new Uint8Array(b);
    let result = 0;
    for (let i = 0; i < a.byteLength; i++) {
      result |= aView[i] ^ bView[i];
    }
    return result === 0;
  }

  /**
   * Clear encryption and HMAC keys for a storage key
   */
  private clearKeys(key: string): void {
    // Clear in-memory keys
    this.keys.delete(key);
    
    // Clear persisted keys from localStorage
    const persistedKeysKey = `${this.namespace}:keys:${key}`;
    localStorage.removeItem(persistedKeysKey);
    
    // Also clear the stored data since we can't decrypt it anymore
    localStorage.removeItem(this.getStorageKey(key));
    
    // Reset retry count
    this.retryCount.delete(key);
  }

  /**
   * Get namespaced storage key
   */
  private getStorageKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  /**
   * Convert ArrayBuffer to Base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
} 