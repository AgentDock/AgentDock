import type { AggregatedEvaluationResult } from '../types';
import fs from 'node:fs';
import path from 'node:path';

/**
 * A basic storage provider that appends results to a local JSONL file.
 * This class is intended for server-side use only due to its use of 'fs'.
 * It is NOT part of the main library exports and should be imported directly by its file path in server-side scripts.
 */
export class JsonFileStorageProvider {
  private resolvedFilePath: string;

  /**
   * Creates an instance of JsonFileStorageProvider.
   * @param options Configuration options.
   * @param options.filePath The path to the JSONL log file. Will be created if it doesn't exist.
   */
  constructor(options: { filePath: string }) {
    if (!options || !options.filePath) {
      throw new Error('[JsonFileStorageProvider] filePath is required in options.');
    }
    this.resolvedFilePath = path.resolve(options.filePath);
    
    // Ensure directory exists synchronously during construction
    try {
      this.ensureDirectoryExistsSync(path.dirname(this.resolvedFilePath));
    } catch (err: any) {
      // Re-throw error if directory creation fails, making constructor fail.
      console.error(`[JsonFileStorageProvider] Fatal: Failed to create directory for ${this.resolvedFilePath}:`, err.message);
      throw new Error(`Failed to initialize JsonFileStorageProvider (directory creation failed for ${this.resolvedFilePath}): ${err.message}`);
    }
  }

  private ensureDirectoryExistsSync(dirPath: string): void {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') { // If error is not 'already exists', then throw
        throw error;
      }
      // If error is EEXIST, directory already exists, which is fine.
    }
  }

  async saveResult(result: AggregatedEvaluationResult): Promise<void> {
    try {
      const resultString = JSON.stringify(result) + '\n';
      // Use fs.promises for the async append operation as it's not in constructor path
      await fs.promises.appendFile(this.resolvedFilePath, resultString, 'utf8');
    } catch (error) {
      console.error(`[JsonFileStorageProvider] Failed to save result to ${this.resolvedFilePath}:`, error);
      throw new Error(`Failed to save evaluation result: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 