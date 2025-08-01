/**
 * @fileoverview Tests for SecureStorage implementation
 */

import { ErrorCode } from '../../errors';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  mockCrypto,
  mockLocalStorage
} from '../../test/setup';
import { SecureStorage } from '../secure-storage';

describe('SecureStorage', () => {
  let storage: SecureStorage;
  const testKey = 'test-key';
  const testValue = { foo: 'bar' };

  beforeEach(() => {
    storage = SecureStorage.getInstance('test');
    jest.clearAllMocks();

    // Setup default mock implementations
    mockCrypto.subtle.generateKey.mockImplementation(async () => ({
      type: 'secret',
      extractable: true,
      algorithm: { name: 'AES-GCM' },
      usages: ['encrypt', 'decrypt']
    }));

    mockCrypto.subtle.encrypt.mockImplementation(
      async () => new ArrayBuffer(32)
    );
    mockCrypto.subtle.decrypt.mockImplementation(async () =>
      new TextEncoder().encode(JSON.stringify(testValue))
    );
    mockCrypto.subtle.sign.mockImplementation(async () => new ArrayBuffer(32));
    mockCrypto.getRandomValues.mockImplementation(() => new Uint8Array(12));
  });

  describe('set', () => {
    it('should encrypt and store data with HMAC', async () => {
      await storage.set(testKey, testValue);

      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledTimes(2); // Encryption key + HMAC key
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalledTimes(1);
      expect(mockCrypto.subtle.sign).toHaveBeenCalledTimes(1);
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
    });

    it('should handle encryption errors', async () => {
      mockCrypto.subtle.encrypt.mockRejectedValueOnce(
        new Error('Encryption failed')
      );

      await expect(storage.set(testKey, testValue)).rejects.toMatchObject({
        code: ErrorCode.STORAGE_WRITE
      });
    });

    it('should handle invalid data', async () => {
      const circularRef: any = {};
      circularRef.self = circularRef;

      await expect(storage.set(testKey, circularRef)).rejects.toMatchObject({
        code: ErrorCode.STORAGE_WRITE
      });
    });
  });

  describe('get', () => {
    const mockStoredData = {
      data: arrayBufferToBase64(new ArrayBuffer(32)),
      hmac: arrayBufferToBase64(new ArrayBuffer(32)),
      iv: arrayBufferToBase64(new ArrayBuffer(12)),
      version: '1.0',
      timestamp: Date.now()
    };

    beforeEach(() => {
      mockLocalStorage.getItem.mockImplementation(() =>
        JSON.stringify(mockStoredData)
      );
    });

    it('should decrypt and verify stored data', async () => {
      const result = await storage.get(testKey);

      expect(result).toEqual(testValue);
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalledTimes(1);
      expect(mockCrypto.subtle.sign).toHaveBeenCalledTimes(1);
    });

    it('should return null for non-existent key', async () => {
      mockLocalStorage.getItem.mockReturnValueOnce(null);

      const result = await storage.get(testKey);
      expect(result).toBeNull();
    });

    it('should handle decryption errors', async () => {
      mockCrypto.subtle.decrypt.mockRejectedValueOnce(
        new Error('Decryption failed')
      );

      await expect(storage.get(testKey)).rejects.toMatchObject({
        code: ErrorCode.STORAGE_READ
      });
    });

    it('should handle tampering detection', async () => {
      // Simulate different HMAC value
      mockCrypto.subtle.sign.mockImplementationOnce(
        async () => new ArrayBuffer(16)
      );

      await expect(storage.get(testKey)).rejects.toMatchObject({
        code: ErrorCode.TAMPERING_DETECTED
      });
    });

    it('should enforce retry limit', async () => {
      mockCrypto.subtle.decrypt.mockRejectedValue(
        new Error('Decryption failed')
      );

      // Attempt multiple times
      for (let i = 0; i < 3; i++) {
        await expect(storage.get(testKey)).rejects.toMatchObject({
          code: ErrorCode.STORAGE_READ
        });
      }

      // Next attempt should fail with MAX_RETRIES_EXCEEDED
      await expect(storage.get(testKey)).rejects.toMatchObject({
        code: ErrorCode.MAX_RETRIES_EXCEEDED
      });
    });

    it('should handle version mismatch', async () => {
      mockLocalStorage.getItem.mockImplementationOnce(() =>
        JSON.stringify({ ...mockStoredData, version: '0.9' })
      );

      await expect(storage.get(testKey)).rejects.toMatchObject({
        code: ErrorCode.STORAGE_READ
      });
    });
  });

  describe('remove', () => {
    it('should remove stored data and keys', async () => {
      await storage.remove(testKey);

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test:test-key');
    });

    it('should handle removal errors', async () => {
      mockLocalStorage.removeItem.mockImplementationOnce(() => {
        throw new Error('Remove failed');
      });

      await expect(storage.remove(testKey)).rejects.toMatchObject({
        code: ErrorCode.STORAGE_DELETE
      });
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      mockLocalStorage.length = 2;
      mockLocalStorage.key
        .mockReturnValueOnce('test:key1')
        .mockReturnValueOnce('other:key2');
    });

    it('should clear only namespaced items', async () => {
      await storage.clear();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(1);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test:key1');
    });

    it('should handle clear errors', async () => {
      mockLocalStorage.removeItem.mockImplementationOnce(() => {
        throw new Error('Clear failed');
      });

      await expect(storage.clear()).rejects.toMatchObject({
        code: ErrorCode.STORAGE_DELETE
      });
    });
  });

  describe('key management', () => {
    beforeEach(() => {
      storage = SecureStorage.getInstance('test');
      jest.clearAllMocks();

      // Setup default mock implementations
      mockCrypto.subtle.generateKey.mockImplementation(async () => ({
        type: 'secret',
        extractable: true,
        algorithm: { name: 'AES-GCM' },
        usages: ['encrypt', 'decrypt']
      }));
      mockCrypto.subtle.encrypt.mockImplementation(
        async () => new ArrayBuffer(32)
      );
      mockCrypto.subtle.decrypt.mockImplementation(async () =>
        new TextEncoder().encode(JSON.stringify(testValue))
      );
      mockCrypto.subtle.sign.mockImplementation(
        async () => new ArrayBuffer(32)
      );
      mockCrypto.getRandomValues.mockImplementation(() => new Uint8Array(12));
    });

    it('should reuse existing keys for the same storage key', async () => {
      await storage.set(testKey, testValue);
      await storage.set(testKey, testValue);

      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledTimes(2); // Encryption + HMAC keys
    });

    it('should generate new keys after tampering detection', async () => {
      // First set operation - generates initial keys
      await storage.set(testKey, testValue);
      const initialCalls = mockCrypto.subtle.generateKey.mock.calls.length;

      // Simulate tampering detection
      mockCrypto.subtle.sign.mockImplementationOnce(
        async () => new ArrayBuffer(16)
      );

      try {
        await storage.get(testKey);
      } catch (error) {
        // Expected tampering error
      }

      // Next set operation should generate new keys
      await storage.set(testKey, testValue);
      const totalCalls = mockCrypto.subtle.generateKey.mock.calls.length;
      expect(totalCalls - initialCalls).toBe(2); // Should generate 2 new keys
    });
  });
});
