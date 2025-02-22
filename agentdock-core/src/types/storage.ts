/**
 * @fileoverview Storage type definitions
 */

export interface StorageData {
  data: string;      // Encrypted data
  hmac: string;      // HMAC for tampering detection
  version: string;   // Storage format version
  timestamp: number; // Creation timestamp
  iv: string;        // Initialization vector
}

export interface StorageKey {
  key: CryptoKey;
  hmacKey: CryptoKey;
}

export interface StorageOptions {
  namespace?: string;
  maxRetries?: number;
  version?: string;
} 