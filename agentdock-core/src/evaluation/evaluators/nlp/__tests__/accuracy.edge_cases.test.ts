import { NLPAccuracyEvaluator, type NLPAccuracyEvaluatorConfig } from '../accuracy';
import { type EvaluationResult, type EvaluationInput, type EvaluationCriteria } from '../../../types';
import { type Message as AgentMessage } from '../../../../types/messages';
import { embed, type EmbeddingModel } from 'ai';

// Mock the 'ai' module
jest.mock('ai', () => ({
  ...jest.requireActual('ai'),
  embed: jest.fn(),
}));
const mockEmbed = embed as jest.Mock;

// Function to calculate cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

describe('NLPAccuracyEvaluator - Edge Cases (Empty/Null Inputs)', () => {
  let evaluator: NLPAccuracyEvaluator;
  const evaluatorConfig: NLPAccuracyEvaluatorConfig = {
    criterionName: 'SemanticSimilarityEdgeCases',
    embeddingModel: 'text-embedding-3-small' as unknown as EmbeddingModel<string>,
    similarityThreshold: 0.8,
  };

  beforeEach(() => {
    mockEmbed.mockClear();
    evaluator = new NLPAccuracyEvaluator(evaluatorConfig);
  });

  const mockEmbedding = (text: string): number[] => {
    const arr = Array(10).fill(0);
    if (text === '') return arr;
    for (let i = 0; i < Math.min(text.length, 10); i++) {
      arr[i] = (text.charCodeAt(i) / 128) - 0.5;
    }
    const magnitude = Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0 && text.length > 0) return arr.map(() => 0.1);
    if (magnitude === 0) return arr;
    return arr.map(x => x / (magnitude || 1));
  };

  const createTestInput = (
    response: string | AgentMessage,
    groundTruth: string | AgentMessage | undefined | null,
    criterionScale: 'binary' | 'numeric' | 'pass/fail' = 'binary'
  ): EvaluationInput => {
    const criteria: EvaluationCriteria[] = [{
      name: evaluatorConfig.criterionName,
      description: 'Test criterion for edge cases',
      scale: criterionScale,
    }];
    return {
      response,
      groundTruth,
      criteria,
    };
  };

  it('should handle empty response string (similarity 0, score false for binary)', async () => {
    const gtText = 'This is the ground truth text.';
    const embeddingEmpty = mockEmbedding('');
    const embeddingGt = mockEmbedding(gtText);
    mockEmbed
      .mockResolvedValueOnce({ embedding: embeddingEmpty, usage: { promptTokens: 1, totalTokens: 1 } })
      .mockResolvedValueOnce({ embedding: embeddingGt, usage: { promptTokens: 1, totalTokens: 1 } });
    
    const input = createTestInput('', gtText);
    const results = await evaluator.evaluate(input, input.criteria!);
    expect(results.length).toBe(1);
    const result = results[0];
    expect(result.score).toBe(false); // Cosine with zero vector is 0, 0 < 0.8 -> false
    expect(result.reasoning).toContain('Cosine similarity: 0.0000.');
    expect(result.reasoning).toContain(`Threshold: ${evaluatorConfig.similarityThreshold}. Outcome: Fail.`);
    expect(result.error).toBeUndefined();
  });

  it('should handle empty groundTruth string (similarity 0, score false for binary)', async () => {
    const respText = 'This is the response text.';
    const embeddingResp = mockEmbedding(respText);
    const embeddingEmpty = mockEmbedding('');
    mockEmbed
      .mockResolvedValueOnce({ embedding: embeddingResp, usage: { promptTokens: 1, totalTokens: 1 } })
      .mockResolvedValueOnce({ embedding: embeddingEmpty, usage: { promptTokens: 1, totalTokens: 1 } });

    const input = createTestInput(respText, '');
    const results = await evaluator.evaluate(input, input.criteria!);
    expect(results.length).toBe(1);
    const result = results[0];
    expect(result.score).toBe(false);
    expect(result.reasoning).toContain('Cosine similarity: 0.0000.');
    expect(result.error).toBeUndefined();
  });

  it('should handle both response and groundTruth being empty (similarity 0, score false for binary)', async () => {
    // Current cosineSimilarity([0,..],[0,..]) returns 0.
    const embeddingEmpty1 = mockEmbedding('');
    const embeddingEmpty2 = mockEmbedding('');

    mockEmbed
      .mockResolvedValueOnce({ embedding: embeddingEmpty1, usage: { promptTokens: 1, totalTokens: 1 } })
      .mockResolvedValueOnce({ embedding: embeddingEmpty2, usage: { promptTokens: 1, totalTokens: 1 } });

    const input = createTestInput('', '');
    const results = await evaluator.evaluate(input, input.criteria!);
    expect(results.length).toBe(1);
    const result = results[0];
    expect(result.score).toBe(false); // Similarity is 0, 0 < 0.8 -> false
    expect(result.reasoning).toContain('Cosine similarity: 0.0000.');
  });

  it('should return error if groundTruth is undefined (as per accuracy.ts logic)', async () => {
    const inputUndefined = createTestInput('Some response', undefined);
    const results = await evaluator.evaluate(inputUndefined, inputUndefined.criteria!);
    expect(results.length).toBe(1);
    const result = results[0];
    expect(result.score).toBe(false); // Default error score for binary scale
    expect(result.reasoning).toContain('No ground truth provided for comparison.');
    expect(result.error).toContain('Missing groundTruth in EvaluationInput.');
    expect(mockEmbed).toHaveBeenCalledTimes(0); // Should not call embed
  });

  it('should return error if groundTruth is null (as per accuracy.ts logic)', async () => {
    const inputNull = createTestInput('Some response', null);
    const results = await evaluator.evaluate(inputNull, inputNull.criteria!);
    expect(results.length).toBe(1);
    const result = results[0];
    expect(result.score).toBe(false);
    expect(result.reasoning).toContain('No ground truth provided for comparison.');
    expect(result.error).toContain('Missing groundTruth in EvaluationInput.');
    expect(mockEmbed).toHaveBeenCalledTimes(0);
  });

  it('should return error if response is undefined (as per accuracy.ts logic)', async () => {
    const inputUndefined = createTestInput('', 'Some groundTruth');
    const results = await evaluator.evaluate(inputUndefined, inputUndefined.criteria!);
    expect(results.length).toBe(1);
    const result = results[0];
    expect(result.score).toBe(false);
    expect(result.reasoning).toContain('No agent response provided.');
    expect(result.error).toContain('Missing agent response in EvaluationInput.');
    expect(mockEmbed).toHaveBeenCalledTimes(0);
  });

  it('should return error if response is null (as per accuracy.ts logic)', async () => {
    const inputNull = createTestInput('', 'Some groundTruth');
    const results = await evaluator.evaluate(inputNull, inputNull.criteria!);
    expect(results.length).toBe(1);
    const result = results[0];
    expect(result.score).toBe(false);
    expect(result.reasoning).toContain('No agent response provided.');
    expect(result.error).toContain('Missing agent response in EvaluationInput.');
    expect(mockEmbed).toHaveBeenCalledTimes(0);
  });
}); 