/**
 * @fileoverview Storage abstraction layer exports.
 *
 * This file exports all public APIs for the storage abstraction layer.
 */

// Export types
export * from './types';

// Export factory functions
export {
  StorageFactory,
  getStorageFactory,
  createStorageProvider,
  getDefaultStorageProvider,
} from './factory';

// Export providers
export { MemoryStorageProvider } from './providers/memory-provider';
