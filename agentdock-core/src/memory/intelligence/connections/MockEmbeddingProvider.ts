/**
 * Mock embedding provider for testing and development
 * Generates semantically meaningful embeddings based on word overlap and semantic features
 */
import type { EmbeddingModel } from 'ai';

export class MockEmbeddingProvider implements EmbeddingModel<string> {
  readonly specificationVersion = 'v1';
  readonly provider = 'mock';
  readonly modelId = 'mock-embedding-model';
  readonly maxEmbeddingValues = 1;
  readonly maxEmbeddingsPerCall = 100;
  readonly supportsParallelCalls = true;

  private mockEmbeddings = new Map<string, number[]>();
  private semanticWords = {
    // Programming concepts
    programming: [
      'programming',
      'coding',
      'development',
      'software',
      'code',
      'script',
      'algorithm'
    ],
    web: [
      'web',
      'website',
      'frontend',
      'backend',
      'server',
      'client',
      'browser',
      'html',
      'css'
    ],
    languages: [
      'python',
      'javascript',
      'typescript',
      'java',
      'c++',
      'rust',
      'go'
    ],
    frameworks: [
      'react',
      'angular',
      'vue',
      'django',
      'flask',
      'express',
      'node'
    ],
    data: ['data', 'database', 'sql', 'mongodb', 'redis', 'storage', 'cache'],
    ai: [
      'ai',
      'machine learning',
      'neural',
      'deep learning',
      'model',
      'training'
    ],

    // Food/cooking concepts
    cooking: [
      'cooking',
      'recipe',
      'food',
      'kitchen',
      'chef',
      'cuisine',
      'meal'
    ],
    italian: ['italian', 'pasta', 'pizza', 'mediterranean', 'rome', 'italy'],

    // General concepts
    temporal: [
      'before',
      'after',
      'then',
      'next',
      'sequence',
      'time',
      'when',
      'during'
    ],
    similar: ['similar', 'like', 'same', 'comparable', 'equivalent', 'related'],
    causation: [
      'causes',
      'because',
      'leads to',
      'results in',
      'triggers',
      'due to'
    ]
  };

  constructor(private dimensions: number = 1536) {}

  async doEmbed(options: {
    values: string[];
  }): Promise<{ embeddings: number[][] }> {
    const embeddings = options.values.map((value) => {
      // Generate deterministic embeddings based on content
      const cached = this.mockEmbeddings.get(value);
      if (cached) return cached;

      const embedding = this.generateSemanticEmbedding(value);
      this.mockEmbeddings.set(value, embedding);
      return embedding;
    });

    return { embeddings };
  }

  private generateSemanticEmbedding(content: string): number[] {
    const words = this.extractWords(content);
    const embedding = new Array(this.dimensions).fill(0);

    // Generate base vector with some randomness for uniqueness
    const contentHash = this.simpleHash(content);
    for (let i = 0; i < this.dimensions; i++) {
      embedding[i] = ((contentHash + i) % 1000) / 5000 - 0.1; // Small base values
    }

    // Add semantic features based on word categories
    let featureIndex = 0;
    for (const [category, categoryWords] of Object.entries(
      this.semanticWords
    )) {
      const overlap = this.calculateWordOverlap(words, categoryWords);
      if (overlap > 0) {
        // Add strong semantic signal for this category
        for (let i = 0; i < 50 && featureIndex + i < this.dimensions; i++) {
          embedding[featureIndex + i] += overlap * 0.8; // Strong semantic signal
        }
      }
      featureIndex += 50; // Move to next semantic region
      if (featureIndex >= this.dimensions) break;
    }

    // Normalize the embedding vector
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] = embedding[i] / magnitude;
      }
    }

    return embedding;
  }

  private extractWords(content: string): string[] {
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2);
  }

  private calculateWordOverlap(
    contentWords: string[],
    categoryWords: string[]
  ): number {
    let overlap = 0;
    for (const word of contentWords) {
      for (const categoryWord of categoryWords) {
        if (word.includes(categoryWord) || categoryWord.includes(word)) {
          overlap += 1;
        }
      }
    }
    return Math.min(overlap / Math.max(contentWords.length, 1), 1.0);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
