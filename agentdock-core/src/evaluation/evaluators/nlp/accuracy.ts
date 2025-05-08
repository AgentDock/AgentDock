import { embed, type EmbeddingModel } from 'ai';
import type { EvaluationCriteria, EvaluationInput, EvaluationResult, Evaluator } from '../../types';
// We'll need a cosine similarity function. For now, a placeholder.
// Popular libraries like 'vector-math' or 'mathjs' have this, or we can implement a simple one.
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length === 0) {
    throw new Error('cosineSimilarity: vectors must be non-empty');
  }
  if (vecA.length !== vecB.length) {
    throw new Error(
      `cosineSimilarity: dimension mismatch (${vecA.length} != ${vecB.length})`,
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) {
    return 0; // Avoid division by zero
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Configuration for the NLPAccuracyEvaluator.
 */
export interface NLPAccuracyEvaluatorConfig {
  /** The name of the criterion this evaluator targets (e.g., "SemanticAccuracy"). */
  criterionName: string;
  /** The embedding model instance to use (from Vercel AI SDK). */
  embeddingModel: EmbeddingModel<string>;
  /** 
   * Optional: The minimum similarity score to be considered a "pass" if the criterion scale is binary/pass-fail.
   * Defaults to null (score is returned as is).
   */
  similarityThreshold?: number | null;
}

/**
 * Evaluates semantic accuracy by comparing embeddings of the agent's response 
 * with a ground truth reference using cosine similarity.
 */
export class NLPAccuracyEvaluator implements Evaluator {
  public readonly type = 'NLPAccuracy';
  private config: NLPAccuracyEvaluatorConfig;

  constructor(config: NLPAccuracyEvaluatorConfig) {
    if (!config.criterionName || config.criterionName.trim() === '') {
      throw new Error('[NLPAccuracyEvaluator] criterionName must be a non-empty string.');
    }
    if (!config.embeddingModel) {
      throw new Error('[NLPAccuracyEvaluator] embeddingModel must be provided.');
    }
    this.config = config;
  }

  async evaluate(input: EvaluationInput, criteria: EvaluationCriteria[]): Promise<EvaluationResult[]> {
    const targetCriterion = criteria.find(c => c.name === this.config.criterionName);

    if (!targetCriterion) {
      console.warn(`[NLPAccuracyEvaluator] Criterion "${this.config.criterionName}" not found in input.criteria. Skipping evaluation.`);
      return [];
    }

    if (!input.response) {
      return [{
        criterionName: this.config.criterionName,
        score: targetCriterion.scale === 'binary' || targetCriterion.scale === 'pass/fail' ? false : 0,
        reasoning: 'No agent response provided.',
        evaluatorType: this.type,
        error: 'Missing agent response in EvaluationInput.',
      }];
    }

    if (!input.groundTruth) {
      return [{
        criterionName: this.config.criterionName,
        score: targetCriterion.scale === 'binary' || targetCriterion.scale === 'pass/fail' ? false : 0,
        reasoning: 'No ground truth provided for comparison.',
        evaluatorType: this.type,
        error: 'Missing groundTruth in EvaluationInput.',
      }];
    }

    const responseText = typeof input.response === 'string' ? input.response : JSON.stringify(input.response); // Simple stringification for AgentMessage
    const groundTruthText = String(input.groundTruth); // Ensure groundTruth is a string

    try {
      const [responseEmbeddingResult, groundTruthEmbeddingResult] = await Promise.all([
        embed({ model: this.config.embeddingModel, value: responseText }),
        embed({ model: this.config.embeddingModel, value: groundTruthText }),
      ]);

      const similarity = cosineSimilarity(responseEmbeddingResult.embedding, groundTruthEmbeddingResult.embedding);

      let score: number | boolean = similarity;
      let reasoning = `Cosine similarity: ${similarity.toFixed(4)}.`;

      if (this.config.similarityThreshold !== null && this.config.similarityThreshold !== undefined) {
        if (targetCriterion.scale === 'binary' || targetCriterion.scale === 'pass/fail') {
          score = similarity >= this.config.similarityThreshold;
          reasoning += ` Threshold: ${this.config.similarityThreshold}. Outcome: ${score ? 'Pass' : 'Fail'}.`;
        } else {
          reasoning += ` (Note: similarityThreshold is set but criterion scale is '${targetCriterion.scale}', not binary/pass-fail. Threshold not directly applied for scoring boolean pass/fail unless scale matches.)`;
        }
      }
      
      // Ensure score matches the expected type for the scale if it's not numeric
      // For now, we'll let normalization handle it, but stricter type checking could be added
      // e.g. if scale is likert5, this raw 0-1 similarity might need adjustment or a different criterion type

      return [{
        criterionName: this.config.criterionName,
        score: score, 
        reasoning: reasoning,
        evaluatorType: this.type,
      }];

    } catch (error: any) {
      console.error(`[NLPAccuracyEvaluator] Error during embedding or similarity calculation:`, error);
      return [{
        criterionName: this.config.criterionName,
        score: targetCriterion.scale === 'binary' || targetCriterion.scale === 'pass/fail' ? false : 0,
        reasoning: `Error: ${error.message || 'Failed to calculate semantic similarity.'}`,
        evaluatorType: this.type,
        error: error.message || 'Failed to calculate semantic similarity.',
      }];
    }
  }
} 