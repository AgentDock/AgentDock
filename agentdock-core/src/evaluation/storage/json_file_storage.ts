import type { AggregatedEvaluationResult } from '../types';
import fs from 'node:fs/promises';
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
    this.ensureDirectoryExists(path.dirname(this.resolvedFilePath)).catch(err => {
      console.error(`[JsonFileStorageProvider] Failed to ensure directory exists for ${this.resolvedFilePath}:`, err);
    });
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async saveResult(result: AggregatedEvaluationResult): Promise<void> {
    try {
      const resultString = JSON.stringify(result) + '\n';
      await fs.appendFile(this.resolvedFilePath, resultString, 'utf8');
    } catch (error) {
      console.error(`[JsonFileStorageProvider] Failed to save result to ${this.resolvedFilePath}:`, error);
      throw new Error(`Failed to save evaluation result: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 