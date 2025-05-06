import type { EvaluationStorageProvider, AggregatedEvaluationResult } from '../types';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * A basic EvaluationStorageProvider that appends results to a local JSON file.
 * Note: This is not suitable for high-throughput or production environments
 * due to potential race conditions and lack of scalability.
 */
export class JsonFileStorageProvider implements EvaluationStorageProvider {
  private resolvedFilePath: string;

  /**
   * Creates an instance of JsonFileStorageProvider.
   * @param filePath The path to the JSON log file. Will be created if it doesn't exist.
   */
  constructor(filePath: string = './evaluation_results.log') {
    this.resolvedFilePath = path.resolve(filePath);
    // Ensure directory exists during initialization (or handle error)
    this.ensureDirectoryExists(path.dirname(this.resolvedFilePath)).catch(err => {
      console.error(`[JsonFileStorageProvider] Failed to ensure directory exists for ${this.resolvedFilePath}:`, err);
    });
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') { // Ignore error if directory already exists
        throw error;
      }
    }
  }

  async saveResult(result: AggregatedEvaluationResult): Promise<void> {
    try {
      const resultString = JSON.stringify(result) + '\n'; // Append newline for line-based reading
      await fs.appendFile(this.resolvedFilePath, resultString, 'utf8');
    } catch (error) {
      console.error(`[JsonFileStorageProvider] Failed to save result to ${this.resolvedFilePath}:`, error);
      // Re-throw or handle as appropriate for the application context
      throw new Error(`Failed to save evaluation result: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 